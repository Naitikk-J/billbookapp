import { normaliseFlight, type NormalisedFlight } from './flightAi';
import { emptyFlightBillCharges, type FlightBillCharges } from './flightBillCharges';
import { cityForIata } from './airportNames';
import { decodePdfBase64, flattenPdfText, pdfBufferToText } from './pdfText';

export type FlightPdfFormat =
  | 'air_india_eticket'
  | 'indigo_itinerary'
  | 'safarmate_voucher'
  | 'generic';

export interface FlightPdfExtraction {
  format: FlightPdfFormat;
  segments: NormalisedFlight[];
  charges: FlightBillCharges;
  rawTextLength: number;
}

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function parseCompactDate(d: string, time?: string): string {
  const m = d.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
  if (!m) return '';
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return '';
  const day = m[1].padStart(2, '0');
  const hhmm = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '00:00';
  const [hh, mm] = hhmm.split(':');
  return `${m[3]}-${mon}-${day}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00`;
}

function parseLongDate(d: string, time?: string): string {
  const m = d.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return '';
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return '';
  const day = m[1].padStart(2, '0');
  let hh = '00';
  let mm = '00';
  if (time) {
    const tm = time.match(/^(\d{1,2}):(\d{2})/);
    if (tm) {
      hh = tm[1].padStart(2, '0');
      mm = tm[2];
    }
  }
  return `${m[3]}-${mon}-${day}T${hh}:${mm}:00`;
}

function parseVoucherDate(dayName: string, d: string, timeRaw: string): string {
  void dayName;
  const m = d.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return '';
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return '';
  const day = m[1].padStart(2, '0');
  let hh = '12';
  let mm = '00';
  const t = timeRaw.trim().toUpperCase();
  const tm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (tm) {
    let h = parseInt(tm[1], 10);
    mm = (tm[2] ?? '00').padStart(2, '0');
    const ap = tm[3];
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    hh = String(h).padStart(2, '0');
  }
  return `${m[3]}-${mon}-${day}T${hh}:${mm}:00`;
}

function cleanPdfWhitespace(raw: string): string {
  return raw.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

function dedupeRepeatedNameToken(raw: string): string {
  const s = raw.trim();
  const exact = s.match(/^([A-Za-z]{2,})\1+$/i);
  if (exact) return exact[1];
  const partial = s.match(/([A-Za-z]{3,})\1/i);
  if (partial) return partial[1];
  return s;
}

function splitSmushedCapsName(raw: string): string {
  let s = raw.replace(/\(ADT\)|\(CHD\)|\(INF\)/gi, '').trim().toUpperCase();
  for (const title of ['MS', 'MR', 'MRS', 'MSTR']) {
    if (s.endsWith(title)) s = s.slice(0, -title.length);
  }
  if (!s) return '';

  const scoreCapsParts = (parts: string[]): number => {
    let score = 0;
    for (const p of parts) {
      if (p.length >= 4 && p.length <= 10) score += 3;
      else if (p.length === 3) score += 1;
      else score -= 2;
      if (/[AEIOU]/i.test(p)) score += 1;
      if (/[^AEIOU]{5,}/i.test(p)) score -= 4;
    }
    score -= Math.max(0, parts.length - 10) * 2;
    if (parts.length >= 2 && parts.length <= 6) score += 2;
    return score;
  };

  let bestParts: string[] = [s];
  let bestScore = -Infinity;
  const minPart = 3;
  const dfs = (i: number, acc: string[]) => {
    if (i === s.length) {
      const sc = scoreCapsParts(acc);
      if (sc > bestScore) {
        bestScore = sc;
        bestParts = acc;
      }
      return;
    }
    const remaining = s.length - i;
    for (let len = Math.min(12, remaining); len >= 1; len--) {
      if (len < minPart && len !== remaining) continue;
      dfs(i + len, [...acc, s.slice(i, i + len)]);
    }
  };
  dfs(0, []);

  const parts = bestParts;
  return parts.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

function humanizePassenger(raw: string): string {
  const s = cleanPdfWhitespace(
    raw
      .replace(/\(ADT\)|\(CHD\)|\(INF\)/gi, '')
      .replace(/\s*(?:Adult|Child|Infant)\b.*$/i, '')
  );
  if (!s) return '';
  if (/^[a-z]+$/.test(s)) return dedupeRepeatedNameToken(s.charAt(0).toUpperCase() + s.slice(1));
  if (/^[A-Z]+$/.test(s) && s.length > 8) {
    return splitSmushedCapsName(s);
  }
  if (/^[A-Z\s]+$/.test(s) && !s.includes(' ')) {
    return s.charAt(0) + s.slice(1).toLowerCase();
  }
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const PASSENGER_NAME_BLOCKLIST =
  /\b(airport|international|terminal|sector|indigo|passenger|information|check-in|check in|booking|payment|confirmed|complete|female|male|adult|child|infant|travel time|baggage|add-ons|pnr|reference|mumbai|chandigarh|delhi|bangalore|hyderabad|chennai|kolkata|pune|goa|goindigo)\b/i;

function isPlausiblePassengerName(name: string): boolean {
  const n = cleanPdfWhitespace(name);
  if (!n || n.length < 2 || n.length > 80) return false;
  if (PASSENGER_NAME_BLOCKLIST.test(n)) return false;
  if (/\d{2,}/.test(n)) return false;
  const words = n.split(/\s+/);
  if (words.length > 8) return false;
  if (words.some((w) => w.length > 18)) return false;
  return true;
}

/** Keep every word from the ticket — prefer the longest plausible cleaned candidate. */
function pickLongestPassengerName(...candidates: Array<string | undefined | null>): string {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const c of candidates) {
    if (!c?.trim()) continue;
    const n = humanizePassenger(c);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(n);
  }
  const plausible = normalized.filter(isPlausiblePassengerName);
  const pool = plausible.length > 0 ? plausible : normalized;
  return pool.sort((a, b) => b.length - a.length)[0] ?? '';
}

function isValidIndigoPnr(code: string): boolean {
  const c = code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) return false;
  return /\d/.test(c);
}

function extractIndigoPnr(raw: string, flat: string): string {
  const hay = `${raw}\n${flat}`;
  const patterns = [
    /PNR\s*\/\s*Booking Ref(?:erence)?\s*:?\s*([A-Z0-9]{6})/i,
    /Booking Ref(?:erence)([A-Z0-9]{6})/i,
    /PNR\/Booking Reference\s*([A-Z0-9]{6})/i,
  ];
  for (const re of patterns) {
    const m = hay.match(re);
    if (m?.[1] && isValidIndigoPnr(m[1])) return m[1].toUpperCase();
  }
  return '';
}

function parseIndigoDateTimes(block: string): Array<{ time: string; date: string }> {
  const out: Array<{ time: string; date: string }> = [];
  const re = /(\d{1,2}:\d{2}),?\s*(?:hrs,?\s*)?(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    out.push({ time: m[1], date: m[2] });
  }
  return out;
}

function parseIndigoPassengerNames(raw: string, fileName?: string): string[] {
  const names: string[] = [];
  const headerRe =
    /Passenger Information\s*(MS|MR|Mrs|Ms|Mstr|Miss)\.?\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,12})\s*(?:Adult|Child|Infant)/gi;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(raw)) !== null) {
    const full = humanizePassenger(`${m[1]} ${m[2]}`);
    if (isPlausiblePassengerName(full)) names.push(full);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const n of names) {
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
  }
  if (unique.length > 0) return unique;

  const legacy = parseIndigoPassengerNameLegacy(raw, fileName);
  return legacy ? [legacy] : [];
}

/** IndiGo itinerary PDFs often repeat the pax name (PDF text quirk) before "Adult". */
function parseIndigoPassengerNameLegacy(raw: string, fileName?: string): string {
  const block = raw.match(/Passenger Information([\s\S]{0,450})/i)?.[1] ?? '';

  const smushedBeforeAdult = block.match(/\b([a-z]{3,15})\1+(?:\s*\1+)*\s*(?:Adult|Child|Infant)/i);
  const fromSmushed = smushedBeforeAdult
    ? humanizePassenger(dedupeRepeatedNameToken(smushedBeforeAdult[1]))
    : '';

  const titledBeforeAdult = block.match(
    /(?:Mr\.?|Mrs\.?|Ms\.?|Mstr\.?|Miss\.?)\s*([A-Za-z]+(?:\s+[A-Za-z]+){0,8})\s*(?:Adult|Child|Infant|\|)/i
  );
  const fromTitled = titledBeforeAdult ? humanizePassenger(titledBeforeAdult[1]) : '';

  const spacedBeforeAdult = block.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,8})\s*(?:Adult|Child|Infant|\|)/i
  );
  const fromSpaced = spacedBeforeAdult ? humanizePassenger(spacedBeforeAdult[1]) : '';

  const dupToken =
    block.match(/([a-z]{3,15})\1+/i)?.[1] ??
    raw.match(/Passenger Information[\s\S]{0,200}?([a-z]{3,15})\1+/i)?.[1];
  const fromDup = dupToken ? humanizePassenger(dedupeRepeatedNameToken(dupToken)) : '';

  const fromSection = extractPassengerNameFromSection(block);

  return pickLongestPassengerName(
    fromSmushed,
    fromTitled,
    fromSpaced,
    fromDup,
    fromSection,
    passengerNameFromFileName(fileName)
  );
}

function indigoItinerarySampleBlock(raw: string): string {
  const parts = raw.split(/Passenger Information/i);
  if (parts.length < 2) return raw;
  return parts[1]!.split(/Passenger Information|\nNote\n/i)[0] ?? parts[1]!;
}

function parseIndigoSegments(
  raw: string,
  pnr: string,
  passengerNames: string[]
): NormalisedFlight[] {
  const block = indigoItinerarySampleBlock(raw);
  const sectorMatches = [...block.matchAll(/\b([A-Z]{3})-([A-Z]{3})\b/g)];
  const legs: Array<{ from: string; to: string }> = [];
  for (const m of sectorMatches) {
    const from = m[1]!;
    const to = m[2]!;
    const key = `${from}-${to}`;
    if (!legs.some((l) => `${l.from}-${l.to}` === key)) legs.push({ from, to });
  }

  const flightMatches = [...block.matchAll(/\b6E\s*(\d{3,4})\b/gi)];
  const flights: string[] = [];
  for (const m of flightMatches) {
    const fn = `6E ${m[1]}`;
    if (!flights.includes(fn)) flights.push(fn);
  }

  const times = parseIndigoDateTimes(block);
  const pax = passengerNames.map((name) => ({ name, seat: '', cabin: '' }));

  const segments: NormalisedFlight[] = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const dep = times[i * 2];
    const arr = times[i * 2 + 1];
    segments.push(
      normaliseFlight({
        pnr,
        airline: 'IndiGo',
        airlineCode: '6E',
        flightNumber: flights[i] ?? flights[0] ?? '',
        fromAirport: leg.from,
        toAirport: leg.to,
        fromCity: cityForIata(leg.from),
        toCity: cityForIata(leg.to),
        departureAt: dep ? parseLongDate(dep.date, dep.time) : '',
        arrivalAt: arr ? parseLongDate(arr.date, arr.time) : '',
        passengers: pax.length > 0 ? pax : [],
        status: 'confirmed',
      })
    );
  }

  return dedupeFlightSegments(segments);
}

function capsWord(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Air India e-ticket: PASSENGER:SINGHBHUVESHKUMARMR(ADT) — surname + given, title before (ADT). */
function parseAirIndiaCapsPassenger(caps: string, fileName?: string): string {
  const core = caps.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (!core) return '';

  const hint = passengerNameFromFileName(fileName);
  if (hint) {
    const hintCompact = hint.replace(/\s+/g, '').toUpperCase();
    const idx = core.indexOf(hintCompact);
    if (idx >= 0) {
      const prefix = core.slice(0, idx);
      const suffix = core.slice(idx + hintCompact.length);
      if (prefix.length >= 2) {
        const joined = `${hint} ${capsWord(prefix)}`.trim();
        if (isPlausiblePassengerName(joined)) return joined;
      }
      const parts: string[] = [];
      if (prefix.length >= 2) parts.push(capsWord(prefix));
      parts.push(hint);
      if (suffix.length >= 2 && !/^(MR|MRS|MS|MSTR|MISS)/.test(suffix)) {
        parts.push(capsWord(suffix));
      }
      const joined = parts.join(' ').trim();
      if (isPlausiblePassengerName(joined)) return joined;
    }
    const hintWords = hint.split(/\s+/).filter(Boolean);
    if (hintWords.length === 1) {
      const w = hintWords[0]!.toUpperCase();
      const i = core.indexOf(w);
      if (i > 0) {
        const joined = `${hint} ${capsWord(core.slice(0, i))}`.trim();
        if (isPlausiblePassengerName(joined)) return joined;
      }
    }
  }

  const SURNAME_PREFIXES = ['KUMAR', 'SINGH', 'VATS', 'DEVI', 'SHARMA', 'GUPTA', 'PATEL', 'REDDY'];
  for (const s of SURNAME_PREFIXES) {
    if (core.startsWith(s) && core.length > s.length + 2) {
      const joined = `${capsWord(core.slice(s.length))} ${capsWord(s)}`;
      if (isPlausiblePassengerName(joined)) return joined;
    }
    if (core.endsWith(s) && core.length > s.length + 2) {
      const joined = `${capsWord(core.slice(0, -s.length))} ${capsWord(s)}`;
      if (isPlausiblePassengerName(joined)) return joined;
    }
  }

  const split = splitSmushedCapsName(core);
  if (isPlausiblePassengerName(split)) return split;

  if (/^[A-Z]{5,}[A-Z]{4,}$/.test(core)) {
    for (let i = 3; i <= Math.min(12, core.length - 3); i++) {
      const a = capsWord(core.slice(0, i));
      const b = capsWord(core.slice(i));
      const joined = `${b} ${a}`;
      if (isPlausiblePassengerName(joined)) return joined;
    }
  }

  if (core.length >= 8 && core.length <= 28) {
    for (let i = 4; i <= core.length - 4; i++) {
      const joined = `${capsWord(core.slice(i))} ${capsWord(core.slice(0, i))}`;
      if (isPlausiblePassengerName(joined)) return joined;
    }
  }
  return split;
}

function parseAirIndiaPassengerName(flat: string, raw: string, fileName?: string): string {
  const fromFile = passengerNameFromFileName(fileName);

  const capsMatch = flat.match(
    /PASSENGER:([A-Z]+?)(?:MR|MRS|MS|MSTR|MISS)(?:\(ADT\)|\(CHD\)|\(INF\))/i
  );
  const fromCaps = capsMatch ? parseAirIndiaCapsPassenger(capsMatch[1]!, fileName) : '';

  const slash =
    flat.match(/PASSENGER:\s*([A-Z]+)\/([A-Z\s]+?)(?:\(ADT\)|\(CHD\)|\(INF\)|\s|$)/i) ??
    raw.match(/PASSENGER:\s*([A-Z]+)\/([A-Z\s]+?)(?:\(ADT\)|\(CHD\)|\(INF\)|\s|$)/i);
  const slashName = slash
    ? humanizePassenger(`${slash[2].trim()} ${slash[1].trim()}`)
    : '';

  const spaced =
    flat.match(/PASSENGER:\s*([A-Z][A-Z\s.'-]+)(?:\(ADT\)|\(CHD\)|\(INF\))/i)?.[1]?.trim() ??
    '';

  if (fromFile && isPlausiblePassengerName(fromFile)) return fromFile;
  if (fromCaps && isPlausiblePassengerName(fromCaps)) return fromCaps;
  return pickLongestPassengerName(fromFile, fromCaps, slashName, spaced);
}

const AIR_INDIA_CITY_HINTS: Array<{ re: RegExp; iata: string }> = [
  { re: /INDIRA GANDHI|DELHI/, iata: 'DEL' },
  { re: /SINGAPORE|CHANGI/, iata: 'SIN' },
  { re: /DUBAI/, iata: 'DXB' },
  { re: /HEATHROW|\bLONDON\b/, iata: 'LHR' },
  { re: /MUMBAI|CHHATRAPATI SHIVAJI/, iata: 'BOM' },
  { re: /\bHYDERABAD\b|RAJIV GANDHI/, iata: 'HYD' },
  { re: /JABALPUR|\bJLR\b/, iata: 'JLR' },
  { re: /BENGALURU|KEMPEGOWDA|\bBLR\b/, iata: 'BLR' },
  { re: /COIMBATORE|\bCJB\b/, iata: 'CJB' },
  { re: /CHANDIGARH|\bIXC\b/, iata: 'IXC' },
];

function iatasFromSnippet(snippet: string): string[] {
  const upper = snippet.toUpperCase();
  const hits: Array<{ iata: string; idx: number }> = [];
  for (const { re, iata } of AIR_INDIA_CITY_HINTS) {
    const m = upper.match(re);
    if (m?.index != null) hits.push({ iata, idx: m.index });
  }
  hits.sort((a, b) => a.idx - b.idx);
  const out: string[] = [];
  for (const h of hits) {
    if (!out.includes(h.iata)) out.push(h.iata);
  }
  return out;
}

function normalizeSmushedAirIndiaFlight(match: string): string {
  const body = match.replace(/^AI/i, '');
  const mFlightTime = body.match(/^(\d{3})(\d{1,2}):(\d{2})$/);
  if (mFlightTime) {
    return `AI ${mFlightTime[1]} ${mFlightTime[2].padStart(2, '0')}:${mFlightTime[3]}`;
  }
  const mLong = body.match(/^(\d{3})(\d{3}):(\d{2})$/);
  if (mLong) {
    const depH = Number(mLong[2]) > 23 ? mLong[2].slice(1) : mLong[2].slice(-2);
    return `AI ${mLong[1]} ${depH}:${mLong[3]}`;
  }
  const m4h = body.match(/^(\d{3,4})(\d{2}):(\d{2})$/);
  if (m4h) return `AI ${m4h[1]} ${m4h[2]}:${m4h[3]}`;
  return match;
}

function normalizeAirIndiaFlat(flat: string): string {
  return flat.replace(/\bAI\d{5,}:\d{2}\b/gi, (token) => normalizeSmushedAirIndiaFlight(token));
}

function parseAirIndiaFlightLegs(
  flat: string,
  pnr: string,
  passengerName: string
): NormalisedFlight[] {
  const normalized = normalizeAirIndiaFlat(flat);
  const flightRe =
    /\bAI\s+(\d{2,4})\s+(\d{1,2}:\d{2})\s+(\d{1,2}[A-Za-z]{3}\d{4})\s+(\d{1,2}:\d{2})\s+(\d{1,2}[A-Za-z]{3}\d{4})/gi;
  const segments: NormalisedFlight[] = [];
  const pax = passengerName ? [{ name: passengerName, seat: '', cabin: '' }] : [];
  let match: RegExpExecArray | null;

  while ((match = flightRe.exec(normalized)) !== null) {
    const idx = match.index ?? 0;
    const ctx = normalized.slice(Math.max(0, idx - 280), idx);
    const routeSlice = ctx.split(/FlightToDepartureArrivalFrom/i).pop() ?? ctx;
    const iatas = iatasFromSnippet(routeSlice.slice(-200));
    let fromAirport = iatas[0] ?? '';
    let toAirport = iatas[1] ?? '';
    if (!toAirport || toAirport === fromAirport) {
      toAirport = iatas.find((c) => c !== fromAirport) ?? toAirport;
    }
    if (!fromAirport && iatas.length >= 2) {
      fromAirport = iatas[iatas.length - 2] ?? '';
      toAirport = iatas[iatas.length - 1] ?? '';
    }
    const dep = parseCompactDate(match[3]!, match[2]!);
    const arr = parseCompactDate(match[5]!, match[4]!);
    segments.push(
      normaliseFlight({
        pnr,
        airline: 'Air India',
        airlineCode: 'AI',
        flightNumber: `AI ${match[1]}`,
        fromAirport,
        toAirport,
        fromCity: cityForIata(fromAirport),
        toCity: cityForIata(toAirport),
        departureAt: dep,
        arrivalAt: arr,
        passengers: pax,
        status: 'confirmed',
      })
    );
  }
  return dedupeFlightSegments(segments);
}

/** Prefer the longest plausible passenger line from a ticket block. */
function extractPassengerNameFromSection(section: string): string {
  const block = section.slice(0, 600);
  const titled = block.match(
    /(?:Mr\.?|Mrs\.?|Ms\.?|Mstr\.?|Master\.?|Miss\.?)\s+([A-Za-z]+(?:[\s.-]+[A-Za-z]+){0,12})/i
  );
  if (titled) return humanizePassenger(titled[1]);

  const numbered = block.match(/\d+\.\s*(?:Mr\.?|Mrs\.?|Ms\.?|Mstr\.?)?\s*([A-Za-z]+(?:[\s.-]+[A-Za-z]+){0,12})/i);
  if (numbered) return humanizePassenger(numbered[1]);

  const capsWords = block.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,12})\b/);
  if (capsWords) return humanizePassenger(capsWords[1]);

  const titleCase = block.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+){1,12})\b/);
  if (titleCase) return humanizePassenger(titleCase[1]);

  return '';
}

function dedupeFlightSegments(segments: NormalisedFlight[]): NormalisedFlight[] {
  const seen = new Set<string>();
  return segments.filter((s) => {
    if (!s.flightNumber?.trim() || !s.fromAirport || !s.toAirport) return false;
    const key = `${s.flightNumber}|${s.fromAirport}|${s.toAirport}|${s.departureAt ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectFormat(flat: string, raw: string): FlightPdfFormat {
  if (/ELECTRONICTICKETITINERARY|BOOKINGREFERENCE:|AIRINDIA/i.test(flat)) {
    return 'air_india_eticket';
  }
  if (/goindigo\.in|PNR\/Booking Reference|6E\s*\d{3,4}/i.test(flat + raw)) {
    return 'indigo_itinerary';
  }
  if (/Safarmate\s+Travels|Booking\s*Id\s*:/i.test(raw)) {
    return 'safarmate_voucher';
  }
  return 'generic';
}

function passengerNameFromFileName(fileName?: string): string {
  if (!fileName) return '';
  const base = fileName.replace(/\.pdf$/i, '').split(/[/\\]/).pop() ?? '';
  const m =
    base.match(/\(\s*[A-Z0-9]+\s*\)\s*-\s*([A-Za-z]+(?:[\s.-]+[A-Za-z]+)+)/i) ??
    base.match(/-\s*([A-Za-z]+(?:[\s.-]+[A-Za-z]+)+)\s*(?:\(\d+\))?\s*$/);
  return m ? humanizePassenger(cleanPdfWhitespace(m[1])) : '';
}

function parseAirIndia(flat: string, raw: string, fileName?: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  charges.currency = 'INR';

  const pnr = flat.match(/BOOKINGREFERENCE:\s*([A-Z0-9]{6})/i)?.[1]?.toUpperCase() ?? '';
  charges.pnr = pnr;
  charges.bookingId = pnr;

  charges.billToName = parseAirIndiaPassengerName(flat, raw, fileName);

  charges.issuedDate = flat.match(/Dateofissue:\s*(\d{1,2}[A-Za-z]{3}\d{4})/i)?.[1] ?? '';

  const total = flat.match(/TotalAmount:\s*INR\s*([\d,]+)/i)?.[1]?.replace(/,/g, '');
  if (total) charges.grandTotal = Number(total) || 0;

  const segments = parseAirIndiaFlightLegs(flat, pnr, charges.billToName);

  return { format: 'air_india_eticket', segments, charges, rawTextLength: flat.length };
}

function parseIndigo(flat: string, raw: string, fileName?: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  const pnr = extractIndigoPnr(raw, flat);
  charges.pnr = pnr;
  charges.bookingId = pnr;

  const passengerNames = parseIndigoPassengerNames(raw, fileName);
  charges.billToName =
    passengerNames.length > 1
      ? passengerNames.join(' & ')
      : passengerNames[0] ?? '';

  let segments = parseIndigoSegments(raw, pnr, passengerNames);

  if (segments.length === 0) {
    const sector = flat.match(/\b([A-Z]{3})-([A-Z]{3})\b/);
    const flight = flat.match(/\b(6E)\s*(\d{3,4})\b/i);
    const times = [
      ...raw.matchAll(/(\d{1,2}:\d{2}),?\s*(?:hrs,?\s*)?(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/gi),
    ];
    if (sector && flight) {
      const depIso = times[0] ? parseLongDate(times[0][2], times[0][1]) : '';
      const arrIso = times[1] ? parseLongDate(times[1][2], times[1][1]) : '';
      const pax = passengerNames.map((name) => ({ name, seat: '', cabin: '' }));
      segments = [
        normaliseFlight({
          pnr,
          airline: 'IndiGo',
          airlineCode: '6E',
          flightNumber: `${flight[1]!.toUpperCase()} ${flight[2]}`,
          fromAirport: sector[1]!,
          toAirport: sector[2]!,
          fromCity: cityForIata(sector[1]!),
          toCity: cityForIata(sector[2]!),
          departureAt: depIso,
          arrivalAt: arrIso,
          passengers: pax,
          status: 'confirmed',
        }),
      ];
    }
  }

  return { format: 'indigo_itinerary', segments, charges, rawTextLength: flat.length };
}

function parseSafarmateVoucherDateTime(
  block: string,
  afterLabel: 'Departure' | 'Arrival'
): { date: string; time: string } | null {
  const labelRe =
    afterLabel === 'Departure'
      ? /Departure[\s\S]*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[\t\s]*\n[\t\s]*(\d{1,2})[\t\s]+([A-Za-z]{3})[\t\s]+(\d{4})[\t\s]*\n[\t\s]*([\d:]+\s*(?:AM|PM)?)/i
      : /Arrival[\s\S]*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[\t\s]*\n[\t\s]*(\d{1,2})[\t\s]+([A-Za-z]{3})[\t\s]+(\d{4})[\t\s]*\n[\t\s]*([\d:]+\s*(?:AM|PM)?)/i;
  const m = block.match(labelRe);
  if (!m) return null;
  return { date: `${m[2]} ${m[3]} ${m[4]}`, time: cleanPdfWhitespace(m[5]) };
}

function parseSafarmateVoucher(raw: string, fileName?: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  const flat = flattenPdfText(raw);

  charges.pnr = (raw.match(/PNR:\s*([A-Z0-9]+)/i)?.[1] ?? '').toUpperCase();
  charges.bookingId = (raw.match(/Booking\s*Id\s*:\s*([A-Z0-9]+)/i)?.[1] ?? charges.pnr).toUpperCase();
  charges.issuedDate = cleanPdfWhitespace(raw.match(/Issued\s*Date\s*:\s*([^\n]+)/i)?.[1] ?? '');

  const passengerBlock = raw.match(/Passenger\s*Name([\s\S]{0,500})/i)?.[1] ?? '';
  const fromSection = extractPassengerNameFromSection(passengerBlock);
  const passengerMatch = raw.match(
    /Passenger\s*Name[\s\S]*?\d+\.\s*(?:Ms|Mr|Mrs|Mstr)\.?\s*([A-Za-z]+(?:[\t ]+[A-Za-z]+)+)/i
  );
  const fromList = passengerMatch ? humanizePassenger(passengerMatch[1]) : '';
  charges.billToName = pickLongestPassengerName(
    fromSection,
    fromList,
    passengerNameFromFileName(fileName)
  );

  const segments: NormalisedFlight[] = [];
  const flightSectionRe =
    /([A-Z]{3})\s*-\s*([A-Z]{3})[\t\s]*\n[\t\s]*Flight[\s\S]*?(?=\n[A-Z]{3}\s*-\s*[A-Z]{3}[\t\s]*\n[\t\s]*Flight|\nTraveller\s*Details|$)/gi;
  let section: RegExpExecArray | null;
  while ((section = flightSectionRe.exec(raw)) !== null) {
    const block = section[0];
    const fromAirport = section[1];
    const toAirport = section[2];
    const flight =
      block.match(/Air\s*India[\t\s]*(AI)[\t\s]*(\d+)/i) ??
      block.match(/IndiGo[\t\s]*(6E)[\t\s]*(\d+)/i) ??
      block.match(/\b(AI|6E|IX|UK|SG)[\t\s]*(\d{3,4})\b/i);
    if (!flight) continue;

    const depCity = cleanPdfWhitespace(block.match(/Departure[\t\s]*\n[\t\s]*([^\n(]+)/i)?.[1] ?? '');
    const arrCity = cleanPdfWhitespace(block.match(/Arrival[\t\s]*\n[\t\s]*([^\n(]+)/i)?.[1] ?? '');
    const dep = parseSafarmateVoucherDateTime(block, 'Departure');
    const arr = parseSafarmateVoucherDateTime(block, 'Arrival');

    segments.push(
      normaliseFlight({
        pnr: charges.pnr,
        bookingReference: charges.bookingId,
        airline: /IndiGo/i.test(block) ? 'IndiGo' : 'Air India',
        airlineCode: flight[1].toUpperCase(),
        flightNumber: `${flight[1].toUpperCase()} ${flight[2]}`,
        fromAirport,
        toAirport,
        fromCity: depCity,
        toCity: arrCity,
        departureAt: dep ? parseVoucherDate('', dep.date, dep.time) : '',
        arrivalAt: arr ? parseVoucherDate('', arr.date, arr.time) : '',
        passengers: charges.billToName ? [{ name: charges.billToName, seat: '', cabin: '' }] : [],
        status: 'booked',
      })
    );
  }

  let finalSegments = dedupeFlightSegments(segments);

  if (finalSegments.length === 0) {
    const sector = flat.match(/\b([A-Z]{3})\s*-\s*([A-Z]{3})\b/);
    const flight = flat.match(/\b(AI|6E)\s*(\d{3,4})\b/);
    if (sector && flight) {
      finalSegments = [
        normaliseFlight({
          pnr: charges.pnr,
          airline: 'Air India',
          airlineCode: flight[1],
          flightNumber: `${flight[1]} ${flight[2]}`,
          fromAirport: sector[1],
          toAirport: sector[2],
          passengers: charges.billToName ? [{ name: charges.billToName, seat: '', cabin: '' }] : [],
          status: 'booked',
        }),
      ];
    }
  }

  return { format: 'safarmate_voucher', segments: finalSegments, charges, rawTextLength: raw.length };
}

function parseGeneric(flat: string, raw: string, fileName?: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  charges.pnr =
    (flat.match(/PNR[:\s/]+([A-Z0-9]{6})/i)?.[1] ??
      flat.match(/BOOKING\s*REFERENCE[:\s]+([A-Z0-9]{6})/i)?.[1])?.toUpperCase() ?? '';
  charges.bookingId = charges.pnr;

  const total = flat.match(/Total(?:\s*Amount)?[:\s]+INR\s*([\d,]+)/i)?.[1]?.replace(/,/g, '');
  if (total) charges.grandTotal = Number(total) || 0;

  charges.billToName = pickLongestPassengerName(
    extractPassengerNameFromSection(raw.slice(0, 1200)),
    passengerNameFromFileName(fileName)
  );

  const segments: NormalisedFlight[] = [];
  const flightRe =
    /\b(AI|6E|IX|UK|SG|QP)\s*(\d{2,4})\b/gi;
  const sector = flat.match(/\b([A-Z]{3})-([A-Z]{3})\b/);
  let fm: RegExpExecArray | null;
  while ((fm = flightRe.exec(flat)) !== null) {
    segments.push(
      normaliseFlight({
        pnr: charges.pnr,
        airlineCode: fm[1].toUpperCase(),
        flightNumber: `${fm[1].toUpperCase()} ${fm[2]}`,
        fromAirport: sector?.[1] ?? '',
        toAirport: sector?.[2] ?? '',
        status: 'confirmed',
      })
    );
  }

  return { format: 'generic', segments, charges, rawTextLength: raw.length };
}

export function extractFromFlightPdfText(rawText: string, fileName?: string): FlightPdfExtraction {
  const flat = flattenPdfText(rawText);
  const format = detectFormat(flat, rawText);

  if (format === 'air_india_eticket') return parseAirIndia(flat, rawText, fileName);
  if (format === 'indigo_itinerary') return parseIndigo(flat, rawText, fileName);
  if (format === 'safarmate_voucher') return parseSafarmateVoucher(rawText, fileName);

  const generic = parseGeneric(flat, rawText, fileName);
  if (generic.segments.length > 0) return generic;

  return generic;
}

export async function extractFromFlightPdfBase64(
  base64: string,
  fileName?: string
): Promise<FlightPdfExtraction> {
  const buffer = decodePdfBase64(base64);
  const text = await pdfBufferToText(buffer);
  if (!text.trim()) {
    return { format: 'generic', segments: [], charges: emptyFlightBillCharges(), rawTextLength: 0 };
  }
  return extractFromFlightPdfText(text, fileName);
}
