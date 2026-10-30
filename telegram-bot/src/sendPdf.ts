import FormData from 'form-data';
import dns from 'node:dns';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import type { Context } from 'telegraf';
import { config } from './config.js';

/** Telegram uploads often fail on IPv6 / chunked multipart from some ISPs. */
const lookupIpv4: LookupFunction = (hostname, options, callback) => {
  dns.lookup(
    hostname,
    { ...(typeof options === 'object' && options ? options : {}), family: 4, hints: dns.ADDRCONFIG },
    callback
  );
};

const UPLOAD_TIMEOUT_MS = 180_000;
const MAX_ATTEMPTS = 4;

function isRetryableUpload(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    msg.includes('socket hang up') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('aborted') ||
    msg.includes('econnrefused')
  );
}

function sendDocumentRaw(
  chatId: number,
  pdf: Buffer,
  filename: string,
  caption: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1024));
    form.append('document', pdf, {
      filename,
      contentType: 'application/pdf',
    });

    const headers = form.getHeaders();

    const req = https.request(
      {
        method: 'POST',
        host: 'api.telegram.org',
        path: `/bot${config.botToken}/sendDocument`,
        headers,
        agent: new https.Agent({ keepAlive: false, lookup: lookupIpv4 }),
        lookup: lookupIpv4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
            return;
          }
          reject(new Error(`Telegram sendDocument ${res.statusCode}: ${body.slice(0, 300)}`));
        });
      }
    );

    req.setTimeout(UPLOAD_TIMEOUT_MS, () => {
      req.destroy(new Error('Telegram PDF upload timed out (3 min)'));
    });
    req.on('error', reject);
    form.on('error', reject);

    form.getLength((err, length) => {
      if (err) {
        reject(err);
        return;
      }
      if (typeof length === 'number') {
        req.setHeader('Content-Length', length);
      }
      form.pipe(req);
    });
  });
}

export async function sendPdfToChat(
  ctx: Context,
  pdf: Buffer,
  filename: string,
  caption: string
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) throw new Error('No chat id');

  const safeName = filename.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'safarmate.pdf';
  console.log(`[telegram-bot] uploading PDF ${pdf.length} bytes as ${safeName}`);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await sendDocumentRaw(chatId, pdf, safeName, caption);
      console.log('[telegram-bot] PDF sent OK');
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`[telegram-bot] sendDocument attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err);
      if (attempt >= MAX_ATTEMPTS || !isRetryableUpload(err)) break;
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
