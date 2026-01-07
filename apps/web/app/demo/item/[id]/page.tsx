'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getDemoItem } from '@/lib/demo-data';
import { Card } from '@/components/marto/Card';
import { Button } from '@/components/marto/Button';
import { PageHeader } from '@/components/marto/PageHeader';

export default function DemoItemPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const item = getDemoItem(id);

  if (!item) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Card>
          <h1 className="text-xl font-semibold text-[var(--marto-text)]">
            Item não encontrado
          </h1>
          <p className="mt-2 text-[var(--marto-muted)]">
            Volte para o catálogo.
          </p>

          <div className="mt-6">
            <Link href="/demo/catalog">
              <Button variant="secondary">Ir para catálogo</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const cta = item.kind === 'product' ? 'Comprar (demo)' : 'Solicitar (demo)';

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={item.title}
        description={item.subtitle}
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold text-[var(--marto-text)]">
            {item.priceLabel}
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {item.statusLabel}
          </span>
        </div>

        <div className="mt-3 text-sm text-[var(--marto-text)]">
          Fornecedor/Prestador:{' '}
          <span className="font-medium">{item.sellerLabel}</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/demo/confirm?itemId=${encodeURIComponent(item.id)}`}>
            <Button>{cta}</Button>
          </Link>

          <Link href="/demo/catalog">
            <Button variant="secondary">Voltar</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
