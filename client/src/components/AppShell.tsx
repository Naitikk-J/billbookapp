import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Menu,
  X,
  Search,
  BookOpen,
  Sparkles,
  PlaneTakeoff,
  FileSpreadsheet,
  Ticket,
} from 'lucide-react';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';
import { cn } from '@/lib/cn';
import { useAppDispatch, useAppSelector } from '@/store';
import { signOut } from '@/store/authSlice';
import { initials } from '@/lib/format';
import { AiInvoiceDialog } from './AiInvoiceDialog';
import { api } from '@/lib/api';
import type { Company } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown';

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/flights', label: 'Flight status', icon: PlaneTakeoff, end: false },
  { to: '/app/flight-invoices', label: 'Flight invoices', icon: FileSpreadsheet, end: false },
  { to: '/app/indigo-tickets', label: 'IndiGo Tickets', icon: Ticket, end: false },
  { to: '/app/invoices', label: 'Invoices', icon: FileText, end: false },
  { to: '/app/ledger', label: 'Ledger', icon: BookOpen, end: false },
  { to: '/app/customers', label: 'Customers', icon: Users, end: false },
  { to: '/app/products', label: 'Products', icon: Package, end: false },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export function AppShell() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    void qc.prefetchQuery({
      queryKey: ['company'],
      queryFn: async () => {
        const res = await api.get<{ company: Company }>('/company');
        return res.data.company;
      },
      staleTime: 120_000,
    });
  }, [qc]);

  function handleSignOut() {
    dispatch(signOut());
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link to="/app" className="flex items-center">
            <Brand size={20} />
          </Link>
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pt-4">
          <Button asChild variant="primary" className="w-full">
            <Link to="/app/invoices/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </Button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-foreground/5 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-muted">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-royal-500 to-emerald-500 text-sm font-semibold text-white">
                  {initials(user?.name ?? 'IF')}
                </span>
                <span className="flex-1 overflow-hidden">
                  <span className="block truncate font-medium">{user?.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/app/settings">
                  <SettingsIcon className="h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-8">
          <button
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search flights, invoices, customers…"
              className="h-10 w-full rounded-lg border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:bg-background"
            />
          </div>
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAiOpen(true)}
            className="hidden md:inline-flex border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-royal-500/10 text-foreground hover:from-emerald-500/20 hover:to-royal-500/20"
          >
            <Sparkles className="h-4 w-4 text-emerald-500" /> AI
          </Button>
          <Button asChild variant="primary" size="sm" className="hidden md:inline-flex">
            <Link to="/app/invoices/new">
              <Plus className="h-4 w-4" /> Create
            </Link>
          </Button>
        </header>
        <AiInvoiceDialog open={aiOpen} onOpenChange={setAiOpen} />
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-navy-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
