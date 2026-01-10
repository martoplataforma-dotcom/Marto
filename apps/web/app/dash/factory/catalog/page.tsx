'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type FactoryMeResponse = {
  ok: boolean;
  factory: {
    tradeName: string;
  } | null;
};

export default function FactoryCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [factoryName, setFactoryName] = useState<string>('Fabricante');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMsg('');

        const token = getToken();
        if (!token) {
          setMsg('Sem token. Faça login primeiro.');
          return;
        }

        const data = await fetchJSON<FactoryMeResponse>(`/factories/me`, {
          method: 'GET',
        });

        setFactoryName(data?.factory?.tradeName ?? 'Fabricante');
      } catch (e) {
        const a = e as ApiError;
        setMsg(`${a.status} - ${a.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mock = [
    {
      id: 'p1',
      title: 'Poltrona Aurora',
      sku: 'AUR-001',
      status: 'Ativo',
      price: 'R$ 1.490,00',
    },
    {
      id: 'p2',
      title: 'Sofá Boreal 2L',
      sku: 'BOR-210',
      status: 'Rascunho',
      price: 'R$ 2.790,00',
    },
    {
      id: 'p3',
      title: 'Mesa Lótus 6 lugares',
      sku: 'LOT-600',
      status: 'Ativo',
      price: 'R$ 3.350,00',
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Catálogo</h1>
          <p className="text-sm text-neutral-600">
            {loading ? 'Carregando…' : factoryName} • Produtos fabricados no
            Marto
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/dash/factory"
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Voltar
          </Link>
          <Link
            href="/logout"
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Sair
          </Link>
        </nav>
      </header>

      {msg ? (
        <div className="mb-4 rounded-xl border bg-white p-4 text-sm">
          {msg}
        </div>
      ) : null}

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Produtos do catálogo</h2>
            <p className="text-xs text-neutral-500">
              Estes produtos representam o que sua fábrica oferece no Marto.
            </p>
          </div>

          <button
            disabled
            className="rounded-lg border px-3 py-2 text-sm font-medium opacity-60"
            title="Vamos habilitar no próximo passo"
          >
            Adicionar produto
          </button>
        </div>

        {/* BLOCO DE FILTROS VISUAIS (mock) */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Buscar por nome ou SKU"
              disabled
              className="w-full sm:w-64 rounded-lg border px-3 py-2 text-sm opacity-60"
              title="Busca será habilitada com o backend"
            />

            <select
              disabled
              className="rounded-lg border px-3 py-2 text-sm opacity-60"
              title="Filtro será habilitado com o backend"
              defaultValue=""
            >
              <option value="">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="draft">Rascunho</option>
            </select>
          </div>

          <div className="text-xs text-neutral-500">
            Filtros visuais — ativaremos com dados reais.
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mock.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border bg-white overflow-hidden"
            >
              {/* thumbnail fake */}
              <div className="h-36 w-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-400">
                imagem do produto
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold leading-tight">
                      {p.title}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      SKU {p.sku}
                    </div>
                  </div>

                  <span className="rounded-full border bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                    {p.status}
                  </span>
                </div>

                <div className="mt-3 text-sm font-medium text-neutral-800">
                  {p.price}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                    type="button"
                    disabled
                    title="Vamos habilitar quando ligar o backend do catálogo da fábrica"
                  >
                    Editar
                  </button>

                  {/* ✅ LINK ATIVO PARA DETALHES */}
                  <Link
                    href={`/dash/factory/catalog/${p.id}`}
                    className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                  >
                    Ver detalhes
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* empty state (preparação futura) */}
        <div className="mt-6 rounded-xl border bg-neutral-50 p-4 text-sm text-neutral-700">
          <div className="font-medium">Comece pelo seu primeiro produto</div>
          <p className="mt-1 text-xs text-neutral-600">
            Cadastre produtos com fotos, variações e preços para que lojistas e
            consumidores encontrem sua fábrica no Marto.
          </p>
        </div>

        <div className="mt-4 text-xs text-neutral-500">
          Mock visual: vamos ligar no backend quando criarmos o catálogo da
          fábrica.
        </div>
      </section>
    </main>
  );
}
