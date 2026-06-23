import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Path, Image } from '@react-pdf/renderer';
import type { Company, Invoice } from '@/lib/types';
import { ensureFonts, fmt, fmtDateShort, inrInWords } from './shared';

ensureFonts();

const NAVY = '#1A2F4F';
const NAVY_SOFT = '#2A4373';
const GOLD = '#C8A057';
const GOLD_SOFT = '#E0C896';
const CREAM = '#FAF1E2';
const CREAM_DEEP = '#F5E7CC';
const MUTED = '#8B7E66';
const TEXT = '#1A2F4F';
const RULE = '#E8DEC8';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: TEXT,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
  },
  outerFrame: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 4,
  },
  innerFrame: {
    position: 'absolute',
    top: 22,
    left: 22,
    right: 22,
    bottom: 22,
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
    paddingTop: 18,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  logoCol: { width: 100, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  logoImage: { width: 90, height: 60, objectFit: 'contain' },
  logoFallback: {
    width: 80,
    height: 56,
    borderRadius: 6,
    backgroundColor: NAVY,
    color: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1 },
  companyCol: { flex: 1, paddingLeft: 4 },
  companyName: {
    fontSize: 19,
    fontWeight: 800,
    color: NAVY,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  smallRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
  smallLabel: { color: MUTED, fontSize: 9 },
  smallValue: { color: TEXT, fontSize: 9, fontWeight: 600 },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
  iconDot: {
    width: 11,
    height: 11,
    borderRadius: 11,
    backgroundColor: GOLD,
    marginRight: 5,
  },
  addressLine: { color: TEXT, fontSize: 9, marginTop: 4, maxWidth: 340 },
  kindBadgeCol: { width: 130, alignItems: 'flex-end', justifyContent: 'flex-start' },
  kindBadge: {
    borderWidth: 1,
    borderColor: NAVY,
    paddingVertical: 6,
    paddingHorizontal: 12,
    color: NAVY,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
  },

  metaRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  metaCell: { flex: 1, paddingHorizontal: 4 },
  metaLabel: { color: NAVY, fontSize: 9, fontWeight: 700, marginBottom: 3 },
  metaValue: { color: TEXT, fontSize: 10 },

  partiesRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  partyCol: { flex: 1, padding: 12 },
  partyDivider: { width: 0.5, backgroundColor: RULE },
  partyLabel: { color: NAVY, fontSize: 10, fontWeight: 700, marginBottom: 4 },
  partyName: { color: TEXT, fontSize: 11, fontWeight: 700, marginBottom: 3 },
  partyLine: { color: TEXT, fontSize: 9.5, marginTop: 1 },
  partyKV: { flexDirection: 'row', marginTop: 2 },
  partyKey: { color: TEXT, fontSize: 9.5, fontWeight: 700, marginRight: 4 },
  partyVal: { color: TEXT, fontSize: 9.5 },

  tableHead: {
    flexDirection: 'row',
    backgroundColor: CREAM,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeadText: { color: NAVY, fontSize: 10, fontWeight: 700, letterSpacing: 0.4 },
  cellNo: { width: 50, textAlign: 'center' },
  cellItem: { flex: 1 },
  cellAmount: { width: 90, textAlign: 'right' },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  tableCellNo: { width: 50, textAlign: 'center', color: TEXT, fontSize: 10 },
  tableCellItem: { flex: 1, color: TEXT, fontSize: 10 },
  tableCellAmount: { width: 90, textAlign: 'right', color: TEXT, fontSize: 10 },
  tableSubText: { color: MUTED, fontSize: 8.5, marginTop: 2 },

  spacer: { flex: 1, minHeight: 60 },

  subtotalRow: {
    flexDirection: 'row',
    backgroundColor: CREAM,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  subtotalLabel: { flex: 1, color: NAVY, fontSize: 11, fontWeight: 700, letterSpacing: 1 },
  subtotalValue: { color: NAVY, fontSize: 11, fontWeight: 700 },

  taxBlock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    paddingTop: 12,
  },
  footerLeft: { flex: 1.05, paddingHorizontal: 12, paddingRight: 20 },
  footerRight: { flex: 1, paddingHorizontal: 12, paddingLeft: 14, borderLeftWidth: 0.5, borderLeftColor: RULE },

  footerLabel: { color: NAVY, fontSize: 10, fontWeight: 700, marginBottom: 4 },
  footerText: { color: MUTED, fontSize: 9.5, marginBottom: 8 },

  bankGrid: { marginTop: 4 },
  bankRow: { flexDirection: 'row', marginBottom: 2 },
  bankKey: { width: 80, color: TEXT, fontSize: 9.5, fontWeight: 600 },
  bankValue: { flex: 1, color: TEXT, fontSize: 9.5 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  totalKey: { color: NAVY, fontSize: 11, fontWeight: 700 },
  totalVal: { color: NAVY, fontSize: 13, fontWeight: 800 },

  smallTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  smallTotalKey: { color: MUTED, fontSize: 9.5 },
  smallTotalVal: { color: TEXT, fontSize: 10 },

  wordsBlock: { marginTop: 12 },
  wordsLabel: { color: NAVY, fontSize: 10, fontWeight: 700 },
  wordsText: { color: MUTED, fontSize: 9.5, marginTop: 3 },
});

function CornerOrnament({ flipX, flipY }: { flipX?: boolean; flipY?: boolean }) {
  // Decorative scrollwork — drawn as a viewBox-normalized 100x100 SVG.
  // We flip via scale on the wrapping group so the same paths reuse for all 4 corners.
  const tx = flipX ? 100 : 0;
  const ty = flipY ? 100 : 0;
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <Svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <Path
        d={`M ${tx} ${ty} m 0 0 L ${tx + sx * 60} ${ty + sy * 0}`}
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
      {/* Inner curve */}
      <Path
        d={`M ${tx + sx * 6} ${ty + sy * 32}
           C ${tx + sx * 10} ${ty + sy * 22}, ${tx + sx * 22} ${ty + sy * 10}, ${tx + sx * 32} ${ty + sy * 6}`}
        stroke={GOLD}
        strokeWidth={0.8}
        fill="none"
      />
      {/* Outer flourish — scroll */}
      <Path
        d={`M ${tx + sx * 0} ${ty + sy * 42}
            C ${tx + sx * 10} ${ty + sy * 42}, ${tx + sx * 18} ${ty + sy * 38}, ${tx + sx * 24} ${ty + sy * 30}
            C ${tx + sx * 30} ${ty + sy * 22}, ${tx + sx * 36} ${ty + sy * 14}, ${tx + sx * 42} ${ty + sy * 6}
            C ${tx + sx * 40} ${ty + sy * 14}, ${tx + sx * 36} ${ty + sy * 18}, ${tx + sx * 28} ${ty + sy * 22}
            C ${tx + sx * 20} ${ty + sy * 26}, ${tx + sx * 12} ${ty + sy * 30}, ${tx + sx * 8} ${ty + sy * 38} Z`}
        fill={GOLD}
      />
      {/* Small fans */}
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
      {/* Two tiny gold dots */}
      <Path d={`M ${tx + sx * 4} ${ty + sy * 4} L ${tx + sx * 6} ${ty + sy * 4} L ${tx + sx * 6} ${ty + sy * 6} L ${tx + sx * 4} ${ty + sy * 6} Z`} fill={GOLD} />
      <Path d={`M ${tx + sx * 50} ${ty + sy * 4} L ${tx + sx * 52} ${ty + sy * 4} L ${tx + sx * 52} ${ty + sy * 6} L ${tx + sx * 50} ${ty + sy * 6} Z`} fill={GOLD} />
      <Path d={`M ${tx + sx * 4} ${ty + sy * 50} L ${tx + sx * 6} ${ty + sy * 50} L ${tx + sx * 6} ${ty + sy * 52} L ${tx + sx * 4} ${ty + sy * 52} Z`} fill={GOLD} />
    </Svg>
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
  const customerLines: string[] = [];
  const c = invoice.customerSnapshot;
  const cityLine = [c.city, c.state, c.postalCode].filter(Boolean).join(', ');
  if (c.address) customerLines.push(c.address);
  if (cityLine) customerLines.push(cityLine);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Outer + inner gold frames + corner ornaments */}
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
                <View style={styles.logoFallback}>
                  <Text style={styles.logoText}>
                    {(company?.name ?? 'YOUR CO').slice(0, 12).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.companyCol}>
              <Text style={styles.companyName}>
                {(company?.legalName || company?.name || 'YOUR COMPANY').toUpperCase()}
              </Text>
              {company?.panNumber ? (
                <View style={styles.smallRow}>
                  <Text style={styles.smallLabel}>Pan No</Text>
                  <Text style={styles.smallValue}>{company.panNumber}</Text>
                </View>
              ) : null}
              <View style={styles.contactRow}>
                {company?.phone ? (
                  <View style={styles.contactItem}>
                    <View style={styles.iconDot} />
                    <Text style={styles.smallValue}>{company.phone}</Text>
                  </View>
                ) : null}
                {company?.email ? (
                  <View style={styles.contactItem}>
                    <View style={styles.iconDot} />
                    <Text style={styles.smallValue}>{company.email}</Text>
                  </View>
                ) : null}
              </View>
              {(company?.address || company?.city || company?.state) ? (
                <View style={styles.contactRow}>
                  <View style={styles.contactItem}>
                    <View style={styles.iconDot} />
                    <Text style={styles.addressLine}>
                      {[company?.address, company?.city, company?.state, company?.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
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
              {customerLines.map((line, i) => (
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
              {customerLines.map((line, i) => (
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
            <Text style={[styles.tableHeadText, styles.cellNo]}>No</Text>
            <Text style={[styles.tableHeadText, styles.cellItem]}>ITEMS/SERVICES</Text>
            <Text style={[styles.tableHeadText, styles.cellAmount]}>Total</Text>
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
                {fmt(item.amount ?? item.quantity * item.rate, invoice.currency)}
              </Text>
            </View>
          ))}

          <View style={styles.spacer} />

          {/* Tax breakdown (only if applicable) */}
          {(invoice.cgstTotal || invoice.sgstTotal || invoice.igstTotal || invoice.discountTotal) ? (
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

          {/* Footer: terms+bank | totals+words */}
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
                    {company?.legalName || company?.name ? (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankKey}>Name</Text>
                        <Text style={styles.bankValue}>{company?.legalName || company?.name}</Text>
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
              <View style={styles.wordsBlock}>
                <Text style={styles.wordsLabel}>Total Amount (in words)</Text>
                <Text style={styles.wordsText}>{inrInWords(invoice.grandTotal, invoice.currency)}</Text>
              </View>
              {invoice.notes ? (
                <View style={styles.wordsBlock}>
                  <Text style={styles.wordsLabel}>Notes</Text>
                  <Text style={styles.wordsText}>{invoice.notes}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
