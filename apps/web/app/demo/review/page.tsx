'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Card } from '@/components/marto/Card';
import { Button } from '@/components/marto/Button';
import { Textarea } from '@/components/marto/Input';
import { PageHeader } from '@/components/marto/PageHeader';

export default function DemoReview() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get('ref') ?? 'demo-ref';

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  async function enviar() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400)); // loading fake
    setSaving(false);
    router.push('/demo/done');
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Avaliar"
        description="Fechando o ciclo com feedback."
      />

      <Card>
        <div className="text-xs text-[var(--marto-muted)]">Referência</div>
        <div className="mt-1 font-mono text-sm text-[var(--marto-text)]">{ref}</div>

        <div className="mt-6">
          <label className="text-sm font-medium text-[var(--marto-text)]">
            Nota
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  rating === n
                    ? 'bg-[var(--marto-primary)] text-[var(--marto-primary-foreground)]'
                    : 'bg-white text-[var(--marto-text)] hover:bg-zinc-50'
                }`}
              >
                {n}★
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label className="text-sm font-medium text-[var(--marto-text)]">
            Comentário (opcional)
          </label>
          <Textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: Serviço rápido e bem feito."
            className="mt-2"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={enviar} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar avaliação'}
          </Button>

          <Link href={`/demo/track?ref=${encodeURIComponent(ref)}`}>
            <Button variant="secondary">Voltar</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
