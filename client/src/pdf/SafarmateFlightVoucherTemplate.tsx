import { useMemo } from 'react';
import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Company, Invoice, TravelDetails } from '@/lib/types';
import { expandIndianState, formatAirportLine, formatSectorLabel } from '@/lib/airportNames';
import { fmtDate, safarmateLogoUrl } from './shared';
import { barcodeImageSrc } from './barcodeImageSrc';
import { barcodeDataUrl, sectorBarcodeValue } from './barcodeDataUrl';

const INK = '#1a1a1a';
const MUTED = '#555555';
const BORDER = '#d0d0d0';
const ACCENT = '#1F8A9B';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: INK,
    padding: 28,
    paddingBottom: 36,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 110, height: 48, objectFit: 'contain' },
  companyBlock: { flex: 1, paddingLeft: 12, textAlign: 'right' },
  companyName: { fontSize: 11, fontWeight: 700 },
  companyLine: { fontSize: 8, color: MUTED, lineHeight: 1.35, marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    marginTop: 14,
    borderWidth: 0.8,
    borderColor: BORDER,
    backgroundColor: '#FAFAFA',
  },
  metaCell: { flex: 1, padding: 8, borderRightWidth: 0.8, borderRightColor: BORDER },
  metaCellLast: { flex: 1, padding: 8 },
  metaLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase' },
  metaValue: { fontSize: 10, fontWeight: 700, marginTop: 2 },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 10,
    fontWeight: 700,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  passengerBox: {
    borderWidth: 0.8,
    borderColor: BORDER,
    padding: 10,
  },
  passengerName: { fontSize: 11, fontWeight: 700, flexWrap: 'wrap', lineHeight: 1.35 },
  sectorHeader: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 700,
    backgroundColor: '#E8F4F6',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  segmentCard: {
    borderWidth: 0.8,
    borderColor: BORDER,
    marginBottom: 8,
  },
  segmentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 0.8,
    borderBottomColor: BORDER,
  },
  flightLabel: { fontSize: 9, fontWeight: 700 },
  cabinLabel: { fontSize: 8, color: MUTED },
  segmentBody: { flexDirection: 'row', padding: 10 },
  leg: { flex: 1, paddingRight: 8 },
  legTitle: { fontSize: 7, color: MUTED, textTransform: 'uppercase' },
  legCity: { fontSize: 10, fontWeight: 700, marginTop: 2 },
  legSub: { fontSize: 8, color: MUTED, marginTop: 2, lineHeight: 1.3 },
  legTime: { fontSize: 9, fontWeight: 700, marginTop: 4 },
  legDate: { fontSize: 8, color: MUTED },
  segmentFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderTopWidth: 0.6,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footChip: { fontSize: 7.5, color: MUTED },
  termsTitle: { marginTop: 14, fontSize: 9, fontWeight: 700 },
  termsLine: { fontSize: 7.5, color: MUTED, lineHeight: 1.4, marginTop: 3 },
  thanks: { marginTop: 10, fontSize: 9, fontWeight: 700, textAlign: 'center', color: ACCENT },
  travellerSection: {
    marginTop: 14,
    borderWidth: 0.8,
    borderColor: BORDER,
  },
  travellerHead: {
    flexDirection: 'row',
    backgroundColor: '#E8F4F6',
    borderBottomWidth: 0.8,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  travellerHeadCell: { flex: 1, fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase' },
  travellerHeadBarcode: { width: 140, fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase' },
  travellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: BORDER,
  },
  travellerRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  travellerNameCol: { flex: 1, fontSize: 9, fontWeight: 700, flexWrap: 'wrap', lineHeight: 1.35 },
  travellerSectorCol: { flex: 1, fontSize: 9, fontWeight: 700 },
  barcodeImg: { width: 130, height: 32, objectFit: 'contain' },
  barcodePlaceholder: {
    width: 130,
    height: 32,
    backgroundColor: '#F0F0F0',
    borderWidth: 0.5,
    borderColor: BORDER,
  },
});

function clean(value?: string | null): string {
  const v = (value ?? '').trim();
  return v || '';
}

function pickLongestName(...candidates: Array<string | undefined | null>): string {
  return candidates
    .map((c) => clean(c))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? '';
}

function uniquePassengerNames(...sources: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sources) {
    const name = clean(s);
    if (!name) continue;
    for (const part of name.split(/\s*&\s*/)) {
      const p = clean(part);
      if (!p) continue;
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function passengerDisplayName(invoice: Invoice, segments: SegmentRow[]): string {
  const td = invoice.travelDetails ?? {};
  const fromSegments = segments.flatMap((s) => (s.passengers ?? []).map((p) => p.name));
  const names = uniquePassengerNames(
    td.travellerName,
    invoice.customerSnapshot?.name,
    ...fromSegments
  );
  if (names.length > 1) return names.join(' & ');
  if (names.length === 1) return names[0]!;
  return pickLongestName(td.travellerName, invoice.customerSnapshot?.name, ...fromSegments) || 'Passenger';
}

type SegmentRow = {
  pnr?: string;
  flightNumber?: string;
  airline?: string;
  fromCity?: string;
  fromAirport?: string;
  toCity?: string;
  toAirport?: string;
  departureAt?: string | null;
  arrivalAt?: string | null;
  passengers?: Array<{ name: string; cabin?: string }>;
};

/** Ticket times are stored as wall-clock ISO (Z is not a timezone shift). */
function wallClock(value?: string | null): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

function fmtLegDate(value?: string | null): string {
  const d = wallClock(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtLegTime(value?: string | null): string {
  const d = wallClock(value);
  if (!d) return '—';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function sectorHeading(seg: SegmentRow): string {
  return formatSectorLabel(seg.fromCity, seg.fromAirport, seg.toCity, seg.toAirport);
}

function segmentsFromInvoice(invoice: Invoice): SegmentRow[] {
  const td = (invoice.travelDetails ?? {}) as TravelDetails & { flightSegments?: SegmentRow[] };
  if (Array.isArray(td.flightSegments) && td.flightSegments.length > 0) {
    return td.flightSegments;
  }
  if (clean(td.flight) || clean(td.destination)) {
    return [
      {
        pnr: td.bookingId,
        flightNumber: td.flight,
        fromCity: '',
        toCity: td.destination,
        departureAt: td.startDate ?? null,
        arrivalAt: td.endDate ?? null,
        passengers: td.travellerName ? [{ name: td.travellerName }] : [],
      },
    ];
  }
  return [];
}

function issuedLabel(invoice: Invoice): string {
  const td = invoice.travelDetails ?? {};
  const fromNotes = clean(td.notes).replace(/^Issued:\s*/i, '');
  if (fromNotes) return fromNotes;
  return fmtDate(invoice.issueDate);
}

export function SafarmateFlightVoucherTemplate({
  invoice,
  company,
}: {
  invoice: Invoice;
  company: Company | null;
}) {
  const brand = clean(company?.legalName) || clean(company?.name) || 'Safarmate Travels LLP';
  const address = [
    clean(company?.address),
    [
      clean(company?.city),
      expandIndianState(clean(company?.state)),
      clean(company?.postalCode),
    ]
      .filter(Boolean)
      .join(', '),
  ]
    .filter(Boolean)
    .join(', ');
  const phone = clean(company?.phone);
  const td = invoice.travelDetails ?? {};
  const segments = useMemo(() => segmentsFromInvoice(invoice), [invoice]);
  const pnr = clean(td.bookingId) || segments[0]?.pnr || '—';
  const bookingId = clean(td.bookingId) || pnr;
  const passenger = passengerDisplayName(invoice, segments);
  const passengers = useMemo(() => {
    const td = invoice.travelDetails ?? {};
    const fromSeg = segments.flatMap((s) => (s.passengers ?? []).map((p) => p.name));
    const list = uniquePassengerNames(td.travellerName, invoice.customerSnapshot?.name, ...fromSeg);
    return list.length > 0 ? list : [passenger];
  }, [invoice, segments, passenger]);
  const snapshots = useMemo(
    () => (Array.isArray(td.barcodeSnapshots) ? td.barcodeSnapshots.filter(Boolean) : []),
    [td.barcodeSnapshots]
  );

  const { pnrSnapshot, sectorSnapshots } = useMemo(() => {
    if (snapshots.length === 0) {
      return { pnrSnapshot: null as string | null, sectorSnapshots: [] as string[] };
    }
    const segCount = segments.length;
    if (segCount > 1 && snapshots.length >= segCount) {
      return {
        pnrSnapshot: snapshots[0] ?? null,
        sectorSnapshots: snapshots.slice(1, 1 + segCount),
      };
    }
    return {
      pnrSnapshot: snapshots[0] ?? null,
      sectorSnapshots: snapshots.length > 1 ? snapshots.slice(1) : snapshots,
    };
  }, [snapshots, segments.length]);

  const travellerRows = useMemo(() => {
    const paxList = passengers;
    const segCount = Math.max(segments.length, 1);
    const perPaxBarcodes = snapshots.length === paxList.length;
    const perSegBarcodes =
      !perPaxBarcodes && snapshots.length >= segCount && paxList.length === 1;

    return paxList.flatMap((paxName, pi) =>
      segments.map((seg, si) => {
        let src: string | null = null;
        if (perPaxBarcodes) src = snapshots[pi] ?? null;
        else if (perSegBarcodes) src = sectorSnapshots[si] ?? snapshots[si] ?? null;
        else if (paxList.length === 1 && segCount > 1) {
          src = sectorSnapshots[si] ?? snapshots[si + 1] ?? snapshots[si] ?? null;
        } else {
          src = snapshots[pi] ?? sectorSnapshots[si] ?? snapshots[si] ?? null;
        }

        const generated = barcodeDataUrl(
          sectorBarcodeValue(pnr !== '—' ? pnr : bookingId, seg.fromAirport ?? '', seg.toAirport ?? ''),
          { height: 34, lineWidth: 1 }
        );
        return {
          key: `${pi}-${si}-${sectorHeading(seg)}`,
          paxName,
          sectorLabel: sectorHeading(seg),
          src: src || generated,
        };
      })
    );
  }, [passengers, segments, snapshots, sectorSnapshots, pnr, bookingId]);

  const pnrBarcodeSrc = useMemo(
    () => pnrSnapshot || barcodeDataUrl(pnr !== '—' ? pnr : bookingId, { height: 28, lineWidth: 1.2 }),
    [pnrSnapshot, pnr, bookingId]
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={safarmateLogoUrl()} style={styles.logo} />
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{brand}</Text>
            {address ? <Text style={styles.companyLine}>{address}</Text> : null}
            {phone ? <Text style={styles.companyLine}>Phone: {phone}</Text> : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>PNR</Text>
            <Text style={styles.metaValue}>{pnr}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Booking ID</Text>
            <Text style={styles.metaValue}>{bookingId}</Text>
          </View>
          <View style={styles.metaCellLast}>
            <Text style={styles.metaLabel}>Issued date</Text>
            <Text style={styles.metaValue}>{issuedLabel(invoice)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Passenger</Text>
        <View style={styles.passengerBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              {passengers.map((name, idx) => (
                <Text key={`${name}-${idx}`} style={styles.passengerName}>
                  {passengers.length > 1 ? `${idx + 1}. ` : '1. '}
                  {name}
                </Text>
              ))}
              {invoice.number && invoice.number !== 'DRAFT' ? (
                <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>
                  Voucher ref: {invoice.number}
                </Text>
              ) : null}
            </View>
            {pnrBarcodeSrc ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 7, color: MUTED, marginBottom: 2 }}>PNR barcode</Text>
                <Image src={barcodeImageSrc(pnrBarcodeSrc)} style={{ width: 100, height: 26, objectFit: 'contain' }} />
              </View>
            ) : null}
          </View>
        </View>

        {segments.map((seg, idx) => (
          <View key={`${seg.flightNumber}-${idx}`} wrap={false}>
            <Text style={styles.sectorHeader}>{sectorHeading(seg)}</Text>
            <View style={styles.segmentCard}>
              <View style={styles.segmentTop}>
                <Text style={styles.flightLabel}>
                  {[clean(seg.airline), clean(seg.flightNumber)].filter(Boolean).join(' ') ||
                    'Flight'}
                </Text>
                <Text style={styles.cabinLabel}>Economy</Text>
              </View>
              <View style={styles.segmentBody}>
                <View style={styles.leg}>
                  <Text style={styles.legTitle}>Departure</Text>
                  <Text style={styles.legCity}>
                    {formatAirportLine(seg.fromCity, seg.fromAirport)}
                  </Text>
                  <Text style={styles.legTime}>{fmtLegTime(seg.departureAt)}</Text>
                  <Text style={styles.legDate}>{fmtLegDate(seg.departureAt)}</Text>
                </View>
                <View style={styles.leg}>
                  <Text style={styles.legTitle}>Arrival</Text>
                  <Text style={styles.legCity}>
                    {formatAirportLine(seg.toCity, seg.toAirport)}
                  </Text>
                  <Text style={styles.legTime}>{fmtLegTime(seg.arrivalAt)}</Text>
                  <Text style={styles.legDate}>{fmtLegDate(seg.arrivalAt)}</Text>
                </View>
              </View>
              <View style={styles.segmentFoot}>
                {seg.pnr ? <Text style={styles.footChip}>Airline PNR: {seg.pnr}</Text> : null}
                <Text style={styles.footChip}>Status: Confirmed</Text>
              </View>
            </View>
          </View>
        ))}

        {travellerRows.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Traveller details</Text>
            <View style={styles.travellerSection}>
              <View style={styles.travellerHead}>
                <Text style={styles.travellerHeadCell}>Pax name</Text>
                <Text style={styles.travellerHeadCell}>Segment</Text>
                <Text style={styles.travellerHeadBarcode}>Barcode</Text>
              </View>
              {travellerRows.map((row, idx) => (
                <View
                  key={row.key}
                  style={
                    idx === travellerRows.length - 1 ? styles.travellerRowLast : styles.travellerRow
                  }
                >
                  <Text style={styles.travellerNameCol}>{row.paxName}</Text>
                  <Text style={styles.travellerSectorCol}>{row.sectorLabel}</Text>
                  {row.src ? (
                    <Image src={barcodeImageSrc(row.src)} style={styles.barcodeImg} />
                  ) : (
                    <View style={styles.barcodePlaceholder} />
                  )}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.termsTitle}>Terms &amp; conditions</Text>
        <Text style={styles.termsLine}>
          • All passengers must carry valid photo ID at check-in (Passport, Aadhaar, Driving Licence,
          etc.).
        </Text>
        <Text style={styles.termsLine}>
          • Reach the airport at least 2 hours before domestic and 4 hours before international
          departures.
        </Text>
        <Text style={styles.termsLine}>
          • Flight timings are subject to change; recheck with the airline before travel.
        </Text>
        <Text style={styles.termsLine}>
          • Cabin baggage as per airline/BCAS rules (typically 7 kg, one piece within size limits).
        </Text>
        {clean(invoice.terms) ? (
          <Text style={styles.termsLine}>• {clean(invoice.terms)}</Text>
        ) : null}

        <Text style={styles.thanks}>Thank you for booking with us. Have a safe journey!</Text>
      </Page>
    </Document>
  );
}
