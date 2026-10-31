import type { Context } from 'telegraf';
import { downloadIndigoItinerary } from '../../server/src/utils/indigoItinerary.js';
import { mainMenu } from './menu.js';
import { sendPdfToChat } from './sendPdf.js';
import { getSession, resetSession } from './session.js';

export async function startIndigoTickets(ctx: Context): Promise<void> {
  const session = getSession(ctx.chat!.id);
  session.flow = 'indigo';
  session.indigo = { step: 'pnr' };
  session.pendingDelete = undefined;
  await ctx.reply('IndiGo Tickets\n\nPNR / booking reference?');
}

export async function handleIndigoText(ctx: Context, text: string): Promise<void> {
  const session = getSession(ctx.chat!.id);
  const form = session.indigo ?? { step: 'pnr' as const };

  if (form.step === 'pnr') {
    const pnr = text.trim().toUpperCase();
    if (!/^[A-Z0-9]{5,8}$/.test(pnr)) {
      await ctx.reply('PNR should be 5–8 letters or numbers. Send it again.');
      return;
    }
    session.indigo = { step: 'lastName', pnr };
    await ctx.reply('Email or last name, exactly as on the IndiGo booking?');
    return;
  }

  const lastName = text.trim();
  if (lastName.length < 2) {
    await ctx.reply('Enter the last name or email.');
    return;
  }
  const pnr = form.pnr ?? '';
  await ctx.reply(
    `Fetching the IndiGo itinerary for ${pnr}. This usually takes under a minute.`
  );
  try {
    const pdf = await downloadIndigoItinerary({ pnr, lastName });
    await sendPdfToChat(ctx, pdf, `IndiGo-${pnr}.pdf`, `IndiGo itinerary ${pnr}`);
    resetSession(ctx.chat!.id);
    await ctx.reply('Ticket sent.', mainMenu());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    session.indigo = { step: 'lastName', pnr };
    await ctx.reply(
      `Could not download that itinerary:\n${msg.slice(0, 500)}\n\nSend the last name / email again, or tap Cancel.`
    );
  }
}
