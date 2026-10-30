import type { Customer } from '@/lib/types';

export function matchCustomerId(name: string, customers: Customer[]): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const exact = customers.find((c) => c.name.trim().toLowerCase() === n);
  if (exact) return exact._id;
  const partial = customers.find(
    (c) =>
      c.name.trim().toLowerCase().includes(n) || n.includes(c.name.trim().toLowerCase())
  );
  return partial?._id ?? null;
}
