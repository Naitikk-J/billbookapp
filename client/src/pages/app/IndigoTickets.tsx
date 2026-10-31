import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Loader2, Ticket } from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function errorText(err: unknown): Promise<string> {
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) return json.error.message;
    } catch {
      return 'IndiGo download failed.';
    }
  }
  return apiError(err, 'IndiGo download failed.');
}

export default function IndigoTicketsPage() {
  const [pnr, setPnr] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const code = pnr.trim().toUpperCase();
    const name = lastName.trim();
    if (!/^[A-Z0-9]{5,8}$/.test(code)) {
      toast.error('PNR should be 5–8 letters or numbers.');
      return;
    }
    if (name.length < 2) {
      toast.error('Enter the last name or email from the booking.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/indigo/itinerary', { pnr: code, lastName: name }, {
        responseType: 'blob',
        timeout: 180_000,
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `IndiGo-${code}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Saved IndiGo-${code}.pdf`);
    } catch (err) {
      toast.error(await errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IndiGo Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the PNR and the last name or email on the booking. Safarmate fetches the
          itinerary and downloads the PDF. This can take a minute.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" /> Retrieve itinerary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="indigo-pnr">PNR</Label>
              <Input
                id="indigo-pnr"
                value={pnr}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="FHQKPE"
                onChange={(e) => setPnr(e.target.value.toUpperCase())}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="indigo-name">Email or last name</Label>
              <Input
                id="indigo-name"
                value={lastName}
                autoComplete="off"
                placeholder="Last name or email"
                onChange={(e) => setLastName(e.target.value)}
                disabled={busy}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Fetching from IndiGo…' : 'Download ticket'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
