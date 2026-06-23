import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, MoreHorizontal, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';

const schema = z.object({
  kind: z.enum(['product', 'service']).default('service'),
  name: z.string().min(1, 'Required'),
  description: z.string().optional().default(''),
  category: z.string().optional().default(''),
  unit: z.string().optional().default('pax'),
  price: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100).default(18),
  hsnCode: z.string().optional().default(''),
});
type Values = z.infer<typeof schema>;

const TRAVEL_CATEGORIES = [
  'Tour Package',
  'Flight Booking',
  'Hotel Booking',
  'Visa Service',
  'Travel Insurance',
  'Cab / Transfer',
  'Forex',
  'Passport Assistance',
  'Custom Service',
];

export default function ProductsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ['products', query],
    queryFn: async () => {
      const res = await api.get<{ products: Product[] }>('/products', { params: { q: query } });
      return res.data.products;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Values) => {
      if (editing) {
        const res = await api.patch(`/products/${editing._id}`, values);
        return res.data.product;
      }
      const res = await api.post('/products', values);
      return res.data.product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(editing ? 'Product updated' : 'Product added');
      setOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product archived');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Products & services</h1>
          <p className="text-sm text-muted-foreground">A catalog of what you sell — packages, visas, transfers, and add-ons.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products & services…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
              <div className="grid grid-cols-[1.5fr_1fr_120px_120px_44px] items-center px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Item</span>
                <span>Category</span>
                <span className="text-right">Price</span>
                <span className="text-right">Tax %</span>
                <span />
              </div>
              {list.data.map((p) => (
                <div
                  key={p._id}
                  className="grid grid-cols-[1.5fr_1fr_120px_120px_44px] items-center gap-2 px-6 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant={p.kind === 'service' ? 'primary' : 'muted'}>
                        {p.kind}
                      </Badge>
                    </div>
                    {p.description ? (
                      <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{p.category || '—'}</p>
                  <p className="text-right font-medium">{formatCurrency(p.price)}</p>
                  <p className="text-right text-sm text-muted-foreground">{p.taxPercent ?? 0}%</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => {
                          if (confirm(`Archive ${p.name}?`)) removeMutation.mutate(p._id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Package className="h-5 w-5 text-emerald-500" />}
              title="No items yet"
              description="Add a tour package, visa service, or any line item you bill regularly."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        onSubmit={(v) => saveMutation.mutate(v)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Product | null;
  onSubmit: (values: Values) => void;
  saving: boolean;
}) {
  const defaultValues = useMemo<Values>(
    () => ({
      kind: initial?.kind ?? 'service',
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      category: initial?.category ?? '',
      unit: initial?.unit ?? 'pax',
      price: initial?.price ?? 0,
      taxPercent: initial?.taxPercent ?? 18,
      hsnCode: initial?.hsnCode ?? '',
    }),
    [initial]
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), values: defaultValues });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit item' : 'New product or service'}</DialogTitle>
          <DialogDescription>Items appear as suggestions when building invoices.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.watch('kind')}
                onValueChange={(v) => form.setValue('kind', v as 'product' | 'service')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.watch('category') || ''}
                onValueChange={(v) => form.setValue('category', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {TRAVEL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Name</Label>
              <Input placeholder="Bali 7N/8D — Beach Package" {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} placeholder="What's included…" {...form.register('description')} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input placeholder="pax / night / qty" {...form.register('unit')} />
            </div>
            <div className="space-y-1.5">
              <Label>HSN code</Label>
              <Input {...form.register('hsnCode')} />
            </div>
            <div className="space-y-1.5">
              <Label>Price (INR)</Label>
              <Input type="number" step="0.01" {...form.register('price')} />
            </div>
            <div className="space-y-1.5">
              <Label>Tax %</Label>
              <Input type="number" step="0.01" {...form.register('taxPercent')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : initial ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
