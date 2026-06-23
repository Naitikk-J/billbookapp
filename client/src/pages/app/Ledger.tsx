import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';

import { api, apiError } from '@/lib/api';
import type {
  Company,
  Customer,
  LedgerAccount,
  LedgerCustomerDetail,
  LedgerEntry,
  LedgerEntryKind,
  LedgerEntryMethod,
  LedgerSummary,
} from '@/lib/types';
import { LedgerStatement } from '@/pdf/LedgerStatement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import {
  formatCurrency,
  formatDate,
  fromInputDateTime,
  initials,
  toInputDateTime,
} from '@/lib/format';

type AccountKind = 'customer' | 'supplier';

const PAYMENT_METHODS: LedgerEntryMethod[] = ['cash', 'upi', 'bank', 'card', 'cheque', 'other'];

const entrySchema = z.object({
  kind: z.enum(['payment', 'credit']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  note: z.string().max(500).optional().default(''),
  method: z.enum(['cash', 'upi', 'bank', 'card', 'cheque', 'other']).default('cash'),
  date: z.string().min(1, 'Pick a date and time'),
});
type EntryValues = z.infer<typeof entrySchema>;

type EntryDialogState =
  | { mode: 'create'; kind: LedgerEntryKind }
  | { mode: 'edit'; entry: LedgerEntry }
  | null;

const newPartySchema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().optional().default(''),
  email: z.string().email().or(z.literal('')).optional().default(''),
  city: z.string().optional().default(''),
});
type NewPartyValues = z.infer<typeof newPartySchema>;

export default function LedgerPage() {
  const navigate = useNavigate();
  const params = useParams<{ customerId?: string }>();
  const selectedId = params.customerId ?? null;

  const [tab, setTab] = useState<AccountKind>('customer');
  const [query, setQuery] = useState('');
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [entryDialog, setEntryDialog] = useState<EntryDialogState>(null);
  const [downloading, setDownloading] = useState(false);

  const qc = useQueryClient();

  const company = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get<{ company: Company }>('/company');
      return res.data.company;
    },
  });

  const summary = useQuery({
    queryKey: ['ledger-summary', tab],
    queryFn: async () => {
      const res = await api.get<LedgerSummary>('/ledger/summary', { params: { kind: tab } });
      return res.data;
    },
  });

  const filteredAccounts = useMemo(() => {
    if (!summary.data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return summary.data.accounts;
    return summary.data.accounts.filter((a) =>
      [a.name, a.phone, a.email, a.city].some((v) => (v ?? '').toLowerCase().includes(q))
    );
  }, [summary.data, query]);

  const detail = useQuery({
    queryKey: ['ledger-detail', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await api.get<LedgerCustomerDetail>(`/ledger/${selectedId}`);
      return res.data;
    },
    enabled: !!selectedId,
  });

  const addEntry = useMutation({
    mutationFn: async (values: EntryValues) => {
      if (!selectedId) throw new Error('Select a party first');
      const payload = {
        ...values,
        date: fromInputDateTime(values.date),
      };
      await api.post(`/ledger/${selectedId}/entries`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger-summary'] });
      qc.invalidateQueries({ queryKey: ['ledger-detail', selectedId] });
      setEntryDialog(null);
      toast.success('Entry recorded');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: EntryValues }) => {
      const payload = {
        ...values,
        date: fromInputDateTime(values.date),
      };
      await api.patch(`/ledger/entries/${id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger-summary'] });
      qc.invalidateQueries({ queryKey: ['ledger-detail', selectedId] });
      setEntryDialog(null);
      toast.success('Entry updated');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ledger/entries/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger-summary'] });
      qc.invalidateQueries({ queryKey: ['ledger-detail', selectedId] });
      toast.success('Entry removed');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  async function handleDownload() {
    if (!detail.data) return;
    setDownloading(true);
    try {
      const generatedAt = new Date();
      const blob = await pdf(
        <LedgerStatement
          company={company.data ?? null}
          detail={detail.data}
          generatedAt={generatedAt}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = detail.data.customer.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const stamp = generatedAt
        .toISOString()
        .replace(/[:T]/g, '-')
        .slice(0, 16);
      a.href = url;
      a.download = `ledger-${slug || 'party'}-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Statement downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate PDF');
    } finally {
      setDownloading(false);
    }
  }

  const addParty = useMutation({
    mutationFn: async (values: NewPartyValues) => {
      const res = await api.post('/customers', { ...values, kind: tab });
      return res.data.customer as Customer;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['ledger-summary'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      setAddPartyOpen(false);
      toast.success(`${tab === 'customer' ? 'Customer' : 'Supplier'} added`);
      navigate(`/app/ledger/${c._id}`);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const totals = summary.data?.totals;
  const tabLabel = tab === 'customer' ? 'Customer' : 'Supplier';
  const youGetLabel = tab === 'customer' ? 'You Get' : 'You Pay';
  const youGiveLabel = tab === 'customer' ? 'You Give' : 'They Give';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Track money you get and money you owe — separate from invoices.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Sidebar list */}
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1">
              {(['customer', 'supplier'] as AccountKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setTab(k);
                    if (selectedId) navigate('/app/ledger');
                  }}
                  className={cn(
                    'rounded-md py-2 text-sm font-medium capitalize transition-colors',
                    tab === k
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {k === 'customer' ? 'Customers' : 'Suppliers'}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search ${tab}s…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Net balance</p>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-display text-lg font-bold text-emerald-500">
                  {formatCurrency(totals?.netReceivable ?? 0)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {totals?.accountsCount ?? 0} accounts
                </span>
              </div>
              {(totals?.netPayable ?? 0) > 0 ? (
                <p className="mt-1 text-xs text-destructive">
                  − {formatCurrency(totals?.netPayable ?? 0)} {youGiveLabel}
                </p>
              ) : null}
            </div>
          </div>

          <CardContent className="p-0">
            {summary.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filteredAccounts.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-5 w-5 text-emerald-500" />}
                title={`No ${tab}s yet`}
                description={`Add a ${tab} to start recording transactions.`}
                action={
                  <Button variant="primary" onClick={() => setAddPartyOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Add {tab}
                  </Button>
                }
              />
            ) : (
              <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
                {filteredAccounts.map((a) => (
                  <AccountRow
                    key={a._id}
                    account={a}
                    active={a._id === selectedId}
                    onSelect={() => navigate(`/app/ledger/${a._id}`)}
                  />
                ))}
              </ul>
            )}
          </CardContent>

          <div className="border-t border-border p-3">
            <Button variant="primary" className="w-full" onClick={() => setAddPartyOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add {tabLabel}
            </Button>
          </div>
        </Card>

        {/* Detail */}
        <Card className="overflow-hidden">
          {!selectedId ? (
            <CardContent className="flex h-full min-h-[480px] items-center justify-center">
              <EmptyState
                icon={<BookOpen className="h-5 w-5 text-emerald-500" />}
                title="Select a party"
                description="Pick a customer or supplier from the list to view their transaction history."
              />
            </CardContent>
          ) : detail.isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : detail.data ? (
            <DetailPanel
              detail={detail.data}
              tabLabel={tabLabel}
              youGetLabel={youGetLabel}
              youGiveLabel={youGiveLabel}
              onAddPayment={() => setEntryDialog({ mode: 'create', kind: 'payment' })}
              onAddCredit={() => setEntryDialog({ mode: 'create', kind: 'credit' })}
              onEditEntry={(entry) => setEntryDialog({ mode: 'edit', entry })}
              onDeleteEntry={(id) => {
                if (confirm('Remove this entry?')) deleteEntry.mutate(id);
              }}
              onDownload={handleDownload}
              downloading={downloading}
              deleting={deleteEntry.isPending}
            />
          ) : null}
        </Card>
      </div>

      <NewPartyDialog
        open={addPartyOpen}
        onOpenChange={setAddPartyOpen}
        kind={tab}
        onSubmit={(v) => addParty.mutate(v)}
        saving={addParty.isPending}
      />

      <EntryDialog
        state={entryDialog}
        onOpenChange={(o) => {
          if (!o) setEntryDialog(null);
        }}
        partyName={detail.data?.customer.name ?? ''}
        onCreate={(v) => addEntry.mutate(v)}
        onUpdate={(id, v) => updateEntry.mutate({ id, values: v })}
        saving={addEntry.isPending || updateEntry.isPending}
      />
    </div>
  );
}

function AccountRow({
  account,
  active,
  onSelect,
}: {
  account: LedgerAccount;
  active: boolean;
  onSelect: () => void;
}) {
  const positive = account.balance > 0;
  const negative = account.balance < 0;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
          active && 'bg-emerald-500/10 hover:bg-emerald-500/15'
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-royal-500 to-emerald-500 text-sm font-semibold text-white">
          {initials(account.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{account.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {account.lastActivity
              ? `Last activity ${formatDate(account.lastActivity)}`
              : account.phone || account.city || '—'}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span
            className={cn(
              'font-display text-sm font-semibold',
              positive && 'text-destructive',
              negative && 'text-emerald-500',
              !positive && !negative && 'text-muted-foreground'
            )}
          >
            {positive
              ? formatCurrency(account.balance)
              : negative
                ? `+${formatCurrency(Math.abs(account.balance))}`
                : formatCurrency(0)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {positive ? 'Due' : negative ? 'Advance' : 'Settled'}
          </span>
        </span>
      </button>
    </li>
  );
}

function DetailPanel({
  detail,
  tabLabel,
  youGetLabel,
  youGiveLabel,
  onAddPayment,
  onAddCredit,
  onEditEntry,
  onDeleteEntry,
  onDownload,
  downloading,
  deleting,
}: {
  detail: LedgerCustomerDetail;
  tabLabel: string;
  youGetLabel: string;
  youGiveLabel: string;
  onAddPayment: () => void;
  onAddCredit: () => void;
  onEditEntry: (entry: LedgerEntry) => void;
  onDeleteEntry: (id: string) => void;
  onDownload: () => void;
  downloading: boolean;
  deleting: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof detail.entries>();
    for (const e of detail.entries) {
      const k = formatDate(e.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [detail.entries]);

  const balance = detail.totals.balance;
  const positive = balance > 0;
  const negative = balance < 0;

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-royal-500 to-emerald-500 text-base font-semibold text-white">
            {initials(detail.customer.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{detail.customer.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[detail.customer.phone, detail.customer.email, detail.customer.city]
                .filter(Boolean)
                .join(' · ') || `${tabLabel} account`}
            </p>
          </div>
        </div>
        <div className="flex items-start justify-between gap-4 md:justify-end">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {positive
                ? `${youGetLabel} (Due)`
                : negative
                  ? `${youGiveLabel} (Advance)`
                  : 'Balance'}
            </p>
            <p
              className={cn(
                'font-display text-2xl font-bold',
                positive && 'text-destructive',
                negative && 'text-emerald-500'
              )}
            >
              {positive
                ? formatCurrency(balance)
                : negative
                  ? `+${formatCurrency(Math.abs(balance))}`
                  : formatCurrency(0)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={downloading || detail.entries.length === 0}
            title={
              detail.entries.length === 0
                ? 'No transactions to download yet'
                : 'Download timestamped PDF statement'
            }
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Transactions */}
      <div className="flex-1 overflow-y-auto p-5">
        {grouped.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5 text-emerald-500" />}
            title="No transactions yet"
            description="Use the buttons below to record a payment received or amount given."
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(([dateKey, entries]) => (
              <div key={dateKey}>
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {dateKey}
                </p>
                <div className="space-y-2">
                  {entries.map((e) => (
                    <EntryRow
                      key={e._id}
                      entry={e}
                      onEdit={() => onEditEntry(e)}
                      onDelete={() => onDeleteEntry(e._id)}
                      deleting={deleting}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 border-t border-border bg-muted/20 p-4">
        <Button
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
          onClick={onAddPayment}
        >
          <ArrowDown className="h-4 w-4" /> Payment (Received)
        </Button>
        <Button
          variant="outline"
          className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
          onClick={onAddCredit}
        >
          <ArrowUp className="h-4 w-4" /> Credit (Given)
        </Button>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
  deleting,
}: {
  entry: LedgerCustomerDetail['entries'][number];
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isPayment = entry.kind === 'payment';
  const d = new Date(entry.date);
  const timeLabel = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const dateLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border px-4 py-3',
        isPayment
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-destructive/30 bg-destructive/5'
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          isPayment ? 'bg-emerald-500/15 text-emerald-500' : 'bg-destructive/15 text-destructive'
        )}
      >
        {isPayment ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-display text-base font-semibold',
            isPayment ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
          )}
        >
          {isPayment ? '' : '+ '}
          {formatCurrency(entry.amount)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {(entry.method ?? 'cash').toUpperCase()}
          {entry.note ? ` · ${entry.note}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-end text-right text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{timeLabel}</span>
        <span>{dateLabel}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Edit entry"
          title="Edit entry"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          aria-label="Delete entry"
          title="Delete entry"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EntryDialog({
  state,
  onOpenChange,
  partyName,
  onCreate,
  onUpdate,
  saving,
}: {
  state: EntryDialogState;
  onOpenChange: (o: boolean) => void;
  partyName: string;
  onCreate: (values: EntryValues) => void;
  onUpdate: (id: string, values: EntryValues) => void;
  saving: boolean;
}) {
  const open = state !== null;
  const isEdit = state?.mode === 'edit';
  const kind: LedgerEntryKind = state
    ? state.mode === 'create'
      ? state.kind
      : state.entry.kind
    : 'payment';
  const isPayment = kind === 'payment';

  const defaults: EntryValues = useMemo(() => {
    if (state?.mode === 'edit') {
      return {
        kind: state.entry.kind,
        amount: state.entry.amount as unknown as number,
        note: state.entry.note ?? '',
        method: (state.entry.method ?? 'cash') as LedgerEntryMethod,
        date: toInputDateTime(state.entry.date),
      };
    }
    return {
      kind: state?.mode === 'create' ? state.kind : 'payment',
      amount: 0 as unknown as number,
      note: '',
      method: 'cash',
      date: toInputDateTime(new Date()),
    };
  }, [state]);

  const form = useForm<EntryValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  function submit(values: EntryValues) {
    if (state?.mode === 'edit') {
      onUpdate(state.entry._id, values);
    } else {
      onCreate(values);
    }
  }

  const title = isEdit
    ? `Edit ${isPayment ? 'payment' : 'credit'} — ${partyName}`
    : `${isPayment ? 'Payment received' : 'Credit given'} — ${partyName}`;
  const description = isEdit
    ? 'Update the amount, time, method or note. The running balance recalculates automatically.'
    : isPayment
      ? 'Record money received from this party. This reduces what they owe.'
      : 'Record money given / goods supplied. This adds to what they owe.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount" error={form.formState.errors.amount?.message}>
              <Input type="number" step="0.01" placeholder="0" {...form.register('amount')} />
            </Field>
            <Field label="Date & time" error={form.formState.errors.date?.message}>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  step="60"
                  {...form.register('date')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => form.setValue('date', toInputDateTime(new Date()))}
                  title="Set to current local time"
                >
                  Now
                </Button>
              </div>
            </Field>
            {isEdit ? (
              <Field label="Type" className="md:col-span-2">
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...form.register('kind')}
                >
                  <option value="payment">Payment (Received)</option>
                  <option value="credit">Credit (Given)</option>
                </select>
              </Field>
            ) : null}
            <Field label="Method" className="md:col-span-2">
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...form.register('method')}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note" className="md:col-span-2">
              <Textarea
                rows={2}
                placeholder="Optional reference, invoice no, etc."
                {...form.register('note')}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className={cn(
                isPayment
                  ? 'bg-emerald-500 hover:bg-emerald-500/90'
                  : 'bg-destructive hover:bg-destructive/90'
              )}
            >
              {saving ? (
                <Loader2 className="animate-spin" />
              ) : isEdit ? (
                'Save changes'
              ) : isPayment ? (
                'Record payment'
              ) : (
                'Record credit'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewPartyDialog({
  open,
  onOpenChange,
  kind,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: AccountKind;
  onSubmit: (v: NewPartyValues) => void;
  saving: boolean;
}) {
  const form = useForm<NewPartyValues>({
    resolver: zodResolver(newPartySchema),
    values: { name: '', phone: '', email: '', city: '' },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {kind}</DialogTitle>
          <DialogDescription>
            Quick add — fill phone / email later from the Customers section if needed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" error={form.formState.errors.name?.message} className="md:col-span-2">
              <Input placeholder={kind === 'customer' ? 'Customer name' : 'Supplier name'} {...form.register('name')} />
            </Field>
            <Field label="Phone">
              <Input placeholder="+91 98xxxxxx" {...form.register('phone')} />
            </Field>
            <Field label="City">
              <Input {...form.register('city')} />
            </Field>
            <Field label="Email" className="md:col-span-2" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register('email')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <><Plus className="h-4 w-4" /> Add</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
