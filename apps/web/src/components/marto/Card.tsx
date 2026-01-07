import * as React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ padded = true, className = '', ...props }: Props) {
  const base =
    'rounded-2xl border border-[var(--marto-border)] bg-[var(--marto-surface)] shadow-sm';
  const pad = padded ? 'p-6' : '';
  return <div className={`${base} ${pad} ${className}`} {...props} />;
}
