import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import type { Customer } from '@/lib/types';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { formatDate, initials } from '@/lib/format';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email().or(z.literal('')).optional().default(''),
  phone: z.string().optional().default(''),
  gstNumber: z.string().optional().default(''),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  country: z.string().optional().default('India'),
  postalCode: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

type CustomerValues = z.infer<typeof schema>;

export default function CustomersPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useQuery({
    queryKey: ['customers', query],
    queryFn: async () => {
      const res = await api.get<{ customers: Customer[] }>('/customers', { params: { q: query } });
      return res.data.customers;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerValues) => {
      if (editing) {
        const res = await api.patch(`/customers/${editing._id}`, values);
        return res.data.customer as Customer;
      }
      const res = await api.post('/customers', values);
      return res.data.customer as Customer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success(editing ? 'Customer updated' : 'Customer added');
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer removed');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Everyone you bill — agencies, corporates, and individuals.</p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <UserPlus className="h-4 w-4" /> Add customer
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : list.data && list.data.length > 0 ? (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_120px_44px] items-center px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Customer</span>
                <span>Contact</span>
                <span>Location</span>
                <span>Added</span>
                <span />
              </div>
              {list.data.map((c) => (
                <div
                  key={c._id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_120px_44px] items-center gap-2 px-6 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-royal-500 to-emerald-500 text-sm font-semibold text-white">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      {c.gstNumber ? (
                        <p className="truncate text-xs text-muted-foreground">GST {c.gstNumber}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="truncate">{c.email || '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.phone || '—'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="truncate">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.country || '—'}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => {
                          if (confirm(`Remove ${c.name}?`)) deleteMutation.mutate(c._id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<UserPlus className="h-5 w-5 text-emerald-500" />}
              title="No customers yet"
              description="Add your first customer to start drafting invoices in seconds."
              action={
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add customer
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        onSubmit={(v) => saveMutation.mutate(v)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Customer | null;
  onSubmit: (values: CustomerValues) => void;
  saving: boolean;
}) {
  const defaultValues = useMemo<CustomerValues>(
    () => ({
      name: initial?.name ?? '',
      email: initial?.email ?? '',
      phone: initial?.phone ?? '',
      gstNumber: initial?.gstNumber ?? '',
      address: initial?.address ?? '',
      city: initial?.city ?? '',
      state: initial?.state ?? '',
      country: initial?.country ?? 'India',
      postalCode: initial?.postalCode ?? '',
      notes: initial?.notes ?? '',
    }),
    [initial]
  );

  const form = useForm<CustomerValues>({
    resolver: zodResolver(schema),
    values: defaultValues,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit customer' : 'New customer'}</DialogTitle>
          <DialogDescription>Used to auto-fill invoices, quotes, and receipts.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input placeholder="Apex Holidays LLP" {...form.register('name')} />
            </Field>
            <Field label="GST number" error={form.formState.errors.gstNumber?.message}>
              <Input placeholder="29ABCDE1234F1Z5" {...form.register('gstNumber')} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" placeholder="finance@apex.com" {...form.register('email')} />
            </Field>
            <Field label="Phone" error={form.formState.errors.phone?.message}>
              <Input placeholder="+91 98xxxxxx" {...form.register('phone')} />
            </Field>
            <Field label="Address" className="md:col-span-2">
              <Textarea rows={2} placeholder="Street, area…" {...form.register('address')} />
            </Field>
            <Field label="City"><Input {...form.register('city')} /></Field>
            <Field label="State"><Input {...form.register('state')} /></Field>
            <Field label="Country"><Input {...form.register('country')} /></Field>
            <Field label="Postal code"><Input {...form.register('postalCode')} /></Field>
            <Field label="Notes" className="md:col-span-2">
              <Textarea rows={3} placeholder="Internal notes…" {...form.register('notes')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : initial ? 'Save changes' : 'Add customer'}
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
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
