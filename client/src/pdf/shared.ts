import { Font } from '@react-pdf/renderer';

let registered = false;

export function ensureFonts() {
  if (registered) return;
  registered = true;
  if (typeof window === 'undefined') return;
  try {
    Font.registerHyphenationCallback((word) => [word]);
    const origin = window.location.origin;
    Font.register({
      family: 'Inter',
      fonts: [
        { src: `${origin}/fonts/Inter-Regular.otf`, fontWeight: 400 },
        { src: `${origin}/fonts/Inter-Medium.otf`, fontWeight: 500 },
        { src: `${origin}/fonts/Inter-SemiBold.otf`, fontWeight: 600 },
        { src: `${origin}/fonts/Inter-Bold.otf`, fontWeight: 700 },
        { src: `${origin}/fonts/Inter-ExtraBold.otf`, fontWeight: 800 },
      ],
    });
  } catch (err) {
    console.warn('[pdf] font registration failed, falling back to Helvetica', err);
  }
}

export function fmt(amount: number, currency = 'INR'): string {
  const value = amount || 0;
  const isWhole = Math.round(value * 100) % 100 === 0;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(isWhole ? 0 : 2)}`;
  }
}

export function fmtPlain(amount: number, currency = 'INR'): string {
  const value = amount || 0;
  const isWhole = Math.round(value * 100) % 100 === 0;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(isWhole ? 0 : 2);
  }
}

export function fmtDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateShort(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + ' Hundred');
  if (r) parts.push(twoDigits(r));
  return parts.join(' ');
}

export function inrInWords(amount: number, currency = 'INR'): string {
  if (!Number.isFinite(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(Math.round(amount * 100) / 100);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  let words = '';
  if (rupees === 0) {
    words = 'Zero';
  } else {
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const rest = rupees % 1000;
    const parts: string[] = [];
    if (crore) parts.push(twoDigits(crore) + ' Crore');
    if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
    if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
    if (rest) parts.push(threeDigits(rest));
    words = parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  const isInr = currency === 'INR';
  let out = (negative ? 'Negative ' : '') + words + (isInr ? ' Rupees' : ` ${currency}`);
  if (paise > 0 && isInr) out += ' and ' + twoDigits(paise) + ' Paise';
  return out + ' Only';
}
