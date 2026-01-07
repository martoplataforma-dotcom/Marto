export function PageHeader({
  eyebrow = 'Marto • Demo',
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-4">
      <div className="text-sm text-[var(--marto-muted)]">{eyebrow}</div>
      <h1 className="mt-1 text-2xl font-semibold text-[var(--marto-text)]">{title}</h1>
      {description ? (
        <p className="mt-1 text-[var(--marto-muted)]">{description}</p>
      ) : null}
    </header>
  );
}
