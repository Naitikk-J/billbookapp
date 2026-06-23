import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Path, G, Circle, Image } from '@react-pdf/renderer';
import type { Company, Invoice } from '@/lib/types';
import { ensureFonts, fmt, fmtPlain, fmtDateShort, inrInWords } from './shared';

ensureFonts();

const NAVY = '#1A2F4F';
const GOLD = '#C8A057';
const GOLD_SOFT = '#E0C896';
const CREAM = '#FAEAD7';
const MUTED = '#8A8378';
const TEXT = '#1A2F4F';
const RULE = '#E8DEC8';
const RULE_SOFT = '#EFE6D2';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: TEXT,
    paddingTop: 26,
    paddingBottom: 26,
    paddingHorizontal: 26,
  },
  outerFrame: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 3,
  },
  innerFrame: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 0.5,
    borderColor: GOLD_SOFT,
    borderRadius: 2,
  },
  cornerTL: { position: 'absolute', top: 14, left: 14, width: 70, height: 70 },
  cornerTR: { position: 'absolute', top: 14, right: 14, width: 70, height: 70 },
  cornerBL: { position: 'absolute', bottom: 14, left: 14, width: 70, height: 70 },
  cornerBR: { position: 'absolute', bottom: 14, right: 14, width: 70, height: 70 },

  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  logoCol: { width: 95, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  logoImage: { width: 84, height: 56, objectFit: 'contain' },
  brandFallback: { alignItems: 'center', justifyContent: 'center' },
  brandTagline: {
    color: GOLD,
    fontSize: 5.5,
    fontWeight: 700,
    letterSpacing: 1.1,
    marginTop: 2,
  },
  brandName: { color: NAVY, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.3 },

  companyCol: { flex: 1, paddingLeft: 10 },
  companyName: {
    fontSize: 17.5,
    fontWeight: 800,
    color: NAVY,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  panRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  panLabel: { color: MUTED, fontSize: 9, marginRight: 8 },
  panValue: { color: TEXT, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4 },

  contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  iconBg: {
    width: 13,
    height: 13,
    borderRadius: 13,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  contactText: { color: TEXT, fontSize: 9 },
  addressLine: { color: TEXT, fontSize: 9, flexShrink: 1, lineHeight: 1.35 },

  kindBadgeCol: { width: 110, alignItems: 'flex-end', justifyContent: 'flex-start' },
  kindBadge: {
    borderWidth: 1,
    borderColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 10,
    color: NAVY,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: 0.8,
  },

  metaRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  metaCell: { flex: 1, paddingHorizontal: 4 },
  metaLabel: { color: NAVY, fontSize: 9, fontWeight: 700, marginBottom: 4 },
  metaValue: { color: TEXT, fontSize: 10 },

  partiesRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    minHeight: 90,
  },
  partyCol: { flex: 1, padding: 12 },
  partyDivider: { width: 0.5, backgroundColor: RULE },
  partyLabel: { color: NAVY, fontSize: 10, fontWeight: 700, marginBottom: 5 },
  partyName: { color: TEXT, fontSize: 11, fontWeight: 700, marginBottom: 3 },
  partyLine: { color: TEXT, fontSize: 9.5, marginTop: 1 },
  partyKV: { flexDirection: 'row', marginTop: 3 },
  partyKey: { color: TEXT, fontSize: 9.5, fontWeight: 700, marginRight: 6 },
  partyVal: { color: TEXT, fontSize: 9.5 },

  tableHead: {
    flexDirection: 'row',
    backgroundColor: CREAM,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tableHeadText: { color: NAVY, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  headNo: { width: 50, textAlign: 'center' },
  headItem: { flex: 1 },
  headAmount: { width: 90, textAlign: 'right' },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tableCellNo: { width: 50, textAlign: 'center', color: TEXT, fontSize: 10 },
  tableCellItem: { flex: 1, color: TEXT, fontSize: 10, paddingRight: 12 },
  tableCellAmount: { width: 90, textAlign: 'right', color: TEXT, fontSize: 10 },
  tableSubText: { color: MUTED, fontSize: 8.5, marginTop: 2 },

  spacer: { flex: 1, minHeight: 60 },

  subtotalRow: {
    flexDirection: 'row',
    backgroundColor: CREAM,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  subtotalLabel: { flex: 1, color: NAVY, fontSize: 11, fontWeight: 700, letterSpacing: 1, textAlign: 'center', paddingRight: 90 },
  subtotalValue: { color: NAVY, fontSize: 11, fontWeight: 700, width: 90, textAlign: 'right' },

  taxBlock: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  taxLine: { flexDirection: 'row', gap: 16, marginRight: 8 },
  taxItem: { flexDirection: 'row', gap: 6 },
  taxLabel: { color: MUTED, fontSize: 9 },
  taxValue: { color: TEXT, fontSize: 9, fontWeight: 600 },

  footerRow: {
    flexDirection: 'row',
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  footerLeft: { flex: 1, paddingRight: 16 },
  footerRight: { flex: 1, paddingLeft: 16 },

  footerRightTopRule: {
    height: 0.6,
    backgroundColor: GOLD,
    marginBottom: 10,
  },

  footerLabel: { color: NAVY, fontSize: 10, fontWeight: 700, marginBottom: 4 },
  footerText: { color: MUTED, fontSize: 9.5, marginBottom: 10 },

  bankGrid: { marginTop: 2 },
  bankRow: { flexDirection: 'row', marginBottom: 2 },
  bankKey: { width: 80, color: TEXT, fontSize: 9.5, fontWeight: 600 },
  bankValue: { flex: 1, color: TEXT, fontSize: 9.5 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalKey: { color: NAVY, fontSize: 11, fontWeight: 700 },
  totalVal: { color: NAVY, fontSize: 14, fontWeight: 800 },

  smallTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  smallTotalKey: { color: MUTED, fontSize: 9.5 },
  smallTotalVal: { color: TEXT, fontSize: 10 },

  innerRule: { height: 0.5, backgroundColor: RULE_SOFT, marginTop: 12, marginBottom: 10 },

  wordsBlock: {},
  wordsLabel: { color: NAVY, fontSize: 10, fontWeight: 700 },
  wordsText: { color: MUTED, fontSize: 9.5, marginTop: 3 },
});

function CornerOrnament({ flipX, flipY }: { flipX?: boolean; flipY?: boolean }) {
  const tx = flipX ? 100 : 0;
  const ty = flipY ? 100 : 0;
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <Svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <Path
        d={`M ${tx} ${ty} L ${tx + sx * 60} ${ty + sy * 0}`}
        stroke={GOLD}
        strokeWidth={0.8}
        fill="none"
      />
      <Path
        d={`M ${tx} ${ty} L ${tx + sx * 0} ${ty + sy * 60}`}
        stroke={GOLD}
        strokeWidth={0.8}
        fill="none"
      />
      <Path
        d={`M ${tx + sx * 6} ${ty + sy * 32}
           C ${tx + sx * 10} ${ty + sy * 22}, ${tx + sx * 22} ${ty + sy * 10}, ${tx + sx * 32} ${ty + sy * 6}`}
        stroke={GOLD}
        strokeWidth={0.8}
        fill="none"
      />
      <Path
        d={`M ${tx + sx * 0} ${ty + sy * 42}
            C ${tx + sx * 10} ${ty + sy * 42}, ${tx + sx * 18} ${ty + sy * 38}, ${tx + sx * 24} ${ty + sy * 30}
            C ${tx + sx * 30} ${ty + sy * 22}, ${tx + sx * 36} ${ty + sy * 14}, ${tx + sx * 42} ${ty + sy * 6}
            C ${tx + sx * 40} ${ty + sy * 14}, ${tx + sx * 36} ${ty + sy * 18}, ${tx + sx * 28} ${ty + sy * 22}
            C ${tx + sx * 20} ${ty + sy * 26}, ${tx + sx * 12} ${ty + sy * 30}, ${tx + sx * 8} ${ty + sy * 38} Z`}
        fill={GOLD}
      />
      <Path
        d={`M ${tx + sx * 12} ${ty + sy * 18}
            C ${tx + sx * 16} ${ty + sy * 16}, ${tx + sx * 18} ${ty + sy * 14}, ${tx + sx * 20} ${ty + sy * 10}
            L ${tx + sx * 14} ${ty + sy * 14} Z`}
        fill={GOLD_SOFT}
      />
      <Path
        d={`M ${tx + sx * 28} ${ty + sy * 36}
            C ${tx + sx * 32} ${ty + sy * 34}, ${tx + sx * 34} ${ty + sy * 32}, ${tx + sx * 36} ${ty + sy * 28}
            L ${tx + sx * 30} ${ty + sy * 32} Z`}
        fill={GOLD_SOFT}
      />
    </Svg>
  );
}

function PlaneLogo() {
  return (
    <View style={styles.brandFallback}>
      <Svg viewBox="0 0 120 70" style={{ width: 96, height: 56 }}>
        {/* Plane body */}
        <Path
          d="M14 36 L96 18 L100 22 L52 40 L42 60 L36 58 L40 42 L18 44 Z"
          fill={NAVY}
        />
        {/* Tail accent */}
        <Path d="M64 30 L82 26 L78 34 L60 36 Z" fill={GOLD} />
        {/* Speed line */}
        <Path
          d="M10 50 C 30 46, 60 48, 96 40"
          stroke={GOLD}
          strokeWidth={2.4}
          fill="none"
        />
      </Svg>
      <Text style={styles.brandName}>SAFARMATE</Text>
      <Text style={styles.brandTagline}>LET TRAVEL FILL YOUR SOUL</Text>
    </View>
  );
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.iconBg}>
      <Svg viewBox="0 0 24 24" width={9} height={9}>
        {children}
      </Svg>
    </View>
  );
}

function PhoneIcon() {
  return (
    <Path
      d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C9.4 21 3 14.6 3 6c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 1.9z"
      fill="#fff"
    />
  );
}

function MailIcon() {
  return (
    <G>
      <Path d="M3 6h18v12H3z" fill="#fff" />
      <Path d="M3 6l9 7 9-7" stroke={GOLD} strokeWidth={1.6} fill="none" />
    </G>
  );
}

function PinIcon() {
  return (
    <G>
      <Path
        d="M12 2c-3.9 0-7 3.1-7 7 0 4.6 6 12 6.4 12.5.3.4.9.4 1.2 0C13 21 19 13.6 19 9c0-3.9-3.1-7-7-7z"
        fill="#fff"
      />
      <Circle cx={12} cy={9} r={2.4} fill={GOLD} />
    </G>
  );
}

function kindLabel(kind: Invoice['kind'], taxMode: Invoice['taxMode']): string {
  if (kind === 'quote') return 'QUOTATION';
  if (kind === 'proforma') return 'PROFORMA INVOICE';
  if (kind === 'receipt') return 'RECEIPT';
  return taxMode === 'none' ? 'BILL OF SUPPLY' : 'TAX INVOICE';
}

export function HeritageTemplate({
  invoice,
  company,
}: {
  invoice: Invoice;
  company: Company | null;
}) {
  const c = invoice.customerSnapshot;
  const billCityLine = [c.city, c.state, c.postalCode].filter(Boolean).join(', ');
  const billLines: string[] = [];
  if (c.address) billLines.push(c.address);
  if (billCityLine) billLines.push(billCityLine);

  const fullAddress = [company?.address, company?.city, company?.state, company?.postalCode]
    .filter(Boolean)
    .join(', ');

  const hasTaxBreakdown = !!(invoice.cgstTotal || invoice.sgstTotal || invoice.igstTotal || invoice.discountTotal);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.outerFrame} fixed />
        <View style={styles.innerFrame} fixed />
        <View style={styles.cornerTL} fixed>
          <CornerOrnament />
        </View>
        <View style={styles.cornerTR} fixed>
          <CornerOrnament flipX />
        </View>
        <View style={styles.cornerBL} fixed>
          <CornerOrnament flipY />
        </View>
        <View style={styles.cornerBR} fixed>
          <CornerOrnament flipX flipY />
        </View>

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.logoCol}>
              {company?.logoUrl ? (
                <Image src={company.logoUrl} style={styles.logoImage} />
              ) : (
                <PlaneLogo />
              )}
            </View>
            <View style={styles.companyCol}>
              <Text style={styles.companyName}>
                {(company?.legalName || company?.name || 'YOUR COMPANY').toUpperCase()}
              </Text>
              {company?.panNumber ? (
                <View style={styles.panRow}>
                  <Text style={styles.panLabel}>Pan No</Text>
                  <Text style={styles.panValue}>{company.panNumber}</Text>
                </View>
              ) : null}
              <View style={styles.contactRow}>
                {company?.phone ? (
                  <View style={styles.contactItem}>
                    <IconWrap><PhoneIcon /></IconWrap>
                    <Text style={styles.contactText}>{company.phone}</Text>
                  </View>
                ) : null}
                {company?.email ? (
                  <View style={styles.contactItem}>
                    <IconWrap><MailIcon /></IconWrap>
                    <Text style={styles.contactText}>{company.email}</Text>
                  </View>
                ) : null}
              </View>
              {fullAddress ? (
                <View style={[styles.contactRow, { marginTop: 4 }]}>
                  <View style={[styles.contactItem, { flex: 1 }]}>
                    <IconWrap><PinIcon /></IconWrap>
                    <Text style={styles.addressLine}>{fullAddress}</Text>
                  </View>
                </View>
              ) : null}
            </View>
            <View style={styles.kindBadgeCol}>
              <Text style={styles.kindBadge}>{kindLabel(invoice.kind, invoice.taxMode)}</Text>
            </View>
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Invoice No.</Text>
              <Text style={styles.metaValue}>{invoice.number}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Invoice Date</Text>
              <Text style={styles.metaValue}>{fmtDateShort(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Due Date</Text>
              <Text style={styles.metaValue}>{fmtDateShort(invoice.dueDate)}</Text>
            </View>
          </View>

          {/* Parties */}
          <View style={styles.partiesRow}>
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>Bill To</Text>
              <Text style={styles.partyName}>{(c.name || '—').toUpperCase()}</Text>
              {billLines.map((line, i) => (
                <Text key={i} style={styles.partyLine}>{line}</Text>
              ))}
              {c.phone ? (
                <View style={styles.partyKV}>
                  <Text style={styles.partyKey}>Mobile</Text>
                  <Text style={styles.partyVal}>{c.phone}</Text>
                </View>
              ) : null}
              {c.gstNumber ? (
                <View style={styles.partyKV}>
                  <Text style={styles.partyKey}>GSTIN</Text>
                  <Text style={styles.partyVal}>{c.gstNumber}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.partyDivider} />
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>Ship To</Text>
              <Text style={styles.partyName}>{(c.name || '—').toUpperCase()}</Text>
              {billLines.map((line, i) => (
                <Text key={i} style={styles.partyLine}>{line}</Text>
              ))}
              {invoice.travelDetails?.destination ? (
                <View style={styles.partyKV}>
                  <Text style={styles.partyKey}>Destination</Text>
                  <Text style={styles.partyVal}>{invoice.travelDetails.destination}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Items */}
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadText, styles.headNo]}>No</Text>
            <Text style={[styles.tableHeadText, styles.headItem]}>ITEMS/SERVICES</Text>
            <Text style={[styles.tableHeadText, styles.headAmount]}>Total</Text>
          </View>
          {invoice.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow} wrap={false}>
              <Text style={styles.tableCellNo}>{idx + 1}</Text>
              <View style={styles.tableCellItem}>
                <Text>{item.description}</Text>
                {(item.hsnCode || item.quantity > 1) ? (
                  <Text style={styles.tableSubText}>
                    {item.quantity} {item.unit || ''}
                    {item.taxPercent ? ` · GST ${item.taxPercent}%` : ''}
                    {item.hsnCode ? ` · HSN ${item.hsnCode}` : ''}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.tableCellAmount}>
                {fmtPlain(item.amount ?? item.quantity * item.rate, invoice.currency)}
              </Text>
            </View>
          ))}

          <View style={styles.spacer} />

          {hasTaxBreakdown ? (
            <View style={styles.taxBlock}>
              <View style={styles.taxLine}>
                {invoice.discountTotal ? (
                  <View style={styles.taxItem}>
                    <Text style={styles.taxLabel}>Discount</Text>
                    <Text style={styles.taxValue}>− {fmt(invoice.discountTotal, invoice.currency)}</Text>
                  </View>
                ) : null}
                {invoice.cgstTotal ? (
                  <View style={styles.taxItem}>
                    <Text style={styles.taxLabel}>CGST</Text>
                    <Text style={styles.taxValue}>{fmt(invoice.cgstTotal, invoice.currency)}</Text>
                  </View>
                ) : null}
                {invoice.sgstTotal ? (
                  <View style={styles.taxItem}>
                    <Text style={styles.taxLabel}>SGST</Text>
                    <Text style={styles.taxValue}>{fmt(invoice.sgstTotal, invoice.currency)}</Text>
                  </View>
                ) : null}
                {invoice.igstTotal ? (
                  <View style={styles.taxItem}>
                    <Text style={styles.taxLabel}>IGST</Text>
                    <Text style={styles.taxValue}>{fmt(invoice.igstTotal, invoice.currency)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Subtotal band */}
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>SUBTOTAL</Text>
            <Text style={styles.subtotalValue}>{fmt(invoice.subtotal, invoice.currency)}</Text>
          </View>

          {/* Footer split */}
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              {invoice.terms ? (
                <>
                  <Text style={styles.footerLabel}>Terms & Conditions</Text>
                  <Text style={styles.footerText}>{invoice.terms}</Text>
                </>
              ) : null}

              {(company?.bankName || company?.accountNumber || company?.ifsc || company?.upiId) ? (
                <>
                  <Text style={styles.footerLabel}>Bank Details</Text>
                  <View style={styles.bankGrid}>
                    {company?.name || company?.legalName ? (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankKey}>Name</Text>
                        <Text style={styles.bankValue}>{company?.name || company?.legalName}</Text>
                      </View>
                    ) : null}
                    {company?.ifsc ? (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankKey}>IFSC</Text>
                        <Text style={styles.bankValue}>{company.ifsc}</Text>
                      </View>
                    ) : null}
                    {company?.accountNumber ? (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankKey}>Account No</Text>
                        <Text style={styles.bankValue}>{company.accountNumber}</Text>
                      </View>
                    ) : null}
                    {company?.bankName ? (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankKey}>Bank Name</Text>
                        <Text style={styles.bankValue}>{company.bankName}</Text>
                      </View>
                    ) : null}
                    {company?.upiId ? (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankKey}>UPI ID</Text>
                        <Text style={styles.bankValue}>{company.upiId}</Text>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.footerRight}>
              <View style={styles.footerRightTopRule} />
              <View style={styles.totalRow}>
                <Text style={styles.totalKey}>Total Amount</Text>
                <Text style={styles.totalVal}>{fmt(invoice.grandTotal, invoice.currency)}</Text>
              </View>
              <View style={styles.smallTotalRow}>
                <Text style={styles.smallTotalKey}>Received Amount</Text>
                <Text style={styles.smallTotalVal}>
                  {fmt(invoice.amountPaid ?? 0, invoice.currency)}
                </Text>
              </View>
              {invoice.balanceDue ? (
                <View style={styles.smallTotalRow}>
                  <Text style={styles.smallTotalKey}>Balance Due</Text>
                  <Text style={styles.smallTotalVal}>
                    {fmt(invoice.balanceDue, invoice.currency)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.innerRule} />
              <View style={styles.wordsBlock}>
                <Text style={styles.wordsLabel}>Total Amount (in words)</Text>
                <Text style={styles.wordsText}>{inrInWords(invoice.grandTotal, invoice.currency)}</Text>
              </View>
              {invoice.notes ? (
                <>
                  <View style={styles.innerRule} />
                  <View style={styles.wordsBlock}>
                    <Text style={styles.wordsLabel}>Notes</Text>
                    <Text style={styles.wordsText}>{invoice.notes}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
