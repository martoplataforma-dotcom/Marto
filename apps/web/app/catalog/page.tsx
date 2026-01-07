'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJSON } from '../../src/lib/api';
import { PageHeader } from '@/components/marto/PageHeader';

type Product = {
  id: string;
  name: string;
  price: string;
};

export default function CatalogPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchJSON<Product[]>('/products');
        setItems(data);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : JSON.stringify(e),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="p-6">
      <PageHeader
        title="Catálogo"
        description="Escolha um item para ver o ciclo funcionando."
      />

      {loading && (
        <p className="mt-6">Carregando produtos…</p>
      )}

      {error && (
        <pre className="mt-6 text-sm text-red-600">
          {error}
        </pre>
      )}

      {!loading && !error && (
        <ul className="mt-6 grid gap-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between rounded-xl border p-4"
            >
              <div>
                <div className="font-semibold">
                  {it.name}
                </div>
                <div className="text-sm text-gray-600">
                  R$ {it.price}
                </div>
              </div>

              <Link
                href={`/checkout?productId=${it.id}`}
                className="rounded-lg border px-3 py-2"
              >
                Comprar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
