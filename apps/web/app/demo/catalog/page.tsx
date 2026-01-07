import Link from 'next/link';
import { DEMO_ITEMS } from '@/lib/demo-data';
import { Card } from '@/components/marto/Card';
import { Button } from '@/components/marto/Button';
import { EmptyState } from '@/components/marto/EmptyState';
import { PageHeader } from '@/components/marto/PageHeader';

export default function DemoCatalog() {
  const items = DEMO_ITEMS; // simulação de dados

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Catálogo"
        description="Escolha um item para ver o ciclo funcionando."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum item disponível"
          description="Quando houver produtos ou serviços, eles aparecerão aqui."
          actionLabel="Voltar para a demo"
          actionHref="/demo"
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Link key={it.id} href={`/demo/item/${it.id}`} className="block">
              <Card className="p-5 hover:bg-zinc-50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-[var(--marto-muted)]">
                      {it.kind === 'product' ? 'Produto' : 'Serviço'}
                    </div>

                    <div className="mt-1 text-lg font-semibold text-[var(--marto-text)]">
                      {it.title}
                    </div>

                    <div className="mt-1 text-sm text-[var(--marto-muted)]">
                      {it.subtitle}
                    </div>

                    <div className="mt-3 text-sm text-[var(--marto-text)]">
                      <span className="font-medium">{it.priceLabel}</span>{' '}
                      <span className="text-[var(--marto-muted)]">
                        • {it.sellerLabel}
                      </span>
                    </div>
                  </div>

                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {it.statusLabel}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link href="/demo">
          <Button variant="secondary">Voltar</Button>
        </Link>
      </div>
    </main>
  );
}
