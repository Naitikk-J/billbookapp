import path from 'node:path';
import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';

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
  /** PNG data URL of the current QR — only present while state === 'qr'. */
  qrDataUrl: string | null;
  /** ISO timestamp the QR was generated (lets the client detect a refresh). */
  qrIssuedAt: string | null;
  /** Human-readable note, e.g. last error or sync info. */
  message: string;
  /** Logged-in WhatsApp account, once ready. */
  account: {
    number: string;
    name: string;
  } | null;
}

const SESSION_DIR =
  process.env.WHATSAPP_SESSION_DIR ?? path.resolve(process.cwd(), '.wwebjs_auth');

class WhatsAppService {
  private client: Client | null = null;
  private status: WhatsAppStatus = {
    state: 'initializing',
    ready: false,
    qrDataUrl: null,
    qrIssuedAt: null,
    message: 'Booting…',
    account: null,
  };

  start(): void {
    if (this.client) return;
    this.client = this.buildClient();
    this.client.initialize().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.status = {
        ...this.status,
        state: 'auth_failure',
        ready: false,
        message: `Failed to initialise: ${message}`,
      };
      console.error('[whatsapp] initialize failed', err);
    });
  }

  getStatus(): WhatsAppStatus {
    return this.status;
  }

  async sendMessage(rawPhone: string, message: string): Promise<{ id: string }> {
    if (!this.client) throw new Error('WhatsApp client not initialised');
    if (this.status.state !== 'ready') {
      throw new Error(`WhatsApp not ready (state=${this.status.state})`);
    }
    const trimmed = (message ?? '').trim();
    if (!trimmed) throw new Error('Message body is empty');
    if (trimmed.length > 4_000) throw new Error('Message body too long (max 4000 chars)');

    const chatId = normalisePhoneToChatId(rawPhone);
    if (!chatId) throw new Error(`Invalid phone number: ${rawPhone}`);

    // Optional sanity check — number must be on WhatsApp.
    try {
      const numberId = await this.client.getNumberId(chatId.replace('@c.us', ''));
      if (!numberId) {
        throw new Error('This number is not on WhatsApp');
      }
    } catch (err) {
      // getNumberId can throw transiently; we still attempt the send below.
      console.warn('[whatsapp] getNumberId check failed (continuing):', err);
    }

    const sent = await this.client.sendMessage(chatId, trimmed);
    return { id: sent.id._serialized };
  }

  async logout(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.logout();
    } catch (err) {
      console.warn('[whatsapp] logout error (continuing):', err);
    }
    try {
      await this.client.destroy();
    } catch {
      // ignore
    }
    this.client = null;
    this.status = {
      state: 'initializing',
      ready: false,
      qrDataUrl: null,
      qrIssuedAt: null,
      message: 'Reconnecting after logout…',
      account: null,
    };
    // Restart so a fresh QR is offered.
    this.start();
  }

  private buildClient(): Client {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'safarmate',
        dataPath: SESSION_DIR,
      }),
      puppeteer: {
        headless: true,
        executablePath,
        // Aggressive memory trimming so WhatsApp Web fits in a 512 MB
        // Render free-tier container. If you upgrade to a bigger plan,
        // dropping --single-process makes crashes less fatal.
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--disable-features=site-per-process,TranslateUI,BlinkGenPropertyTrees',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      },
    });

    client.on('qr', async (qr) => {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
        this.status = {
          ...this.status,
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
    });

    client.on('authenticated', () => {
      this.status = {
        ...this.status,
        state: 'authenticated',
        ready: false,
        qrDataUrl: null,
        qrIssuedAt: null,
        message: 'Authenticated. Syncing…',
      };
    });

    client.on('auth_failure', (msg) => {
      this.status = {
        ...this.status,
        state: 'auth_failure',
        ready: false,
        qrDataUrl: null,
        qrIssuedAt: null,
        message: `Auth failure: ${msg}`,
        account: null,
      };
    });

    client.on('ready', () => {
      const info = client.info;
      this.status = {
        state: 'ready',
        ready: true,
        qrDataUrl: null,
        qrIssuedAt: null,
        message: 'Connected.',
        account: info
          ? {
              number: info.wid?.user ?? '',
              name: info.pushname ?? '',
            }
          : null,
      };
      console.log('[whatsapp] ready as', info?.wid?.user);
    });

    client.on('disconnected', (reason) => {
      this.status = {
        ...this.status,
        state: 'disconnected',
        ready: false,
        qrDataUrl: null,
        qrIssuedAt: null,
        message: `Disconnected: ${reason}`,
        account: null,
      };
      console.warn('[whatsapp] disconnected:', reason);
      // Auto-reinitialise so a fresh QR shows up.
      try {
        this.client?.destroy().catch(() => undefined);
      } catch {
        // ignore
      }
      this.client = null;
      setTimeout(() => this.start(), 2_000);
    });

    return client;
  }
}

export const whatsapp = new WhatsAppService();

/**
 * Normalise a free-form phone number to a WhatsApp chat ID (`<E164>@c.us`).
 * - Strips spaces, dashes, parentheses, leading `+`.
 * - 10-digit numbers are assumed Indian and prefixed with 91.
 * - Numbers starting with `0` get the leading 0 stripped + 91 prefix.
 * - Numbers ≥ 11 digits are assumed to already include country code.
 */
export function normalisePhoneToChatId(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith('91')) {
    // already in E.164 form
  } else if (digits.length === 13 && digits.startsWith('091')) {
    digits = digits.slice(1);
  } else if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  return `${digits}@c.us`;
}
