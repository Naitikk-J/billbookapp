import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Loader2,
  LogOut,
  MessageCircle,
  PlaneTakeoff,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import type { Company, WhatsAppStatusResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type Values = Partial<Company>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const companyQuery = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get<{ company: Company }>('/company');
      return res.data.company;
    },
  });

  const form = useForm<Values>({ defaultValues: {} });

  useEffect(() => {
    if (companyQuery.data) form.reset(companyQuery.data);
  }, [companyQuery.data, form]);

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const res = await api.patch<{ company: Company }>('/company', values);
      return res.data.company;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] });
      toast.success('Settings saved');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const whatsapp = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const res = await api.get<WhatsAppStatusResponse>('/whatsapp/status');
      return res.data;
    },
    refetchInterval: (q) => {
      const data = q.state.data as WhatsAppStatusResponse | undefined;
      if (!data?.configured) return false;
      if (data.status?.ready) return 30_000;
      return 4_000;
    },
  });

  const whatsappLogout = useMutation({
    mutationFn: async () => {
      await api.post('/whatsapp/logout');
    },
    onSuccess: () => {
      toast.success('WhatsApp disconnected');
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Company details show up on every invoice you generate.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={form.handleSubmit((v) => save.mutate(v))}
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 className="animate-spin" /> : <><Save className="h-4 w-4" /> Save</>}
        </Button>
      </div>

      {companyQuery.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Company profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Name"><Input {...form.register('name')} /></Field>
              <Field label="Legal name"><Input {...form.register('legalName')} /></Field>
              <Field label="Industry"><Input {...form.register('industry')} /></Field>
              <Field label="Website"><Input {...form.register('website')} /></Field>
              <Field label="Email"><Input type="email" {...form.register('email')} /></Field>
              <Field label="Phone"><Input {...form.register('phone')} /></Field>
              <Field label="Logo URL"><Input {...form.register('logoUrl')} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax & address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="GSTIN"><Input {...form.register('gstNumber')} /></Field>
              <Field label="PAN"><Input {...form.register('panNumber')} /></Field>
              <Field label="Address"><Textarea rows={2} {...form.register('address')} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City"><Input {...form.register('city')} /></Field>
                <Field label="State"><Input {...form.register('state')} /></Field>
                <Field label="Country"><Input {...form.register('country')} /></Field>
                <Field label="Postal code"><Input {...form.register('postalCode')} /></Field>
              </div>
              <Field label="Currency"><Input {...form.register('currency')} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bank & UPI</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Bank name"><Input {...form.register('bankName')} /></Field>
              <Field label="Account number"><Input {...form.register('accountNumber')} /></Field>
              <Field label="IFSC"><Input {...form.register('ifsc')} /></Field>
              <Field label="UPI ID"><Input placeholder="yourname@upi" {...form.register('upiId')} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Defaults</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Invoice prefix"><Input {...form.register('invoicePrefix')} /></Field>
              <Field label="Quote prefix"><Input {...form.register('quotePrefix')} /></Field>
              <Field label="Default terms">
                <Textarea rows={5} {...form.register('defaultTerms')} />
              </Field>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" /> AI assistant
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Paste a Google Gemini API key to enable natural-language invoice creation.
                Get one free at{' '}
                <a
                  className="text-emerald-500 hover:underline"
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  aistudio.google.com/app/apikey
                </a>
                . Leave empty to use the server-wide key (if configured).
              </p>
            </CardHeader>
            <CardContent>
              <Field label="Gemini API key">
                <Input
                  type="password"
                  placeholder="AIza…"
                  autoComplete="off"
                  {...form.register('geminiApiKey')}
                />
              </Field>
              {companyQuery.data?.geminiApiKeySet ? (
                <p className="mt-2 text-xs text-emerald-500">
                  Key on file. Leave the field blank to keep it unchanged.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlaneTakeoff className="h-4 w-4 text-emerald-500" /> Flight automation
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Connect Gmail so Safarmate can watch your inbox and keep the flight Kanban board in sync.
                Use a Google{' '}
                <a
                  className="text-emerald-500 hover:underline"
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                >
                  App Password
                </a>{' '}
                (2FA must be on). Credentials are stored on your company record and never returned to the browser.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Gmail address">
                <Input
                  type="email"
                  placeholder="ops@yourtravelco.com"
                  autoComplete="off"
                  {...form.register('gmailAddress')}
                />
              </Field>
              <Field label="Gmail App Password">
                <Input
                  type="password"
                  placeholder="16-char app password"
                  autoComplete="off"
                  {...form.register('gmailAppPassword')}
                />
                {companyQuery.data?.gmailAppPasswordSet ? (
                  <p className="text-xs text-emerald-500">
                    Password on file. Leave blank to keep it; type a new one to replace.
                  </p>
                ) : null}
              </Field>
            </CardContent>
          </Card>

          <WhatsAppCard
            status={whatsapp.data ?? null}
            loading={whatsapp.isLoading}
            onRefresh={() => whatsapp.refetch()}
            onLogout={() => {
              if (confirm('Disconnect WhatsApp? You will need to scan the QR again to send reminders.')) {
                whatsappLogout.mutate();
              }
            }}
            disconnecting={whatsappLogout.isPending}
          />
        </div>
      )}
    </div>
  );
}

function WhatsAppCard({
  status,
  loading,
  onRefresh,
  onLogout,
  disconnecting,
}: {
  status: WhatsAppStatusResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  disconnecting: boolean;
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp reminders
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Powered by your self-hosted <code className="rounded bg-muted px-1 py-0.5">whatsapp-bridge</code>{' '}
          service. Scan the QR once with WhatsApp → Settings → Linked devices. The session is stored only on
          the bridge machine; the browser never sees any secret.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !status?.configured ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">Bridge not configured on the server.</p>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
              {status?.reason ??
                'Set WHATSAPP_BRIDGE_URL and WHATSAPP_BRIDGE_TOKEN on the server, then restart.'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Run instructions live in <code className="rounded bg-muted px-1">whatsapp-bridge/README.md</code>.
            </p>
          </div>
        ) : status.unreachable || !status.status ? (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            <div>
              <p className="font-medium">Bridge unreachable.</p>
              <p className="mt-1 text-xs">{status.reason ?? 'The bridge service is offline.'}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        ) : status.status.state === 'ready' ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Connected
              </div>
              <p className="mt-2 text-sm">
                Sending as{' '}
                <span className="font-semibold">
                  +{status.status.account?.number ?? '—'}
                </span>
                {status.status.account?.name ? ` (${status.status.account.name})` : ''}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onLogout}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="animate-spin" /> : <><LogOut className="h-4 w-4" /> Disconnect</>}
            </Button>
          </div>
        ) : status.status.state === 'qr' && status.status.qrDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={status.status.qrDataUrl}
              alt="WhatsApp linking QR"
              className="h-64 w-64 rounded-xl border border-border bg-white p-3"
            />
            <p className="text-center text-sm text-muted-foreground">
              Open WhatsApp on your phone → <span className="font-medium">Settings → Linked devices → Link a device</span>{' '}
              and scan this QR. It refreshes every ~20 s.
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
            <p className="font-medium capitalize">{status.status.state.replace('_', ' ')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {status.status.message || 'Waiting for the bridge to come online…'}
            </p>
            <div className="mt-3">
              <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
