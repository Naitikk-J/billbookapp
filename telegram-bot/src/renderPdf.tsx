import './reactGlobal.js';
import { renderToBuffer } from '@react-pdf/renderer';
import type { Company, Invoice } from '@/lib/types';
import { getTemplate } from '@/pdf/registry';
import { config } from './config.js';

export async function renderInvoicePdf(
  invoice: Invoice,
  company: Company | null
): Promise<Buffer> {
  if (config.publicAppUrl) {
    process.env.SAFARMATE_PUBLIC_URL = config.publicAppUrl;
  }
  const template = getTemplate(invoice.template);
  const doc = template.render({ invoice, company });
  const buf = await renderToBuffer(doc);
  return Buffer.from(buf);
}
