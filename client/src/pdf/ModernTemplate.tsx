import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Company, Invoice } from '@/lib/types';
import { ensureFonts, fmt, fmtDate } from './shared';

ensureFonts();

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#0B1220',
    backgroundColor: '#FFFFFF',
  },
  bandTop: {
    height: 6,
    backgroundColor: '#2A5BFF',
    marginHorizontal: -40,
    marginTop: -40,
    marginBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  company: { maxWidth: '55%' },
  brand: { fontSize: 18, fontWeight: 800, letterSpacing: -0.3 },
  muted: { color: '#637299' },
  metaBox: {
    backgroundColor: '#F5F7FB',
    padding: 14,
    borderRadius: 8,
    minWidth: 200,
  },
  metaTitle: { fontSize: 10, fontWeight: 700, color: '#2A5BFF', letterSpacing: 1, marginBottom: 6 },
  metaNumber: { fontSize: 20, fontWeight: 800, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  partiesRow: { flexDirection: 'row', gap: 16, marginBottom: 22 },
  party: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 14,
  },
  partyLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#637299',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  partyName: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  table: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E7ECF5' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#0B1220',
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F8',
  },
  rowAlt: { backgroundColor: '#FAFBFE' },
  cellDesc: { flex: 3 },
  cellQty: { flex: 1, textAlign: 'right' },
  cellRate: { flex: 1, textAlign: 'right' },
  cellTax: { flex: 1, textAlign: 'right' },
  cellAmount: { flex: 1.2, textAlign: 'right', fontWeight: 700 },
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  totalsBox: { width: 260 },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0B1220',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  grandLabel: { fontSize: 11, letterSpacing: 1, color: '#9AA8C7' },
  grandValue: { fontSize: 18, fontWeight: 800, letterSpacing: -0.4 },
  notesBox: {
    marginTop: 22,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E7ECF5',
    paddingTop: 8,
    color: '#637299',
    fontSize: 9,
  },
});

export function ModernTemplate({ invoice, company }: { invoice: Invoice; company: Company | null }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.bandTop} />
        <View style={styles.headerRow}>
          <View style={styles.company}>
            <Text style={styles.brand}>{company?.name ?? 'Your Company'}</Text>
            {company?.address ? <Text style={styles.muted}>{company.address}</Text> : null}
            <Text style={styles.muted}>
              {[company?.city, company?.state, company?.postalCode].filter(Boolean).join(', ')}
            </Text>
            {company?.gstNumber ? <Text style={styles.muted}>GSTIN: {company.gstNumber}</Text> : null}
            {company?.email ? <Text style={styles.muted}>{company.email}</Text> : null}
            {company?.phone ? <Text style={styles.muted}>{company.phone}</Text> : null}
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaTitle}>{invoice.kind.toUpperCase()}</Text>
            <Text style={styles.metaNumber}>{invoice.number}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Date</Text>
              <Text>{fmtDate(invoice.issueDate)}</Text>
            </View>
            {invoice.dueDate ? (
              <View style={styles.metaRow}>
                <Text style={styles.muted}>Due</Text>
                <Text>{fmtDate(invoice.dueDate)}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Status</Text>
              <Text style={{ fontWeight: 700, color: '#10B981' }}>
                {invoice.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.party}>
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
            {invoice.customerSnapshot.gstNumber ? (
              <Text style={styles.muted}>GSTIN: {invoice.customerSnapshot.gstNumber}</Text>
            ) : null}
            {invoice.customerSnapshot.email ? (
              <Text style={styles.muted}>{invoice.customerSnapshot.email}</Text>
            ) : null}
          </View>
          {invoice.travelDetails?.destination ? (
            <View style={styles.party}>
              <Text style={styles.partyLabel}>Travel details</Text>
              <Text style={styles.partyName}>
                {invoice.travelDetails.packageName || invoice.travelDetails.destination}
              </Text>
              <Text style={styles.muted}>Destination: {invoice.travelDetails.destination}</Text>
              {invoice.travelDetails.startDate ? (
                <Text style={styles.muted}>
                  {fmtDate(invoice.travelDetails.startDate)} —{' '}
                  {fmtDate(invoice.travelDetails.endDate)}
                </Text>
              ) : null}
              {invoice.travelDetails.adults || invoice.travelDetails.children ? (
                <Text style={styles.muted}>
                  {invoice.travelDetails.adults ?? 0} adults ·{' '}
                  {invoice.travelDetails.children ?? 0} children
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={styles.cellDesc}>Description</Text>
            <Text style={styles.cellQty}>Qty</Text>
            <Text style={styles.cellRate}>Rate</Text>
            <Text style={styles.cellTax}>Tax</Text>
            <Text style={styles.cellAmount}>Amount</Text>
          </View>
          {invoice.items.map((item, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.rowAlt : {}]}>
              <View style={styles.cellDesc}>
                <Text style={{ fontWeight: 600 }}>{item.description}</Text>
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

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
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
            {invoice.amountPaid ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>Paid</Text>
                <Text style={{ color: '#10B981', fontWeight: 700 }}>
                  {fmt(invoice.amountPaid, invoice.currency)}
                </Text>
              </View>
            ) : null}
            {invoice.balanceDue ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>Balance due</Text>
                <Text style={{ fontWeight: 700 }}>
                  {fmt(invoice.balanceDue, invoice.currency)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {(invoice.notes || invoice.terms) ? (
          <View style={styles.notesBox}>
            {invoice.notes ? (
              <>
                <Text style={[styles.partyLabel, { marginBottom: 4 }]}>Notes</Text>
                <Text>{invoice.notes}</Text>
              </>
            ) : null}
            {invoice.terms ? (
              <>
                <Text style={[styles.partyLabel, { marginTop: 8, marginBottom: 4 }]}>Terms</Text>
                <Text>{invoice.terms}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{company?.name ?? ''}</Text>
          <Text>
            {company?.upiId ? `UPI: ${company.upiId}` : ''}
            {company?.upiId && company?.website ? '  ·  ' : ''}
            {company?.website ?? ''}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
