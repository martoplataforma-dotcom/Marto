import { headers } from 'next/headers';

export default async function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const url = h.get('x-url') || '';
  const isPresent = url.includes('present=1');

  return (
    <div className="min-h-screen bg-[var(--marto-bg)]">
      <div className={`mx-auto max-w-3xl ${isPresent ? 'p-4' : 'p-6'}`}>
        {children}
      </div>
    </div>
  );
}
