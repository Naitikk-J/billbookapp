import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Mic, MicOff, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { api, apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

export interface AiInvoiceDraft {
  customer: {
    name?: string;
    phone?: string;
    email?: string;
    gstNumber?: string;
    city?: string;
  };
  matchedCustomerId: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    taxPercent: number;
  }>;
  notes: string;
  dueDateOffsetDays: number;
  currency: string;
  kind: 'invoice' | 'quote' | 'proforma' | 'receipt';
  discountPercent: number;
}

const EXAMPLES = [
  'Make a bill for Apex Holidays for ₹50,000 with 18% GST — item is flight from Jaipur to Bombay',
  'Quotation for Singh Tours, ₹1,20,000 for 5N6D Bali package, 2 adults, no tax',
  'Invoice ABC Pvt Ltd — 3 nights hotel @ ₹4500 + airport transfer ₹2000, GST 12',
];

export function AiInvoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [keyMissing, setKeyMissing] = useState(false);
  const recognitionRef = useRef<unknown>(null);

  const supportsSpeech =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const parse = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await api.post<{ draft: AiInvoiceDraft }>('/ai/invoice/parse', { prompt });
      return res.data.draft;
    },
    onSuccess: (draft) => {
      setKeyMissing(false);
      onOpenChange(false);
      setText('');
      const route =
        draft.kind === 'invoice' ? '/app/invoices/new' : `/app/invoices/new?kind=${draft.kind}`;
      navigate(route, { state: { aiDraft: draft } });
      toast.success('Draft ready — review and save.');
    },
    onError: (err) => {
      const message = apiError(err);
      if (/api key/i.test(message)) {
        setKeyMissing(true);
        return;
      }
      toast.error(message);
    },
  });

  useEffect(() => {
    if (!open) {
      stopListening();
      setKeyMissing(false);
    }
  }, [open]);

  function startListening() {
    if (!supportsSpeech) {
      toast.error('Voice input not supported in this browser. Try Chrome.');
      return;
    }
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) return;
    const r = new (SR as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: (e: { error: string }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    })();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-IN';
    let baseline = text;
    r.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript + ' ';
      }
      setText(((baseline ? baseline + ' ' : '') + transcript).trim());
    };
    r.onerror = (e) => {
      toast.error(`Mic error: ${e.error}`);
      setListening(false);
    };
    r.onend = () => {
      setListening(false);
    };
    r.start();
    recognitionRef.current = r;
    setListening(true);
    baseline = text;
  }

  function stopListening() {
    const r = recognitionRef.current as { stop?: () => void } | null;
    if (r && typeof r.stop === 'function') r.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error('Describe the bill you want to create.');
      return;
    }
    parse.mutate(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" /> AI Invoice
          </DialogTitle>
          <DialogDescription>
            Describe the bill in plain English (or Hinglish). I'll extract the customer, line items,
            GST and dates — you just review and save.
          </DialogDescription>
        </DialogHeader>

        {keyMissing ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="space-y-2">
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  Gemini API key required
                </p>
                <p className="text-muted-foreground">
                  Paste a free Google AI key in Settings to enable AI Invoice. It takes 30 seconds.
                </p>
                <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
                  <li>
                    Open{' '}
                    <a
                      className="text-emerald-500 hover:underline"
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                    >
                      aistudio.google.com/app/apikey
                    </a>{' '}
                    and click <em>Create API key</em>.
                  </li>
                  <li>Copy the <code className="rounded bg-muted px-1">AIza…</code> string.</li>
                  <li>
                    Paste it in <strong>Settings → AI assistant → Gemini API key</strong> and save.
                  </li>
                </ol>
                <div className="flex gap-2 pt-1">
                  <Button asChild variant="primary" size="sm">
                    <Link to="/app/settings" onClick={() => onOpenChange(false)}>
                      <Sparkles className="h-4 w-4" /> Open Settings
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setKeyMissing(false)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Make a bill for Apex Holidays, ₹50000 with 18% GST, item is flight from Jaipur to Bombay"
              rows={5}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening())}
              className={cn(
                'absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
                listening
                  ? 'border-destructive/40 bg-destructive/10 text-destructive animate-pulse'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
              aria-label={listening ? 'Stop dictation' : 'Start dictation'}
              title={listening ? 'Stop dictation' : 'Dictate'}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Try
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setText(ex)}
                  className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={parse.isPending} onClick={handleSubmit}>
            {parse.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Drafting…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Generate invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
