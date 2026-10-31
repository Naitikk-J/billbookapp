import { Markup } from 'telegraf';

export function mainMenu() {
  return Markup.keyboard([
    ['🆕 New bill', '📄 Ticket PDF'],
    ['📒 Ledger', '🧾 Invoices'],
    ['👥 Customers', '📦 Products'],
    ['✈️ Flights', '📊 Summary'],
    ['🛫 IndiGo Tickets'],
    ['❌ Cancel / Menu'],
  ]).resize();
}

export function inr(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export const MENU_PREFIXES = ['🆕', '📄', '📒', '🧾', '👥', '📦', '✈️', '📊', '🛫', '❌'];
