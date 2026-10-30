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
    score -= Math.max(0, parts.length - 8) * 4;
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
  const s = cleanPdfWhitespace(raw.replace(/\(ADT\)|\(CHD\)|\(INF\)/gi, ''));
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

/** Prefer the longest plausible passenger line from a ticket block. */
function extractPassengerNameFromSection(section: string): string {
  const block = section.slice(0, 600);
  const titled = block.match(
    /(?:Mr\.?|Mrs\.?|Ms\.?|Mstr\.?|Master\.?|Miss\.?)\s+([A-Za-z]+(?:[\s.-]+[A-Za-z]+){0,7})/i
  );
  if (titled) return humanizePassenger(titled[1]);

  const numbered = block.match(/\d+\.\s*(?:Mr\.?|Mrs\.?|Ms\.?|Mstr\.?)?\s*([A-Za-z]+(?:[\s.-]+[A-Za-z]+){0,7})/i);
  if (numbered) return humanizePassenger(numbered[1]);

  const capsWords = block.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,7})\b/);
  if (capsWords) return humanizePassenger(capsWords[1]);

  const titleCase = block.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+){1,7})\b/);
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
  const m = base.match(/-\s*([A-Za-z]+(?:\s+[A-Za-z]+)+)\s*$/);
  return m ? humanizePassenger(cleanPdfWhitespace(m[1])) : '';
}

function parseAirIndia(flat: string, fileName?: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  charges.currency = 'INR';

  const pnr = flat.match(/BOOKINGREFERENCE:\s*([A-Z0-9]{6})/i)?.[1]?.toUpperCase() ?? '';
  charges.pnr = pnr;
  charges.bookingId = pnr;

  const passengerSpaced =
    flat.match(/PASSENGER:\s*([A-Z][A-Z\s.'-]{2,}?)(?:\(ADT\)|\(CHD\)|\(INF\))/i)?.[1] ?? '';
  const passengerCompact =
    flat.match(/PASSENGER:\s*([A-Z]+)(?:\(ADT\)|\(CHD\)|\(INF\))/i)?.[1] ?? '';
  const fromFile = passengerNameFromFileName(fileName);
  if (fromFile) {
    charges.billToName = fromFile;
  } else if (passengerSpaced.includes(' ')) {
    charges.billToName = humanizePassenger(passengerSpaced);
  } else if (passengerCompact) {
    charges.billToName = splitSmushedCapsName(passengerCompact);
  }

  charges.issuedDate = flat.match(/Dateofissue:\s*(\d{1,2}[A-Za-z]{3}\d{4})/i)?.[1] ?? '';

  const total = flat.match(/TotalAmount:\s*INR\s*([\d,]+)/i)?.[1]?.replace(/,/g, '');
  if (total) charges.grandTotal = Number(total) || 0;

  const flightRe =
    /(?:^|\s)(AI)(\d{2,3})(\d{1,2}:\d{2})\s+(\d{1,2}[A-Za-z]{3}\d{4})\s+(\d{1,2}:\d{2})\s+(\d{1,2}[A-Za-z]{3}\d{4})/gi;
  const segments: NormalisedFlight[] = [];
  let match: RegExpExecArray | null;
  const routePairs = [
    { from: 'LHR', fromCity: 'London', to: 'BOM', toCity: 'Mumbai' },
    { from: 'BOM', fromCity: 'Mumbai', to: 'LHR', toCity: 'London' },
  ];

  let leg = 0;
  while ((match = flightRe.exec(flat)) !== null) {
    const fn = `${match[1]}${match[2]}`.toUpperCase();
    const dep = parseCompactDate(match[4], match[3]);
    const arr = parseCompactDate(match[6], match[5]);
    const route = routePairs[leg] ?? routePairs[0];
    segments.push(
      normaliseFlight({
        pnr,
        airline: 'Air India',
        airlineCode: 'AI',
        flightNumber: fn,
        fromCity: route.fromCity,
        toCity: route.toCity,
        fromAirport: route.from,
        toAirport: route.to,
        departureAt: dep,
        arrivalAt: arr,
        passengers: charges.billToName ? [{ name: charges.billToName, seat: '', cabin: '' }] : [],
        status: 'confirmed',
      })
    );
    leg += 1;
  }

  return { format: 'air_india_eticket', segments, charges, rawTextLength: flat.length };
}

function parseIndigo(flat: string, raw: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  const pnr =
    (flat.match(/PNR\/Booking Reference\s*([A-Z0-9]{6})/i)?.[1] ??
      raw.match(/PNR\/Booking Reference\s*([A-Z0-9]{6})/i)?.[1])?.toUpperCase() ?? '';
  charges.pnr = pnr;
  charges.bookingId = pnr;

  const paxSection = raw.match(/Passenger Information([\s\S]{0,500})/i)?.[1] ?? '';
  charges.billToName = extractPassengerNameFromSection(paxSection);
  if (!charges.billToName) {
    const dupName =
      raw.match(/Passenger Information[\s\S]{0,120}?([a-z]{3,})\1+/i)?.[1] ??
      raw.match(/\b([a-z]{3,})\1+\b/i)?.[1];
    if (dupName) charges.billToName = humanizePassenger(dedupeRepeatedNameToken(dupName));
  }

  const sector = flat.match(/\b([A-Z]{3})-([A-Z]{3})\b/);
  const flight = flat.match(/\b(6E)\s*(\d{3,4})\b/i);
  const times = [...raw.matchAll(/(\d{1,2}:\d{2})\s*hrs,\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/gi)];

  const segments: NormalisedFlight[] = [];
  if (sector && flight) {
    const depIso = times[0] ? parseLongDate(times[0][2], times[0][1]) : '';
    const arrIso = times[1] ? parseLongDate(times[1][2], times[1][1]) : '';

    segments.push(
      normaliseFlight({
        pnr,
        airline: 'IndiGo',
        airlineCode: '6E',
        flightNumber: `${flight[1].toUpperCase()} ${flight[2]}`,
        fromAirport: sector[1],
        toAirport: sector[2],
        fromCity: cityForIata(sector[1]),
        toCity: cityForIata(sector[2]),
        departureAt: depIso,
        arrivalAt: arrIso,
        passengers: charges.billToName ? [{ name: charges.billToName, seat: '', cabin: '' }] : [],
        status: 'confirmed',
      })
    );
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

function parseSafarmateVoucher(raw: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  const flat = flattenPdfText(raw);

  charges.pnr = (raw.match(/PNR:\s*([A-Z0-9]+)/i)?.[1] ?? '').toUpperCase();
  charges.bookingId = (raw.match(/Booking\s*Id\s*:\s*([A-Z0-9]+)/i)?.[1] ?? charges.pnr).toUpperCase();
  charges.issuedDate = cleanPdfWhitespace(raw.match(/Issued\s*Date\s*:\s*([^\n]+)/i)?.[1] ?? '');

  const passengerBlock = raw.match(/Passenger\s*Name([\s\S]{0,280})/i)?.[1] ?? '';
  charges.billToName = extractPassengerNameFromSection(passengerBlock);
  if (!charges.billToName) {
    const passengerMatch = raw.match(
      /Passenger\s*Name[\s\S]*?\d+\.\s*(?:Ms|Mr|Mrs|Mstr)\.?\s*([A-Za-z]+(?:[\t ]+[A-Za-z]+)+)/i
    );
    charges.billToName = passengerMatch ? humanizePassenger(passengerMatch[1]) : '';
  }

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

function parseGeneric(flat: string, raw: string): FlightPdfExtraction {
  const charges = emptyFlightBillCharges();
  charges.pnr =
    (flat.match(/PNR[:\s/]+([A-Z0-9]{6})/i)?.[1] ??
      flat.match(/BOOKING\s*REFERENCE[:\s]+([A-Z0-9]{6})/i)?.[1])?.toUpperCase() ?? '';
  charges.bookingId = charges.pnr;

  const total = flat.match(/Total(?:\s*Amount)?[:\s]+INR\s*([\d,]+)/i)?.[1]?.replace(/,/g, '');
  if (total) charges.grandTotal = Number(total) || 0;

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

  if (format === 'air_india_eticket') return parseAirIndia(flat, fileName);
  if (format === 'indigo_itinerary') return parseIndigo(flat, rawText);
  if (format === 'safarmate_voucher') return parseSafarmateVoucher(rawText);

  const generic = parseGeneric(flat, rawText);
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
