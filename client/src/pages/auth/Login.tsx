import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brand } from '@/components/Brand';
import { api, apiError } from '@/lib/api';
import { setTokens } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type LoginValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  useEffect(() => {
    if (accessToken) navigate('/app', { replace: true });
  }, [accessToken, navigate]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: LoginValues) => {
      const res = await api.post('/auth/login', values);
      return res.data;
    },
    onSuccess: (data) => {
      dispatch(setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      }));
      toast.success('Welcome back');
      const from = (location.state as { from?: string } | null)?.from ?? '/app';
      navigate(from, { replace: true });
    },
    onError: (err) => toast.error(apiError(err, 'Login failed')),
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage invoices, customers, and your team."
      footer={
        <span>
          New to InvoiceFlow? <Link to="/register" className="text-secondary hover:underline">Create an account</Link>
        </span>
      }
    >
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@agency.com" {...form.register('email')} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.register('password')} />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <>Sign in <ArrowRight /></>}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-800 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-hero-glow opacity-70" />
        <div className="relative z-10">
          <Brand />
        </div>
        <div className="relative z-10 max-w-md">
          <p className="font-display text-3xl font-bold leading-snug">
            “We switched from BillBook to InvoiceFlow and cut our invoicing time in half. The PDFs alone are worth it.”
          </p>
          <p className="mt-6 text-sm text-white/70">— Priya Sharma, Apex Holidays LLP</p>
        </div>
        <div className="relative z-10 text-xs text-white/50">© {new Date().getFullYear()} InvoiceFlow Pro</div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Brand />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to site</Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">
            <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
