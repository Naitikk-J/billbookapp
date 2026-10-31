import { Telegraf, Markup, type Context } from 'telegraf';
import { config, isChatAllowed } from './config.js';
import { bootstrapBot } from './bootstrap.js';
import { parseFlightPdfLocal } from './parseFlightPdfLocal.js';
import {
  downloadTelegramPdf,
  finalizeExistingTicketDraft,
  mergeAndSendGroupTickets,
} from './existingTicketPdf.js';
import { getSession, resetSession } from './session.js';
import { passengerNameFromDraft, pnrFromDraft } from './mergeFlightDrafts.js';
import type { FlightInvoiceDraft } from '../../server/src/utils/flightInvoiceDraft.js';
import { MENU_PREFIXES, mainMenu } from './menu.js';
import { handleNewBillText, registerNewBillActions, templateKeyboard } from './newBill.js';
import { handleIndigoText, startIndigoTickets } from './indigoTickets.js';
import {
  handlePlatformText,
  registerPlatform,
  showCustomers,
  showFlights,
  showInvoices,
  showLedger,
  showProducts,
  showSummary,
} from './platform.js';

const bot = new Telegraf(config.botToken, { handlerTimeout: 300_000 });

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
      'New bill asks for the same fields as the app (template, customer, tax, every line, booking details).\n' +
      'Ticket PDF still turns an airline PDF into a voucher.\n' +
      'Ledger, invoices, customers, products, and the flight board are on the keyboard.\n' +
      'IndiGo Tickets asks for a PNR and last name, then sends the itinerary PDF.\n' +
      'Send - to skip an optional field. Delete always asks you to confirm.',
    mainMenu()
  );
});

bot.hears('❌ Cancel / Menu', async (ctx) => {
  resetSession(ctx.chat!.id);
  await ctx.reply('Menu cleared.', mainMenu());
});

bot.hears('🆕 New bill', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  session.flow = 'new_bill';
  session.step = 'template';
  session.newBill = {};
  session.pendingDelete = undefined;
  await ctx.reply('Choose a template. All 7 app templates are here.', templateKeyboard());
});

bot.hears('📒 Ledger', async (ctx) => {
  try {
    await showLedger(ctx);
  } catch (err) {
    await ctx.reply(`Ledger failed: ${err instanceof Error ? err.message : err}`.slice(0, 400));
  }
});

bot.hears('🧾 Invoices', async (ctx) => {
  try {
    await showInvoices(ctx);
  } catch (err) {
    await ctx.reply(`Invoices failed: ${err instanceof Error ? err.message : err}`.slice(0, 400));
  }
});

bot.hears('👥 Customers', async (ctx) => {
  try {
    await showCustomers(ctx);
  } catch (err) {
    await ctx.reply(`Customers failed: ${err instanceof Error ? err.message : err}`.slice(0, 400));
  }
});

bot.hears('📦 Products', async (ctx) => {
  try {
    await showProducts(ctx);
  } catch (err) {
    await ctx.reply(`Products failed: ${err instanceof Error ? err.message : err}`.slice(0, 400));
  }
});

bot.hears('✈️ Flights', async (ctx) => {
  try {
    await showFlights(ctx);
  } catch (err) {
    await ctx.reply(`Flights failed: ${err instanceof Error ? err.message : err}`.slice(0, 400));
  }
});

bot.hears('🛫 IndiGo Tickets', async (ctx) => {
  await startIndigoTickets(ctx);
});

bot.hears('📊 Summary', async (ctx) => {
  resetSession(ctx.chat!.id);
  try {
    await showSummary(ctx);
  } catch (err) {
    await ctx.reply(`Summary failed: ${err instanceof Error ? err.message : err}`.slice(0, 400));
  }
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

bot.action('cancel', async (ctx) => {
  resetSession(ctx.chat!.id);
  await ctx.answerCbQuery('Cancelled');
  await ctx.editMessageText('Cancelled. Use the keyboard menu when ready.');
});

bot.on('text', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  const text = ctx.message.text.trim();
  if (MENU_PREFIXES.some((p) => text.startsWith(p))) return;

  if (session.flow === 'new_bill' && session.step && session.newBill) {
    await handleNewBillText(ctx, session.step, text);
    return;
  }

  if (session.flow === 'indigo') {
    await handleIndigoText(ctx, text);
    return;
  }

  if (await handlePlatformText(ctx, text)) return;

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

registerNewBillActions(bot);
registerPlatform(bot);

bot.on('document', async (ctx) => {
  const session = getSession(ctx.chat!.id);
  if (session.flow !== 'existing_bill') {
    await ctx.reply('Choose Ticket PDF from the menu first.', mainMenu());
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
