'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type ProductItem = {
  id: string;
  title: string;
  description?: string | null;
  priceCents: number;
  active: boolean;
};

type ProductsResponse = {
  ok: boolean;
  items: ProductItem[];
};

// ✅ 1) type do POST (sem any)
type CreateProductResponse =
  | { ok: true; created: ProductItem }
  | { ok: false; message: string };

export default function MerchantProductsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);

  // form novo produto
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        setMsg('Sem token. Faça login novamente.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetchJSON<ProductsResponse>('/merchants/me/products', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setProducts(res.items ?? []);
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Erro ao carregar produtos.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function createProduct() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token.');
      return;
    }

    const priceNum = Number(price.replace(',', '.'));
    const priceCents = Math.round(priceNum * 100);

    if (!title.trim()) {
      setMsg('Informe o nome do produto.');
      return;
    }

    if (!Number.isFinite(priceNum) || priceCents <= 0) {
      setMsg('Preço inválido.');
      return;
    }

    setSaving(true);
    try {
      // ✅ 2) sem any
      const res = await fetchJSON<CreateProductResponse>('/merchants/me/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priceCents,
        }),
      });

      // ✅ 3) 100% tipado
      if (!res.ok) {
        setMsg(res.message || 'Erro ao criar produto.');
        return;
      }

      setProducts((p) => [res.created, ...p]);
      setTitle('');
      setDescription('');
      setPrice('');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Gerencie os anúncios da sua loja no Marto.
            </p>
          </div>

          <Link
            href="/dash/merchant"
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {/* MENSAGEM */}
        {msg ? (
          <div className="mb-4 rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {msg}
          </div>
        ) : null}

        {/* NOVO PRODUTO */}
        <div className="mb-6 rounded-3xl border bg-white p-6">
          <div className="text-lg font-semibold">Novo anúncio</div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Nome do produto</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
              />
            </label>

            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Descrição</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                rows={3}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Preço (R$)</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
              />
            </label>

            <div className="flex items-end">
              <button
                onClick={createProduct}
                disabled={saving}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Criar produto'}
              </button>
            </div>
          </div>
        </div>

        {/* LISTA */}
        <div className="rounded-3xl border bg-white p-6">
          <div className="text-lg font-semibold">
            Produtos cadastrados ({products.length})
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              <div className="text-sm text-zinc-600">Carregando…</div>
            ) : products.length === 0 ? (
              <div className="text-sm text-zinc-600">
                Nenhum produto cadastrado ainda.
              </div>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border px-4 py-3"
                >
                  <div>
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-zinc-600">
                   R${' '}
                      {(p.priceCents / 100).toFixed(2).replace('.', ',')} •{' '}
                      {p.active ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-zinc-600">
                    Editar → (em breve)
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
