import type { InvoiceStatus } from '@/lib/types';
import { Badge } from './badge';

const labels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

const variants: Record<InvoiceStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'> = {
  draft: 'muted',
  sent: 'primary',
  paid: 'success',
  partial: 'warning',
  overdue: 'danger',
  cancelled: 'muted',
};

export function StatusPill({ status }: { status: InvoiceStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
