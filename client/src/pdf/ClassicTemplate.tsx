import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Company, Invoice } from '@/lib/types';
import { ensureFonts, fmt, fmtDate } from './shared';

ensureFonts();

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#0B1220',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 800, letterSpacing: -0.5 },
  subtitle: { fontSize: 11, color: '#637299', marginTop: 4, letterSpacing: 1 },
  divider: { borderBottomWidth: 1.4, borderBottomColor: '#0B1220', marginBottom: 18 },
  parties: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  partyCol: { width: '48%' },
  partyLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#637299',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  partyName: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  muted: { color: '#637299' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  table: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#0B1220' },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0B1220',
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E7ECF5',
  },
  cellDesc: { flex: 3 },
  cellQty: { flex: 1, textAlign: 'right' },
  cellRate: { flex: 1, textAlign: 'right' },
  cellTax: { flex: 1, textAlign: 'right' },
  cellAmount: { flex: 1.2, textAlign: 'right' },
  totals: { marginTop: 18, alignSelf: 'flex-end', width: 260 },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1.4,
    borderTopColor: '#0B1220',
    marginTop: 6,
  },
  grandLabel: { fontWeight: 700, letterSpacing: 1 },
  grandValue: { fontSize: 16, fontWeight: 800, letterSpacing: -0.4 },
  signature: { marginTop: 60, alignItems: 'flex-end' },
  signatureLine: { width: 180, borderTopWidth: 1, borderTopColor: '#0B1220', paddingTop: 6 },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 44,
    right: 44,
    textAlign: 'center',
    fontSize: 8.5,
    color: '#637299',
  },
});

export function ClassicTemplate({ invoice, company }: { invoice: Invoice; company: Company | null }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{invoice.kind === 'invoice' ? 'INVOICE' : invoice.kind.toUpperCase()}</Text>
            <Text style={styles.subtitle}>{invoice.number}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>{company?.name ?? 'Your Company'}</Text>
            {company?.address ? <Text style={styles.muted}>{company.address}</Text> : null}
            <Text style={styles.muted}>
              {[company?.city, company?.state, company?.postalCode].filter(Boolean).join(', ')}
            </Text>
            {company?.gstNumber ? <Text style={styles.muted}>GSTIN: {company.gstNumber}</Text> : null}
            {company?.email ? <Text style={styles.muted}>{company.email}</Text> : null}
            {company?.phone ? <Text style={styles.muted}>{company.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.parties}>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>Bill to</Text>
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
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Issue date</Text>
              <Text>{fmtDate(invoice.issueDate)}</Text>
            </View>
            {invoice.dueDate ? (
              <View style={styles.metaRow}>
                <Text style={styles.muted}>Due date</Text>
                <Text>{fmtDate(invoice.dueDate)}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Status</Text>
              <Text style={{ fontWeight: 700 }}>{invoice.status.toUpperCase()}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Currency</Text>
              <Text>{invoice.currency}</Text>
            </View>
          </View>
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
            <View key={idx} style={styles.tableRow}>
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
            <Text style={styles.grandLabel}>TOTAL</Text>
            <Text style={styles.grandValue}>{fmt(invoice.grandTotal, invoice.currency)}</Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.partyLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}
        {invoice.terms ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.partyLabel}>Terms</Text>
            <Text>{invoice.terms}</Text>
          </View>
        ) : null}

        <View style={styles.signature}>
          <View style={styles.signatureLine}>
            <Text>For {company?.name ?? 'Your Company'}</Text>
            <Text style={styles.muted}>Authorised signatory</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {company?.name ?? ''}
          {company?.upiId ? `  ·  UPI: ${company.upiId}` : ''}
          {company?.website ? `  ·  ${company.website}` : ''}
        </Text>
      </Page>
    </Document>
  );
}
