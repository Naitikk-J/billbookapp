import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Plane,
  ShieldCheck,
  Sparkles,
  Hotel,
  FileText,
  Globe2,
  Wallet,
  Layers,
  Gauge,
  CreditCard,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brand } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/cn';

const features = [
  {
    icon: Plane,
    title: 'Travel-first workflows',
    description:
      'Built-in fields for destinations, passenger counts, hotels, flights, vehicles, and package breakdowns.',
  },
  {
    icon: FileText,
    title: 'Premium PDF templates',
    description: 'Print-ready, brand-matched invoices with logos, signatures, stamps, and QR codes.',
  },
  {
    icon: Gauge,
    title: 'Sub-30 second invoicing',
    description:
      'Pre-saved customers, products and services let you draft an invoice faster than a chat reply.',
  },
  {
    icon: Wallet,
    title: 'Payments & GST built-in',
    description:
      'Auto CGST/SGST/IGST, partial payments, UPI QR codes, multi-currency, and outstanding tracking.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    description: 'JWT auth, rate limiting, mongo sanitization, role-based access, and audit logs.',
  },
  {
    icon: Sparkles,
    title: 'Designed like a product, not a form',
    description:
      'Calm typography, premium spacing, glassmorphism, and motion that makes work feel light.',
  },
];

const templatePreviews = [
  { name: 'Aurora', tone: 'from-royal-500 to-emerald-500', tag: 'Modern' },
  { name: 'Continental', tone: 'from-navy-700 to-navy-500', tag: 'Classic' },
  { name: 'Voyage', tone: 'from-emerald-500 to-teal-400', tag: 'Travel' },
  { name: 'Marquee', tone: 'from-amber-500 to-rose-500', tag: 'Luxury' },
  { name: 'Mono', tone: 'from-neutral-700 to-neutral-500', tag: 'Minimal' },
  { name: 'Crest', tone: 'from-indigo-600 to-fuchsia-500', tag: 'Corporate' },
];

const stats = [
  { label: 'Invoices generated', value: '1.2M+' },
  { label: 'Tour operators', value: '4,200+' },
  { label: 'Avg. creation time', value: '24s' },
  { label: 'PDF render time', value: '<2s' },
];

const faqs = [
  {
    q: 'Is this only for travel agencies?',
    a: 'No — Safarmate works for any service business. We just go further than most tools when it comes to tour packages, visas, hotels, transport billing, and now flight ops via the live Kanban board.',
  },
  {
    q: 'Can I customize my invoice templates?',
    a: 'Yes. Logo, signature, stamp, colors, typography, footer copy, terms, and bank/UPI details can all be tuned per template.',
  },
  {
    q: 'Does it support Indian GST?',
    a: 'Yes — CGST + SGST for intra-state and IGST for inter-state are computed automatically. HSN codes are supported per line item.',
  },
  {
    q: 'Can I migrate from BillBook / Vyapar / Zoho?',
    a: 'CSV import for customers and products is on the roadmap. For now the API is open — write a 10-line script and you are done.',
  },
];

function GridBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-hero-glow opacity-90" />
      <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(circle_at_50%_30%,black_30%,transparent_70%)]" />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Brand />
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#templates" className="hover:text-foreground transition-colors">Templates</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-24 md:pt-28 md:pb-32">
      <GridBackdrop />
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <Badge variant="primary" className="mb-6 gap-1.5 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Built for travel & service businesses
          </Badge>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl text-balance">
            The invoice platform that <span className="text-gradient">feels like a product</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Draft tour packages, GST invoices, quotations, and travel itineraries in under 30 seconds.
            Print-ready PDFs, calm UI, and the kind of polish you don&apos;t expect from a billing app.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild variant="primary" size="lg" className="group">
              <Link to="/register">
                Create your first invoice free
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#templates">Browse templates</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free forever · 5-minute setup · No credit card required.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="rounded-3xl border border-border bg-card/70 p-3 shadow-glow backdrop-blur-xl">
            <HeroPreview />
          </div>
          <div className="pointer-events-none absolute -inset-x-12 -bottom-12 h-32 bg-gradient-to-t from-background to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="grid gap-3 rounded-2xl bg-background/80 p-5 md:grid-cols-[1fr_280px]">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Invoice
            </p>
            <p className="font-display text-2xl font-bold">INV-00128</p>
          </div>
          <Badge variant="success">Paid</Badge>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground">Bill to</p>
            <p className="mt-1 font-medium">Apex Holidays LLP</p>
            <p className="text-muted-foreground">Goa, India</p>
          </div>
          <div>
            <p className="text-muted-foreground">Destination</p>
            <p className="mt-1 font-medium">Bali · 7N / 8D</p>
            <p className="text-muted-foreground">4 adults · 2 kids</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="mt-1 font-display text-lg font-bold">₹3,84,500</p>
            <p className="text-emerald-500">Settled · UPI</p>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          {[
            { d: 'Flight — DEL ↔ DPS · 6 pax', a: '₹1,72,000' },
            { d: 'Hotel — Kuta Beach Resort · 7N', a: '₹1,08,500' },
            { d: 'Transfers + Tour guide', a: '₹46,000' },
            { d: 'Visa + Travel insurance · 6 pax', a: '₹28,000' },
          ].map((row) => (
            <div
              key={row.d}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm"
            >
              <span className="text-foreground/90">{row.d}</span>
              <span className="font-medium">{row.a}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            This month
          </p>
          <p className="mt-2 font-display text-3xl font-bold">₹18.4L</p>
          <p className="text-xs text-emerald-500">+22% vs last month</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Outstanding
          </p>
          <p className="mt-2 font-display text-3xl font-bold">₹2.16L</p>
          <p className="text-xs text-warning">7 invoices pending</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick actions
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-royal-500/10 px-2 py-1 text-royal-500">New invoice</span>
            <span className="rounded-md bg-emerald/10 px-2 py-1 text-emerald-500">New quote</span>
            <span className="rounded-md bg-muted px-2 py-1 text-foreground/80">Receipt</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stats() {
  return (
    <section className="border-y border-border/60 bg-muted/30 py-10">
      <div className="container grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-3xl font-bold tracking-tight">{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="muted" className="mb-4">Built for the work you actually do</Badge>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl text-balance">
            Less data entry. More closed deals.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every screen is tuned for the realities of running a travel desk, agency, or service company.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-foreground/20 hover:shadow-soft"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-emerald-500/15 text-royal-500 transition-transform group-hover:scale-105">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Templates() {
  return (
    <section id="templates" className="border-t border-border/60 bg-muted/20 py-24 md:py-32">
      <div className="container">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <Badge variant="primary" className="mb-3">50+ templates</Badge>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl text-balance">
              A template for every kind of customer.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Corporate, luxury, minimal, travel, hotel, airline, visa, GST, international, monochrome — pick once or switch per client.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/register">
              See all templates <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templatePreviews.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className={cn('relative aspect-[4/5] w-full bg-gradient-to-br p-6 text-white', t.tone)}>
                <div className="flex items-center justify-between text-xs/none opacity-80">
                  <span>{t.tag}</span>
                  <span>{t.name}</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-6 w-1/2 rounded bg-white/20" />
                  <div className="h-2 w-3/5 rounded bg-white/15" />
                </div>
                <div className="absolute inset-x-6 bottom-6 space-y-2">
                  {[80, 70, 60, 50].map((w) => (
                    <div key={w} className="flex items-center justify-between">
                      <div className="h-2 rounded bg-white/15" style={{ width: `${w}%` }} />
                      <div className="h-2 w-12 rounded bg-white/25" />
                    </div>
                  ))}
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
                    <span className="text-xs/none opacity-80">Grand total</span>
                    <span className="font-display text-lg font-bold">₹1,84,500</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="font-display text-base font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">Editable colors · logo · footer</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  const cards = [
    { icon: Plane, title: 'Tour Operators', body: 'Multi-passenger, multi-segment travel billing.' },
    { icon: Hotel, title: 'Hotels & DMCs', body: 'Stay-night breakdown, taxes, and city-tax handling.' },
    { icon: Globe2, title: 'Visa & Forex', body: 'Service-line invoices with KYC reference.' },
    { icon: CreditCard, title: 'Payments', body: 'UPI QR, bank transfer, partial settlements.' },
    { icon: Layers, title: 'Quotations', body: 'One-click convert quote → invoice.' },
    { icon: Zap, title: 'Recurring', body: 'Auto-generate monthly retainer invoices.' },
  ];
  return (
    <section className="py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl text-balance">
            Built for the messy reality of running a service business.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:bg-muted/40"
            >
              <c.icon className="h-5 w-5 text-emerald-500" />
              <h3 className="mt-4 font-display text-base font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="container max-w-3xl">
        <div className="text-center">
          <Badge variant="muted" className="mb-3">FAQ</Badge>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Questions, answered.
          </h2>
        </div>
        <div className="mt-12 space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-border bg-card p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between font-display text-base font-semibold">
                {f.q}
                <span className="ml-4 transition-transform group-open:rotate-45 text-muted-foreground">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden border-t border-border/60 bg-muted/20 py-24">
      <div className="absolute inset-0 -z-10 bg-hero-glow opacity-70" />
      <div className="container text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl text-balance">
          Your first invoice is 60 seconds away.
        </h2>
        <p className="mt-4 text-muted-foreground">No setup calls. No credit card. Just calm software that does the job.</p>
        <Button asChild variant="primary" size="lg" className="mt-8">
          <Link to="/register">
            Create your first invoice free
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <Brand size={20} />
        <p>© {new Date().getFullYear()} Safarmate Admin Portal. Designed for travel & service businesses.</p>
        <div className="flex gap-6">
          <a className="hover:text-foreground" href="#">Privacy</a>
          <a className="hover:text-foreground" href="#">Terms</a>
          <a className="hover:text-foreground" href="mailto:hello@invoiceflow.app">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <Stats />
        <Features />
        <Templates />
        <Showcase />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
