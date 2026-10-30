import type { Context } from 'telegraf';
import type { Company, Invoice } from '@/lib/types';
import { config } from './config.js';
import { fetchWithRetry } from './http.js';
import { saveFlightDraft, getCompany } from './api/safarmate.js';
import { invoiceForPdf } from './invoiceForPdf.js';
import { parseFlightPdfLocal } from './parseFlightPdfLocal.js';
import { renderInvoicePdf } from './renderPdf.js';
import { sendPdfToChat } from './sendPdf.js';
import type { FlightInvoiceDraft } from '../../server/src/utils/flightInvoiceDraft.js';
import {
  mergeFlightDrafts,
  passengerNameFromDraft,
  pnrFromDraft,
} from './mergeFlightDrafts.js';

export async function downloadTelegramPdf(
  ctx: Context,
  fileId: string,
  preferredName?: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const file = await ctx.telegram.getFile(fileId);
  if (!file.file_path) throw new Error('Could not download file from Telegram');
  const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
  const res = await fetchWithRetry(url, {}, { timeoutMs: 90_000 });
  if (!res.ok) throw new Error('Telegram file download failed');
  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName =
    clean(preferredName) || file.file_path.split('/').pop() || 'ticket.pdf';
  return { buffer, fileName };
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

export async function finalizeExistingTicketDraft(
  ctx: Context,
  draft: FlightInvoiceDraft,
  extractionFormat: string
): Promise<void> {
  const statusMsg = await ctx.reply('Saving bill in Safarmate…');
  let savedInvoiceLabel = '';
  try {
    const company = await getCompany();
    const invoice = await saveFlightDraft(draft as unknown as Record<string, unknown>);
    const travel = (draft.travelDetails ?? {}) as Record<string, unknown>;
    const invLabel = String(invoice.number ?? invoice._id ?? '');
    savedInvoiceLabel = invLabel;

    await ctx.telegram
      .editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, 'Generating PDF…')
      .catch(() => {});

    const draftBarcodes = Array.isArray(travel.barcodeSnapshots)
      ? (travel.barcodeSnapshots as string[]).filter(Boolean)
      : [];

    const pdf = await renderInvoicePdf(
      invoiceForPdf(invoice, { barcodeSnapshots: draftBarcodes }),
      company as unknown as Company
    );

    await ctx.telegram
      .editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, 'Uploading PDF to chat…')
      .catch(() => {});

    const fmt = extractionFormat.replace(/_/g, ' ') || 'PDF';
    const filename = `safarmate-voucher-${travel.bookingId ?? invoice._id}.pdf`;
    const paxNote =
      passengerNameFromDraft(draft).includes('&') || (draft.segments ?? []).length
        ? `\nPassengers: ${passengerNameFromDraft(draft).split(/\s*&\s*/).join(', ')}`
        : '';

    await sendPdfToChat(
      ctx,
      pdf,
      filename,
      `✅ Safarmate bill from ${fmt}\n${invLabel}\nPNR ${pnrFromDraft(draft) || '—'}${paxNote}\n${draftBarcodes.length > 0 ? `${draftBarcodes.length} barcode(s) from ticket PDF(s).\n` : ''}Saved — check Invoices in app.`
    );

    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (savedInvoiceLabel) {
      await ctx.reply(
        `Bill ${savedInvoiceLabel} is saved in Safarmate — check Invoices in the app.\n\nPDF could not be sent:\n${msg.slice(0, 350)}`
      );
    } else {
      throw err;
    }
  }
}

export async function mergeAndSendGroupTickets(
  ctx: Context,
  drafts: FlightInvoiceDraft[],
  formats: string[]
): Promise<void> {
  const merged = mergeFlightDrafts(drafts);
  const fmt =
    formats.length === 1
      ? formats[0]!
      : `merged (${formats.map((f) => f.replace(/_/g, ' ')).join(', ')})`;
  await finalizeExistingTicketDraft(ctx, merged, fmt);
}
