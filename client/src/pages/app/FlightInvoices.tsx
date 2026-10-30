import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PDFDownloadLink } from '@react-pdf/renderer';
import {
  Download,
  FileUp,
  Loader2,
  Plane,
  Share2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import { fileToBase64 } from '@/lib/fileToBase64';
import type { Company, Customer, FlightInvoiceDraft, Invoice } from '@/lib/types';
import { computeTotals } from '@/lib/totals';
import { getTemplate } from '@/pdf/registry';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { matchCustomerId } from '@/lib/matchCustomer';
import { FlightPdfPreview } from '@/components/FlightPdfPreview';

function draftToPreviewInvoice(
  draft: FlightInvoiceDraft,
  customerLabel: string,
  companyId: string
): Invoice {
  const totals = computeTotals(draft.items, draft.taxMode === 'inter' ? 'inter' : draft.taxMode);
  return {
    _id: 'preview',
    companyId,
    customerId: draft.matchedCustomerId ?? '',
    kind: draft.kind,
    number: 'DRAFT',
    issueDate: new Date().toISOString(),
    currency: draft.currency,
    template: draft.template,
    customerSnapshot: {
      name: customerLabel,
      email: draft.customerHint.email,
      phone: draft.customerHint.phone,
      gstNumber: draft.customerHint.gstNumber,
      address: '',
      city: draft.customerHint.city,
      state: '',
      country: 'India',
      postalCode: '',
    },
    items: draft.items.map((it) => {
      const gross = (it.quantity || 0) * (it.rate || 0);
      const disc = gross * ((it.discountPercent || 0) / 100);
      const taxable = gross - disc;
      const tax = taxable * ((it.taxPercent || 0) / 100);
      return {
        description: it.description,
        hsnCode: it.hsnCode,
        quantity: it.quantity,
        unit: it.unit,
        rate: it.rate,
        taxPercent: it.taxPercent,
        discountPercent: it.discountPercent,
        amount: Math.round((taxable + tax + Number.EPSILON) * 100) / 100,
      };
    }),
    travelDetails: { ...draft.travelDetails, flightSegments: draft.segments },
    notes: draft.notes,
    terms: '',
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    grandTotal: totals.grandTotal,
    amountPaid: 0,
    balanceDue: totals.grandTotal,
    taxMode: draft.taxMode === 'inter' ? 'inter' : draft.taxMode === 'none' ? 'none' : 'intra',
    status: 'draft',
    payments: [],
  };
}

export default function FlightInvoicesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<FlightInvoiceDraft | null>(null);
  const [customerId, setCustomerId] = useState<string>('');

  const companyQuery = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get<{ company: Company }>('/company');
      return res.data.company;
    },
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: async () => {
      const res = await api.get<{ customers: Customer[] }>('/customers', {
        params: { view: 'picker' },
      });
      return res.data.customers;
    },
    staleTime: 120_000,
  });

  const parsePdf = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      const res = await api.post<{
        draft: FlightInvoiceDraft;
        extraction?: { format: string; rawTextLength: number };
      }>('/flight-invoices/parse-pdf', {
        fileName: f.name,
        mimeType: f.type || 'application/pdf',
        base64,
      });
      return res.data;
    },
    onSuccess: (data) => {
      const customers =
        qc.getQueryData<Customer[]>(['customers', 'picker']) ?? customersQuery.data ?? [];
      const matched =
        data.draft.matchedCustomerId ??
        matchCustomerId(data.draft.customerHint.name ?? '', customers);
      const draft = matched
        ? {
            ...data.draft,
            matchedCustomerId: matched,
            customerHint: {
              ...data.draft.customerHint,
              ...(() => {
                const c = customers.find((x) => x._id === matched);
                return c
                  ? {
                      phone: c.phone ?? data.draft.customerHint.phone,
                      email: c.email ?? data.draft.customerHint.email,
                      city: c.city ?? data.draft.customerHint.city,
                    }
                  : {};
              })(),
            },
          }
        : data.draft;
      setDraft(draft);
      setCustomerId(matched ?? '');
      const fmt = data.extraction?.format?.replace(/_/g, ' ') ?? 'PDF';
      toast.success(`Extracted (${fmt}) — check preview and save to share.`);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const saveInvoice = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('Upload a PDF first.');
      let cid = customerId;
      if (!cid) {
        const name = (draft.customerHint.name ?? '').trim() || 'Flight customer';
        const created = await api.post<{ customer: Customer }>('/customers', {
          name,
          phone: draft.customerHint.phone ?? '',
          email: draft.customerHint.email ?? '',
          city: draft.customerHint.city ?? '',
        });
        cid = created.data.customer._id;
      }

      const res = await api.post<{ invoice: Invoice }>('/invoices', {
        kind: draft.kind,
        customerId: cid,
        currency: draft.currency,
        template: draft.template,
        taxMode: draft.taxMode,
        issueDate: new Date().toISOString(),
        notes: draft.notes,
        items: draft.items,
        travelDetails: {
          ...draft.travelDetails,
          startDate: draft.travelDetails.startDate
            ? new Date(draft.travelDetails.startDate).toISOString()
            : undefined,
          endDate: draft.travelDetails.endDate
            ? new Date(draft.travelDetails.endDate).toISOString()
            : undefined,
          flightSegments: draft.segments,
        },
      });
      return res.data.invoice;
    },
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice saved — share the PDF from the next screen.');
      navigate(`/app/invoices/${invoice._id}`);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const customers = customersQuery.data ?? [];
  const customerLabel =
    customers.find((c) => c._id === customerId)?.name ?? draft?.customerHint.name ?? 'Customer';

  const previewInvoice = useMemo(() => {
    if (!draft || !companyQuery.data) return null;
    return draftToPreviewInvoice(draft, customerLabel, companyQuery.data._id ?? '');
  }, [draft, customerLabel, companyQuery.data]);

  const template = previewInvoice ? getTemplate(previewInvoice.template) : null;
  const pdfDoc =
    previewInvoice && template
      ? template.render({ invoice: previewInvoice, company: companyQuery.data ?? null })
      : null;

  function onPickPdf(f: File | undefined) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please drop a PDF file.');
      return;
    }
    setFile(f);
    setDraft(null);
    parsePdf.mutate(f);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Flight invoices</h1>
            <p className="text-sm text-muted-foreground">
            Drop an airline e-ticket or itinerary PDF — local parser (no AI) builds your Safarmate flight
            voucher to share with customers.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileUp className="h-4 w-4 text-sky-500" /> Upload flight PDF
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onPickPdf(e.dataTransfer.files[0]);
                }}
                className={cn(
                  'cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-secondary/50',
                  parsePdf.isPending && 'pointer-events-none opacity-70'
                )}
              >
                {parsePdf.isPending ? (
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-secondary" />
                ) : (
                  <Plane className="mx-auto h-8 w-8 text-muted-foreground" />
                )}
                <p className="mt-2 text-sm font-medium">
                  {file ? file.name : 'Click or drop flight bill PDF'}
                </p>
                <p className="text-xs text-muted-foreground">
                  MakeMyTrip, Goibibo, airline e-ticket, tax invoice — up to ~10 MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => onPickPdf(e.target.files?.[0])}
                />
              </div>
            </CardContent>
          </Card>

          {draft ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-emerald-500" /> Extracted
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">PNR / booking</p>
                  <p className="font-medium">{draft.travelDetails.bookingId || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Route</p>
                  <p className="font-medium">{draft.travelDetails.flight || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Segments</p>
                  <p className="font-medium">{draft.segments.length}</p>
                </div>
                <div className="space-y-1.5 pt-2">
                  <Label>Bill to (customer)</Label>
                  <Select value={customerId || '_new'} onValueChange={(v) => setCustomerId(v === '_new' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_new">
                        Create: {draft.customerHint.name || 'Flight customer'}
                      </SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="mt-2 w-full"
                  variant="primary"
                  disabled={saveInvoice.isPending}
                  onClick={() => saveInvoice.mutate()}
                >
                  {saveInvoice.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" /> Save & share invoice
                    </>
                  )}
                </Button>
                {pdfDoc ? (
                  <PDFDownloadLink
                    document={pdfDoc}
                    fileName={`flight-invoice-${draft.travelDetails.bookingId || 'draft'}.pdf`}
                    className="inline-flex w-full"
                  >
                    {({ loading }) => (
                      <Button variant="outline" className="w-full" disabled={loading} type="button">
                        <Download className="h-4 w-4" />
                        {loading ? 'Preparing…' : 'Download PDF without saving'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="min-h-[520px] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Voucher preview</CardTitle>
            <p className="text-sm text-muted-foreground">Safarmate Flight Voucher — customer share</p>
          </CardHeader>
          <CardContent className="h-[640px] p-0">
            {pdfDoc ? (
              <FlightPdfPreview document={pdfDoc} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <FileUp className="h-10 w-10 opacity-40" />
                Upload a PDF to see your branded invoice here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
