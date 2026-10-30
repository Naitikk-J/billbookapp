import { Telegraf, Markup, type Context } from 'telegraf';
import type { Company, Invoice } from '@/lib/types';
import { config, isChatAllowed } from './config.js';
import {
  createCustomer,
  createInvoice,
  getCompany,
  getInvoice,
  parseFlightPdf,
} from './api/safarmate.js';
import { buildNewInvoiceBody } from './buildInvoicePayload.js';
import { renderInvoicePdf } from './renderPdf.js';
import {
  getSession,
  resetSession,
  type NewBillDraft,
  type NewBillStep,
} from './session.js';
import { BOT_TEMPLATES, needsTravelFields, templateById } from './templates.js';

const bot = new Telegraf(config.botToken);

function mainMenu() {
  return Markup.keyboard([
    ['🆕 New Safarmate bill', '📄 Existing ticket PDF'],
    ['❌ Cancel / Menu'],
  ]).resize();
}

function templateKeyboard() {
  const rows = BOT_TEMPLATES.map((t) => [Markup.button.callback(t.name, `tpl:${t.id}`)]);
  rows.push([Markup.button.callback('« Back', 'cancel')]);
  return Markup.inlineKeyboard(rows);
}

function nextStepAfterAmount(templateId: string): NewBillStep {
  if (!needsTravelFields(templateId)) return 'confirm';
  return 'booking_type';
}

function summaryText(draft: NewBillDraft): string {
  const lines = [
    `Template: ${draft.templateName}`,
    `Customer: ${draft.customerName}`,
    draft.customerPhone ? `Phone: ${draft.customerPhone}` : '',
    `Description: ${draft.description}`,
    `Amount: ₹${draft.amount.toLocaleString('en-IN')}`,
  ];
  if (needsTravelFields(draft.templateId)) {
    lines.push(`Booking: ${draft.bookingType}`);
    if (draft.bookingId) lines.push(`Booking ID / PNR: ${draft.bookingId}`);
    if (draft.destination) lines.push(`Destination: ${draft.destination}`);
  }
  return lines.filter(Boolean).join('\n');
}

bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  if (!isChatAllowed(chatId)) {
    await ctx.reply('This bot is private. Ask admin to add your Telegram user ID.');
    return;
  }
  return next();
});

bot.start(async (ctx) => {
  resetSession(ctx.chat!.id);
  await ctx.reply(
    'Safarmate Bill Bot\n\n' +
      '🆕 *New bill* — step-by-step (template, customer, amount…)\n' +
      '📄 *Existing ticket* — send airline/agency PDF → Safarmate bill PDF in this chat\n',
    { parse_mode: 'Markdown', ...mainMenu() }
  );
});

bot.hears('❌ Cancel / Menu', async (ctx) => {
  resetSession(ctx.chat!.id);
  await ctx.reply('Menu cleared.', mainMenu());
});

bot.hears('🆕 New Safarmate bill', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  session.flow = 'new_bill';
  session.step = 'template';
  session.newBill = {};
  await ctx.reply('Choose invoice template:', templateKeyboard());
});

bot.hears('📄 Existing ticket PDF', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  session.flow = 'existing_bill';
  await ctx.reply(
    'Send the *airline e-ticket*, *IndiGo itinerary*, or *Safarmate voucher* PDF as a document (not photo).\n\n' +
      'I will parse it and reply with your Safarmate flight voucher PDF.',
    { parse_mode: 'Markdown', ...mainMenu() }
  );
});

bot.action(/^tpl:(.+)$/, async (ctx) => {
  const templateId = ctx.match[1];
  const meta = templateById(templateId);
  if (!meta) {
    await ctx.answerCbQuery('Unknown template');
    return;
  }
  const session = getSession(ctx.chat!.id);
  if (session.flow !== 'new_bill') {
    await ctx.answerCbQuery('Start with New Safarmate bill first');
    return;
  }
  session.newBill = {
    ...session.newBill,
    templateId: meta.id,
    templateName: meta.name,
    bookingType: meta.category === 'flight' ? 'flight' : 'hotel',
  };
  session.step = 'customer_name';
  await ctx.answerCbQuery(meta.name);
  await ctx.editMessageText(`Template: *${meta.name}*\n\nCustomer name?`, { parse_mode: 'Markdown' });
});

bot.action('cancel', async (ctx) => {
  resetSession(ctx.chat!.id);
  await ctx.answerCbQuery('Cancelled');
  await ctx.editMessageText('Cancelled. Use the keyboard menu when ready.');
});

bot.on('text', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  const text = ctx.message.text.trim();
  if (text.startsWith('🆕') || text.startsWith('📄') || text.startsWith('❌')) return;

  if (session.flow === 'new_bill' && session.step && session.newBill) {
    await handleNewBillStep(ctx as Context, session.step, text);
    return;
  }

  if (session.flow === 'existing_bill') {
    await ctx.reply('Please send a PDF *document* file.', { parse_mode: 'Markdown' });
  }
});

async function handleNewBillStep(ctx: Context, step: NewBillStep, text: string) {
  const id = ctx.chat!.id;
  const session = getSession(id);
  const draft = session.newBill!;

  switch (step) {
    case 'customer_name':
      draft.customerName = text;
      session.step = 'customer_phone';
      await ctx.reply('Customer phone? (send - to skip)');
      break;
    case 'customer_phone':
      draft.customerPhone = text === '-' ? '' : text;
      session.step = 'description';
      await ctx.reply('Bill line description? (e.g. Delhi–Singapore flight package)');
      break;
    case 'description':
      draft.description = text;
      session.step = 'amount';
      await ctx.reply('Total amount in INR? (numbers only, e.g. 91832)');
      break;
    case 'amount': {
      const amount = Number(text.replace(/[,₹\s]/g, ''));
      if (!Number.isFinite(amount) || amount < 0) {
        await ctx.reply('Enter a valid amount.');
        return;
      }
      draft.amount = amount;
      const next = nextStepAfterAmount(draft.templateId!);
      session.step = next;
      if (next === 'booking_type') {
        await ctx.reply('Booking type? Reply *hotel* or *flight*', { parse_mode: 'Markdown' });
      } else {
        await confirmNewBill(ctx, id, draft as NewBillDraft);
      }
      break;
    }
    case 'booking_type': {
      const t = text.toLowerCase();
      if (t !== 'hotel' && t !== 'flight') {
        await ctx.reply('Reply hotel or flight.');
        return;
      }
      draft.bookingType = t;
      session.step = 'booking_id';
      await ctx.reply('Booking ID / PNR? (or - to skip)');
      break;
    }
    case 'booking_id':
      draft.bookingId = text === '-' ? '' : text;
      session.step = 'destination';
      await ctx.reply('Destination / sector summary? (e.g. Delhi to Singapore, or - to skip)');
      break;
    case 'destination':
      draft.destination = text === '-' ? '' : text;
      session.step = 'confirm';
      await confirmNewBill(ctx, id, draft as NewBillDraft);
      break;
    case 'confirm':
      if (/^(yes|y|ha|haan|ok|confirm)$/i.test(text)) {
        await finalizeNewBill(ctx, id, draft as NewBillDraft);
      } else if (/^(no|n|nahi|cancel)$/i.test(text)) {
        resetSession(id);
        await ctx.reply('Cancelled.', mainMenu());
      } else {
        await ctx.reply('Reply *yes* to create & send PDF, or *no* to cancel.', { parse_mode: 'Markdown' });
      }
      break;
    default:
      break;
  }
}

async function confirmNewBill(ctx: Context, chatId: number, draft: NewBillDraft) {
  getSession(chatId).step = 'confirm';
  await ctx.reply(`Review:\n\n${summaryText(draft)}\n\nReply *yes* to generate PDF, or *no* to cancel.`, {
    parse_mode: 'Markdown',
  });
}

async function finalizeNewBill(ctx: Context, chatId: number, draft: NewBillDraft) {
  await ctx.reply('Creating bill…');
  try {
    const customer = await createCustomer({
      name: draft.customerName,
      phone: draft.customerPhone,
    });
    const body = buildNewInvoiceBody(draft, customer._id);
    const created = await createInvoice(body);
    const [company, invoice] = await Promise.all([getCompany(), getInvoice(created._id)]);
    const pdf = await renderInvoicePdf(invoice as unknown as Invoice, company as unknown as Company);
    await ctx.replyWithDocument(
      { source: pdf, filename: `safarmate-${invoice.number || created._id}.pdf` },
      { caption: `✅ ${draft.templateName}\n${invoice.number ?? ''}` }
    );
    resetSession(chatId);
    await ctx.reply('Done. Menu:', mainMenu());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Failed: ${msg.slice(0, 400)}`);
  }
}

bot.on('document', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  if (session.flow !== 'existing_bill') {
    await ctx.reply('Choose *Existing ticket PDF* from the menu first.', { parse_mode: 'Markdown', ...mainMenu() });
    return;
  }

  const doc = ctx.message.document;
  const name = doc.file_name ?? 'ticket.pdf';
  if (!name.toLowerCase().endsWith('.pdf') && doc.mime_type !== 'application/pdf') {
    await ctx.reply('Please send a PDF file.');
    return;
  }

  await ctx.reply('Reading ticket PDF…');
  try {
    const file = await ctx.telegram.getFile(doc.file_id);
    if (!file.file_path) throw new Error('Could not download file from Telegram');
    const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Telegram file download failed');
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString('base64');

    const { draft, extraction } = await parseFlightPdf(base64, name);
    const hint = (draft.customerHint as { name?: string; phone?: string; email?: string; city?: string }) ?? {};
    const customer = await createCustomer({
      name: (hint.name ?? '').trim() || 'Flight customer',
      phone: hint.phone,
      email: hint.email,
      city: hint.city,
    });

    const travel = (draft.travelDetails ?? {}) as Record<string, unknown>;
    const segments = draft.segments as unknown[] | undefined;
    const created = await createInvoice({
      kind: draft.kind ?? 'invoice',
      customerId: customer._id,
      currency: draft.currency ?? 'INR',
      template: draft.template ?? 'safarmate-flight-voucher',
      taxMode: draft.taxMode ?? 'none',
      issueDate: new Date().toISOString(),
      notes: draft.notes ?? '',
      items: draft.items ?? [],
      travelDetails: {
        ...travel,
        flightSegments: segments ?? travel.flightSegments,
      },
    });

    const [company, invoice] = await Promise.all([getCompany(), getInvoice(created._id)]);
    const pdf = await renderInvoicePdf(invoice as unknown as Invoice, company as unknown as Company);
    const fmt = extraction?.format?.replace(/_/g, ' ') ?? 'PDF';
    await ctx.replyWithDocument(
      { source: pdf, filename: `safarmate-voucher-${travel.bookingId ?? created._id}.pdf` },
      { caption: `✅ Safarmate bill from ${fmt}\n${invoice.number ?? ''}` }
    );
    resetSession(ctx.chat!.id);
    await ctx.reply('Sent in chat. Need another?', mainMenu());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Could not process PDF:\n${msg.slice(0, 500)}`, mainMenu());
    resetSession(ctx.chat!.id);
  }
});

bot.catch((err) => {
  console.error('[telegram-bot]', err);
});

console.log('[telegram-bot] starting…');
bot.launch().then(() => console.log('[telegram-bot] polling'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
