import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import {
  ArrowLeft,
  Copy,
  Download,
  Loader2,
  Pencil,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import type { Company, Invoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTemplate } from '@/pdf/registry';
import { formatCurrency, formatDate } from '@/lib/format';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const invoiceQuery = useQuery({
    queryKey: ['invoice', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<{ invoice: Invoice }>(`/invoices/${id}`);
      return res.data.invoice;
    },
  });

  const companyQuery = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get<{ company: Company }>('/company');
      return res.data.company;
    },
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ invoice: Invoice }>(`/invoices/${id}/duplicate`);
      return res.data.invoice;
    },
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Duplicated');
      navigate(`/app/invoices/${inv._id}/edit`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const removeInvoice = useMutation({
    mutationFn: async () => {
      await api.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted');
      navigate('/app/invoices');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (invoiceQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!invoiceQuery.data) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
        <Button asChild variant="primary" className="mt-4">
          <Link to="/app/invoices">Back to invoices</Link>
        </Button>
      </div>
    );
  }

  const invoice = invoiceQuery.data;
  const company = companyQuery.data ?? null;
  const template = getTemplate(invoice.template);
  const pdfDocument = template.render({ invoice, company });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link to="/app/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <p className="font-mono text-xs text-muted-foreground">{invoice.number}</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {invoice.customerSnapshot.name || 'Invoice'}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatDate(invoice.issueDate)}</span>
              <span>·</span>
              <StatusPill status={invoice.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PDFDownloadLink
            document={pdfDocument}
            fileName={`${invoice.number}.pdf`}
            className="inline-flex"
          >
            {({ loading }) => (
              <Button variant="primary" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </Button>
            )}
          </PDFDownloadLink>
          <Button asChild variant="outline">
            <Link to={`/app/invoices/${invoice._id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="outline" onClick={() => duplicate.mutate()}>
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button variant="outline" onClick={() => setPaymentOpen(true)}>
            <Wallet className="h-4 w-4" /> Record payment
          </Button>
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (confirm(`Delete ${invoice.number}?`)) removeInvoice.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>PDF preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Template: <span className="font-medium">{template.name}</span>
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="aspect-[1/1.414] w-full overflow-hidden rounded-b-2xl bg-muted">
              <PDFViewer width="100%" height="100%" showToolbar={false}>
                {pdfDocument}
              </PDFViewer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Subtotal" value={formatCurrency(invoice.subtotal, invoice.currency)} />
              {invoice.discountTotal ? (
                <Row label="Discount" value={`− ${formatCurrency(invoice.discountTotal, invoice.currency)}`} />
              ) : null}
              {invoice.cgstTotal ? (
                <Row label="CGST" value={formatCurrency(invoice.cgstTotal, invoice.currency)} />
              ) : null}
              {invoice.sgstTotal ? (
                <Row label="SGST" value={formatCurrency(invoice.sgstTotal, invoice.currency)} />
              ) : null}
              {invoice.igstTotal ? (
                <Row label="IGST" value={formatCurrency(invoice.igstTotal, invoice.currency)} />
              ) : null}
              <div className="my-2 h-px bg-border" />
              <div className="flex items-center justify-between rounded-xl bg-navy-800 px-4 py-3 text-white">
                <span className="text-xs uppercase tracking-wider text-white/60">Grand total</span>
                <span className="font-display text-2xl font-bold">
                  {formatCurrency(invoice.grandTotal, invoice.currency)}
                </span>
              </div>
              {invoice.amountPaid ? (
                <Row
                  label="Paid"
                  value={
                    <span className="font-semibold text-emerald-500">
                      {formatCurrency(invoice.amountPaid, invoice.currency)}
                    </span>
                  }
                />
              ) : null}
              {invoice.balanceDue ? (
                <Row label="Balance due" value={formatCurrency(invoice.balanceDue, invoice.currency)} />
              ) : null}
            </CardContent>
          </Card>

          {invoice.payments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {invoice.payments.map((p) => (
                  <div
                    key={p._id ?? `${p.amount}-${p.paidAt}`}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{formatCurrency(p.amount, invoice.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.method.replace('_', ' ')} · {formatDate(p.paidAt)}
                      </p>
                    </div>
                    {p.reference ? (
                      <span className="text-xs text-muted-foreground">{p.reference}</span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <Receipt className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 text-sm text-muted-foreground">
                  No payments recorded yet.
                </div>
                <Button variant="primary" size="sm" onClick={() => setPaymentOpen(true)}>
                  Record
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoice={invoice}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(invoice.balanceDue ?? invoice.grandTotal));
  const [method, setMethod] = useState<string>('upi');
  const [reference, setReference] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ invoice: Invoice }>(`/invoices/${invoice._id}/payments`, {
        amount: Number(amount) || 0,
        method,
        reference,
      });
      return res.data.invoice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoice._id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Payment recorded');
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Balance due: {formatCurrency(invoice.balanceDue, invoice.currency)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="credit_card">Credit card</SelectItem>
                <SelectItem value="debit_card">Debit card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input
              placeholder="UTR / cheque no / txn id"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : 'Save payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
