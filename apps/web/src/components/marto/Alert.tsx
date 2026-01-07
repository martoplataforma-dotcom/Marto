import * as React from 'react';

type Variant = 'success' | 'error' | 'warning' | 'info';

export function Alert({
  variant = 'info',
  title,
  children,
  className = '',
}: {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const map: Record<Variant, { bg: string; border: string; text: string; dot: string }> = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-900',
      dot: 'bg-[var(--marto-success)]',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      dot: 'bg-[var(--marto-danger)]',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      dot: 'bg-[var(--marto-warning)]',
    },
    info: {
      bg: 'bg-zinc-50',
      border: 'border-[var(--marto-border)]',
      text: 'text-[var(--marto-text)]',
      dot: 'bg-[var(--marto-primary)]',
    },
  };

  const v = map[variant];

  return (
    <div className={`rounded-xl border ${v.bg} ${v.border} p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${v.dot}`} />
        <div className={`${v.text}`}>
          {title ? <div className="text-sm font-medium">{title}</div> : null}
          <div className="mt-1 text-sm opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}
