import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import {
  ArrowLeft,
  Eye,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import type { Company, Customer, Invoice, InvoiceKind, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { computeTotals } from '@/lib/totals';
import { formatCurrency, toInputDate } from '@/lib/format';
import { TEMPLATES } from '@/pdf/registry';
import { cn } from '@/lib/cn';
import type { AiInvoiceDraft } from '@/components/AiInvoiceDialog';

type Kind = InvoiceKind;
type TaxMode = 'intra' | 'inter' | 'none';

interface FormItem {
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  taxPercent: number;
  discountPercent: number;
}

interface FormValues {
  kind: Kind;
  customerId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  template: string;
  taxMode: TaxMode;
  notes: string;
  terms: string;
  items: FormItem[];
  travel: {
    packageName: string;
    destination: string;
    startDate: string;
    endDate: string;
    adults: number;
    children: number;
    hotel: string;
    flight: string;
    vehicle: string;
  };
}

function emptyItem(): FormItem {
  return {
    description: '',
    hsnCode: '',
    quantity: 1,
    unit: 'pax',
    rate: 0,
    taxPercent: 18,
    discountPercent: 0,
  };
}

export default function InvoiceBuilderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const [search] = useSearchParams();
  const initialKind = (search.get('kind') as Kind) ?? 'invoice';
  const aiDraft = (location.state as { aiDraft?: AiInvoiceDraft } | null)?.aiDraft ?? null;
  const aiAppliedRef = useRef(false);

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get<{ customers: Customer[] }>('/customers');
      return res.data.customers;
    },
  });

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get<{ products: Product[] }>('/products');
      return res.data.products;
    },
  });

  const companyQuery = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get<{ company: Company }>('/company');
      return res.data.company;
    },
  });

  const existing = useQuery({
    queryKey: ['invoice', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<{ invoice: Invoice }>(`/invoices/${id}`);
      return res.data.invoice;
    },
  });

  const form = useForm<FormValues>({
    defaultValues: {
      kind: initialKind,
      customerId: '',
      number: '',
      issueDate: toInputDate(new Date()),
      dueDate: '',
      currency: 'INR',
      template: 'safarmate',
      taxMode: 'intra',
      notes: '',
      terms: '',
      items: [emptyItem()],
      travel: {
        packageName: '',
        destination: '',
        startDate: '',
        endDate: '',
        adults: 0,
        children: 0,
        hotel: '',
        flight: '',
        vehicle: '',
      },
    },
  });

  useEffect(() => {
    if (existing.data) {
      const inv = existing.data;
      form.reset({
        kind: inv.kind,
        customerId: inv.customerId,
        number: inv.number,
        issueDate: toInputDate(inv.issueDate),
        dueDate: toInputDate(inv.dueDate ?? null),
        currency: inv.currency,
        template: inv.template,
        taxMode: inv.taxMode,
        notes: inv.notes ?? '',
        terms: inv.terms ?? '',
        items: inv.items.length
          ? inv.items.map((it) => ({
              description: it.description,
              hsnCode: it.hsnCode ?? '',
              quantity: it.quantity,
              unit: it.unit ?? 'pax',
              rate: it.rate,
              taxPercent: it.taxPercent ?? 0,
              discountPercent: it.discountPercent ?? 0,
            }))
          : [emptyItem()],
        travel: {
          packageName: inv.travelDetails?.packageName ?? '',
          destination: inv.travelDetails?.destination ?? '',
          startDate: toInputDate(inv.travelDetails?.startDate ?? null),
          endDate: toInputDate(inv.travelDetails?.endDate ?? null),
          adults: inv.travelDetails?.adults ?? 0,
          children: inv.travelDetails?.children ?? 0,
          hotel: inv.travelDetails?.hotel ?? '',
          flight: inv.travelDetails?.flight ?? '',
          vehicle: inv.travelDetails?.vehicle ?? '',
        },
      });
    }
  }, [existing.data, form]);

  useEffect(() => {
    if (!id && companyQuery.data && !form.getValues('terms')) {
      form.setValue('terms', companyQuery.data.defaultTerms ?? '');
    }
  }, [companyQuery.data, form, id]);

  const createCustomerForDraft = useMutation({
    mutationFn: async (party: AiInvoiceDraft['customer']) => {
      const res = await api.post<{ customer: Customer }>('/customers', {
        name: party.name,
        phone: party.phone ?? '',
        email: party.email ?? '',
        gstNumber: party.gstNumber ?? '',
        city: party.city ?? '',
      });
      return res.data.customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  useEffect(() => {
    if (id) return;
    if (!aiDraft || aiAppliedRef.current) return;
    if (!customersQuery.data) return;
    aiAppliedRef.current = true;

    const applyDraft = async () => {
      let customerId = aiDraft.matchedCustomerId ?? '';

      if (!customerId && aiDraft.customer?.name) {
        try {
          const c = await createCustomerForDraft.mutateAsync(aiDraft.customer);
          customerId = c._id;
        } catch {
          toast.error('Could not auto-create the customer — pick one manually.');
        }
      }

      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + (aiDraft.dueDateOffsetDays ?? 7));

      form.reset({
        kind: aiDraft.kind ?? 'invoice',
        customerId,
        number: '',
        issueDate: toInputDate(today),
        dueDate: toInputDate(due),
        currency: aiDraft.currency || 'INR',
        template: 'safarmate',
        taxMode: aiDraft.items.some((it) => (it.taxPercent ?? 0) > 0) ? 'intra' : 'none',
        notes: aiDraft.notes ?? '',
        terms: companyQuery.data?.defaultTerms ?? '',
        items: aiDraft.items.length
          ? aiDraft.items.map((it) => ({
              description: it.description,
              hsnCode: '',
              quantity: Number(it.quantity) || 1,
              unit: it.unit || 'pax',
              rate: Number(it.rate) || 0,
              taxPercent: Number(it.taxPercent) || 0,
              discountPercent: aiDraft.discountPercent ?? 0,
            }))
          : [emptyItem()],
        travel: {
          packageName: '',
          destination: '',
          startDate: '',
          endDate: '',
          adults: 0,
          children: 0,
          hotel: '',
          flight: '',
          vehicle: '',
        },
      });

      toast.success('AI draft loaded — review the items and save.');
      navigate(location.pathname + (location.search ?? ''), { replace: true, state: {} });
    };

    applyDraft();
  }, [aiDraft, customersQuery.data, companyQuery.data, id, form, navigate, location.pathname, location.search, createCustomerForDraft]);

  const items = useFieldArray({ control: form.control, name: 'items' });
  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const taxMode = useWatch({ control: form.control, name: 'taxMode' });
  const currency = useWatch({ control: form.control, name: 'currency' });
  const template = useWatch({ control: form.control, name: 'template' });

  const totals = useMemo(
    () => computeTotals(watchedItems ?? [], taxMode ?? 'intra'),
    [watchedItems, taxMode, items.fields.length]
  );

  const customerOptions = customersQuery.data ?? [];
  const productOptions = productsQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!values.customerId) {
        throw new Error('Pick a customer before saving.');
      }

      const cleanedItems = values.items
        .map((it) => ({
          description: (it.description ?? '').trim(),
          hsnCode: it.hsnCode ?? '',
          quantity: Number(it.quantity),
          unit: it.unit || 'pax',
          rate: Number(it.rate),
          taxPercent: Number(it.taxPercent ?? 0),
          discountPercent: Number(it.discountPercent ?? 0),
        }))
        .filter(
          (it) =>
            it.description.length > 0 &&
            Number.isFinite(it.quantity) &&
            it.quantity > 0 &&
            Number.isFinite(it.rate) &&
            it.rate >= 0
        );

      if (cleanedItems.length === 0) {
        throw new Error(
          'Add at least one line item with a description, quantity > 0, and a rate.'
        );
      }

      const payload = {
        kind: values.kind,
        customerId: values.customerId,
        issueDate: new Date(values.issueDate || new Date()).toISOString(),
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        currency: values.currency,
        template: values.template,
        taxMode: values.taxMode,
        notes: values.notes,
        terms: values.terms,
        items: cleanedItems,
        travelDetails: {
          packageName: values.travel.packageName,
          destination: values.travel.destination,
          startDate: values.travel.startDate
            ? new Date(values.travel.startDate).toISOString()
            : undefined,
          endDate: values.travel.endDate
            ? new Date(values.travel.endDate).toISOString()
            : undefined,
          adults: Math.max(0, Math.floor(Number(values.travel.adults) || 0)),
          children: Math.max(0, Math.floor(Number(values.travel.children) || 0)),
          hotel: values.travel.hotel,
          flight: values.travel.flight,
          vehicle: values.travel.vehicle,
        },
      };
      const url = id ? `/invoices/${id}` : '/invoices';
      const method = id ? 'patch' : 'post';
      const res = await api[method]<{ invoice: Invoice }>(url, payload);
      return res.data.invoice;
    },
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['recent-invoices'] });
      toast.success(id ? 'Invoice updated' : 'Invoice created');
      navigate(`/app/invoices/${invoice._id}`);
    },
    onError: (err) => {
      const message = apiError(err);
      const details =
        (err as { response?: { data?: unknown } } | undefined)?.response?.data ?? null;
      // eslint-disable-next-line no-console
      console.error('[invoice save failed]', { message, details, error: err });
      toast.error(message, { duration: 10_000 });
    },
  });

  function fillFromProduct(index: number, product: Product) {
    form.setValue(`items.${index}.description`, product.name);
    form.setValue(`items.${index}.rate`, product.price);
    form.setValue(`items.${index}.taxPercent`, product.taxPercent ?? 0);
    form.setValue(`items.${index}.unit`, product.unit ?? 'pax');
    form.setValue(`items.${index}.hsnCode`, product.hsnCode ?? '');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link to="/app/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {id ? 'Edit invoice' : 'New invoice'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Build it in seconds. Switch templates anytime.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={form.handleSubmit((v) => saveMutation.mutate(v))}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <><Save className="h-4 w-4" /> Save invoice</>}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.watch('kind')}
                    onValueChange={(v) => form.setValue('kind', v as Kind)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="quote">Quotation</SelectItem>
                      <SelectItem value="proforma">Proforma</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Issue date</Label>
                  <Input type="date" {...form.register('issueDate')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input type="date" {...form.register('dueDate')} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Customer</Label>
                  {customersQuery.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : customerOptions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-sm">
                      No customers yet —
                      <Link to="/app/customers" className="ml-1 text-secondary underline">
                        add one
                      </Link>
                      .
                    </div>
                  ) : (
                    <Select
                      value={form.watch('customerId')}
                      onValueChange={(v) => form.setValue('customerId', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Pick a customer…" /></SelectTrigger>
                      <SelectContent>
                        {customerOptions.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.name}
                            {c.city ? ` · ${c.city}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={form.watch('currency')}
                    onValueChange={(v) => form.setValue('currency', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR — ₹</SelectItem>
                      <SelectItem value="USD">USD — $</SelectItem>
                      <SelectItem value="EUR">EUR — €</SelectItem>
                      <SelectItem value="GBP">GBP — £</SelectItem>
                      <SelectItem value="AED">AED — د.إ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tax mode</Label>
                  <Select
                    value={form.watch('taxMode')}
                    onValueChange={(v) => form.setValue('taxMode', v as TaxMode)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intra">Intra-state (CGST + SGST)</SelectItem>
                      <SelectItem value="inter">Inter-state (IGST)</SelectItem>
                      <SelectItem value="none">No tax</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line items</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => items.append(emptyItem())}
              >
                <Plus className="h-4 w-4" /> Add row
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="hidden gap-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,_2.4fr)_88px_88px_88px_88px_88px_44px]">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span>Rate</span>
                  <span>Tax %</span>
                  <span>Disc %</span>
                  <span className="sr-only">Actions</span>
                </div>
                {items.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-xl border border-border bg-muted/20 p-3 transition-colors"
                  >
                    <div className="grid gap-2 md:grid-cols-[minmax(0,_2.4fr)_88px_88px_88px_88px_88px_44px] md:items-center">
                      <div className="space-y-1">
                        <Input
                          placeholder="Service or item description"
                          {...form.register(`items.${index}.description`)}
                        />
                        <div className="flex gap-2">
                          <Input
                            className="h-8 text-xs"
                            placeholder="HSN"
                            {...form.register(`items.${index}.hsnCode`)}
                          />
                          {productOptions.length > 0 ? (
                            <Select
                              value=""
                              onValueChange={(productId) => {
                                const p = productOptions.find((x) => x._id === productId);
                                if (p) fillFromProduct(index, p);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Or pick from catalog" />
                              </SelectTrigger>
                              <SelectContent>
                                {productOptions.map((p) => (
                                  <SelectItem key={p._id} value={p._id}>
                                    {p.name} · {formatCurrency(p.price)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Qty"
                        {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                      <Input
                        placeholder="unit"
                        {...form.register(`items.${index}.unit`)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Rate"
                        {...form.register(`items.${index}.rate`, { valueAsNumber: true })}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Tax %"
                        {...form.register(`items.${index}.taxPercent`, { valueAsNumber: true })}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Disc %"
                        {...form.register(`items.${index}.discountPercent`, { valueAsNumber: true })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => items.remove(index)}
                        disabled={items.fields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" /> Travel details (optional)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                For travel packages, tours, and trips — shows up beautifully on the PDF.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Package name</Label>
                <Input placeholder="Bali 7N/8D — Beach package" {...form.register('travel.packageName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Destination</Label>
                <Input placeholder="Bali" {...form.register('travel.destination')} />
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" {...form.register('travel.startDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" {...form.register('travel.endDate')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Adults</Label>
                  <Input type="number" {...form.register('travel.adults', { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Children</Label>
                  <Input type="number" {...form.register('travel.children', { valueAsNumber: true })} />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label>Hotel</Label>
                <Input placeholder="Hotel + city" {...form.register('travel.hotel')} />
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label>Flight</Label>
                <Input placeholder="Airline + route" {...form.register('travel.flight')} />
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label>Vehicle / transfers</Label>
                <Input placeholder="SUV / Innova / Tempo" {...form.register('travel.vehicle')} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes & terms</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Customer notes</Label>
                <Textarea rows={4} placeholder="Thanks for choosing us!" {...form.register('notes')} />
              </div>
              <div className="space-y-1.5">
                <Label>Terms & conditions</Label>
                <Textarea rows={4} placeholder="Payment terms…" {...form.register('terms')} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle>Totals</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {taxMode === 'intra'
                  ? 'CGST + SGST'
                  : taxMode === 'inter'
                    ? 'IGST'
                    : 'No tax'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <TotalRow label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
              {totals.discountTotal > 0 ? (
                <TotalRow
                  label="Discount"
                  value={`− ${formatCurrency(totals.discountTotal, currency)}`}
                />
              ) : null}
              <TotalRow label="Taxable" value={formatCurrency(totals.taxableTotal, currency)} />
              {taxMode === 'intra' ? (
                <>
                  <TotalRow label="CGST" value={formatCurrency(totals.cgstTotal, currency)} />
                  <TotalRow label="SGST" value={formatCurrency(totals.sgstTotal, currency)} />
                </>
              ) : taxMode === 'inter' ? (
                <TotalRow label="IGST" value={formatCurrency(totals.igstTotal, currency)} />
              ) : (
                <TotalRow
                  label="Tax"
                  value={`No tax (${formatCurrency(0, currency)})`}
                />
              )}
              <div className="my-2 h-px bg-border" />
              <div className="flex items-center justify-between rounded-xl bg-navy-800 px-4 py-3 text-white">
                <span className="text-xs uppercase tracking-wider text-white/60">Grand total</span>
                <span className="font-display text-2xl font-bold">
                  {formatCurrency(totals.grandTotal, currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
              <p className="text-sm text-muted-foreground">Switch the look. PDF updates instantly.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => form.setValue('template', t.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                      template === t.id
                        ? 'border-secondary bg-secondary/5 ring-1 ring-secondary/40'
                        : 'border-border hover:border-foreground/20'
                    )}
                  >
                    <span
                      className={cn(
                        'h-10 w-12 shrink-0 rounded-md bg-gradient-to-br',
                        t.accent
                      )}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    {template === t.id ? (
                      <Badge variant="primary">Selected</Badge>
                    ) : null}
                  </button>
                ))}
              </div>
              {id ? (
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link to={`/app/invoices/${id}`}>
                    <Eye className="h-4 w-4" /> Open preview
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
