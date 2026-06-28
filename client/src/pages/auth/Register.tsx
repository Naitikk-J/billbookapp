import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, apiError } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/store';
import { setTokens } from '@/store/authSlice';
import { AuthLayout } from './Login';

const schema = z.object({
  name: z.string().min(2, 'Your full name'),
  companyName: z.string().min(2, 'Company name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type RegisterValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  useEffect(() => {
    if (accessToken) navigate('/app', { replace: true });
  }, [accessToken, navigate]);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', companyName: '', email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: RegisterValues) => {
      const res = await api.post('/auth/register', values);
      return res.data;
    },
    onSuccess: (data) => {
      dispatch(
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        })
      );
      toast.success('Welcome to Safarmate Admin Portal');
      navigate('/app', { replace: true });
    },
    onError: (err) => toast.error(apiError(err, 'Registration failed')),
  });

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="One account for your whole team. Free forever — every feature included."
      footer={
        <span>
          Already have an account? <Link to="/login" className="text-secondary hover:underline">Sign in</Link>
        </span>
      }
    >
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" placeholder="Naitik Mehta" autoComplete="name" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              placeholder="Apex Holidays"
              autoComplete="organization"
              {...form.register('companyName')}
            />
            {form.formState.errors.companyName ? (
              <p className="text-xs text-destructive">{form.formState.errors.companyName.message}</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@agency.com" {...form.register('email')} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Choose a password</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...form.register('password')} />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <>Create account <ArrowRight /></>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our terms & privacy policy.
        </p>
      </form>
    </AuthLayout>
  );
}
