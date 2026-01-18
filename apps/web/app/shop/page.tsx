// apps/web/app/shop/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Product = {
  id: string;
  name: string;
  price: number;
  merchantId?: string;
};

export default function ShopPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setErr(null);
        setLoading(true);

        // ✅ API (ajuste se sua porta/base for diferente)
        const res = await fetch('http://localhost:3001/api/products', {
          method: 'GET',
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${text}`);
        }

        const data = (await res.json()) as Product[];
        if (!alive) return;

        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : 'Erro ao carregar produtos');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Vitrine</h1>
            <p className="text-sm text-white/70">
              Produtos reais vindo do backend (teste primeira venda)
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Voltar
          </Link>
        </header>

        <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          {loading ? (
            <p className="text-sm text-white/70">Carregando...</p>
          ) : err ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-white/70">Nenhum produto encontrado.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="rounded-2xl border border-white/15 bg-black/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{p.name}</div>
                      <div className="text-sm text-white/70">
                        R$ {(p.price / 100).toFixed(2).replace('.', ',')}
                      </div>
                      <div className="mt-2 text-xs text-white/60">
                        ID: {p.id}
                      </div>
                    </div>

                    <Link
                      href={`/shop/${encodeURIComponent(p.id)}`}
                      className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
                    >
                      Ver
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
