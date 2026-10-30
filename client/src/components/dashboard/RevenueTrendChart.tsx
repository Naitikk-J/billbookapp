import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency } from '@/lib/format';

export function RevenueTrendChart({
  data,
}: {
  data: Array<{ month: string; revenue: number; received: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Create your first invoice to see revenue here.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
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
          <Area type="monotone" dataKey="revenue" stroke="#2A5BFF" strokeWidth={2} fill="url(#grevenue)" />
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
  );
}
