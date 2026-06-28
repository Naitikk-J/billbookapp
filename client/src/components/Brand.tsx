import { cn } from '@/lib/cn';

export function Brand({
  className,
  size = 24,
  variant = 'full',
}: {
  className?: string;
  size?: number;
  variant?: 'full' | 'compact';
}) {
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
        {/* Stylised paper plane mark */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3.5 12.2L20 4.5l-4.4 16-4.4-5.6-4.6 3.4-.4-4.6-3-1.5z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M20 4.5l-9 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      {variant === 'full' ? (
        <span className="flex flex-col leading-tight">
          <span className="font-display text-lg font-bold tracking-tight">
            Safarmate <span className="text-emerald-500">Admin</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Portal
          </span>
        </span>
      ) : (
        <span className="font-display text-lg font-bold tracking-tight">
          Safarmate
        </span>
      )}
    </div>
  );
}
