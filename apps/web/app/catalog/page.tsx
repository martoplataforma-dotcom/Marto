// apps/web/app/catalog/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJSON, type ApiError } from '../../src/lib/api';
import { PageHeader } from '@/components/marto/PageHeader';

type Product = {
  id: string;
  name: string;
  price: string | number;
  merchantId: string;
};

function priceToLabel(price: string | number): string {
  const n =
    typeof price === 'number'
      ? price
      : Number(String(price).replace(',', '.'));

  if (!Number.isFinite(n)) return String(price ?? '');
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default function CatalogPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetchJSON<Product[]>('/products');
        setItems(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        const err = e as ApiError;
        setError(err?.message ?? (e instanceof Error ? e.message : String(e)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Catálogo"
          description="Escolha um item para ver o ciclo funcionando."
        />

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Carregando produtos…
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {items.map((it) => {
              const href = `/shop/${encodeURIComponent(it.id)}`;

              return (
                <li
                  key={it.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                >
                  <div>
                    <div className="font-semibold text-white/90">{it.name}</div>
                    <div className="mt-1 text-sm text-white/70">
                      R$ {priceToLabel(it.price)}
                    </div>
                    <div className="mt-1 text-xs text-white/65">
                      merchantId:{' '}
                      <span className="break-all text-white/75">
                        {it.merchantId}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={href}
                    className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Ver detalhes →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
