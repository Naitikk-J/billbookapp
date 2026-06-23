import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  IndianRupee,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '@/lib/api';
import type { DashboardStats, Invoice } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppSelector } from '@/store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user);

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/invoices/stats');
      return res.data;
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ['recent-invoices'],
    queryFn: async () => {
      const res = await api.get<{ invoices: Invoice[] }>('/invoices');
      return res.data.invoices.slice(0, 6);
    },
  });

  const stats = statsQuery.data;

  const chartData =
    stats?.monthly.map((m) => ({
      month: MONTHS[m.month - 1] ?? `${m.month}`,
      revenue: m.revenue,
      received: m.received,
    })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Good to see you back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/app/invoices">
              View all <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link to="/app/invoices/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Today's revenue"
          icon={IndianRupee}
          value={stats ? formatCurrency(stats.today.revenue) : null}
          loading={statsQuery.isLoading}
          tone="emerald"
        />
        <KpiCard
          label="This month"
          icon={TrendingUp}
          value={stats ? formatCurrency(stats.month.revenue) : null}
          hint={stats ? `${stats.month.count} invoices` : ''}
          loading={statsQuery.isLoading}
          tone="royal"
        />
        <KpiCard
          label="Outstanding"
          icon={Receipt}
          value={stats ? formatCurrency(stats.pending.total) : null}
          hint={stats ? `${stats.pending.count} pending` : ''}
          loading={statsQuery.isLoading}
          tone="warning"
        />
        <KpiCard
          label="Paid invoices"
          icon={FileText}
          value={stats ? String(stats.paidCount) : null}
          hint="Across all time"
          loading={statsQuery.isLoading}
          tone="default"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue trend</CardTitle>
              <p className="text-sm text-muted-foreground">Last 6 months</p>
            </div>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : chartData.length === 0 ? (
              <div className="grid h-72 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Create your first invoice to see revenue here.
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="grevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2A5BFF" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#2A5BFF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="greceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(v) =>
                        v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${Math.round(v / 1000)}k`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2A5BFF"
                      strokeWidth={2}
                      fill="url(#grevenue)"
                    />
                    <Area
                      type="monotone"
                      dataKey="received"
                      stroke="#10B981"
                      strokeWidth={2}
                      fill="url(#greceived)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <p className="text-sm text-muted-foreground">Speed up routine work.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <QuickAction to="/app/invoices/new" label="New invoice" tone="royal" icon={Plus} />
            <QuickAction
              to="/app/invoices/new?kind=quote"
              label="New quote"
              tone="emerald"
              icon={FileText}
            />
            <QuickAction to="/app/customers" label="Add customer" tone="muted" icon={Plus} />
            <QuickAction to="/app/products" label="Add product" tone="muted" icon={Plus} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent invoices</CardTitle>
            <p className="text-sm text-muted-foreground">Latest activity across your workspace.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/invoices">
              View all <ArrowUpRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {invoicesQuery.isLoading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
            <div className="divide-y divide-border">
              {invoicesQuery.data.map((inv) => (
                <Link
                  key={inv._id}
                  to={`/app/invoices/${inv._id}`}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inv.customerSnapshot.name || '—'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {inv.number} · {formatDate(inv.issueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-display text-base font-semibold">
                      {formatCurrency(inv.grandTotal, inv.currency)}
                    </p>
                    <StatusPill status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No invoices yet. <Link to="/app/invoices/new" className="text-secondary underline">Create the first one</Link>.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  tone,
}: {
  label: string;
  value: string | null;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  tone: 'emerald' | 'royal' | 'warning' | 'default';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'from-emerald-500/15 to-transparent text-emerald-500'
      : tone === 'royal'
        ? 'from-royal-500/15 to-transparent text-royal-500'
        : tone === 'warning'
          ? 'from-warning/15 to-transparent text-warning'
          : 'from-foreground/10 to-transparent text-foreground';
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <p className="font-display text-3xl font-bold tracking-tight">{value ?? '—'}</p>
          )}
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  to,
  label,
  icon: Icon,
  tone,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'royal' | 'emerald' | 'muted';
}) {
  const cls =
    tone === 'royal'
      ? 'border-royal-500/30 bg-royal-500/5 text-royal-500 hover:bg-royal-500/10'
      : tone === 'emerald'
        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10'
        : 'border-border bg-muted/30 text-foreground hover:bg-muted';
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-xl border p-4 text-sm font-medium transition-colors ${cls}`}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <ArrowRight className="h-4 w-4 opacity-60" />
    </Link>
  );
}
