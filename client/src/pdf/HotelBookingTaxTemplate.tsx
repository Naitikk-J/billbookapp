import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Company, Invoice, InvoiceLineItem } from '@/lib/types';
import { fmt, fmtDate } from './shared';

const INK = '#111111';
const MUTED = '#444444';
const BORDER = '#CCCCCC';
const DASH = '#BBBBBB';
const RED = '#C62828';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: INK,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 26,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taxTitle: { fontSize: 16, fontWeight: 700, letterSpacing: 0.3 },
  issuerBlock: { width: 210, textAlign: 'right' },
  issuerName: { fontSize: 8.5, fontWeight: 700, lineHeight: 1.35 },
  issuerLine: { fontSize: 8, lineHeight: 1.35, color: MUTED },
  logoWrap: { alignItems: 'center', marginTop: -8, marginBottom: 6 },
  logo: { width: 120, height: 52, objectFit: 'contain' },
  metaBox: {
    flexDirection: 'row',
    borderWidth: 0.8,
    borderColor: BORDER,
    marginTop: 4,
    minHeight: 118,
  },
  metaCols: { flex: 1, flexDirection: 'row' },
  metaCol: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },
  metaDivider: { width: 0.8, backgroundColor: BORDER },
  metaRow: { flexDirection: 'row', marginTop: 2 },
  metaKey: { width: 92, fontSize: 7.5, color: MUTED },
  metaVal: { flex: 1, fontSize: 7.5, fontWeight: 700 },
  qrCol: {
    width: 92,
    borderLeftWidth: 0.8,
    borderLeftColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  qrImg: { width: 72, height: 72, objectFit: 'contain' },
  qrPlaceholder: { width: 72, height: 72, borderWidth: 0.6, borderColor: BORDER },
  customerBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: DASH,
    borderStyle: 'dashed',
    flexDirection: 'row',
  },
  customerCol: { flex: 1.2, paddingRight: 8 },
  travellerCol: { flex: 1, paddingLeft: 8 },
  customerName: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  line: { fontSize: 8, lineHeight: 1.35, marginTop: 1 },
  travellerTitle: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  bookingStrip: {
    marginTop: 10,
    flexDirection: 'row',
    borderWidth: 0.8,
    borderColor: BORDER,
    backgroundColor: '#FAFAFA',
  },
  bookingCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 0.8,
    borderRightColor: BORDER,
  },
  bookingCellLast: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },
  bookingLabel: { fontSize: 7, color: MUTED, marginBottom: 2 },
  bookingValue: { fontSize: 8.5, fontWeight: 700 },
  breakupWrap: { marginTop: 14, position: 'relative' },
  breakupTitle: {
    position: 'absolute',
    top: -7,
    left: '38%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  breakupBox: {
    borderWidth: 0.8,
    borderColor: BORDER,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  breakLabel: { fontSize: 8.5, flex: 1, paddingRight: 8 },
  breakValue: { fontSize: 8.5, fontWeight: 700, width: 90, textAlign: 'right' },
  breakDiscount: { color: RED },
  breakGrand: { marginTop: 4, paddingTop: 4, borderTopWidth: 0.6, borderTopColor: BORDER },
  finePrint: { marginTop: 10, fontSize: 6.8, color: MUTED, lineHeight: 1.45 },
  notice: { marginTop: 6, fontSize: 7.5, fontWeight: 700, textAlign: 'center' },
  termsTitle: { marginTop: 8, fontSize: 7.5, fontWeight: 700 },
  termsLine: { fontSize: 6.8, color: MUTED, lineHeight: 1.4, marginTop: 2 },
  pageFoot: {
    position: 'absolute',
    bottom: 14,
    left: 26,
    right: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: MUTED,
  },
});

function clean(value?: string | null): string {
  const v = (value ?? '').trim();
  if (!v || /^(na|n\/a|none|null|undefined|-)$/i.test(v)) return '';
  return v;
}

function safarmateLogoSrc(): string {
  const path = '/brand/safarmate-logo.png';
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

function fmtStayDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function lineGross(item: InvoiceLineItem): number {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  return Math.round((qty * rate + Number.EPSILON) * 100) / 100;
}

function isServiceFeeItem(item: InvoiceLineItem): boolean {
  return /service\s*fee|service charge|convenience|platform fee/i.test(item.description);
}

function splitAmounts(invoice: Invoice) {
  let serviceFees = 0;
  for (const item of invoice.items) {
    if (isServiceFeeItem(item)) serviceFees += lineGross(item);
  }
  const discount = invoice.discountTotal || 0;
  const grand = invoice.grandTotal || 0;
  const baseCharges = Math.round((grand + discount - serviceFees + Number.EPSILON) * 100) / 100;
  return { baseCharges, serviceFees, discount, grand };
}

function resolveBookingType(invoice: Invoice): 'hotel' | 'flight' {
  const td = invoice.travelDetails ?? {};
  const explicit = clean(td.bookingType);
  if (explicit === 'hotel' || explicit === 'flight') return explicit;
  if (clean(td.flight) && !clean(td.hotel)) return 'flight';
  return 'hotel';
}

function resolveBookingId(invoice: Invoice): string {
  const td = invoice.travelDetails ?? {};
  return clean(td.bookingId) || clean(td.packageName) || clean(invoice.tags?.[0]) || invoice.number;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaKey}>{label}</Text>
      <Text style={styles.metaVal}>{value}</Text>
    </View>
  );
}

export function HotelBookingTaxTemplate({
  invoice,
  company,
}: {
  invoice: Invoice;
  company: Company | null;
}) {
  const currency = invoice.currency || company?.currency || 'INR';
  const brand = clean(company?.legalName) || clean(company?.name) || 'Safarmate';
  const issuerAddress = [
    clean(company?.address),
    [clean(company?.city), clean(company?.state), clean(company?.postalCode)].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ');

  const customer = invoice.customerSnapshot ?? {};
  const td = invoice.travelDetails ?? {};
  const customerName =
    [clean(customer.name), clean(td.travellerName)].filter(Boolean).sort((a, b) => b.length - a.length)[0] ||
    brand;
  const customerAddress = [
    clean(customer.address),
    [clean(customer.city), clean(customer.state), clean(customer.postalCode)].filter(Boolean).join(' - '),
  ]
    .filter(Boolean)
    .join(', ');

  const placeOfSupply =
    clean(td.placeOfSupply) || clean(customer.state) || clean(company?.state) || '—';
  const txnCategory =
    clean(td.transactionalCategory) || (clean(customer.gstNumber) ? 'REG/B2B' : 'REG/B2C');
  const txnDetails = clean(td.transactionalDetails) || 'RG';
  const sac = clean(invoice.items.find((it) => clean(it.hsnCode))?.hsnCode) || '998552';
  const bookingType = resolveBookingType(invoice);
  const serviceDesc =
    clean(td.serviceDescription) ||
    clean(invoice.items[0]?.description) ||
    (bookingType === 'flight'
      ? 'Reservation service for air transport, tour operator and tourist assistance services'
      : 'Reservation service for accommodation, tour operator and tourist assistance services');
  const travellerName =
    [clean(td.travellerName), clean(customer.name)].filter(Boolean).sort((a, b) => b.length - a.length)[0] ||
    '—';
  const travellerPan = clean(td.travellerPan) || clean(customer.panNumber);
  const panHolderName = clean(td.panHolderName) || travellerName.toUpperCase();
  const voucherNo = clean(td.advancedReceiptVoucherNo);
  const hotelCity = (clean(td.hotelCity) || clean(td.destination) || clean(customer.city) || '—').toUpperCase();
  const sector = (clean(td.destination) || clean(td.hotelCity) || '—').toUpperCase();
  const { baseCharges, serviceFees, discount, grand } = splitAmounts(invoice);
  const primaryChargeLabel =
    bookingType === 'flight'
      ? '*Airfare / Flight Charges* (Inclusive of applicable taxes)'
      : '*Accommodation Charges* (Inclusive of applicable taxes)';
  const discountLabel =
    bookingType === 'flight' ? 'Airline / supplier funded discount' : 'Hotel funded discount';
  const qrUrl = clean(company?.paymentQrUrl);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headRow}>
          <Text style={styles.taxTitle}>TAX INVOICE</Text>
          <View style={styles.issuerBlock}>
            <Text style={styles.issuerName}>{brand}</Text>
            {issuerAddress ? <Text style={styles.issuerLine}>{issuerAddress}</Text> : null}
          </View>
        </View>

        <View style={styles.logoWrap}>
          <Image src={safarmateLogoSrc()} style={styles.logo} />
        </View>

        <View style={styles.metaBox}>
          <View style={styles.metaCols}>
            <View style={styles.metaCol}>
              <MetaRow label="Booking ID" value={resolveBookingId(invoice)} />
              <MetaRow label="Invoice No." value={invoice.number} />
              <MetaRow label="Date" value={fmtDate(invoice.issueDate)} />
              <MetaRow label="Place of Supply" value={placeOfSupply} />
              <MetaRow label="Transactional Type/Category" value={txnCategory} />
              <MetaRow label="Transactional Details" value={txnDetails} />
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <MetaRow label="PAN" value={clean(company?.panNumber)} />
              <MetaRow label="HSN/SAC" value={sac} />
              <MetaRow label="GSTIN" value={clean(company?.gstNumber)} />
              <MetaRow label="CIN" value={clean(company?.cinNumber)} />
              <MetaRow label="Service Description" value={serviceDesc} />
              <MetaRow label="Tax Payable under RCM" value="No" />
              {voucherNo ? (
                <MetaRow label="Advanced Receipt Voucher No." value={voucherNo} />
              ) : null}
            </View>
          </View>
          <View style={styles.qrCol}>
            {qrUrl ? <Image src={qrUrl} style={styles.qrImg} /> : <View style={styles.qrPlaceholder} />}
          </View>
        </View>

        <View style={styles.customerBlock}>
          <View style={styles.customerCol}>
            <Text style={styles.customerName}>{customerName}</Text>
            {customerAddress ? <Text style={styles.line}>{customerAddress}</Text> : null}
            {clean(customer.city) || clean(customer.postalCode) ? (
              <Text style={styles.line}>
                {[clean(customer.address), clean(customer.city), clean(customer.postalCode)]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            ) : null}
          </View>
          <View style={styles.travellerCol}>
            <Text style={styles.travellerTitle}>Traveller Details</Text>
            <Text style={styles.line}>Traveller Name: {travellerName}</Text>
            {panHolderName ? (
              <Text style={styles.line}>PAN Holder's name: {panHolderName}</Text>
            ) : null}
            {travellerPan ? <Text style={styles.line}>PAN No.: {travellerPan}</Text> : null}
          </View>
        </View>

        <View style={styles.bookingStrip}>
          {bookingType === 'flight' ? (
            <>
              <View style={styles.bookingCell}>
                <Text style={styles.bookingLabel}>Flight / Airline</Text>
                <Text style={styles.bookingValue}>{clean(td.flight) || '—'}</Text>
              </View>
              <View style={styles.bookingCell}>
                <Text style={styles.bookingLabel}>Sector / Destination</Text>
                <Text style={styles.bookingValue}>{sector}</Text>
              </View>
              <View style={styles.bookingCell}>
                <Text style={styles.bookingLabel}>Departure</Text>
                <Text style={styles.bookingValue}>{fmtStayDate(td.startDate)}</Text>
              </View>
              <View style={styles.bookingCellLast}>
                <Text style={styles.bookingLabel}>Return</Text>
                <Text style={styles.bookingValue}>{fmtStayDate(td.endDate)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.bookingCell}>
                <Text style={styles.bookingLabel}>Hotel Name</Text>
                <Text style={styles.bookingValue}>{clean(td.hotel) || clean(td.packageName) || '—'}</Text>
              </View>
              <View style={styles.bookingCell}>
                <Text style={styles.bookingLabel}>Hotel City</Text>
                <Text style={styles.bookingValue}>{hotelCity}</Text>
              </View>
              <View style={styles.bookingCell}>
                <Text style={styles.bookingLabel}>Check-in</Text>
                <Text style={styles.bookingValue}>{fmtStayDate(td.startDate)}</Text>
              </View>
              <View style={styles.bookingCellLast}>
                <Text style={styles.bookingLabel}>Check-Out</Text>
                <Text style={styles.bookingValue}>{fmtStayDate(td.endDate)}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.breakupWrap}>
          <Text style={styles.breakupTitle}>PAYMENT BREAKUP</Text>
          <View style={styles.breakupBox}>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>{primaryChargeLabel}</Text>
              <Text style={styles.breakValue}>{fmt(baseCharges, currency)}</Text>
            </View>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>Service Fees</Text>
              <Text style={styles.breakValue}>{fmt(serviceFees, currency)}</Text>
            </View>
            <View style={styles.breakRow}>
              <Text style={[styles.breakLabel, styles.breakDiscount]}>{discountLabel}</Text>
              <Text style={[styles.breakValue, styles.breakDiscount]}>{fmt(discount, currency)}</Text>
            </View>
            <View style={[styles.breakRow, styles.breakGrand]}>
              <Text style={[styles.breakLabel, { fontWeight: 700 }]}>Grand Total</Text>
              <Text style={[styles.breakValue, { fontSize: 9 }]}>{fmt(grand, currency)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.finePrint}>
          Input tax credit is available only against the original tax invoice issued by the respective service
          provider. Safarmate acts as an intermediary and this document is issued on behalf of the service provider
          where applicable.
        </Text>
        <Text style={styles.notice}>This is not a valid travel document.</Text>

        <Text style={styles.termsTitle}>Terms &amp; Conditions</Text>
        <Text style={styles.termsLine}>
          1. Any dispute must be reported within 48 hours of receipt of this invoice.
        </Text>
        <Text style={styles.termsLine}>
          2. For B2B bookings, scan the QR code to verify invoice details where available.
        </Text>
        <Text style={styles.termsLine}>
          3. This is a system-generated invoice and does not require a signature.
        </Text>
        {clean(invoice.terms) ? <Text style={styles.termsLine}>4. {clean(invoice.terms)}</Text> : null}

        <View style={styles.pageFoot} fixed>
          <Text>
            Registered Office: {issuerAddress || brand}
          </Text>
          <Text>
            {invoice.number} · Page 1 of 1
          </Text>
        </View>
      </Page>
    </Document>
  );
}
