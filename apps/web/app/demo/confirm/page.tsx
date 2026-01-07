'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDemoItem } from '@/lib/demo-data';
import { Card } from '@/components/marto/Card';
import { Button } from '@/components/marto/Button';
import { PageHeader } from '@/components/marto/PageHeader';

export default function DemoConfirm() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = params.get('itemId') ?? '';
  const item = useMemo(() => getDemoItem(itemId), [itemId]);

  const [saving, setSaving] = useState(false);

  async function confirmar() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 450)); // loading fake curto
    setSaving(false);
    router.push(`/demo/track?ref=demo-${Date.now()}`);
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Card>
          <h1 className="text-xl font-semibold text-[var(--marto-text)]">Nada para confirmar</h1>
          <p className="mt-2 text-[var(--marto-muted)]">Volte para o catálogo.</p>
          <div className="mt-6">
            <Link href="/demo/catalog">
              <Button variant="secondary">Ir para catálogo</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Confirmar"
        description="Confirmação simulada (sem operação real)."
      />

      <Card>
        <div className="text-sm text-[var(--marto-muted)]">Item</div>
        <div className="mt-1 text-lg font-semibold text-[var(--marto-text)]">{item.title}</div>
        <div className="mt-2 text-sm text-[var(--marto-text)]">
          <span className="font-medium">{item.priceLabel}</span>{' '}
          <span className="text-[var(--marto-muted)]">• {item.sellerLabel}</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={confirmar} disabled={saving}>
            {saving ? 'Confirmando…' : 'Confirmar (demo)'}
          </Button>

          <Link href="/demo/catalog">
            <Button variant="secondary">Cancelar</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
