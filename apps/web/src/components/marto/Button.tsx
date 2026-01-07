import * as React from 'react';

type Variant = 'primary' | 'secondary';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = 'primary', className = '', disabled, ...props }: Props) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marto-ring)] ' +
    'disabled:opacity-60 disabled:pointer-events-none';

  const styles =
    variant === 'primary'
      ? 'bg-[var(--marto-primary)] text-[var(--marto-primary-foreground)] hover:opacity-90'
      : 'border border-[var(--marto-border)] bg-[var(--marto-surface)] text-[var(--marto-text)] hover:bg-zinc-50';

  return <button disabled={disabled} className={`${base} ${styles} ${className}`} {...props} />;
}
