import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  pointerWithin,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileUp,
  Inbox,
  Loader2,
  Mail,
  PlaneTakeoff,
  Plus,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { api, apiError } from '@/lib/api';
import type {
  Company,
  Flight,
  FlightBoard,
  FlightStatus,
  FlightSyncResult,
  FlightSyncSummary,
} from '@/lib/types';
import { FLIGHT_STATUSES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

interface ColumnMeta {
  status: FlightStatus;
  label: string;
  description: string;
  accent: string;
  badge: string;
}

const COLUMNS: ColumnMeta[] = [
  {
    status: 'booked',
    label: 'Booked',
    description: 'New reservations',
    accent: 'from-sky-500/30 to-sky-500/0',
    badge: 'bg-sky-500/15 text-sky-500',
  },
  {
    status: 'confirmed',
    label: 'Confirmed',
    description: 'Ticket issued',
    accent: 'from-emerald-500/30 to-emerald-500/0',
    badge: 'bg-emerald-500/15 text-emerald-500',
  },
  {
    status: 'checked_in',
    label: 'Checked in',
    description: 'Boarding pass ready',
    accent: 'from-violet-500/30 to-violet-500/0',
    badge: 'bg-violet-500/15 text-violet-500',
  },
  {
    status: 'boarding',
    label: 'Boarding',
    description: 'At gate',
    accent: 'from-amber-500/30 to-amber-500/0',
    badge: 'bg-amber-500/15 text-amber-500',
  },
  {
    status: 'delayed',
    label: 'Delayed',
    description: 'Schedule shifted',
    accent: 'from-orange-500/30 to-orange-500/0',
    badge: 'bg-orange-500/15 text-orange-500',
  },
  {
    status: 'departed',
    label: 'Departed',
    description: 'In the air',
    accent: 'from-indigo-500/30 to-indigo-500/0',
    badge: 'bg-indigo-500/15 text-indigo-500',
  },
  {
    status: 'arrived',
    label: 'Arrived',
    description: 'Landed',
    accent: 'from-teal-500/30 to-teal-500/0',
    badge: 'bg-teal-500/15 text-teal-500',
  },
  {
    status: 'cancelled',
    label: 'Cancelled',
    description: 'Flight cancelled',
    accent: 'from-rose-500/30 to-rose-500/0',
    badge: 'bg-rose-500/15 text-rose-500',
  },
  {
    status: 'missed',
    label: 'Missed',
    description: 'Passenger missed',
    accent: 'from-zinc-500/30 to-zinc-500/0',
    badge: 'bg-zinc-500/15 text-zinc-500',
  },
];

const STATUS_META: Record<FlightStatus, ColumnMeta> = COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.status]: c }),
  {} as Record<FlightStatus, ColumnMeta>
);

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimeOnly(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function emptyBoard(): Record<FlightStatus, Flight[]> {
  return FLIGHT_STATUSES.reduce((acc, s) => {
    acc[s] = [];
    return acc;
  }, {} as Record<FlightStatus, Flight[]>);
}

export default function FlightsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Flight | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const board = useQuery({
    queryKey: ['flights'],
    queryFn: async () => {
      const res = await api.get<FlightBoard>('/flights');
      return res.data;
    },
  });

  const company = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get<{ company: Company }>('/company');
      return res.data.company;
    },
  });

  const [localBoard, setLocalBoard] = useState<Record<FlightStatus, Flight[]>>(emptyBoard);

  useEffect(() => {
    if (board.data?.board) {
      const next = emptyBoard();
      for (const s of FLIGHT_STATUSES) {
        next[s] = (board.data.board[s] ?? []).slice();
      }
      setLocalBoard(next);
    }
  }, [board.data]);

  const filteredBoard = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return localBoard;
    const filtered = emptyBoard();
    for (const s of FLIGHT_STATUSES) {
      filtered[s] = localBoard[s].filter((f) => {
        const hay = [
          f.pnr,
          f.flightNumber,
          f.airline,
          f.fromCity,
          f.fromAirport,
          f.toCity,
          f.toAirport,
          f.passengers?.map((p) => p.name).join(' '),
          f.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return filtered;
  }, [localBoard, query]);

  const reorderMutation = useMutation({
    mutationFn: async (
      orders: Array<{ id: string; status: FlightStatus; position: number }>
    ) => {
      await api.post('/flights/reorder', { orders });
    },
    onError: (err) => {
      toast.error(apiError(err));
      board.refetch();
    },
  });

  const deleteFlight = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/flights/${id}`);
    },
    onSuccess: () => {
      toast.success('Flight removed');
      qc.invalidateQueries({ queryKey: ['flights'] });
      setSelected(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<FlightSyncSummary | null>(null);

  async function runFullSync(options: { fullResync?: boolean; lookbackDays?: number } = {}) {
    if (syncing) return;
    setSyncing(true);
    const totals: FlightSyncSummary = {
      scanned: 0,
      parsed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    };
    setSyncProgress(totals);
    const label = options.fullResync ? 'Deep rescan' : 'Scanning inbox';
    const toastId = toast.loading(`${label}…`);
    let cursor: string | null = null;
    let pages = 0;
    const MAX_PAGES = 30; // hard ceiling so a runaway inbox can't loop forever

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        pages += 1;
        const payload: {
          since?: string;
          fullResync?: boolean;
          lookbackDays?: number;
        } = {};
        if (cursor) {
          payload.since = cursor;
        } else if (options.fullResync) {
          payload.fullResync = true;
          payload.lookbackDays = options.lookbackDays ?? 90;
        }
        const res = await api.post<FlightSyncResult>('/flights/email/sync', payload);
        const result = res.data;
        totals.scanned += result.summary.scanned;
        totals.parsed += result.summary.parsed;
        totals.created += result.summary.created;
        totals.updated += result.summary.updated;
        totals.skipped += result.summary.skipped;
        setSyncProgress({ ...totals });
        qc.invalidateQueries({ queryKey: ['flights'] });
        qc.invalidateQueries({ queryKey: ['company'] });

        toast.loading(
          `${label} · ${totals.scanned} mails · ${totals.created} new · ${totals.updated} updated`,
          { id: toastId }
        );

        if (!result.hasMore || !result.nextSince || pages >= MAX_PAGES) break;
        cursor = result.nextSince;
      }

      toast.success(
        `${label} complete · scanned ${totals.scanned}, ${totals.created} new, ${totals.updated} updated, ${totals.skipped} skipped`,
        { id: toastId, duration: 8_000 }
      );
    } catch (err) {
      toast.error(apiError(err), { id: toastId });
    } finally {
      setSyncing(false);
      // keep the progress card up for a beat so users see what happened
      setTimeout(() => setSyncProgress(null), 4_000);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allCards = useMemo(() => {
    return FLIGHT_STATUSES.flatMap((s) => localBoard[s] ?? []);
  }, [localBoard]);
  const activeCard = allCards.find((c) => c._id === activeId) ?? null;

  function findContainer(cardId: string): FlightStatus | null {
    for (const s of FLIGHT_STATUSES) {
      if (localBoard[s]?.some((c) => c._id === cardId)) return s;
    }
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const fromStatus = findContainer(activeIdStr);
    if (!fromStatus) return;

    let toStatus: FlightStatus | null = null;
    if (overIdStr.startsWith('col:')) {
      toStatus = overIdStr.slice(4) as FlightStatus;
    } else {
      toStatus = findContainer(overIdStr);
    }
    if (!toStatus) return;

    setLocalBoard((prev) => {
      const next = { ...prev };
      const sourceList = [...next[fromStatus]];
      const draggedIdx = sourceList.findIndex((c) => c._id === activeIdStr);
      if (draggedIdx === -1) return prev;
      const [dragged] = sourceList.splice(draggedIdx, 1);

      if (fromStatus === toStatus) {
        const targetIdx = overIdStr.startsWith('col:')
          ? sourceList.length
          : sourceList.findIndex((c) => c._id === overIdStr);
        const newList = arrayMove([...next[fromStatus]], draggedIdx, targetIdx === -1 ? 0 : targetIdx);
        next[fromStatus] = newList.map((c, i) => ({ ...c, position: i }));
      } else {
        const destList = [...next[toStatus]];
        const overIdx = overIdStr.startsWith('col:')
          ? destList.length
          : destList.findIndex((c) => c._id === overIdStr);
        const insertAt = overIdx === -1 ? destList.length : overIdx;
        destList.splice(insertAt, 0, { ...dragged, status: toStatus });
        next[fromStatus] = sourceList.map((c, i) => ({ ...c, position: i }));
        next[toStatus] = destList.map((c, i) => ({ ...c, position: i, status: toStatus! }));
      }

      const orders: Array<{ id: string; status: FlightStatus; position: number }> = [];
      for (const s of FLIGHT_STATUSES) {
        next[s].forEach((c, i) => {
          orders.push({ id: c._id, status: s, position: i });
        });
      }
      reorderMutation.mutate(orders);
      return next;
    });
  }

  const totalCards = allCards.length;
  const filteredTotal = FLIGHT_STATUSES.reduce(
    (acc, s) => acc + (filteredBoard[s]?.length ?? 0),
    0
  );

  const gmailReady = Boolean(company.data?.gmailAppPasswordSet);
  const lastSync = company.data?.lastFlightSyncAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-500">
            <PlaneTakeoff className="h-3.5 w-3.5" /> Flight Operations
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Flight status</h1>
          <p className="text-sm text-muted-foreground">
            Every PNR in one view. Cards update automatically from your inbox; drop in a ticket PDF to add one in seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PNR, name, route…"
              className="h-9 w-52 pl-9"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Button variant="outline" onClick={() => setPdfOpen(true)} className="h-9">
            <FileUp className="h-4 w-4" /> Upload PDF
          </Button>
          <Button variant="outline" onClick={() => setEmailOpen(true)} className="h-9">
            <Mail className="h-4 w-4" /> Paste email
          </Button>
          <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-input bg-background shadow-sm">
            <button
              type="button"
              onClick={() => runFullSync()}
              disabled={!gmailReady || syncing}
              title={
                gmailReady
                  ? 'Scan new mail since the last sync'
                  : 'Configure Gmail in Settings → Flight automation'
              }
              className="inline-flex items-center gap-1.5 px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync inbox
            </button>
            <div className="w-px bg-border" />
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    'Deep rescan the last 90 days from scratch? This ignores the last-sync marker and re-reads every mail (uses more AI tokens).'
                  )
                ) {
                  runFullSync({ fullResync: true, lookbackDays: 90 });
                }
              }}
              disabled={!gmailReady || syncing}
              title="Deep rescan last 90 days from scratch"
              className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              90d
            </button>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)} className="h-9">
            <Plus className="h-4 w-4" /> Manual
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <Inbox className="h-3.5 w-3.5" />
            {totalCards} flights tracked · {filteredTotal} shown
          </span>
          {syncing || syncProgress ? (
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1',
                syncing
                  ? 'bg-secondary/10 text-secondary'
                  : 'bg-emerald-500/10 text-emerald-500'
              )}
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Scanned {syncProgress?.scanned ?? 0} · {syncProgress?.created ?? 0} new ·{' '}
              {syncProgress?.updated ?? 0} updated
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-3">
          {gmailReady ? (
            <span className="flex items-center gap-1.5 text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> Inbox connected
            </span>
          ) : (
            <Link
              to="/app/settings"
              className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
            >
              <SettingsIcon className="h-3.5 w-3.5" /> Connect Gmail
            </Link>
          )}
          {lastSync ? (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Last sync {formatDateTime(lastSync)}
            </span>
          ) : null}
        </span>
      </div>

      {board.isLoading ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="-mx-2 overflow-x-auto pb-2">
            <div className="flex gap-3 px-2">
              {COLUMNS.map((col) => (
                <Column
                  key={col.status}
                  meta={col}
                  flights={filteredBoard[col.status] ?? []}
                  onCardClick={(f) => setSelected(f)}
                />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <div className="w-72 rotate-1 opacity-95">
                <FlightCard flight={activeCard} dragging onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <PdfUploadDialog open={pdfOpen} onOpenChange={setPdfOpen} />
      <EmailPasteDialog open={emailOpen} onOpenChange={setEmailOpen} />
      <ManualFlightDialog open={createOpen} onOpenChange={setCreateOpen} />
      <FlightDetailDialog
        flight={selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        onDelete={() => {
          if (selected && confirm('Delete this flight card?')) deleteFlight.mutate(selected._id);
        }}
        deleting={deleteFlight.isPending}
      />
    </div>
  );
}

function Column({
  meta,
  flights,
  onCardClick,
}: {
  meta: ColumnMeta;
  flights: Flight[];
  onCardClick: (f: Flight) => void;
}) {
  const { setNodeRef, isOver } = useSortable({ id: `col:${meta.status}`, data: { type: 'col' } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-card/40 backdrop-blur transition-colors',
        isOver && 'border-secondary/60 bg-secondary/5'
      )}
    >
      <div className={cn('rounded-t-2xl bg-gradient-to-b p-3', meta.accent)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{meta.label}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {meta.description}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              meta.badge
            )}
          >
            {flights.length}
          </span>
        </div>
      </div>
      <SortableContext items={flights.map((f) => f._id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-32 flex-col gap-2 p-2">
          {flights.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-[11px] text-muted-foreground">
              Drop a card here
            </div>
          ) : (
            flights.map((f) => (
              <SortableFlightCard key={f._id} flight={f} onClick={() => onCardClick(f)} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableFlightCard({ flight, onClick }: { flight: Flight; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: flight._id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FlightCard flight={flight} onClick={onClick} />
    </div>
  );
}

function sourceBadge(source: Flight['source']) {
  if (source === 'email') return { label: 'Email', icon: Mail, cls: 'bg-violet-500/15 text-violet-500' };
  if (source === 'pdf') return { label: 'PDF', icon: FileUp, cls: 'bg-sky-500/15 text-sky-500' };
  return { label: 'Manual', icon: Sparkles, cls: 'bg-emerald-500/15 text-emerald-500' };
}

function FlightCard({
  flight,
  onClick,
  dragging = false,
}: {
  flight: Flight;
  onClick: () => void;
  dragging?: boolean;
}) {
  const route =
    flight.fromAirport && flight.toAirport
      ? `${flight.fromAirport} → ${flight.toAirport}`
      : `${flight.fromCity || '—'} → ${flight.toCity || '—'}`;
  const sub = sourceBadge(flight.source);
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-foreground/30 hover:shadow-md',
        dragging && 'shadow-lg ring-2 ring-secondary/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold leading-tight">{route}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[flight.fromCity, flight.toCity].filter(Boolean).join(' → ') || '—'}
          </p>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', sub.cls)}>
          <sub.icon className="h-3 w-3" /> {sub.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
        <span className="text-muted-foreground">Flight</span>
        <span className="font-mono font-semibold text-right truncate">
          {flight.flightNumber || (flight.airline ?? '—')}
        </span>
        <span className="text-muted-foreground">PNR</span>
        <span className="font-mono font-semibold text-right truncate">{flight.pnr || '—'}</span>
        <span className="text-muted-foreground">Departure</span>
        <span className="font-medium text-right truncate">{formatDateTime(flight.departureAt)}</span>
      </div>
      {flight.passengers?.length ? (
        <p className="truncate text-[11px] text-muted-foreground">
          {flight.passengers.map((p) => p.name).filter(Boolean).join(', ')}
        </p>
      ) : null}
      {flight.statusNote ? (
        <p className="line-clamp-2 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mr-1 inline-block h-3 w-3" />
          {flight.statusNote}
        </p>
      ) : null}
    </button>
  );
}

function FlightDetailDialog({
  flight,
  onOpenChange,
  onDelete,
  deleting,
}: {
  flight: Flight | null;
  onOpenChange: (o: boolean) => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    setNote(flight?.notes ?? '');
    setStatusNote(flight?.statusNote ?? '');
  }, [flight?._id]);

  const update = useMutation({
    mutationFn: async (payload: Partial<Flight>) => {
      if (!flight) return null;
      const res = await api.patch<{ flight: Flight }>(`/flights/${flight._id}`, payload);
      return res.data.flight;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flights'] });
      toast.success('Updated');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (!flight) return null;
  const meta = STATUS_META[flight.status];
  const sub = sourceBadge(flight.source);
  const route =
    flight.fromAirport && flight.toAirport
      ? `${flight.fromAirport} → ${flight.toAirport}`
      : `${flight.fromCity || '—'} → ${flight.toCity || '—'}`;

  return (
    <Dialog open={!!flight} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlaneTakeoff className="h-5 w-5 text-emerald-500" /> {route}
          </DialogTitle>
          <DialogDescription>
            {flight.airline || flight.flightNumber || 'Flight'}{' '}
            {flight.flightNumber ? `· ${flight.flightNumber}` : ''} ·{' '}
            {formatDateTime(flight.departureAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {FLIGHT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update.mutate({ status: s })}
                  className={cn(
                    'rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-all',
                    s === flight.status
                      ? STATUS_META[s].badge + ' ring-2 ring-offset-1 ring-offset-card'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</p>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                sub.cls
              )}
            >
              <sub.icon className="h-3.5 w-3.5" /> {sub.label}
            </span>
            {flight.emailSubject ? (
              <p className="truncate text-xs text-muted-foreground" title={flight.emailSubject}>
                {flight.emailSubject}
              </p>
            ) : null}
            {flight.emailFrom ? (
              <p className="truncate text-xs text-muted-foreground">From: {flight.emailFrom}</p>
            ) : null}
            {flight.pdfName ? (
              <p className="truncate text-xs text-muted-foreground">File: {flight.pdfName}</p>
            ) : null}
            {flight.lastEmailAt ? (
              <p className="text-xs text-muted-foreground">
                Last email: {formatDateTime(flight.lastEmailAt)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DetailField label="PNR" value={flight.pnr} mono />
          <DetailField label="Flight" value={flight.flightNumber || flight.airline} mono />
          <DetailField label="Cabin" value={flight.cabinClass} />
          <DetailField
            label="Departure"
            value={`${formatDateOnly(flight.departureAt)} ${formatTimeOnly(flight.departureAt)}`}
          />
          <DetailField
            label="Arrival"
            value={`${formatDateOnly(flight.arrivalAt)} ${formatTimeOnly(flight.arrivalAt)}`}
          />
          <DetailField
            label="From"
            value={[flight.fromAirport, flight.fromCity, flight.fromTerminal && `T${flight.fromTerminal}`]
              .filter(Boolean)
              .join(' · ')}
          />
          <DetailField
            label="To"
            value={[flight.toAirport, flight.toCity, flight.toTerminal && `T${flight.toTerminal}`]
              .filter(Boolean)
              .join(' · ')}
          />
          <DetailField label="Airline" value={flight.airline} />
          <DetailField label="Booking ref" value={flight.bookingReference} mono />
        </div>

        {flight.passengers?.length ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Passengers ({flight.passengers.length})
            </p>
            <div className="grid gap-1.5 md:grid-cols-2">
              {flight.passengers.map((p, i) => (
                <div key={i} className="rounded-md bg-card px-2 py-1.5 text-xs">
                  <span className="font-medium">{p.name || '—'}</span>
                  <span className="ml-2 text-muted-foreground">
                    {[p.seat && `Seat ${p.seat}`, p.cabin].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Status note</Label>
            <Input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              onBlur={() => {
                if ((flight.statusNote ?? '') !== statusNote) update.mutate({ statusNote });
              }}
              placeholder="e.g. Delayed 45 min, gate B12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Internal note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if ((flight.notes ?? '') !== note) update.mutate({ notes: note });
              }}
              placeholder="Notes only your team sees"
              rows={2}
            />
          </div>
        </div>

        {flight.history?.length ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Activity
            </p>
            <ul className="space-y-1.5">
              {flight.history.slice(-8).reverse().map((h, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span>{h.message}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDateTime(h.at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter className="justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button type="button" variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
        {meta ? null : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  const text = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('truncate text-sm font-medium', mono && 'font-mono')}>{text}</p>
    </div>
  );
}

function PdfUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Pick a PDF first');
      const base64 = await fileToBase64(file);
      const res = await api.post<{ flight: Flight; created: boolean }>('/flights/parse-pdf', {
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        base64,
      });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['flights'] });
      toast.success(`Ticket parsed · ${data.flight.flightNumber || data.flight.pnr || 'card created'}`);
      onOpenChange(false);
      setFile(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setFile(null);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-sky-500" /> Upload ticket PDF
          </DialogTitle>
          <DialogDescription>
            Drop in a ticket PDF and AI will extract the route, PNR, passenger and times into a new card.
          </DialogDescription>
        </DialogHeader>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f && f.type === 'application/pdf') setFile(f);
          }}
          className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-secondary/50"
        >
          <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">
            {file ? file.name : 'Click or drop a PDF here'}
          </p>
          <p className="text-xs text-muted-foreground">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB · ready to parse`
              : 'Up to ~10 MB · works for any airline'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Reading PDF…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Parse & add card
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailPasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [from, setFrom] = useState('');
  const [text, setText] = useState('');

  const parse = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ flight: Flight; created: boolean }>('/flights/parse-text', {
        subject,
        from,
        text,
        date: new Date().toISOString(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['flights'] });
      toast.success(
        data.created
          ? `Added ${data.flight.flightNumber || data.flight.pnr || 'flight'} to the board`
          : `Updated ${data.flight.flightNumber || data.flight.pnr || 'flight'}`
      );
      onOpenChange(false);
      setSubject('');
      setFrom('');
      setText('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-violet-500" /> Paste an airline email
          </DialogTitle>
          <DialogDescription>
            Paste the body of a booking confirmation, status change, or check-in email. AI will figure out the rest and update the card by PNR.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your IndiGo booking is confirmed"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="noreply@goindigo.in"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email body</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="Paste the full email text…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={parse.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={text.trim().length < 10 || parse.isPending}
            onClick={() => parse.mutate()}
          >
            {parse.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Reading…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Parse email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualFlightDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    pnr: '',
    flightNumber: '',
    airline: '',
    fromCity: '',
    fromAirport: '',
    toCity: '',
    toAirport: '',
    departureAt: '',
    passenger: '',
    status: 'booked' as FlightStatus,
  });

  function reset() {
    setForm({
      pnr: '',
      flightNumber: '',
      airline: '',
      fromCity: '',
      fromAirport: '',
      toCity: '',
      toAirport: '',
      departureAt: '',
      passenger: '',
      status: 'booked',
    });
  }

  const create = useMutation({
    mutationFn: async () => {
      const payload: Partial<Flight> & { passengers?: Array<{ name: string }> } = {
        pnr: form.pnr,
        flightNumber: form.flightNumber,
        airline: form.airline,
        fromCity: form.fromCity,
        fromAirport: form.fromAirport,
        toCity: form.toCity,
        toAirport: form.toAirport,
        departureAt: form.departureAt
          ? new Date(form.departureAt).toISOString()
          : null,
        status: form.status,
      };
      if (form.passenger.trim()) {
        payload.passengers = form.passenger
          .split(',')
          .map((p) => ({ name: p.trim() }))
          .filter((p) => p.name);
      }
      const res = await api.post<{ flight: Flight }>('/flights', payload);
      return res.data.flight;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flights'] });
      toast.success('Flight added');
      onOpenChange(false);
      reset();
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add flight manually</DialogTitle>
          <DialogDescription>
            For one-off entries. For routine ops use Sync inbox or PDF upload.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">PNR</Label>
            <Input
              value={form.pnr}
              onChange={(e) => setForm({ ...form, pnr: e.target.value.toUpperCase() })}
              placeholder="ABCDEF"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Flight no.</Label>
            <Input
              value={form.flightNumber}
              onChange={(e) => setForm({ ...form, flightNumber: e.target.value.toUpperCase() })}
              placeholder="6E-2134"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Airline</Label>
            <Input
              value={form.airline}
              onChange={(e) => setForm({ ...form, airline: e.target.value })}
              placeholder="IndiGo"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From (airport code)</Label>
            <Input
              value={form.fromAirport}
              onChange={(e) => setForm({ ...form, fromAirport: e.target.value.toUpperCase() })}
              placeholder="DEL"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From city</Label>
            <Input
              value={form.fromCity}
              onChange={(e) => setForm({ ...form, fromCity: e.target.value })}
              placeholder="Delhi"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To (airport code)</Label>
            <Input
              value={form.toAirport}
              onChange={(e) => setForm({ ...form, toAirport: e.target.value.toUpperCase() })}
              placeholder="BOM"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To city</Label>
            <Input
              value={form.toCity}
              onChange={(e) => setForm({ ...form, toCity: e.target.value })}
              placeholder="Mumbai"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Departure</Label>
            <Input
              type="datetime-local"
              value={form.departureAt}
              onChange={(e) => setForm({ ...form, departureAt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as FlightStatus })}
            >
              {FLIGHT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Passenger(s)</Label>
            <Input
              value={form.passenger}
              onChange={(e) => setForm({ ...form, passenger: e.target.value })}
              placeholder="Naitik Jain, Priya Sharma"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="animate-spin" /> : 'Add flight'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

// keep these used for future expansion (e.g. detail card empty state)
void Card;
void CardContent;
void EmptyState;
