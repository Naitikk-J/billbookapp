import './reactGlobal.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import type { Company, Invoice } from '@/lib/types';
import { getTemplate } from '@/pdf/registry';
import { config } from './config.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const logoPdf = join(__dir, '../../../client/public/brand/safarmate-logo-pdf.png');
const defaultLogo = existsSync(logoPdf)
  ? logoPdf
  : join(__dir, '../../../client/public/brand/safarmate-logo.png');

export async function renderInvoicePdf(
  invoice: Invoice,
  company: Company | null
): Promise<Buffer> {
  if (existsSync(defaultLogo)) {
    process.env.SAFARMATE_LOGO_FILE = defaultLogo;
  }
  if (config.publicAppUrl) {
    process.env.SAFARMATE_PUBLIC_URL = config.publicAppUrl;
  }
  const template = getTemplate(invoice.template);
  const doc = template.render({ invoice, company });
  const buf = await Promise.race([
    renderToBuffer(doc),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('PDF render timed out (90s)')), 90_000);
    }),
  ]);
  return Buffer.from(buf);
}
