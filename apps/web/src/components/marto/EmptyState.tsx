import Link from 'next/link';
import { Button } from '@/components/marto/Button';

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--marto-border)] bg-[var(--marto-surface)] p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-[var(--marto-text)]">
        <span className="text-xl">◻</span>
      </div>

      <h2 className="mt-4 text-lg font-semibold text-[var(--marto-text)]">{title}</h2>
      {description ? <p className="mt-2 text-[var(--marto-muted)]">{description}</p> : null}

      {actionLabel && actionHref ? (
        <div className="mt-6 flex justify-center">
          <Link href={actionHref}>
            <Button>{actionLabel}</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
