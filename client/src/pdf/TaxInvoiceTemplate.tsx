import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Company, Invoice, InvoiceLineItem } from '@/lib/types';
import { fmtDate } from './shared';

const NAVY = '#16324F';
const TEAL = '#1F8A9B';
const GOLD = '#E0A23A';
const INK = '#1C2834';
const MUTED = '#5E6C7B';
const LINE = '#D5DEE6';
const WASH = '#F4F7F9';
const PAPER = '#FFFFFF';

const STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01',
  'himachal pradesh': '02',
  punjab: '03',
  chandigarh: '04',
  uttarakhand: '05',
  haryana: '06',
  delhi: '07',
  'new delhi': '07',
  rajasthan: '08',
  'uttar pradesh': '09',
  bihar: '10',
  sikkim: '11',
  'arunachal pradesh': '12',
  nagaland: '13',
  manipur: '14',
  mizoram: '15',
  tripura: '16',
  meghalaya: '17',
  assam: '18',
  'west bengal': '19',
  jharkhand: '20',
  odisha: '21',
  orissa: '21',
  chhattisgarh: '22',
  'madhya pradesh': '23',
  gujarat: '24',
  'dadra and nagar haveli and daman and diu': '26',
  'dadra and nagar haveli': '26',
  'daman and diu': '26',
  maharashtra: '27',
  karnataka: '29',
  goa: '30',
  lakshadweep: '31',
  kerala: '32',
  'tamil nadu': '33',
  puducherry: '34',
  pondicherry: '34',
  'andaman and nicobar islands': '35',
  telangana: '36',
  'andhra pradesh': '37',
  ladakh: '38',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: INK,
    backgroundColor: PAPER,
  },
  barTeal: { height: 5, backgroundColor: TEAL },
  barGold: { height: 2.5, backgroundColor: GOLD },
  body: { paddingHorizontal: 28, paddingTop: 18, paddingBottom: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: {
    fontSize: 8,
    fontWeight: 700,
    color: TEAL,
    letterSpacing: 1.6,
  },
  number: { marginTop: 2, fontSize: 13, fontWeight: 700, color: NAVY, letterSpacing: 0.2 },
  logo: { width: 118, height: 90, objectFit: 'contain' },
  dueRow: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: WASH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueLabel: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.8 },
  dueValue: { marginTop: 1, fontSize: 9, fontWeight: 700, color: NAVY },
  dueHint: { marginTop: 2, fontSize: 7, color: MUTED },
  dueAmount: { fontSize: 13, fontWeight: 700, color: NAVY },
  parties: {
    marginTop: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
  },
  party: { flex: 1, padding: 10 },
  partySplit: { width: 1, backgroundColor: LINE },
  partyKicker: {
    fontSize: 7,
    fontWeight: 700,
    color: TEAL,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  partyName: { fontSize: 10, fontWeight: 700, color: NAVY, marginBottom: 2 },
  partyLine: { fontSize: 8, color: INK, lineHeight: 1.35 },
  kv: { flexDirection: 'row', marginTop: 2, alignItems: 'flex-start' },
  kvKey: { width: 82, fontSize: 7.5, color: MUTED },
  kvVal: { flex: 1, fontSize: 7.5, fontWeight: 600, color: INK },
  sheet: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sheetHead: { flexDirection: 'row', backgroundColor: NAVY, color: '#FFFFFF' },
  headCell: { paddingVertical: 6, paddingHorizontal: 8 },
  headTitle: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: '#FFFFFF' },
  headSub: { fontSize: 6.5, color: '#C5D2DE', marginTop: 1 },
  sheetBody: { flexDirection: 'row' },
  col: { paddingVertical: 4 },
  colSplit: { width: 1, backgroundColor: LINE },
  itemRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 8 },
  itemDesc: { flex: 1.7, paddingRight: 6 },
  itemAmt: { flex: 0.9, textAlign: 'right' },
  svcDesc: { flex: 1.45, paddingRight: 4 },
  svcSac: { flex: 0.7, textAlign: 'center' },
  svcAmt: { flex: 0.95, textAlign: 'right' },
  itemTitle: { fontSize: 8, fontWeight: 600 },
  itemSub: { fontSize: 7, color: MUTED, marginTop: 1 },
  taxRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  taxLabel: { flex: 1.45, fontSize: 7.5, fontWeight: 700, color: MUTED },
  sheetFoot: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: WASH,
  },
  footCell: { paddingVertical: 6, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footLabel: { fontSize: 7.5, fontWeight: 700, color: NAVY },
  footValue: { fontSize: 8, fontWeight: 700, color: NAVY },
  summary: { marginTop: 10, alignSelf: 'flex-end', width: 230 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  sumLabel: { fontSize: 8, color: MUTED },
  sumValue: { fontSize: 8, fontWeight: 600 },
  netRow: {
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: NAVY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: { fontSize: 7.5, fontWeight: 700, color: '#D5E4EF', letterSpacing: 0.7 },
  netValue: { fontSize: 12, fontWeight: 700, color: '#FFFFFF' },
  lower: {
    marginTop: 14,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 10,
  },
  lowerCol: { flex: 1, paddingRight: 12 },
  blockKicker: {
    fontSize: 7,
    fontWeight: 700,
    color: TEAL,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  blockName: { fontSize: 9, fontWeight: 700, color: NAVY, marginBottom: 2 },
  blockLine: { fontSize: 7.5, color: INK, lineHeight: 1.4 },
  sign: { marginTop: 12, alignItems: 'flex-end' },
  forLine: { fontSize: 7.5, fontWeight: 700, color: NAVY },
  signGap: { height: 28 },
  signImg: { width: 90, height: 36, objectFit: 'contain', marginVertical: 2 },
  signLabel: {
    marginTop: 2,
    fontSize: 7,
    color: MUTED,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    paddingTop: 3,
    width: 120,
    textAlign: 'center',
  },
  payBox: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#FBF8F2',
    borderWidth: 1,
    borderColor: '#E7D7B4',
  },
  payLabel: { fontSize: 7, fontWeight: 700, color: '#8A6A22', letterSpacing: 0.8 },
  payLine: { marginTop: 2, fontSize: 7.5, color: INK, lineHeight: 1.4 },
  note: { marginTop: 8, fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  addressLine: { marginTop: 8, fontSize: 7, color: MUTED, textAlign: 'center', lineHeight: 1.35 },
  disclaimer: { marginTop: 4, fontSize: 7, color: MUTED, textAlign: 'center' },
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(amount: number, currency = 'INR'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return currency === 'INR' ? `Rs. ${formatted}` : `${currency} ${formatted}`;
}

function clean(value?: string | null): string {
  const v = (value ?? '').trim();
  if (!v || /^(na|n\/a|none|null|undefined|-)$/i.test(v)) return '';
  return v;
}

function gstStateCode(gst?: string): string {
  const g = clean(gst).toUpperCase();
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(g)) return g.slice(0, 2);
  return '';
}

function stateCode(state?: string, gst?: string): string {
  const fromGst = gstStateCode(gst);
  if (fromGst) return fromGst;
  const key = clean(state).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  return STATE_CODES[key] ?? '';
}

function addressLines(parts: {
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string[] {
  const lines: string[] = [];
  const street = clean(parts.address);
  if (street) lines.push(street);
  const cityLine = [clean(parts.city), clean(parts.state), clean(parts.postalCode)]
    .filter(Boolean)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  const country = clean(parts.country);
  if (country && country.toLowerCase() !== 'india') lines.push(country);
  return lines;
}

function lineTaxable(item: InvoiceLineItem): number {
  if (typeof item.taxableValue === 'number' && Number.isFinite(item.taxableValue)) {
    return item.taxableValue;
  }
  const gross = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  const disc = gross * ((Number(item.discountPercent) || 0) / 100);
  return round2(gross - disc);
}

function brandLogo(company: Company | null): string {
  const custom = clean(company?.logoUrl);
  if (custom) return custom;
  const path = '/brand/safarmate-logo.png';
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

function docTitle(kind: Invoice['kind']): string {
  if (kind === 'quote') return 'QUOTATION';
  if (kind === 'proforma') return 'PROFORMA INVOICE';
  if (kind === 'receipt') return 'RECEIPT';
  return 'TAX INVOICE';
}

function websiteLabel(website?: string): string {
  return clean(website).replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function Kv({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{label}</Text>
      <Text style={styles.kvVal}>{value}</Text>
    </View>
  );
}

export function TaxInvoiceTemplate({
  invoice,
  company,
}: {
  invoice: Invoice;
  company: Company | null;
}) {
  const currency = invoice.currency || company?.currency || 'INR';
  const brand = clean(company?.legalName) || clean(company?.name) || 'Safarmate';
  const customer = invoice.customerSnapshot ?? {};
  const customerLines = addressLines(customer);
  const companyLines = addressLines({
    address: company?.address,
    city: company?.city,
    state: company?.state,
    postalCode: company?.postalCode,
    country: company?.country,
  });
  const customerGst = clean(customer.gstNumber);
  const companyGst = clean(company?.gstNumber);
  const companyPan = clean(company?.panNumber);
  const cin = clean(company?.cinNumber);
  const customerState = clean(customer.state);
  const companyState = clean(company?.state);
  const supplyCode = stateCode(customerState, customerGst);
  const companyCode = stateCode(companyState, companyGst);

  const reimbursements =
    invoice.taxMode === 'none'
      ? invoice.items
      : invoice.items.filter((item) => !(Number(item.taxPercent) > 0));
  const taxableItems =
    invoice.taxMode === 'none'
      ? []
      : invoice.items.filter((item) => Number(item.taxPercent) > 0);

  const rates = [...new Set(taxableItems.map((item) => Number(item.taxPercent) || 0))];
  const uniformRate = rates.length === 1 ? rates[0] : null;
  const rateLabel = (value: number | null) =>
    value == null ? '-' : `${Number.isInteger(value) ? value.toFixed(0) : value}%`;
  const igstRate = invoice.taxMode === 'inter' ? rateLabel(uniformRate) : '-';
  const halfRate =
    invoice.taxMode === 'intra' && uniformRate != null ? rateLabel(uniformRate / 2) : '-';

  const reimbTotal = round2(reimbursements.reduce((sum, item) => sum + lineTaxable(item), 0));
  const serviceBase = round2(taxableItems.reduce((sum, item) => sum + lineTaxable(item), 0));
  const taxSum = round2(
    (invoice.cgstTotal || 0) + (invoice.sgstTotal || 0) + (invoice.igstTotal || 0)
  );
  const afterTax = round2(serviceBase + taxSum);

  const td = invoice.travelDetails ?? {};
  const trip = [clean(td.packageName), clean(td.destination)].filter(Boolean).join(' · ');
  const lead = clean(customer.name);

  const contactName = clean(company?.contactName);
  const phone = clean(company?.phone);
  const email = clean(company?.email);
  const website = websiteLabel(company?.website);
  const bankBits = [
    clean(company?.bankName) ? `Bank: ${clean(company?.bankName)}` : '',
    clean(company?.accountNumber) ? `A/c: ${clean(company?.accountNumber)}` : '',
    clean(company?.ifsc) ? `IFSC: ${clean(company?.ifsc)}` : '',
    clean(company?.bankBranch) ? `Branch: ${clean(company?.bankBranch)}` : '',
    clean(company?.upiId) ? `UPI: ${clean(company?.upiId)}` : '',
  ].filter(Boolean);
  const payableTo = clean(company?.beneficiaryName) || brand;
  const city = clean(company?.city);
  const registered = companyLines.join(', ');
  const net = invoice.amountPaid > 0 ? invoice.balanceDue : invoice.grandTotal;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.barTeal} />
        <View style={styles.barGold} />
        <View style={styles.body}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>{docTitle(invoice.kind)}</Text>
              <Text style={styles.number}>{invoice.number}</Text>
            </View>
            <Image src={brandLogo(company)} style={styles.logo} />
          </View>

          <View style={styles.dueRow}>
            <View>
              <Text style={styles.dueLabel}>PAYMENT DUE BY</Text>
              <Text style={styles.dueValue}>{invoice.dueDate ? fmtDate(invoice.dueDate) : '-'}</Text>
              <Text style={styles.dueHint}>Reverse charge applicable (Y/N): N</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.dueLabel}>AMOUNT</Text>
              <Text style={styles.dueAmount}>{money(invoice.grandTotal, currency)}</Text>
            </View>
          </View>

          <View style={styles.parties}>
            <View style={styles.party}>
              <Text style={styles.partyKicker}>BILLED TO</Text>
              <Text style={styles.partyName}>{lead || '-'}</Text>
              {customerLines.map((line) => (
                <Text key={line} style={styles.partyLine}>
                  {line}
                </Text>
              ))}
              <View style={{ marginTop: 6 }}>
                <Kv label="GSTIN" value={customerGst || '-'} />
                <Kv label="State" value={customerState} />
                <Kv label="Place of supply" value={customerState} />
                <Kv label="State code" value={supplyCode} />
                {clean(customer.phone) ? <Kv label="Phone" value={clean(customer.phone)} /> : null}
              </View>
            </View>
            <View style={styles.partySplit} />
            <View style={styles.party}>
              <Text style={styles.partyKicker}>ISSUED BY</Text>
              <Text style={styles.partyName}>{brand}</Text>
              {companyLines.map((line) => (
                <Text key={line} style={styles.partyLine}>
                  {line}
                </Text>
              ))}
              <View style={{ marginTop: 6 }}>
                <Kv label="GSTIN" value={companyGst || '-'} />
                <Kv label="PAN" value={companyPan} />
                <Kv label="State" value={companyState} />
                <Kv label="State code" value={companyCode} />
                {cin ? <Kv label="CIN / LLPIN" value={cin} /> : null}
              </View>
            </View>
          </View>

          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={[styles.headCell, { flex: 1 }]}>
                <Text style={styles.headTitle}>REIMBURSEMENT</Text>
                <Text style={styles.headSub}>Description · Amount</Text>
              </View>
              <View style={[styles.headCell, { flex: 1.15 }]}>
                <Text style={styles.headTitle}>TAXABLE SERVICES</Text>
                <Text style={styles.headSub}>Description · SAC · Taxable amount</Text>
              </View>
            </View>
            <View style={styles.sheetBody}>
              <View style={[styles.col, { flex: 1 }]}>
                {reimbursements.length === 0 ? (
                  <View style={styles.itemRow}>
                    <Text style={[styles.itemTitle, { color: MUTED }]}>-</Text>
                  </View>
                ) : (
                  reimbursements.map((item, index) => (
                    <View key={`r-${index}`} style={styles.itemRow}>
                      <View style={styles.itemDesc}>
                        <Text style={styles.itemTitle}>{item.description}</Text>
                        {index === 0 && lead ? (
                          <Text style={styles.itemSub}>Lead Pax: {lead}</Text>
                        ) : null}
                        {index === 0 && trip ? <Text style={styles.itemSub}>{trip}</Text> : null}
                      </View>
                      <Text style={styles.itemAmt}>{money(lineTaxable(item), currency)}</Text>
                    </View>
                  ))
                )}
              </View>
              <View style={styles.colSplit} />
              <View style={[styles.col, { flex: 1.15 }]}>
                {taxableItems.length === 0 ? (
                  <View style={styles.itemRow}>
                    <Text style={[styles.svcDesc, styles.itemTitle, { color: MUTED }]}>-</Text>
                    <Text style={styles.svcSac}>-</Text>
                    <Text style={styles.svcAmt}>{money(0, currency)}</Text>
                  </View>
                ) : (
                  taxableItems.map((item, index) => (
                    <View key={`t-${index}`} style={styles.itemRow}>
                      <Text style={[styles.svcDesc, styles.itemTitle]}>{item.description}</Text>
                      <Text style={styles.svcSac}>{clean(item.hsnCode) || '-'}</Text>
                      <Text style={styles.svcAmt}>{money(lineTaxable(item), currency)}</Text>
                    </View>
                  ))
                )}
                <View style={styles.taxRow}>
                  <Text style={styles.taxLabel}>IGST</Text>
                  <Text style={styles.svcSac}>{igstRate}</Text>
                  <Text style={styles.svcAmt}>{money(invoice.igstTotal || 0, currency)}</Text>
                </View>
                <View style={styles.taxRow}>
                  <Text style={styles.taxLabel}>CGST</Text>
                  <Text style={styles.svcSac}>{halfRate}</Text>
                  <Text style={styles.svcAmt}>{money(invoice.cgstTotal || 0, currency)}</Text>
                </View>
                <View style={styles.taxRow}>
                  <Text style={styles.taxLabel}>SGST</Text>
                  <Text style={styles.svcSac}>{halfRate}</Text>
                  <Text style={styles.svcAmt}>{money(invoice.sgstTotal || 0, currency)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.sheetFoot}>
              <View style={[styles.footCell, { flex: 1 }]}>
                <Text style={styles.footLabel}>Total reimbursement</Text>
                <Text style={styles.footValue}>{money(reimbTotal, currency)}</Text>
              </View>
              <View style={styles.colSplit} />
              <View style={[styles.footCell, { flex: 1.15 }]}>
                <Text style={styles.footLabel}>Total amount after tax</Text>
                <Text style={styles.footValue}>{money(afterTax, currency)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summary}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Gross total</Text>
              <Text style={styles.sumValue}>{money(invoice.grandTotal, currency)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Discount provided</Text>
              <Text style={styles.sumValue}>{money(invoice.discountTotal || 0, currency)}</Text>
            </View>
            {invoice.amountPaid > 0 ? (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Amount received</Text>
                <Text style={styles.sumValue}>{money(invoice.amountPaid, currency)}</Text>
              </View>
            ) : null}
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>NET RECEIVABLE</Text>
              <Text style={styles.netValue}>{money(net, currency)}</Text>
            </View>
          </View>

          <View style={styles.lower}>
            <View style={styles.lowerCol}>
              <Text style={styles.blockKicker}>COMPANY DETAILS</Text>
              <Text style={styles.blockName}>{brand}</Text>
              <Text style={styles.blockLine}>PAN: {companyPan || '-'}</Text>
              {companyLines.map((line) => (
                <Text key={`c-${line}`} style={styles.blockLine}>
                  {line}
                </Text>
              ))}
              <Text style={styles.blockLine}>
                {[cin ? `CIN: ${cin}` : '', `GSTIN: ${companyGst || '-'}`].filter(Boolean).join('   ·   ')}
              </Text>
            </View>
            <View style={styles.lowerCol}>
              <Text style={styles.blockKicker}>CONTACT</Text>
              {contactName ? <Text style={styles.blockName}>{contactName}</Text> : null}
              {phone ? <Text style={styles.blockLine}>Phone: {phone}</Text> : null}
              {website ? <Text style={styles.blockLine}>{website}</Text> : null}
              {email ? <Text style={styles.blockLine}>{email}</Text> : null}
              <View style={styles.sign}>
                <Text style={styles.forLine}>For {brand}</Text>
                {clean(company?.signatureUrl) ? (
                  <Image src={clean(company?.signatureUrl)} style={styles.signImg} />
                ) : (
                  <View style={styles.signGap} />
                )}
                <Text style={styles.signLabel}>Authorised signatory</Text>
              </View>
            </View>
          </View>

          <View style={styles.payBox}>
            <Text style={styles.payLabel}>PAYMENT</Text>
            <Text style={styles.payLine}>
              Payable by bank transfer or demand draft in favour of {payableTo}
              {city ? `, ${city}` : ''}.
            </Text>
            {bankBits.length ? <Text style={styles.payLine}>{bankBits.join('   ·   ')}</Text> : null}
          </View>

          {clean(invoice.notes) ? (
            <Text style={styles.note}>Note: {clean(invoice.notes)}</Text>
          ) : null}

          {registered ? (
            <Text style={styles.addressLine}>Registered address: {registered}</Text>
          ) : null}
          <Text style={styles.disclaimer}>
            This is a system-generated invoice. No signature is required.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
