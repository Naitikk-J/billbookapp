import { Telegraf, Markup, type Context } from 'telegraf';
import type { Company, Invoice } from '@/lib/types';
import { config, isChatAllowed } from './config.js';
import { createCustomer, createInvoice, getCompany } from './api/safarmate.js';
import { bootstrapBot } from './bootstrap.js';
import { buildNewInvoiceBody } from './buildInvoicePayload.js';
import { invoiceForPdf } from './invoiceForPdf.js';
import { renderInvoicePdf } from './renderPdf.js';
import { sendPdfToChat } from './sendPdf.js';
import { parseFlightPdfLocal } from './parseFlightPdfLocal.js';
import {
  downloadTelegramPdf,
  finalizeExistingTicketDraft,
  mergeAndSendGroupTickets,
} from './existingTicketPdf.js';
import {
  getSession,
  resetSession,
  type NewBillDraft,
  type NewBillStep,
} from './session.js';
import { passengerNameFromDraft, pnrFromDraft } from './mergeFlightDrafts.js';
import type { FlightInvoiceDraft } from '../../server/src/utils/flightInvoiceDraft.js';
import { BOT_TEMPLATES, needsTravelFields, templateById } from './templates.js';

const bot = new Telegraf(config.botToken, { handlerTimeout: 300_000 });

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
  const userId = ctx.from?.id;
  if (!userId) return;
  if (!isChatAllowed(userId, ctx.from?.username)) {
    const un = ctx.from?.username ? `@${ctx.from.username}` : '(no username)';
    await ctx.reply(
      `This bot is private. Ask admin to allow your account.\n\nYour Telegram user ID: ${userId}\nUsername: ${un}`
    );
    console.warn('[telegram-bot] blocked user', userId, ctx.from?.username);
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

function existingTicketModeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('1 ticket — 1 PDF', 'existing:single')],
    [Markup.button.callback('Same PNR — several PDFs (group)', 'existing:group')],
    [Markup.button.callback('« Cancel', 'cancel')],
  ]);
}

function groupTicketDoneKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Done — one combined voucher', 'existing:group_done')],
  ]);
}

bot.hears('📄 Existing ticket PDF', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  session.flow = 'existing_bill';
  session.existingBillMode = undefined;
  session.groupTickets = undefined;
  session.groupPnr = undefined;
  await ctx.reply(
    'How is this booking?\n\n' +
      '• *1 ticket — 1 PDF* — single passenger or one combined airline PDF\n' +
      '• *Same PNR — several PDFs* — upload one e-ticket PDF per passenger (same booking), then tap *Done*',
    { parse_mode: 'Markdown', ...existingTicketModeKeyboard() }
  );
});

bot.action('existing:single', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  session.flow = 'existing_bill';
  session.existingBillMode = 'single';
  session.groupTickets = undefined;
  session.groupPnr = undefined;
  await ctx.answerCbQuery();
  await ctx.reply(
    'Send the airline e-ticket, IndiGo itinerary, or agency PDF as a *document* (not photo).',
    { parse_mode: 'Markdown', ...mainMenu() }
  );
});

bot.action('existing:group', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  session.flow = 'existing_bill';
  session.existingBillMode = 'group_pnr';
  session.groupTickets = [];
  session.groupPnr = undefined;
  await ctx.answerCbQuery();
  await ctx.reply(
    '*Same PNR — group upload*\n\n' +
      '1. Send each passenger’s ticket PDF (one file at a time).\n' +
      '2. I will check that the *PNR / booking reference* matches.\n' +
      '3. When all members are uploaded, tap *Done* — I will make *one* Safarmate voucher with everyone’s names and barcodes.',
    { parse_mode: 'Markdown', ...groupTicketDoneKeyboard() }
  );
});

bot.action('existing:group_done', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  await ctx.answerCbQuery();
  if (session.flow !== 'existing_bill' || session.existingBillMode !== 'group_pnr') {
    await ctx.reply('Start with *Existing ticket PDF* → *Same PNR — several PDFs*.', {
      parse_mode: 'Markdown',
    });
    return;
  }
  const queue = session.groupTickets ?? [];
  if (queue.length === 0) {
    await ctx.reply('No PDFs yet. Send at least one ticket PDF, then tap Done.', groupTicketDoneKeyboard());
    return;
  }
  try {
    await mergeAndSendGroupTickets(
      ctx,
      queue.map((q) => q.draft),
      queue.map((q) => q.extractionFormat)
    );
    resetSession(ctx.chat!.id);
    await ctx.reply(
      `Combined ${queue.length} ticket(s) into one voucher (PNR ${session.groupPnr ?? '—'}). Need another?`,
      mainMenu()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Could not merge:\n${msg.slice(0, 500)}`, groupTicketDoneKeyboard());
  }
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
    if (session.existingBillMode === 'group_pnr') {
      const lower = text.toLowerCase();
      if (lower === 'done' || lower === 'merge') {
        await ctx.reply('Tap *Done — one combined voucher* below.', {
          parse_mode: 'Markdown',
          ...groupTicketDoneKeyboard(),
        });
        return;
      }
    }
    if (!session.existingBillMode) {
      await ctx.reply('Choose 1 PDF or Same PNR group:', existingTicketModeKeyboard());
      return;
    }
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
  const statusMsg = await ctx.reply('Creating bill…');
  let savedLabel = '';
  try {
    const customer = await createCustomer({
      name: draft.customerName,
      phone: draft.customerPhone,
    });
    const body = buildNewInvoiceBody(draft, customer._id);
    const created = await createInvoice(body);
    savedLabel = String(created.number ?? created._id ?? '');
    await ctx.telegram
      .editMessageText(chatId, statusMsg.message_id, undefined, 'Generating PDF…')
      .catch(() => {});
    const company = await getCompany();
    const pdf = await renderInvoicePdf(
      invoiceForPdf(created),
      company as unknown as Company
    );
    await ctx.telegram
      .editMessageText(chatId, statusMsg.message_id, undefined, 'Uploading PDF to chat…')
      .catch(() => {});
    await sendPdfToChat(
      ctx,
      pdf,
      `safarmate-${created.number || created._id}.pdf`,
      `✅ ${draft.templateName}\n${created.number ?? ''}\nSaved in Safarmate.`
    );
    await ctx.telegram.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    resetSession(chatId);
    await ctx.reply('Done. Menu:', mainMenu());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (savedLabel) {
      await ctx.reply(
        `Bill ${savedLabel} saved in Safarmate (Invoices in app).\n\nPDF upload failed:\n${msg.slice(0, 350)}`,
        mainMenu()
      );
      resetSession(chatId);
    } else {
      await ctx.reply(`Failed: ${msg.slice(0, 400)}`, mainMenu());
    }
  }
}

bot.on('document', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  if (session.flow !== 'existing_bill') {
    await ctx.reply('Choose *Existing ticket PDF* from the menu first.', { parse_mode: 'Markdown', ...mainMenu() });
    return;
  }

  if (!session.existingBillMode) {
    await ctx.reply('First choose *1 PDF* or *Same PNR group*:', existingTicketModeKeyboard());
    return;
  }

  const doc = ctx.message.document;
  const name = doc.file_name ?? 'ticket.pdf';
  if (!name.toLowerCase().endsWith('.pdf') && doc.mime_type !== 'application/pdf') {
    await ctx.reply('Please send a PDF file.');
    return;
  }

  const statusMsg = await ctx.reply('Downloading ticket…');
  try {
    const { buffer } = await downloadTelegramPdf(ctx, doc.file_id, name);

    await ctx.telegram
      .editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, 'Reading ticket (local)…')
      .catch(() => {});

    const { draft, extraction } = await parseFlightPdfLocal(buffer, name);
    const flightDraft = draft as FlightInvoiceDraft;
    const pnr = pnrFromDraft(flightDraft);
    const pax = passengerNameFromDraft(flightDraft);

    if (session.existingBillMode === 'group_pnr') {
      if (!session.groupTickets) session.groupTickets = [];
      if (session.groupPnr && pnr && session.groupPnr !== pnr) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
        await ctx.reply(
          `PNR mismatch.\nThis file: *${pnr}* (${pax})\nExpected: *${session.groupPnr}*\n\nSkip this file or cancel and start again.`,
          { parse_mode: 'Markdown', ...groupTicketDoneKeyboard() }
        );
        return;
      }
      if (pnr) session.groupPnr = pnr;
      session.groupTickets.push({
        fileName: name,
        draft: flightDraft,
        extractionFormat: extraction.format,
        barcodeCount: extraction.barcodeCount,
      });
      await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
      const n = session.groupTickets.length;
      await ctx.reply(
        `Added *${pax}*${pnr ? ` (PNR ${pnr})` : ''} — ${n} PDF${n === 1 ? '' : 's'} queued.\n` +
          (n < 2
            ? 'Send the next passenger PDF, or tap *Done* if this was the only one.'
            : 'Send more PDFs or tap *Done — one combined voucher*.'),
        { parse_mode: 'Markdown', ...groupTicketDoneKeyboard() }
      );
      return;
    }

    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
    await finalizeExistingTicketDraft(ctx, flightDraft, extraction.format);
    resetSession(ctx.chat!.id);
    await ctx.reply('Sent in chat. Need another?', mainMenu());
  } catch (err) {
    console.error('[telegram-bot] PDF flow error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
    if (session.existingBillMode === 'group_pnr') {
      await ctx.reply(`Could not read PDF:\n${msg.slice(0, 500)}`, groupTicketDoneKeyboard());
    } else {
      await ctx.reply(`Could not process PDF:\n${msg.slice(0, 500)}`, mainMenu());
      resetSession(ctx.chat!.id);
    }
  }
});

bot.catch((err) => {
  console.error('[telegram-bot]', err);
});

console.log('[telegram-bot] starting…');
console.log('[telegram-bot] allowed:', config.allowedEntries.join(', ') || '(all users — dev)');
void bootstrapBot();
bot.launch().then(() => console.log('[telegram-bot] polling'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
