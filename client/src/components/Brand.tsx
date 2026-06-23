import { cn } from '@/lib/cn';

export function Brand({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className="inline-flex items-center justify-center rounded-xl text-white shadow-glow"
        style={{
          width: size + 8,
          height: size + 8,
          background:
            'linear-gradient(135deg, #1E3A8A 0%, #2A5BFF 55%, #10B981 100%)',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 4.5h11.5L19 7v12.5a0.5 0.5 0 01-0.78.42L16 18.5l-2.22 1.42a0.5 0.5 0 01-0.56 0L11 18.5l-2.22 1.42a0.5 0.5 0 01-0.56 0L6 18.5l-2.22 1.42A0.5 0.5 0 013 19.5V6.5A2 2 0 015 4.5z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 9h8M8 12h6M8 15h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        InvoiceFlow <span className="text-emerald-500">Pro</span>
      </span>
    </div>
  );
}
