import { useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import type { Invoice, InvoiceStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { formatCurrency, formatDate } from '@/lib/format';
import { AiInvoiceDialog } from '@/components/AiInvoiceDialog';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [status, setStatus] = useState<string>('all');
  const [aiOpen, setAiOpen] = useState(false);

  const list = useQuery({
    queryKey: ['invoices', debouncedQuery, status],
    queryFn: async () => {
      const res = await api.get<{ invoices: Invoice[] }>('/invoices', {
        params: {
          q: debouncedQuery,
          status: status === 'all' ? '' : status,
          view: 'summary',
          limit: 200,
        },
      });
      return res.data.invoices;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const dup = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/invoices/${id}/duplicate`);
      return res.data.invoice as Invoice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice duplicated');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">All your invoices, quotes, proformas, and receipts in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setAiOpen(true)}
            className="border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-royal-500/10 text-foreground hover:from-emerald-500/20 hover:to-royal-500/20"
          >
            <Sparkles className="h-4 w-4 text-emerald-500" /> AI Invoice
          </Button>
          <Button asChild variant="primary">
            <Link to="/app/invoices/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </Button>
        </div>
      </div>

      <AiInvoiceDialog open={aiOpen} onOpenChange={setAiOpen} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by number, customer, destination…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : list.isError ? (
            <EmptyState
              icon={<FileText className="h-5 w-5 text-destructive" />}
              title="Could not load invoices"
              description="The server or database may be unreachable. Refresh or try again in a moment."
            />
          ) : list.data && list.data.length > 0 ? (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[140px_1.5fr_120px_140px_140px_44px] items-center px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Number</span>
                <span>Customer</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span>Status</span>
                <span />
              </div>
              {list.data.map((inv) => (
                <InvoiceRow
                  key={inv._id}
                  invoice={inv}
                  onDuplicate={() => dup.mutate(inv._id)}
                  onDelete={() => {
                    if (confirm(`Delete ${inv.number}?`)) del.mutate(inv._id);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-5 w-5 text-emerald-500" />}
              title="No invoices yet"
              description="Create your first invoice. It takes less than 30 seconds."
              action={
                <Button asChild variant="primary">
                  <Link to="/app/invoices/new">
                    <Plus className="h-4 w-4" /> Create invoice
                  </Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceRow({
  invoice,
  onDuplicate,
  onDelete,
}: {
  invoice: Invoice;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-[140px_1.5fr_120px_140px_140px_44px] items-center gap-2 px-6 py-4 transition-colors hover:bg-muted/40">
      <Link to={`/app/invoices/${invoice._id}`} className="font-mono text-xs font-semibold">
        {invoice.number}
      </Link>
      <Link to={`/app/invoices/${invoice._id}`} className="min-w-0">
        <p className="truncate font-medium">{invoice.customerSnapshot.name || '—'}</p>
        <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
          <Badge variant="muted">{invoice.kind}</Badge>
          {invoice.travelDetails?.destination ? <span>{invoice.travelDetails.destination}</span> : null}
        </div>
      </Link>
      <p className="text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</p>
      <p className="text-right font-medium">
        {formatCurrency(invoice.grandTotal, invoice.currency)}
      </p>
      <StatusPill status={invoice.status as InvoiceStatus} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy className="h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
