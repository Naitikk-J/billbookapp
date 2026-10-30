import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Company, Invoice, InvoiceLineItem } from '@/lib/types';
import { safarmateLogoUrl } from './shared';

const BORDER = '#333333';
const INK = '#111111';
const MUTED = '#444444';
const HEAD = '#E8E8E8';
const BAR = '#F0F0F0';

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
    fontSize: 8.5,
    color: INK,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleLine: { fontSize: 11, fontWeight: 700, letterSpacing: 0.2 },
  logo: { width: 108, height: 82, objectFit: 'contain' },
  dueBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BAR,
    borderWidth: 0.6,
    borderColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  dueLeft: { fontSize: 8.5, fontWeight: 700 },
  dueRight: { fontSize: 10, fontWeight: 700 },
  reverseCharge: { fontSize: 8, marginBottom: 8, color: MUTED },
  partyGrid: {
    flexDirection: 'row',
    borderWidth: 0.6,
    borderColor: BORDER,
    marginBottom: 0,
  },
  partyCol: { flex: 1, padding: 7, minHeight: 118 },
  partyDivider: { width: 0.6, backgroundColor: BORDER },
  labelRow: { flexDirection: 'row', marginTop: 2 },
  label: { width: 72, fontSize: 8, color: MUTED },
  value: { flex: 1, fontSize: 8.5 },
  issuerName: { fontSize: 9.5, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' },
  table: { borderWidth: 0.6, borderColor: BORDER, borderTopWidth: 0 },
  tableHead: { flexDirection: 'row', backgroundColor: HEAD, borderBottomWidth: 0.6, borderBottomColor: BORDER },
  headHalf: { flex: 1, padding: 5, borderRightWidth: 0.6, borderRightColor: BORDER },
  headHalfLast: { flex: 1, padding: 5 },
  headTitle: { fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase' },
  headSub: { fontSize: 7.5, marginTop: 2, color: MUTED },
  subHead: {
    flexDirection: 'row',
    borderBottomWidth: 0.6,
    borderBottomColor: BORDER,
    backgroundColor: '#FAFAFA',
  },
  subCell: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 7.5, fontWeight: 700, color: MUTED },
  bodyRow: { flexDirection: 'row', minHeight: 72 },
  bodyHalf: { flex: 1, borderRightWidth: 0.6, borderRightColor: BORDER },
  bodyHalfLast: { flex: 1 },
  lineRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 5, alignItems: 'flex-start' },
  descCol: { flex: 1.55, paddingRight: 4 },
  amtCol: { flex: 0.85, textAlign: 'right' },
  sacCol: { flex: 0.65, textAlign: 'center' },
  taxRow: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 5 },
  taxName: { flex: 1.55, fontSize: 8, fontWeight: 700 },
  taxPct: { flex: 0.65, textAlign: 'center', fontSize: 8 },
  taxAmt: { flex: 0.85, textAlign: 'right', fontSize: 8 },
  footRow: {
    flexDirection: 'row',
    borderTopWidth: 0.6,
    borderTopColor: BORDER,
    backgroundColor: HEAD,
  },
  footHalf: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRightWidth: 0.6,
    borderRightColor: BORDER,
  },
  footHalfLast: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  footLabel: { fontSize: 8, fontWeight: 700 },
  footValue: { fontSize: 8.5, fontWeight: 700 },
  totalsBlock: { marginTop: 8, alignSelf: 'flex-end', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { fontSize: 8.5, fontWeight: 700 },
  totalValue: { fontSize: 8.5, fontWeight: 700 },
  lower: { flexDirection: 'row', marginTop: 14, borderTopWidth: 0.6, borderTopColor: BORDER, paddingTop: 8 },
  lowerCol: { flex: 1, paddingRight: 10 },
  sectionTitle: { fontSize: 8.5, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' },
  lowerLine: { fontSize: 8, lineHeight: 1.35, marginTop: 1 },
  signBlock: { marginTop: 10, alignItems: 'flex-end' },
  forLine: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase' },
  signSpace: { height: 26 },
  signImg: { width: 88, height: 34, objectFit: 'contain', marginVertical: 2 },
  signLabel: { fontSize: 7.5, marginTop: 2 },
  payBanner: {
    marginTop: 10,
    borderWidth: 0.6,
    borderColor: BORDER,
    backgroundColor: BAR,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  payText: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.4 },
  addrBlock: { marginTop: 8 },
  addrLine: { fontSize: 7.5, color: MUTED, lineHeight: 1.35 },
  disclaimer: { marginTop: 6, fontSize: 7.5, color: MUTED, textAlign: 'center' },
  itemMain: { fontSize: 8.5, fontWeight: 700 },
  itemSub: { fontSize: 8, marginTop: 1 },
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function moneyInr(amount: number): string {
  const value = round2(Number.isFinite(amount) ? amount : 0);
  if (Math.round((value % 1) * 100) === 0) return `INR ${value.toFixed(1)}`;
  return `INR ${value.toFixed(2)}`;
}

function clean(value?: string | null): string {
  const v = (value ?? '').trim();
  if (!v || /^(na|n\/a|none|null|undefined|-)$/i.test(v)) return '';
  return v;
}

function displayGst(value?: string): string {
  const v = clean(value);
  return v || 'na';
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

function joinAddress(parts: {
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): string {
  return [
    clean(parts.address),
    [clean(parts.city), clean(parts.state), clean(parts.postalCode)].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

function lineTaxable(item: InvoiceLineItem): number {
  if (typeof item.taxableValue === 'number' && Number.isFinite(item.taxableValue)) {
    return item.taxableValue;
  }
  const gross = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  const disc = gross * ((Number(item.discountPercent) || 0) / 100);
  return round2(gross - disc);
}

function safarmateLogoSrc(): string {
  return safarmateLogoUrl();
}

function websiteLabel(website?: string): string {
  return clean(website).replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
  const brand = clean(company?.legalName) || clean(company?.name) || 'Safarmate';
  const brandUpper = brand.toUpperCase();
  const customer = invoice.customerSnapshot ?? {};
  const td = invoice.travelDetails ?? {};
  const customerName =
    [clean(customer.name), clean(td.travellerName)].filter(Boolean).sort((a, b) => b.length - a.length)[0] ||
    '-';
  const customerAddress = joinAddress(customer);
  const customerState = clean(customer.state);
  const customerGst = clean(customer.gstNumber);
  const supplyCode = stateCode(customerState, customerGst);

  const companyAddress = joinAddress({
    address: company?.address,
    city: company?.city,
    state: company?.state,
    postalCode: company?.postalCode,
  });
  const companyGst = clean(company?.gstNumber);
  const companyPan = clean(company?.panNumber);
  const cin = clean(company?.cinNumber);
  const payCity = clean(company?.city) || clean(company?.state) || 'India';

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
  const igstPct =
    invoice.taxMode === 'inter' && uniformRate != null
      ? `${uniformRate % 1 === 0 ? uniformRate.toFixed(1) : uniformRate} %`
      : '--';
  const halfPct =
    invoice.taxMode === 'intra' && uniformRate != null
      ? `${(uniformRate / 2) % 1 === 0 ? (uniformRate / 2).toFixed(1) : uniformRate / 2} %`
      : '--';

  const reimbTotal = round2(reimbursements.reduce((sum, item) => sum + lineTaxable(item), 0));
  const serviceBase = round2(taxableItems.reduce((sum, item) => sum + lineTaxable(item), 0));
  const taxSum = round2(
    (invoice.cgstTotal || 0) + (invoice.sgstTotal || 0) + (invoice.igstTotal || 0)
  );
  const afterTax = round2(serviceBase + taxSum);
  const net = invoice.amountPaid > 0 ? invoice.balanceDue : invoice.grandTotal;

  const packageRef = clean(td.packageName) || clean(td.destination);
  const leadPax = customerName !== '-' ? customerName : '';

  const contactName = clean(company?.contactName);
  const phone = clean(company?.phone);
  const email = clean(company?.email);
  const website = websiteLabel(company?.website);
  const payableTo = (clean(company?.beneficiaryName) || brand).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <Text style={styles.titleLine}>TAX INVOICE : {invoice.number}</Text>
          <Image src={safarmateLogoSrc()} style={styles.logo} />
        </View>

        <View style={styles.dueBar}>
          <Text style={styles.dueLeft}>PAYMENT DUE BY:</Text>
          <Text style={styles.dueRight}>{moneyInr(invoice.grandTotal)}</Text>
        </View>
        <Text style={styles.reverseCharge}>IS REVERSE CHARGE APPLICABLE (Y/N)? N</Text>

        <View style={styles.partyGrid}>
          <View style={styles.partyCol}>
            <Field label="Name :" value={customerName} />
            {customerAddress ? <Field label="Address:" value={customerAddress} /> : null}
            <Field label="GSTIN :" value={displayGst(customerGst)} />
            <Field label="State :" value={customerState || '-'} />
            <Field label="Place of Supply :" value={customerState || '-'} />
            <Field label="State Code:" value={supplyCode || '-'} />
          </View>
          <View style={styles.partyDivider} />
          <View style={styles.partyCol}>
            <Text style={styles.issuerName}>{brandUpper}</Text>
            {companyAddress ? <Field label="Reg. Address :" value={companyAddress} /> : null}
            {cin ? <Field label="CIN No.:" value={cin} /> : null}
            <Field label="GSTIN :" value={displayGst(companyGst)} />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <View style={styles.headHalf}>
              <Text style={styles.headTitle}>REIMBURSEMENT</Text>
            </View>
            <View style={styles.headHalfLast}>
              <Text style={styles.headTitle}>TAXABLE SERVICES (IF ANY)</Text>
            </View>
          </View>
          <View style={styles.subHead}>
            <Text style={[styles.subCell, { flex: 1.55 }]}>Description of Reimbursements</Text>
            <Text style={[styles.subCell, { flex: 0.85, textAlign: 'right' }]}>Amount</Text>
            <Text style={[styles.subCell, { flex: 1.55, borderLeftWidth: 0.6, borderLeftColor: BORDER }]}>
              Description of Services
            </Text>
            <Text style={[styles.subCell, { flex: 0.65, textAlign: 'center' }]}>SAC CODE</Text>
            <Text style={[styles.subCell, { flex: 0.85, textAlign: 'right' }]}>Taxable Amount</Text>
          </View>

          <View style={styles.bodyRow}>
            <View style={styles.bodyHalf}>
              {reimbursements.length === 0 ? (
                <View style={styles.lineRow}>
                  <Text style={styles.descCol}>-</Text>
                  <Text style={styles.amtCol}>{moneyInr(0)}</Text>
                </View>
              ) : (
                reimbursements.map((item, index) => (
                  <View key={`r-${index}`} style={styles.lineRow}>
                    <View style={styles.descCol}>
                      <Text style={styles.itemMain}>{item.description}</Text>
                      {index === 0 && packageRef ? (
                        <Text style={styles.itemSub}>({packageRef.toLowerCase()})</Text>
                      ) : null}
                      {index === 0 && leadPax ? (
                        <Text style={styles.itemSub}>Lead Pax: {leadPax}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.amtCol}>{moneyInr(lineTaxable(item))}</Text>
                  </View>
                ))
              )}
            </View>
            <View style={styles.bodyHalfLast}>
              {taxableItems.length === 0 ? (
                <View style={styles.lineRow}>
                  <Text style={[styles.descCol, { flex: 1.55 }]}>-</Text>
                  <Text style={styles.sacCol}>-</Text>
                  <Text style={styles.amtCol}>{moneyInr(0)}</Text>
                </View>
              ) : (
                taxableItems.map((item, index) => (
                  <View key={`t-${index}`} style={styles.lineRow}>
                    <Text style={[styles.descCol, styles.itemMain]}>{item.description}</Text>
                    <Text style={styles.sacCol}>{clean(item.hsnCode) || '-'}</Text>
                    <Text style={styles.amtCol}>{moneyInr(lineTaxable(item))}</Text>
                  </View>
                ))
              )}
              <View style={styles.taxRow}>
                <Text style={styles.taxName}>IGST</Text>
                <Text style={styles.taxPct}>{igstPct}</Text>
                <Text style={styles.taxAmt}>{moneyInr(invoice.igstTotal || 0)}</Text>
              </View>
              <View style={styles.taxRow}>
                <Text style={styles.taxName}>CGST</Text>
                <Text style={styles.taxPct}>{halfPct}</Text>
                <Text style={styles.taxAmt}>{moneyInr(invoice.cgstTotal || 0)}</Text>
              </View>
              <View style={styles.taxRow}>
                <Text style={styles.taxName}>SGST</Text>
                <Text style={styles.taxPct}>{halfPct}</Text>
                <Text style={styles.taxAmt}>{moneyInr(invoice.sgstTotal || 0)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.footRow}>
            <View style={styles.footHalf}>
              <Text style={styles.footLabel}>Total Reimbursement Amount</Text>
              <Text style={styles.footValue}>{moneyInr(reimbTotal)}</Text>
            </View>
            <View style={styles.footHalfLast}>
              <Text style={styles.footLabel}>Total Amount After Tax</Text>
              <Text style={styles.footValue}>{moneyInr(afterTax)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Gross Total</Text>
            <Text style={styles.totalValue}>{moneyInr(invoice.grandTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount Provided</Text>
            <Text style={styles.totalValue}>{moneyInr(invoice.discountTotal || 0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Receivable</Text>
            <Text style={styles.totalValue}>{moneyInr(net)}</Text>
          </View>
        </View>

        <View style={styles.lower}>
          <View style={styles.lowerCol}>
            <Text style={styles.sectionTitle}>COMPANY DETAILS</Text>
            <Text style={[styles.lowerLine, { fontWeight: 700 }]}>{brandUpper}</Text>
            {companyPan ? <Text style={styles.lowerLine}>PAN : {companyPan}</Text> : null}
            {companyAddress ? <Text style={styles.lowerLine}>Reg. Address : {companyAddress}</Text> : null}
            <Text style={styles.lowerLine}>
              {[cin ? `CIN : ${cin}` : '', companyGst ? `GSTIN : ${companyGst}` : '']
                .filter(Boolean)
                .join('            ')}
            </Text>
          </View>
          <View style={styles.lowerCol}>
            <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
            {contactName ? <Text style={[styles.lowerLine, { fontWeight: 700 }]}>{contactName.toUpperCase()}</Text> : null}
            {phone ? <Text style={styles.lowerLine}>Phone : {phone}</Text> : null}
            {website ? <Text style={styles.lowerLine}>{website}</Text> : null}
            {email ? <Text style={styles.lowerLine}>{email}</Text> : null}
            <View style={styles.signBlock}>
              <Text style={styles.forLine}>FOR {brandUpper}</Text>
              {clean(company?.signatureUrl) ? (
                <Image src={clean(company?.signatureUrl)} style={styles.signImg} />
              ) : (
                <View style={styles.signSpace} />
              )}
              <Text style={styles.signLabel}>Authorised Signatory</Text>
            </View>
          </View>
        </View>

        <View style={styles.payBanner}>
          <Text style={styles.payText}>
            PAYMENT TO BE MADE BY BANK TRANSFER/DD MADE PAYABLE TO {payableTo} AT {payCity.toUpperCase()}
          </Text>
        </View>

        {companyAddress ? (
          <View style={styles.addrBlock}>
            <Text style={styles.addrLine}>Corporate Address :</Text>
            <Text style={styles.addrLine}>{companyAddress}</Text>
            <Text style={[styles.addrLine, { marginTop: 4 }]}>Registered Address :</Text>
            <Text style={styles.addrLine}>{companyAddress}</Text>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          *** This is system generated invoice no signature required. ***
        </Text>
      </Page>
    </Document>
  );
}
