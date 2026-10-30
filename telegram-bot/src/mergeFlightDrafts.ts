import type { FlightInvoiceDraft, FlightSegmentSnapshot } from '../../server/src/utils/flightInvoiceDraft.js';

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

export function pnrFromDraft(draft: FlightInvoiceDraft): string {
  const td = draft.travelDetails ?? {};
  const raw =
    clean(td.bookingId) ||
    clean(draft.segments?.[0]?.pnr) ||
    clean(
      (draft.segments ?? []).find((s) => clean(s.pnr))?.pnr
    );
  return raw.toUpperCase().replace(/\s+/g, '');
}

export function passengerNameFromDraft(draft: FlightInvoiceDraft): string {
  const td = draft.travelDetails ?? {};
  const fromSeg = (draft.segments ?? []).flatMap((s) =>
    (s.passengers ?? []).map((p) => clean(p.name)).filter(Boolean)
  );
  return (
    clean(td.travellerName) ||
    clean(draft.customerHint?.name) ||
    fromSeg[0] ||
    'Passenger'
  );
}

function segmentKey(seg: FlightSegmentSnapshot): string {
  return [
    clean(seg.flightNumber).toUpperCase(),
    clean(seg.fromAirport).toUpperCase() || clean(seg.fromCity).toUpperCase(),
    clean(seg.toAirport).toUpperCase() || clean(seg.toCity).toUpperCase(),
    clean(seg.departureAt),
  ].join('|');
}

function mergePassengers(
  target: FlightSegmentSnapshot,
  source: FlightSegmentSnapshot,
  passengerName: string
): void {
  const list = target.passengers ?? [];
  const names = new Set(list.map((p) => clean(p.name).toLowerCase()).filter(Boolean));
  const addFrom = [...(source.passengers ?? [])];
  if (passengerName && !names.has(passengerName.toLowerCase())) {
    addFrom.unshift({ name: passengerName, seat: '', cabin: '' });
  }
  for (const p of addFrom) {
    const n = clean(p.name);
    if (!n) continue;
    const key = n.toLowerCase();
    if (names.has(key)) continue;
    names.add(key);
    list.push({ name: n, seat: clean(p.seat), cabin: clean(p.cabin) });
  }
  target.passengers = list;
}

function mergeItems(drafts: FlightInvoiceDraft[]): FlightInvoiceDraft['items'] {
  let airfare = 0;
  let serviceFee = 0;
  for (const d of drafts) {
    for (const item of d.items ?? []) {
      const desc = item.description.toLowerCase();
      const rate = Number(item.rate) || 0;
      const qty = Number(item.quantity) || 1;
      const line = rate * qty;
      if (desc.includes('service')) serviceFee += line;
      else airfare += line * (1 - (Number(item.discountPercent) || 0) / 100);
    }
  }
  const base = drafts[0]!;
  const items: FlightInvoiceDraft['items'] = [];
  if (airfare > 0) {
    items.push({
      description: base.items[0]?.description ?? `Flight — ${base.travelDetails?.destination ?? 'booking'}`,
      hsnCode: '998552',
      quantity: 1,
      unit: 'pax',
      rate: Math.round(airfare * 100) / 100,
      taxPercent: 0,
      discountPercent: 0,
    });
  }
  if (serviceFee > 0) {
    items.push({
      description: 'Service Fees',
      hsnCode: '998552',
      quantity: 1,
      unit: 'nos',
      rate: Math.round(serviceFee * 100) / 100,
      taxPercent: 18,
      discountPercent: 0,
    });
  }
  if (items.length === 0 && base.items.length > 0) {
    return base.items.map((i) => ({ ...i }));
  }
  return items;
}

/** Combine same-PNR tickets (one PDF per passenger) into one Safarmate flight draft. */
export function mergeFlightDrafts(drafts: FlightInvoiceDraft[]): FlightInvoiceDraft {
  if (drafts.length === 0) throw new Error('No tickets to merge.');
  if (drafts.length === 1) return drafts[0]!;

  const pnrs = [...new Set(drafts.map(pnrFromDraft).filter(Boolean))];
  if (pnrs.length > 1) {
    throw new Error(
      `PNR mismatch (${pnrs.join(' / ')}). Send only tickets with the same booking reference.`
    );
  }
  if (pnrs.length === 0) {
    throw new Error('Could not read PNR from one or more PDFs.');
  }

  const base = structuredClone(drafts[0]!) as FlightInvoiceDraft;
  const segmentMap = new Map<string, FlightSegmentSnapshot>();

  for (const draft of drafts) {
    const pax = passengerNameFromDraft(draft);
    for (const seg of draft.segments ?? []) {
      const key = segmentKey(seg);
      let merged = segmentMap.get(key);
      if (!merged) {
        merged = structuredClone(seg);
        merged.passengers = [...(merged.passengers ?? [])];
        segmentMap.set(key, merged);
      }
      mergePassengers(merged, seg, pax);
    }
  }

  const segments = [...segmentMap.values()];
  if (segments.length === 0) {
    throw new Error('No flight segments found across PDFs.');
  }

  const passengerNames = drafts.map(passengerNameFromDraft).filter(Boolean);
  const uniqueNames: string[] = [];
  const seen = new Set<string>();
  for (const n of passengerNames) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueNames.push(n);
  }

  const barcodes: string[] = [];
  const barcodeSeen = new Set<string>();
  for (const d of drafts) {
    const td = d.travelDetails ?? {};
    const list = Array.isArray(td.barcodeSnapshots)
      ? (td.barcodeSnapshots as string[]).filter(Boolean)
      : [];
    for (const url of list) {
      if (barcodeSeen.has(url)) continue;
      barcodeSeen.add(url);
      barcodes.push(url);
    }
  }

  const joinedNames = uniqueNames.join(' & ');
  base.segments = segments;
  base.items = mergeItems(drafts);
  base.taxMode = base.items.some((i) => i.taxPercent > 0) ? 'intra' : 'none';
  base.customerHint = {
    ...base.customerHint,
    name: joinedNames || base.customerHint.name,
  };
  base.notes = `Merged ${drafts.length} tickets (PNR ${pnrs[0]}): ${drafts.map((d) => d.sourceFileName).join(', ')}`;
  base.sourceFileName = drafts.map((d) => d.sourceFileName).join(' + ');
  base.travelDetails = {
    ...base.travelDetails,
    bookingId: pnrs[0],
    travellerName: joinedNames,
    flightSegments: segments,
    barcodeSnapshots: barcodes.slice(0, 8),
  };

  return base;
}
