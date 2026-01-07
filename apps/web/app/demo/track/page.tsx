'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/marto/Card';
import { Button } from '@/components/marto/Button';
import { PageHeader } from '@/components/marto/PageHeader';

export default function DemoTrack() {
  const params = useSearchParams();
  const ref = params.get('ref') ?? 'demo-ref';

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Acompanhamento"
        description="Você sempre sabe o que está acontecendo."
      />

      <Card>
        <div className="text-sm text-[var(--marto-muted)]">Referência</div>
        <div className="mt-1 font-mono text-sm text-[var(--marto-text)]">{ref}</div>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl bg-zinc-50 p-4">
            <div className="text-xs text-[var(--marto-muted)]">Status</div>
            <div className="mt-1 text-sm font-medium text-[var(--marto-text)]">
              Em andamento
            </div>
          </div>

          <div className="rounded-xl border border-[var(--marto-border)] p-4">
            <div className="text-sm font-medium text-[var(--marto-text)]">
              Checklist
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-[var(--marto-muted)]">
              <li>Solicitação recebida</li>
              <li>Responsável alocado</li>
              <li>Execução em progresso</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/demo/review?ref=${encodeURIComponent(ref)}`}>
            <Button>Finalizar e avaliar</Button>
          </Link>

          <Link href="/demo/catalog">
            <Button variant="secondary">Voltar ao catálogo</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
