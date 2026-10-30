import { Markup, type Context, type Telegraf } from 'telegraf';
import type { Company } from '@/lib/types';
import {
  addInvoicePayment,
  addLedgerEntry,
  createProduct,
  deleteCustomer,
  deleteFlight,
  deleteInvoice,
  deleteLedgerEntry,
  deleteProduct,
  getCompany,
  getInvoice,
  invoiceStats,
  ledgerDetail,
  ledgerSummary,
  listCustomers,
  listFlights,
  listInvoices,
  listProducts,
  patchFlight,
  type InvoiceListItem,
} from './api/safarmate.js';
import { invoiceForPdf } from './invoiceForPdf.js';
import { renderInvoicePdf } from './renderPdf.js';
import { sendPdfToChat } from './sendPdf.js';
import { inr, mainMenu } from './menu.js';
import { parseAmount, skipped } from './newBill.js';
import { getSession, type PendingDelete } from './session.js';

function askDelete(ctx: Context, pending: PendingDelete) {
  const session = getSession(ctx.chat!.id);
  session.pendingDelete = pending;
  return ctx.reply(
    `Delete ${pending.label}?\nThis cannot be undone.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Yes, delete', 'yesdel'), Markup.button.callback('No', 'nodel')],
    ])
  );
}

async function openLedgerCustomer(ctx: Context, customerId: string) {
  const data = await ledgerDetail(customerId);
  const session = getSession(ctx.chat!.id);
  session.flow = 'ledger';
  session.ledger = { step: 'search', customerId, customerName: data.customer.name };
  const lines = data.entries.slice(0, 6).map((e) => {
    const when = e.date ? new Date(e.date).toLocaleDateString('en-IN') : '';
    return `${when} · ${e.kind} · ${inr(e.amount)} · ${e.method ?? ''} ${e.note ?? ''}`.trim();
  });
  const entryButtons = data.entries.slice(0, 6).map((e) => [
    Markup.button.callback(`Delete ${e.kind} ${inr(e.amount)}`, `dle:${e._id}`),
  ]);
  await ctx.reply(
    [
      data.customer.name,
      `Balance: ${inr(data.totals.balance)} (credit ${inr(data.totals.totalCredit)} − payment ${inr(data.totals.totalPayment)})`,
      lines.length ? lines.join('\n') : 'No entries yet.',
      '',
      'Payment = money received. Credit = amount added to the account.',
    ].join('\n'),
    Markup.inlineKeyboard([
      [
        Markup.button.callback('＋ Payment', `lp:${customerId}`),
        Markup.button.callback('＋ Credit', `lc:${customerId}`),
      ],
      ...entryButtons,
    ])
  );
}

export async function showSummary(ctx: Context) {
  const [stats, ledger] = await Promise.all([invoiceStats(), ledgerSummary()]);
  const top = ledger.accounts
    .slice(0, 8)
    .map((a) => `${a.name}: ${inr(a.balance)}`)
    .join('\n');
  await ctx.reply(
    [
      `Received today: ${inr(stats.today.revenue)}`,
      `This month: ${inr(stats.month.revenue)} · ${stats.month.count} bills`,
      `Pending: ${inr(stats.pending.total)} · ${stats.pending.count} bills`,
      `Paid bills: ${stats.paidCount}`,
      `Ledger receivable: ${inr(ledger.totals.netReceivable)}`,
      `Ledger payable: ${inr(ledger.totals.netPayable)}`,
      top ? `\nAccounts:\n${top}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    mainMenu()
  );
}

export async function showLedger(ctx: Context, q = '') {
  const session = getSession(ctx.chat!.id);
  session.flow = 'ledger';
  session.ledger = { step: 'search' };
  session.pendingDelete = undefined;
  const data = await ledgerSummary();
  const accounts = q
    ? data.accounts.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()))
    : data.accounts;
  const rows = accounts.slice(0, 10).map((a) => [Markup.button.callback(`${a.name} · ${inr(a.balance)}`, `led:${a._id}`)]);
  await ctx.reply(
    `Ledger · receivable ${inr(data.totals.netReceivable)} · payable ${inr(data.totals.netPayable)}\nTap an account, or type a name to search.`,
    rows.length ? Markup.inlineKeyboard(rows) : undefined
  );
}

export async function showInvoices(ctx: Context, q = '') {
  const session = getSession(ctx.chat!.id);
  session.flow = 'invoices';
  session.pay = { step: 'search' };
  session.pendingDelete = undefined;
  const invoices = await listInvoices(q, 8);
  if (invoices.length === 0) {
    await ctx.reply(q ? `No bills matching “${q}”.` : 'No bills yet.');
    return;
  }
  const rows = invoices.map((inv) => invoiceRow(inv));
  await ctx.reply(q ? `Bills matching “${q}”:` : 'Recent bills. Type a name or number to search.', Markup.inlineKeyboard(rows));
}

function invoiceRow(inv: InvoiceListItem) {
  const name = inv.customerSnapshot?.name ?? 'Customer';
  const label = `${inv.number ?? 'Bill'} · ${name} · ${inr(inv.balanceDue ?? inv.grandTotal ?? 0)} due`;
  return [
    Markup.button.callback('PDF', `pdf:${inv._id}`),
    Markup.button.callback(label.slice(0, 40), `pdf:${inv._id}`),
    Markup.button.callback('Pay', `pay:${inv._id}`),
    Markup.button.callback('Del', `di:${inv._id}`),
  ];
}

export async function showCustomers(ctx: Context, q = '') {
  const session = getSession(ctx.chat!.id);
  session.flow = 'customers';
  session.pendingDelete = undefined;
  const customers = await listCustomers(q);
  const rows = customers.slice(0, 10).map((c) => [
    Markup.button.callback(`${c.name}${c.phone ? ` · ${c.phone}` : ''}`.slice(0, 50), `led:${c._id}`),
    Markup.button.callback('Del', `dc:${c._id}`),
  ]);
  await ctx.reply(
    customers.length ? 'Customers. Tap a name for the ledger, Del to remove. Type to search.' : 'No customers yet.',
    rows.length ? Markup.inlineKeyboard(rows) : undefined
  );
}

export async function showProducts(ctx: Context) {
  const session = getSession(ctx.chat!.id);
  session.flow = 'products';
  session.product = undefined;
  session.pendingDelete = undefined;
  const products = await listProducts();
  const lines = products.slice(0, 12).map((p) => `${p.name} · ${inr(p.price)}`);
  const rows = products.slice(0, 8).map((p) => [Markup.button.callback(`Delete ${p.name}`.slice(0, 40), `dp:${p._id}`)]);
  rows.push([Markup.button.callback('＋ Add service', 'prod:add')]);
  await ctx.reply(['Catalog', ...lines].join('\n'), Markup.inlineKeyboard(rows));
}

export async function showFlights(ctx: Context) {
  const session = getSession(ctx.chat!.id);
  session.flow = 'flights';
  session.pendingDelete = undefined;
  const flights = await listFlights();
  const rows = flights.slice(0, 10).map((f) => {
    const route = [f.fromAirport, f.toAirport].filter(Boolean).join('–');
    const label = `${f.status ?? 'booked'} · ${f.flightNumber || f.airline || 'Flight'} ${route} ${f.pnr ?? ''}`.trim();
    return [Markup.button.callback(label.slice(0, 60), `fl:${f._id}`)];
  });
  await ctx.reply(
    flights.length ? `Flight board · ${flights.length} card(s). Tap to change status or delete.` : 'No flight cards.',
    rows.length ? Markup.inlineKeyboard(rows) : undefined
  );
}

async function sendInvoicePdf(ctx: Context, id: string) {
  const invoice = await getInvoice(id);
  const company = await getCompany();
  const pdf = await renderInvoicePdf(invoiceForPdf(invoice), company as unknown as Company);
  await sendPdfToChat(ctx, pdf, `safarmate-${invoice.number || id}.pdf`, `${invoice.number ?? 'Bill'} PDF`);
}

const LEDGER_METHODS = ['cash', 'upi', 'bank', 'card', 'cheque', 'other'] as const;
const INVOICE_METHODS = ['upi', 'cash', 'bank_transfer', 'cheque', 'other'] as const;

export async function handlePlatformText(ctx: Context, text: string): Promise<boolean> {
  const session = getSession(ctx.chat!.id);
  if (session.pendingDelete) {
    if (/^(yes|y|haan|ha|delete)$/i.test(text)) {
      await runDelete(ctx);
    } else if (/^(no|n|nahi|cancel)$/i.test(text)) {
      session.pendingDelete = undefined;
      await ctx.reply('Kept.', mainMenu());
    } else {
      await ctx.reply('Reply yes to delete, or no to keep it.');
    }
    return true;
  }

  if (session.flow === 'ledger' && session.ledger && session.ledger.step !== 'search') {
    await ledgerText(ctx, text);
    return true;
  }
  if (session.flow === 'invoices' && session.pay && session.pay.step !== 'search') {
    await payText(ctx, text);
    return true;
  }
  if (session.flow === 'products' && session.product) {
    await productText(ctx, text);
    return true;
  }
  if (session.flow === 'ledger') {
    await showLedger(ctx, text);
    return true;
  }
  if (session.flow === 'invoices') {
    await showInvoices(ctx, text);
    return true;
  }
  if (session.flow === 'customers') {
    await showCustomers(ctx, text);
    return true;
  }
  return false;
}

async function ledgerText(ctx: Context, text: string) {
  const form = getSession(ctx.chat!.id).ledger!;
  if (form.step === 'amount') {
    const n = parseAmount(text);
    if (n == null || n <= 0) {
      await ctx.reply('Enter an amount greater than 0.');
      return;
    }
    form.amount = n;
    form.step = 'method';
    await ctx.reply(
      'Method?',
      Markup.inlineKeyboard([LEDGER_METHODS.map((m) => Markup.button.callback(m, `lm:${m}`))])
    );
    return;
  }
  if (form.step === 'method') {
    const m = text.toLowerCase();
    if (!LEDGER_METHODS.includes(m as (typeof LEDGER_METHODS)[number])) {
      await ctx.reply('cash, upi, bank, card, cheque, or other.');
      return;
    }
    form.method = m;
    form.step = 'note';
    await ctx.reply('Note? (- to skip)');
    return;
  }
  if (form.step === 'note') {
    const note = skipped(text) ? '' : text.trim();
    await addLedgerEntry(form.customerId!, {
      kind: form.entryKind!,
      amount: form.amount!,
      method: form.method || 'cash',
      note,
    });
    await ctx.reply(`Saved ${form.entryKind} ${inr(form.amount!)} on ${form.customerName}.`);
    await openLedgerCustomer(ctx, form.customerId!);
  }
}

async function payText(ctx: Context, text: string) {
  const form = getSession(ctx.chat!.id).pay!;
  if (form.step === 'amount') {
    const n = parseAmount(text);
    if (n == null || n <= 0) {
      await ctx.reply('Enter the amount received.');
      return;
    }
    form.amount = n;
    form.step = 'method';
    await ctx.reply(
      'Payment method?',
      Markup.inlineKeyboard([INVOICE_METHODS.map((m) => Markup.button.callback(m, `im:${m}`))])
    );
    return;
  }
  if (form.step === 'method') {
    const typed = text.toLowerCase().replace(/\s+/g, '_');
    form.method = typed === 'bank' ? 'bank_transfer' : typed;
    form.step = 'note';
    await ctx.reply('Reference / note? (- to skip)');
    return;
  }
  if (form.step === 'note') {
    const invoice = await addInvoicePayment(form.invoiceId!, {
      amount: form.amount!,
      method: form.method || 'upi',
      note: skipped(text) ? '' : text.trim(),
    });
    await ctx.reply(
      `Payment saved on ${invoice.number ?? form.invoiceLabel}. Balance ${inr(Number(invoice.balanceDue ?? 0))}.`
    );
    getSession(ctx.chat!.id).pay = { step: 'search' };
  }
}

async function productText(ctx: Context, text: string) {
  const form = getSession(ctx.chat!.id).product!;
  if (form.step === 'name') {
    form.name = text.trim();
    form.step = 'price';
    await ctx.reply('Price in INR?');
    return;
  }
  if (form.step === 'price') {
    const n = parseAmount(text);
    if (n == null) {
      await ctx.reply('Enter a price.');
      return;
    }
    form.price = n;
    form.step = 'tax';
    await ctx.reply('Tax %? (- for 18)');
    return;
  }
  if (form.step === 'tax') {
    form.taxPercent = skipped(text) ? 18 : Number(text);
    form.step = 'hsn';
    await ctx.reply('HSN? (- to skip)');
    return;
  }
  if (form.step === 'hsn') {
    const product = await createProduct({
      name: form.name!,
      price: form.price!,
      taxPercent: form.taxPercent,
      hsnCode: skipped(text) ? '' : text.trim(),
    });
    await ctx.reply(`Added ${product.name} at ${inr(product.price)}.`);
    await showProducts(ctx);
  }
}

async function runDelete(ctx: Context) {
  const pending = getSession(ctx.chat!.id).pendingDelete;
  if (!pending) return;
  getSession(ctx.chat!.id).pendingDelete = undefined;
  if (pending.kind === 'invoice') await deleteInvoice(pending.id);
  else if (pending.kind === 'customer') await deleteCustomer(pending.id);
  else if (pending.kind === 'ledger') await deleteLedgerEntry(pending.id);
  else if (pending.kind === 'product') await deleteProduct(pending.id);
  else await deleteFlight(pending.id);
  await ctx.reply(`Deleted ${pending.label}.`, mainMenu());
}

export function registerPlatform(bot: Telegraf<Context>) {
  bot.action('nodel', async (ctx) => {
    getSession(ctx.chat!.id).pendingDelete = undefined;
    await ctx.answerCbQuery('Kept');
    await ctx.reply('Kept.', mainMenu());
  });

  bot.action('yesdel', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await runDelete(ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Delete failed: ${msg.slice(0, 300)}`);
    }
  });

  bot.action(/^led:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await openLedgerCustomer(ctx, ctx.match[1] ?? '');
  });

  bot.action(/^lp:(.+)$/, async (ctx) => {
    const id = ctx.match[1] ?? '';
    const session = getSession(ctx.chat!.id);
    session.flow = 'ledger';
    session.ledger = { step: 'amount', customerId: id, customerName: session.ledger?.customerName, entryKind: 'payment' };
    await ctx.answerCbQuery();
    await ctx.reply('Payment amount received?');
  });

  bot.action(/^lc:(.+)$/, async (ctx) => {
    const id = ctx.match[1] ?? '';
    const session = getSession(ctx.chat!.id);
    session.flow = 'ledger';
    session.ledger = { step: 'amount', customerId: id, customerName: session.ledger?.customerName, entryKind: 'credit' };
    await ctx.answerCbQuery();
    await ctx.reply('Credit amount to add on the account?');
  });

  bot.action(/^lm:(cash|upi|bank|card|cheque|other)$/, async (ctx) => {
    const form = getSession(ctx.chat!.id).ledger;
    if (!form) return ctx.answerCbQuery();
    form.method = ctx.match[1];
    form.step = 'note';
    await ctx.answerCbQuery();
    await ctx.reply('Note? (- to skip)');
  });

  bot.action(/^dle:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await askDelete(ctx, { kind: 'ledger', id: ctx.match[1] ?? '', label: 'this ledger entry' });
  });

  bot.action(/^pdf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Sending PDF');
    try {
      await sendInvoicePdf(ctx, ctx.match[1] ?? '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Could not send PDF: ${msg.slice(0, 300)}`);
    }
  });

  bot.action(/^pay:(.+)$/, async (ctx) => {
    const id = ctx.match[1] ?? '';
    getSession(ctx.chat!.id).flow = 'invoices';
    getSession(ctx.chat!.id).pay = { step: 'amount', invoiceId: id };
    await ctx.answerCbQuery();
    await ctx.reply('Amount received against this bill?');
  });

  bot.action(/^im:(upi|cash|bank_transfer|cheque|other)$/, async (ctx) => {
    const form = getSession(ctx.chat!.id).pay;
    if (!form) return ctx.answerCbQuery();
    form.method = ctx.match[1];
    form.step = 'note';
    await ctx.answerCbQuery();
    await ctx.reply('Reference / note? (- to skip)');
  });

  bot.action(/^di:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await askDelete(ctx, { kind: 'invoice', id: ctx.match[1] ?? '', label: 'this bill' });
  });

  bot.action(/^dc:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await askDelete(ctx, { kind: 'customer', id: ctx.match[1] ?? '', label: 'this customer' });
  });

  bot.action(/^dp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await askDelete(ctx, { kind: 'product', id: ctx.match[1] ?? '', label: 'this catalog item' });
  });

  bot.action('prod:add', async (ctx) => {
    getSession(ctx.chat!.id).flow = 'products';
    getSession(ctx.chat!.id).product = { step: 'name' };
    await ctx.answerCbQuery();
    await ctx.reply('Service name?');
  });

  bot.action(/^fl:(.+)$/, async (ctx) => {
    const id = ctx.match[1] ?? '';
    await ctx.answerCbQuery();
    await ctx.reply(
      'Update this flight card:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Booked', `fs:${id}:booked`),
          Markup.button.callback('Confirmed', `fs:${id}:confirmed`),
        ],
        [
          Markup.button.callback('Departed', `fs:${id}:departed`),
          Markup.button.callback('Arrived', `fs:${id}:arrived`),
        ],
        [
          Markup.button.callback('Cancelled', `fs:${id}:cancelled`),
          Markup.button.callback('Delete', `fd:${id}`),
        ],
      ])
    );
  });

  bot.action(/^fs:(.+):(booked|confirmed|departed|arrived|cancelled)$/, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await patchFlight(ctx.match[1] ?? '', { status: ctx.match[2] ?? 'booked' });
      await ctx.reply(`Status set to ${ctx.match[2]}.`);
      await showFlights(ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Update failed: ${msg.slice(0, 240)}`);
    }
  });

  bot.action(/^fd:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await askDelete(ctx, { kind: 'flight', id: ctx.match[1] ?? '', label: 'this flight card' });
  });
}
