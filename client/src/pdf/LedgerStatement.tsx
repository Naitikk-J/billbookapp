import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { Company, LedgerCustomerDetail } from '@/lib/types';
import { ensureFonts, fmtPlain } from './shared';

interface LedgerStatementProps {
  company: Company | null;
  detail: LedgerCustomerDetail;
  generatedAt: Date;
}

const COLORS = {
  ink: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  soft: '#F8FAFC',
  green: '#059669',
  red: '#DC2626',
  brand: '#1E293B',
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: COLORS.ink,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  companyMeta: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 2,
  },
  statementTitle: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: COLORS.muted,
  },
  statementLabel: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 2,
    color: COLORS.brand,
  },
  partySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  partyBlock: {
    flexBasis: '55%',
  },
  partyLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  partyName: {
    fontSize: 13,
    fontWeight: 700,
  },
  partyMeta: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 2,
  },
  balanceBlock: {
    flexBasis: '40%',
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  totalsCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
    backgroundColor: COLORS.soft,
  },
  totalsLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalsValue: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 4,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: COLORS.muted,
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: COLORS.soft,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.soft,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  th: {
    fontSize: 8.5,
    fontWeight: 700,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  td: {
    fontSize: 9,
  },
  colSn: { width: '6%' },
  colDate: { width: '14%' },
  colTime: { width: '12%' },
  colType: { width: '12%' },
  colMethod: { width: '12%' },
  colNote: { width: '24%' },
  colAmount: { width: '15%', textAlign: 'right' },
  colBalance: { width: '13%', textAlign: 'right' },
  inAmount: { color: COLORS.green, fontWeight: 600 },
  outAmount: { color: COLORS.red, fontWeight: 600 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.muted,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function LedgerStatement({ company, detail, generatedAt }: LedgerStatementProps) {
  ensureFonts();

  const sortedEntries = [...detail.entries].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return diff;
  });

  const opening = detail.customer.openingBalance ?? 0;

  let running = opening;
  const rows = sortedEntries.map((entry, i) => {
    const amount = entry.amount || 0;
    if (entry.kind === 'credit') running += amount;
    else running -= amount;
    return {
      ...entry,
      sn: i + 1,
      runningBalance: running,
    };
  });

  const periodStart = sortedEntries.length ? new Date(sortedEntries[0].date) : null;
  const periodEnd = sortedEntries.length
    ? new Date(sortedEntries[sortedEntries.length - 1].date)
    : null;

  const balance = detail.totals.balance;
  const positive = balance > 0;
  const negative = balance < 0;
  const balanceLabelText =
    detail.customer.kind === 'supplier'
      ? positive
        ? 'You Pay'
        : negative
          ? 'They Owe'
          : 'Settled'
      : positive
        ? 'You Get (Due)'
        : negative
          ? 'You Give (Advance)'
          : 'Settled';

  const companyAddress = company
    ? [company.address, company.city, company.state, company.postalCode]
        .filter(Boolean)
        .join(', ')
    : '';

  const companyContact = company
    ? [company.phone, company.email, company.gstNumber ? `GSTIN: ${company.gstNumber}` : '']
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Document
      title={`Ledger statement — ${detail.customer.name}`}
      author={company?.name ?? 'Bill Book'}
      creator={company?.name ?? 'Bill Book'}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{company?.name ?? 'Your Business'}</Text>
            {companyAddress ? <Text style={styles.companyMeta}>{companyAddress}</Text> : null}
            {companyContact ? <Text style={styles.companyMeta}>{companyContact}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.statementTitle}>Statement</Text>
            <Text style={styles.statementLabel}>Ledger</Text>
            <Text style={styles.companyMeta}>
              Generated: {formatDateTime(generatedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.partySection}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>
              {detail.customer.kind === 'supplier' ? 'Supplier' : 'Customer'}
            </Text>
            <Text style={styles.partyName}>{detail.customer.name}</Text>
            {detail.customer.phone ? (
              <Text style={styles.partyMeta}>Phone: {detail.customer.phone}</Text>
            ) : null}
            {detail.customer.email ? (
              <Text style={styles.partyMeta}>Email: {detail.customer.email}</Text>
            ) : null}
            {detail.customer.city ? (
              <Text style={styles.partyMeta}>City: {detail.customer.city}</Text>
            ) : null}
            {periodStart && periodEnd ? (
              <Text style={[styles.partyMeta, { marginTop: 6 }]}>
                Period: {formatDate(periodStart)} – {formatDate(periodEnd)}
              </Text>
            ) : null}
          </View>
          <View style={styles.balanceBlock}>
            <Text style={styles.balanceLabel}>{balanceLabelText}</Text>
            <Text
              style={[
                styles.balanceValue,
                positive
                  ? { color: COLORS.red }
                  : negative
                    ? { color: COLORS.green }
                    : { color: COLORS.ink },
              ]}
            >
              {negative ? '+' : ''}
              ₹ {fmtPlain(Math.abs(balance))}
            </Text>
            {opening !== 0 ? (
              <Text style={[styles.partyMeta, { marginTop: 4 }]}>
                Opening: ₹ {fmtPlain(opening)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalsCard}>
            <Text style={styles.totalsLabel}>Total Received (In)</Text>
            <Text style={[styles.totalsValue, { color: COLORS.green }]}>
              ₹ {fmtPlain(detail.totals.totalPayment)}
            </Text>
          </View>
          <View style={styles.totalsCard}>
            <Text style={styles.totalsLabel}>Total Given (Out)</Text>
            <Text style={[styles.totalsValue, { color: COLORS.red }]}>
              ₹ {fmtPlain(detail.totals.totalCredit)}
            </Text>
          </View>
          <View style={styles.totalsCard}>
            <Text style={styles.totalsLabel}>Net Balance</Text>
            <Text style={styles.totalsValue}>
              {negative ? '+' : ''}
              ₹ {fmtPlain(Math.abs(balance))}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Transactions ({sortedEntries.length})
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colSn]}>#</Text>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colTime]}>Time</Text>
            <Text style={[styles.th, styles.colType]}>Type</Text>
            <Text style={[styles.th, styles.colMethod]}>Method</Text>
            <Text style={[styles.th, styles.colNote]}>Note</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
            <Text style={[styles.th, styles.colBalance]}>Balance</Text>
          </View>

          {rows.length === 0 ? (
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <Text style={[styles.td, { width: '100%', textAlign: 'center', color: COLORS.muted }]}>
                No transactions recorded.
              </Text>
            </View>
          ) : (
            rows.map((row, idx) => {
              const d = new Date(row.date);
              const isLast = idx === rows.length - 1;
              const isPayment = row.kind === 'payment';
              return (
                <View
                  key={row._id}
                  style={[
                    styles.tableRow,
                    idx % 2 === 1 ? styles.tableRowAlt : null,
                    isLast ? styles.tableRowLast : null,
                  ].filter(Boolean) as never[]}
                >
                  <Text style={[styles.td, styles.colSn]}>{row.sn}</Text>
                  <Text style={[styles.td, styles.colDate]}>{formatDate(d)}</Text>
                  <Text style={[styles.td, styles.colTime]}>{formatTime(d)}</Text>
                  <Text
                    style={[
                      styles.td,
                      styles.colType,
                      isPayment ? styles.inAmount : styles.outAmount,
                    ]}
                  >
                    {isPayment ? 'Received' : 'Given'}
                  </Text>
                  <Text style={[styles.td, styles.colMethod]}>
                    {(row.method ?? 'cash').toUpperCase()}
                  </Text>
                  <Text style={[styles.td, styles.colNote]}>{row.note || '—'}</Text>
                  <Text
                    style={[
                      styles.td,
                      styles.colAmount,
                      isPayment ? styles.inAmount : styles.outAmount,
                    ]}
                  >
                    {isPayment ? '+' : '-'} ₹ {fmtPlain(row.amount)}
                  </Text>
                  <Text style={[styles.td, styles.colBalance]}>
                    ₹ {fmtPlain(row.runningBalance)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Generated on {formatDateTime(generatedAt)}
            {company?.name ? ` by ${company.name}` : ''}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export default LedgerStatement;
