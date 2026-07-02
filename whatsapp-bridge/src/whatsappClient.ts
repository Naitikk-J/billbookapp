import { Boom } from '@hapi/boom';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { useMongoAuthState, type MongoAuthHandle } from './mongoAuth';

export type WhatsAppState =
  | 'initializing'
  | 'qr'
  | 'authenticated'
  | 'ready'
  | 'disconnected'
  | 'auth_failure';

export interface WhatsAppStatus {
  state: WhatsAppState;
  ready: boolean;
  qrDataUrl: string | null;
  qrIssuedAt: string | null;
  message: string;
  account: { number: string; name: string } | null;
}

const MONGODB_URI = process.env.MONGODB_URI ?? '';
const MONGODB_COLLECTION =
  process.env.WHATSAPP_MONGO_COLLECTION ?? 'whatsapp_session';

class WhatsAppService {
  private sock: WASocket | null = null;
  private auth: MongoAuthHandle | null = null;
  private reconnecting = false;
  private status: WhatsAppStatus = {
    state: 'initializing',
    ready: false,
    qrDataUrl: null,
    qrIssuedAt: null,
    message: 'Booting…',
    account: null,
  };

  /** Kick off the WhatsApp connection. Safe to call multiple times. */
  async start(): Promise<void> {
    if (this.sock) return;

    if (!MONGODB_URI) {
      this.status = {
        ...this.status,
        state: 'auth_failure',
        ready: false,
        message:
          'MONGODB_URI is not set — the bridge needs a Mongo connection to persist the WhatsApp session.',
      };
      console.error('[whatsapp] MONGODB_URI missing — refusing to boot');
      return;
    }

    try {
      if (!this.auth) {
        this.auth = await useMongoAuthState(MONGODB_URI, MONGODB_COLLECTION);
        console.log('[whatsapp] mongo auth store connected');
      }

      const { version, isLatest } = await fetchLatestBaileysVersion().catch(
        () => ({ version: [2, 3000, 1015901307] as [number, number, number], isLatest: false })
      );
      console.log(
        `[whatsapp] using WA Web version ${version.join('.')} (latest=${isLatest})`
      );

      const sock = makeWASocket({
        version,
        auth: this.auth.state,
        logger: pino({ level: 'warn' }) as never,
        printQRInTerminal: false,
        browser: Browsers.appropriate('Safarmate'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });
      this.sock = sock;

      sock.ev.on('creds.update', async () => {
        try {
          await this.auth?.saveCreds();
        } catch (err) {
          console.warn('[whatsapp] creds save failed:', err);
        }
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              width: 320,
              margin: 1,
            });
            this.status = {
              state: 'qr',
              ready: false,
              qrDataUrl,
              qrIssuedAt: new Date().toISOString(),
              message: 'Scan this QR with WhatsApp → Linked devices.',
              account: null,
            };
          } catch (err) {
            console.error('[whatsapp] failed to render QR', err);
          }
        }

        if (connection === 'connecting') {
          if (this.status.state !== 'qr') {
            this.status = {
              ...this.status,
              state: 'initializing',
              ready: false,
              message: 'Connecting to WhatsApp…',
            };
          }
        }

        if (connection === 'open') {
          const me = sock.user;
          const rawId = me?.id ?? '';
          const number = rawId.split('@')[0]?.split(':')[0] ?? '';
          this.status = {
            state: 'ready',
            ready: true,
            qrDataUrl: null,
            qrIssuedAt: null,
            message: 'Connected.',
            account: me ? { number, name: me.name ?? '' } : null,
          };
          console.log('[whatsapp] ready as', rawId);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom | undefined)
            ?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;
          const restartRequired =
            statusCode === DisconnectReason.restartRequired;

          console.warn(
            `[whatsapp] connection closed (statusCode=${statusCode}, loggedOut=${loggedOut})`
          );

          this.sock = null;

          if (loggedOut) {
            // WhatsApp on the phone said "unlink this device" — session is dead.
            // Purge Mongo so the next start() shows a fresh QR.
            try {
              await this.auth?.clear();
            } catch (err) {
              console.warn('[whatsapp] failed to clear session:', err);
            }
            this.auth = null;
            this.status = {
              state: 'auth_failure',
              ready: false,
              qrDataUrl: null,
              qrIssuedAt: null,
              message:
                'Logged out from phone. Re-scan the QR to reconnect.',
              account: null,
            };
          } else {
            this.status = {
              ...this.status,
              state: 'disconnected',
              ready: false,
              qrDataUrl: null,
              qrIssuedAt: null,
              message: restartRequired
                ? 'Restart required — reconnecting…'
                : 'Disconnected — reconnecting…',
              account: null,
            };
          }

          this.scheduleReconnect(loggedOut ? 1_000 : 2_000);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[whatsapp] start failed:', err);
      this.status = {
        ...this.status,
        state: 'auth_failure',
        ready: false,
        message: `Failed to start: ${message}`,
      };
      this.sock = null;
      this.scheduleReconnect(5_000);
    }
  }

  private scheduleReconnect(delayMs: number): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    setTimeout(() => {
      this.reconnecting = false;
      this.start().catch((err) =>
        console.error('[whatsapp] reconnect failed:', err)
      );
    }, delayMs);
  }

  getStatus(): WhatsAppStatus {
    return this.status;
  }

  async sendMessage(
    rawPhone: string,
    message: string
  ): Promise<{ id: string }> {
    if (!this.sock) throw new Error('WhatsApp client not initialised');
    if (this.status.state !== 'ready') {
      throw new Error(`WhatsApp not ready (state=${this.status.state})`);
    }
    const trimmed = (message ?? '').trim();
    if (!trimmed) throw new Error('Message body is empty');
    if (trimmed.length > 4_000) {
      throw new Error('Message body too long (max 4000 chars)');
    }

    const jid = normalisePhoneToJid(rawPhone);
    if (!jid) throw new Error(`Invalid phone number: ${rawPhone}`);

    // onWhatsApp accepts the raw digits (no @s.whatsapp.net).
    const digits = jid.replace('@s.whatsapp.net', '');
    try {
      const results = await this.sock.onWhatsApp(digits);
      const hit = results?.[0];
      if (!hit?.exists) {
        throw new Error('This number is not on WhatsApp');
      }
    } catch (err) {
      // If the network check throws we still try to send — some builds of
      // Baileys occasionally fail onWhatsApp transiently.
      if (err instanceof Error && err.message.includes('not on WhatsApp')) {
        throw err;
      }
      console.warn('[whatsapp] onWhatsApp check failed (continuing):', err);
    }

    const sent = await this.sock.sendMessage(jid, { text: trimmed });
    return { id: sent?.key.id ?? '' };
  }

  /** Force a WhatsApp logout, purge the Mongo session, and re-init from a fresh QR. */
  async logout(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        console.warn('[whatsapp] logout error (continuing):', err);
      }
      this.sock = null;
    }
    if (this.auth) {
      try {
        await this.auth.clear();
      } catch (err) {
        console.warn('[whatsapp] session clear failed (continuing):', err);
      }
      try {
        await this.auth.close();
      } catch {
        /* ignore */
      }
      this.auth = null;
    }
    this.status = {
      state: 'initializing',
      ready: false,
      qrDataUrl: null,
      qrIssuedAt: null,
      message: 'Reconnecting after logout…',
      account: null,
    };
    this.scheduleReconnect(500);
  }
}

export const whatsapp = new WhatsAppService();

/**
 * Normalise a free-form phone number to a Baileys JID (`<E164>@s.whatsapp.net`).
 *   - strips spaces / dashes / parentheses / leading `+`
 *   - 10-digit numbers are assumed Indian and prefixed with 91
 *   - leading `0` gets stripped + 91 prefix
 *   - 11-15 digit numbers are assumed already to include a country code
 */
export function normalisePhoneToJid(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0'))
    digits = `91${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith('91')) {
    // already E.164 India
  } else if (digits.length === 13 && digits.startsWith('091')) {
    digits = digits.slice(1);
  } else if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  return `${digits}@s.whatsapp.net`;
}
