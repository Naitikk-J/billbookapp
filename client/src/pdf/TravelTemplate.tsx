import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Company, Invoice } from '@/lib/types';
import { ensureFonts, fmt, fmtDate } from './shared';

ensureFonts();

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#0B1220',
  },
  hero: {
    padding: 36,
    paddingBottom: 60,
    backgroundColor: '#0B1220',
    color: '#FFFFFF',
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 18, fontWeight: 800 },
  badge: {
    backgroundColor: '#10B981',
    color: '#0B1220',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
  },
  heroBody: { marginTop: 28 },
  heroLabel: { fontSize: 9, letterSpacing: 1.2, color: '#9AA8C7', textTransform: 'uppercase' },
  heroDest: { fontSize: 32, fontWeight: 800, marginTop: 4, letterSpacing: -0.6 },
  heroMeta: { flexDirection: 'row', gap: 24, marginTop: 16 },
  heroMetaItem: {},
  heroMetaValue: { fontSize: 14, fontWeight: 700 },
  heroMetaLabel: { fontSize: 9, color: '#9AA8C7', marginTop: 2 },
  body: { padding: 36, marginTop: -34 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7ECF5',
    borderRadius: 12,
    padding: 18,
  },
  partyRow: { flexDirection: 'row', gap: 16, marginBottom: 18 },
  partyCol: { flex: 1 },
  partyLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#637299',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  partyName: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  muted: { color: '#637299' },
  packageRow: { flexDirection: 'row', marginTop: 10 },
  packageItem: { flex: 1 },
  table: { marginTop: 18, borderRadius: 10, overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F8',
    backgroundColor: '#FFFFFF',
  },
  rowAlt: { backgroundColor: '#FAFBFE' },
  cellDesc: { flex: 3 },
  cellQty: { flex: 1, textAlign: 'right' },
  cellRate: { flex: 1, textAlign: 'right' },
  cellTax: { flex: 1, textAlign: 'right' },
  cellAmount: { flex: 1.2, textAlign: 'right', fontWeight: 700 },
  totals: { marginTop: 18, alignSelf: 'flex-end', width: 280 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0B1220',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  grandLabel: { fontSize: 10, letterSpacing: 1.2, color: '#9AA8C7' },
  grandValue: { fontSize: 18, fontWeight: 800, letterSpacing: -0.4 },
  bankBox: {
    marginTop: 22,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7ECF5',
    backgroundColor: '#F8FAFC',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#637299',
    fontSize: 8.5,
  },
});

export function TravelTemplate({ invoice, company }: { invoice: Invoice; company: Company | null }) {
  const td = invoice.travelDetails ?? {};
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.brand}>{company?.name ?? 'Your Company'}</Text>
              <Text style={{ color: '#9AA8C7', marginTop: 4 }}>
                {invoice.kind === 'invoice' ? 'Travel package invoice' : invoice.kind.toUpperCase()}
                {'  ·  '}
                {invoice.number}
              </Text>
            </View>
            <Text style={styles.badge}>{invoice.status.toUpperCase()}</Text>
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroLabel}>Destination</Text>
            <Text style={styles.heroDest}>{td.destination || 'Travel Package'}</Text>
            <View style={styles.heroMeta}>
              {td.startDate ? (
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaValue}>
                    {fmtDate(td.startDate)} → {fmtDate(td.endDate)}
                  </Text>
                  <Text style={styles.heroMetaLabel}>Travel dates</Text>
                </View>
              ) : null}
              {td.adults || td.children ? (
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaValue}>
                    {td.adults ?? 0} adults · {td.children ?? 0} children
                  </Text>
                  <Text style={styles.heroMetaLabel}>Passengers</Text>
                </View>
              ) : null}
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaValue}>{fmt(invoice.grandTotal, invoice.currency)}</Text>
                <Text style={styles.heroMetaLabel}>Grand total</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <View style={styles.partyRow}>
              <View style={styles.partyCol}>
                <Text style={styles.partyLabel}>Billed to</Text>
                <Text style={styles.partyName}>{invoice.customerSnapshot.name || '—'}</Text>
                {invoice.customerSnapshot.address ? (
                  <Text style={styles.muted}>{invoice.customerSnapshot.address}</Text>
                ) : null}
                <Text style={styles.muted}>
                  {[
                    invoice.customerSnapshot.city,
                    invoice.customerSnapshot.state,
                    invoice.customerSnapshot.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
                {invoice.customerSnapshot.email ? (
                  <Text style={styles.muted}>{invoice.customerSnapshot.email}</Text>
                ) : null}
                {invoice.customerSnapshot.phone ? (
                  <Text style={styles.muted}>{invoice.customerSnapshot.phone}</Text>
                ) : null}
              </View>
              <View style={styles.partyCol}>
                <Text style={styles.partyLabel}>Invoice details</Text>
                <Text style={styles.muted}>Issue date: {fmtDate(invoice.issueDate)}</Text>
                {invoice.dueDate ? (
                  <Text style={styles.muted}>Due date: {fmtDate(invoice.dueDate)}</Text>
                ) : null}
                <Text style={styles.muted}>Currency: {invoice.currency}</Text>
                {company?.gstNumber ? (
                  <Text style={styles.muted}>Vendor GSTIN: {company.gstNumber}</Text>
                ) : null}
              </View>
            </View>

            {(td.hotel || td.flight || td.vehicle) ? (
              <View style={styles.packageRow}>
                {td.hotel ? (
                  <View style={styles.packageItem}>
                    <Text style={styles.partyLabel}>Hotel</Text>
                    <Text>{td.hotel}</Text>
                  </View>
                ) : null}
                {td.flight ? (
                  <View style={styles.packageItem}>
                    <Text style={styles.partyLabel}>Flight</Text>
                    <Text>{td.flight}</Text>
                  </View>
                ) : null}
                {td.vehicle ? (
                  <View style={styles.packageItem}>
                    <Text style={styles.partyLabel}>Vehicle</Text>
                    <Text>{td.vehicle}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={styles.cellDesc}>Service</Text>
              <Text style={styles.cellQty}>Qty</Text>
              <Text style={styles.cellRate}>Rate</Text>
              <Text style={styles.cellTax}>Tax</Text>
              <Text style={styles.cellAmount}>Amount</Text>
            </View>
            {invoice.items.map((item, idx) => (
              <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.rowAlt : {}]}>
                <View style={styles.cellDesc}>
                  <Text style={{ fontWeight: 600 }}>{item.description}</Text>
                  {item.hsnCode ? <Text style={styles.muted}>HSN {item.hsnCode}</Text> : null}
                </View>
                <Text style={styles.cellQty}>
                  {item.quantity} {item.unit}
                </Text>
                <Text style={styles.cellRate}>{fmt(item.rate, invoice.currency)}</Text>
                <Text style={styles.cellTax}>{item.taxPercent ?? 0}%</Text>
                <Text style={styles.cellAmount}>{fmt(item.amount ?? 0, invoice.currency)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Subtotal</Text>
              <Text>{fmt(invoice.subtotal, invoice.currency)}</Text>
            </View>
            {invoice.discountTotal ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>Discount</Text>
                <Text>− {fmt(invoice.discountTotal, invoice.currency)}</Text>
              </View>
            ) : null}
            {invoice.cgstTotal ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>CGST</Text>
                <Text>{fmt(invoice.cgstTotal, invoice.currency)}</Text>
              </View>
            ) : null}
            {invoice.sgstTotal ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>SGST</Text>
                <Text>{fmt(invoice.sgstTotal, invoice.currency)}</Text>
              </View>
            ) : null}
            {invoice.igstTotal ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>IGST</Text>
                <Text>{fmt(invoice.igstTotal, invoice.currency)}</Text>
              </View>
            ) : null}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>GRAND TOTAL</Text>
              <Text style={styles.grandValue}>{fmt(invoice.grandTotal, invoice.currency)}</Text>
            </View>
          </View>

          {(company?.bankName || company?.upiId) ? (
            <View style={styles.bankBox}>
              <Text style={styles.partyLabel}>Payment details</Text>
              {company.bankName ? <Text>Bank: {company.bankName}</Text> : null}
              {company.accountNumber ? <Text>A/c: {company.accountNumber}</Text> : null}
              {company.ifsc ? <Text>IFSC: {company.ifsc}</Text> : null}
              {company.upiId ? <Text>UPI: {company.upiId}</Text> : null}
            </View>
          ) : null}

          {invoice.notes ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.partyLabel}>Notes</Text>
              <Text>{invoice.notes}</Text>
            </View>
          ) : null}
          {invoice.terms ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.partyLabel}>Terms & conditions</Text>
              <Text>{invoice.terms}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text>{company?.name ?? ''}</Text>
          <Text>{company?.email ?? ''}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
