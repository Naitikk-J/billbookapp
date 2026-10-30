import { Markup, type Context, type Telegraf } from 'telegraf';
import type { Company } from '@/lib/types';
import { findOrCreateCustomer, getCompany, createInvoice } from './api/safarmate.js';
import { buildNewInvoiceBody } from './buildInvoicePayload.js';
import { invoiceForPdf } from './invoiceForPdf.js';
import { renderInvoicePdf } from './renderPdf.js';
import { sendPdfToChat } from './sendPdf.js';
import {
  getSession,
  resetSession,
  type BillLine,
  type NewBillDraft,
  type NewBillStep,
} from './session.js';
import { BOT_TEMPLATES, templateById } from './templates.js';
import { mainMenu } from './menu.js';
import { blankDraft, defaultHsn, nextLinear, PROMPTS, summaryText, tailSteps } from './billCopy.js';

export function skipped(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === '-' || t === 'skip' || t === 'nahi' || t === 'no';
}

export function parseAmount(text: string): number | null {
  const n = Number(text.replace(/[,₹\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseDate(text: string): string | null {
  const t = text.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  const parts = iso
    ? { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }
    : dmy
      ? { y: Number(dmy[3]), m: Number(dmy[2]), d: Number(dmy[1]) }
      : null;
  if (!parts) return null;
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

async function ask(ctx: Context, step: NewBillStep, draft: Partial<NewBillDraft>) {
  if (step === 'kind') {
    await ctx.reply(
      'Document type?',
      Markup.inlineKeyboard([
        [Markup.button.callback('Invoice', 'kind:invoice'), Markup.button.callback('Quote', 'kind:quote')],
        [Markup.button.callback('Proforma', 'kind:proforma'), Markup.button.callback('Receipt', 'kind:receipt')],
      ])
    );
    return;
  }
  if (step === 'tax_mode') {
    await ctx.reply(
      'Tax mode?',
      Markup.inlineKeyboard([
        [Markup.button.callback('CGST+SGST (intra)', 'tax:intra')],
        [Markup.button.callback('IGST (inter)', 'tax:inter'), Markup.button.callback('No tax', 'tax:none')],
      ])
    );
    return;
  }
  if (step === 'booking_type') {
    await ctx.reply(
      'Booking type?',
      Markup.inlineKeyboard([
        [Markup.button.callback('Hotel', 'book:hotel'), Markup.button.callback('Flight', 'book:flight')],
      ])
    );
    return;
  }
  if (step === 'more_items') {
    const n = draft.items?.length ?? 0;
    await ctx.reply(
      `Line ${n} saved. Add another line?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Yes, another line', 'more:yes'), Markup.button.callback('No, continue', 'more:no')],
      ])
    );
    return;
  }
  if (step === 'confirm') {
    await confirmNewBill(ctx, draft as NewBillDraft);
    return;
  }
  if (step === 'item_desc') {
    const n = (draft.items?.length ?? 0) + 1;
    await ctx.reply(n === 1 ? PROMPTS.item_desc : `Line ${n} — description?`);
    return;
  }
  const prompt = PROMPTS[step];
  if (prompt) await ctx.reply(prompt);
}

async function go(ctx: Context, step: NewBillStep) {
  const session = getSession(ctx.chat!.id);
  session.step = step;
  await ask(ctx, step, session.newBill ?? {});
}

function pushScratch(draft: Partial<NewBillDraft>) {
  const s = draft.scratch ?? {};
  const line: BillLine = {
    description: (s.description ?? '').trim() || 'Service',
    hsnCode: s.hsnCode ?? defaultHsn(draft.templateId ?? ''),
    quantity: s.quantity && s.quantity > 0 ? s.quantity : 1,
    unit: s.unit || 'pax',
    rate: s.rate ?? 0,
    taxPercent: s.taxPercent ?? (draft.taxMode === 'none' ? 0 : 18),
    discountPercent: s.discountPercent ?? 0,
  };
  draft.items = [...(draft.items ?? []), line];
  draft.scratch = {};
  if (!draft.description) draft.description = line.description;
  if (!draft.amount) draft.amount = line.rate * line.quantity;
}

async function confirmNewBill(ctx: Context, draft: NewBillDraft) {
  getSession(ctx.chat!.id).step = 'confirm';
  await ctx.reply(`${summaryText(draft)}\n\nReply yes to save and send PDF, or no to cancel.`);
}

async function finalizeNewBill(ctx: Context, draft: NewBillDraft) {
  const chatId = ctx.chat!.id;
  const statusMsg = await ctx.reply('Creating bill…');
  let savedLabel = '';
  try {
    const email = draft.customerEmail.includes('@') ? draft.customerEmail : '';
    const { customer, created } = await findOrCreateCustomer({
      name: draft.customerName,
      phone: draft.customerPhone,
      email,
      city: draft.customerCity,
      gstNumber: draft.customerGst,
    });
    const body = buildNewInvoiceBody(draft, customer._id);
    const invoice = await createInvoice(body);
    savedLabel = String(invoice.number ?? invoice._id ?? '');
    await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, 'Generating PDF…').catch(() => {});
    const company = await getCompany();
    const pdf = await renderInvoicePdf(invoiceForPdf(invoice), company as unknown as Company);
    await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, 'Uploading PDF…').catch(() => {});
    await sendPdfToChat(
      ctx,
      pdf,
      `safarmate-${invoice.number || invoice._id}.pdf`,
      `✅ ${draft.templateName}\n${invoice.number ?? ''}\n${created ? 'New customer' : 'Existing customer'} · saved in Safarmate.`
    );
    await ctx.telegram.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    resetSession(chatId);
    await ctx.reply('Done.', mainMenu());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (savedLabel) {
      await ctx.reply(`Bill ${savedLabel} is saved.\nPDF upload failed:\n${msg.slice(0, 350)}`, mainMenu());
      resetSession(chatId);
    } else {
      await ctx.reply(`Failed: ${msg.slice(0, 400)}`);
    }
  }
}

function setTextField(draft: Partial<NewBillDraft>, step: NewBillStep, text: string) {
  const skip = skipped(text);
  const value = skip ? '' : text.trim();
  switch (step) {
    case 'customer_phone':
      draft.customerPhone = value;
      break;
    case 'customer_email':
      draft.customerEmail = value;
      break;
    case 'customer_city':
      draft.customerCity = value;
      break;
    case 'customer_gst':
      draft.customerGst = value.toUpperCase();
      break;
    case 'booking_id':
      draft.bookingId = value;
      break;
    case 'voucher_no':
      draft.voucherNo = value;
      break;
    case 'flight':
      draft.flight = value;
      break;
    case 'hotel':
      draft.hotel = value;
      break;
    case 'hotel_city':
      draft.hotelCity = value;
      break;
    case 'destination':
      draft.destination = value;
      break;
    case 'package_name':
      draft.packageName = value;
      break;
    case 'vehicle':
      draft.vehicle = value;
      break;
    case 'place_of_supply':
      draft.placeOfSupply = value;
      break;
    case 'service_desc':
      draft.serviceDescription = value;
      break;
    case 'traveller_name':
      draft.travellerName = value || draft.customerName || '';
      break;
    case 'traveller_pan':
      draft.travellerPan = value.toUpperCase();
      break;
    case 'pan_holder':
      draft.panHolderName = value;
      break;
    case 'txn_category':
      draft.txnCategory = value;
      break;
    case 'txn_details':
      draft.txnDetails = value || 'RG';
      break;
    case 'notes':
      draft.notes = value;
      break;
    case 'terms':
      draft.terms = value;
      break;
    default:
      break;
  }
}

const TEXT_STEPS = new Set<NewBillStep>([
  'customer_phone',
  'customer_email',
  'customer_city',
  'customer_gst',
  'booking_id',
  'voucher_no',
  'flight',
  'hotel',
  'hotel_city',
  'destination',
  'package_name',
  'vehicle',
  'place_of_supply',
  'service_desc',
  'traveller_name',
  'traveller_pan',
  'pan_holder',
  'txn_category',
  'txn_details',
  'notes',
  'terms',
]);

export async function handleNewBillText(ctx: Context, step: NewBillStep, text: string) {
  const session = getSession(ctx.chat!.id);
  const draft = session.newBill ?? {};
  session.newBill = draft;

  if (step === 'customer_name') {
    draft.customerName = text.trim();
    await go(ctx, 'customer_phone');
    return;
  }

  if (step === 'kind') {
    const t = text.toLowerCase();
    if (t !== 'invoice' && t !== 'quote' && t !== 'proforma' && t !== 'receipt') {
      await ctx.reply('Reply invoice, quote, proforma, or receipt.');
      return;
    }
    draft.kind = t;
    await go(ctx, 'customer_name');
    return;
  }

  if (step === 'tax_mode') {
    const t = text.toLowerCase();
    if (t !== 'intra' && t !== 'inter' && t !== 'none') {
      await ctx.reply('Reply intra, inter, or none.');
      return;
    }
    draft.taxMode = t;
    await go(ctx, 'issue_date');
    return;
  }

  if (step === 'booking_type') {
    const t = text.toLowerCase();
    if (t !== 'hotel' && t !== 'flight') {
      await ctx.reply('Reply hotel or flight.');
      return;
    }
    draft.bookingType = t;
    await go(ctx, 'booking_id');
    return;
  }

  if (step === 'issue_date' || step === 'due_date' || step === 'start_date' || step === 'end_date') {
    if (!skipped(text)) {
      const iso = parseDate(text);
      if (!iso) {
        await ctx.reply('Use DD/MM/YYYY, or - to skip.');
        return;
      }
      if (step === 'issue_date') draft.issueDate = iso;
      if (step === 'due_date') draft.dueDate = iso;
      if (step === 'start_date') draft.startDate = iso;
      if (step === 'end_date') draft.endDate = iso;
    }
    await go(ctx, nextLinear(draft, step));
    return;
  }

  if (step === 'adults' || step === 'children') {
    if (!skipped(text)) {
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0) {
        await ctx.reply('Enter a number, or -.');
        return;
      }
      if (step === 'adults') draft.adults = Math.floor(n);
      else draft.children = Math.floor(n);
    }
    await go(ctx, nextLinear(draft, step));
    return;
  }

  if (step === 'item_desc') {
    draft.scratch = { description: text.trim() };
    await go(ctx, 'item_hsn');
    return;
  }
  if (step === 'item_hsn') {
    draft.scratch = {
      ...draft.scratch,
      hsnCode: skipped(text) ? defaultHsn(draft.templateId ?? '') : text.trim(),
    };
    await go(ctx, 'item_qty');
    return;
  }
  if (step === 'item_qty') {
    const n = skipped(text) ? 1 : Number(text);
    if (!Number.isFinite(n) || n <= 0) {
      await ctx.reply('Enter a quantity greater than 0.');
      return;
    }
    draft.scratch = { ...draft.scratch, quantity: n };
    await go(ctx, 'item_unit');
    return;
  }
  if (step === 'item_unit') {
    draft.scratch = { ...draft.scratch, unit: skipped(text) ? 'pax' : text.trim() };
    await go(ctx, 'item_rate');
    return;
  }
  if (step === 'item_rate') {
    const n = parseAmount(text);
    if (n == null) {
      await ctx.reply('Enter the rate in INR.');
      return;
    }
    draft.scratch = { ...draft.scratch, rate: n };
    await go(ctx, 'item_tax');
    return;
  }
  if (step === 'item_tax') {
    const n = skipped(text) ? (draft.taxMode === 'none' ? 0 : 18) : Number(text);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      await ctx.reply('Tax % between 0 and 100.');
      return;
    }
    draft.scratch = { ...draft.scratch, taxPercent: n };
    await go(ctx, 'item_discount');
    return;
  }
  if (step === 'item_discount') {
    const n = skipped(text) ? 0 : Number(text);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      await ctx.reply('Discount % between 0 and 100.');
      return;
    }
    draft.scratch = { ...draft.scratch, discountPercent: n };
    pushScratch(draft);
    await go(ctx, 'more_items');
    return;
  }
  if (step === 'more_items') {
    if (/^(y|yes|haan|ha|add)$/i.test(text)) {
      await go(ctx, 'item_desc');
      return;
    }
    if (/^(n|no|nahi|done|continue)$/i.test(text)) {
      await go(ctx, tailSteps(draft)[0] ?? 'notes');
      return;
    }
    await ctx.reply('Reply yes to add a line, or no to continue.');
    return;
  }

  if (TEXT_STEPS.has(step)) {
    setTextField(draft, step, text);
    await go(ctx, nextLinear(draft, step));
    return;
  }

  if (step === 'confirm') {
    if (/^(yes|y|ha|haan|ok|confirm)$/i.test(text)) {
      await finalizeNewBill(ctx, draft as NewBillDraft);
    } else if (/^(no|n|nahi|cancel)$/i.test(text)) {
      resetSession(ctx.chat!.id);
      await ctx.reply('Cancelled.', mainMenu());
    } else {
      await ctx.reply('Reply yes to create the PDF, or no to cancel.');
    }
  }
}

export function registerNewBillActions(bot: Telegraf<Context>) {
  bot.action(/^tpl:(.+)$/, async (ctx) => {
    const templateId = ctx.match[1] ?? '';
    const meta = templateById(templateId);
    if (!meta) {
      await ctx.answerCbQuery('Unknown template');
      return;
    }
    const session = getSession(ctx.chat!.id);
    if (session.flow !== 'new_bill') {
      await ctx.answerCbQuery('Start with New bill');
      return;
    }
    session.newBill = blankDraft(meta.id, meta.name, meta.category === 'flight' ? 'flight' : 'hotel');
    session.step = 'kind';
    await ctx.answerCbQuery(meta.name);
    await ctx.editMessageText(`Template: ${meta.name}`);
    await ask(ctx, 'kind', session.newBill);
  });

  bot.action(/^kind:(invoice|quote|proforma|receipt)$/, async (ctx) => {
    const session = getSession(ctx.chat!.id);
    if (!session.newBill) return ctx.answerCbQuery();
    session.newBill.kind = ctx.match[1] as NewBillDraft['kind'];
    session.step = 'customer_name';
    await ctx.answerCbQuery();
    await ctx.reply('Customer name? (same name reuses the existing customer so the ledger stays together)');
  });

  bot.action(/^tax:(intra|inter|none)$/, async (ctx) => {
    const session = getSession(ctx.chat!.id);
    if (!session.newBill) return ctx.answerCbQuery();
    session.newBill.taxMode = ctx.match[1] as NewBillDraft['taxMode'];
    await ctx.answerCbQuery();
    await go(ctx, 'issue_date');
  });

  bot.action(/^book:(hotel|flight)$/, async (ctx) => {
    const session = getSession(ctx.chat!.id);
    if (!session.newBill) return ctx.answerCbQuery();
    session.newBill.bookingType = ctx.match[1] as 'hotel' | 'flight';
    await ctx.answerCbQuery();
    await go(ctx, 'booking_id');
  });

  bot.action('more:yes', async (ctx) => {
    await ctx.answerCbQuery();
    await go(ctx, 'item_desc');
  });

  bot.action('more:no', async (ctx) => {
    const draft = getSession(ctx.chat!.id).newBill ?? {};
    await ctx.answerCbQuery();
    await go(ctx, tailSteps(draft)[0] ?? 'notes');
  });
}

export function templateKeyboard() {
  const rows = BOT_TEMPLATES.map((t) => [Markup.button.callback(t.name, `tpl:${t.id}`)]);
  rows.push([Markup.button.callback('« Back', 'cancel')]);
  return Markup.inlineKeyboard(rows);
}
