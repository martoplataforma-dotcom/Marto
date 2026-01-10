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

export default function FactoryOrdersPage() {
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
      id: 'o1',
      title: 'Pedido #10231',
      meta: 'Poltrona Aurora • 2 un.',
      status: 'Novo',
      total: 'R$ 2.980,00',
    },
    {
      id: 'o2',
      title: 'Pedido #10218',
      meta: 'Mesa Lótus 6 lugares • 1 un.',
      status: 'Em produção',
      total: 'R$ 3.350,00',
    },
    {
      id: 'o3',
      title: 'Pedido #10197',
      meta: 'Sofá Boreal 2L • 1 un.',
      status: 'Finalizado',
      total: 'R$ 2.790,00',
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-sm text-neutral-600">
            {loading ? 'Carregando…' : factoryName} • Acompanhe a demanda e o
            andamento
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
            <h2 className="text-sm font-semibold">Fila de pedidos</h2>
            <p className="text-xs text-neutral-500">
              Mock visual: vamos ligar no backend quando criarmos pedidos reais
              da fábrica.
            </p>
          </div>

          <button
            disabled
            className="rounded-lg border px-3 py-2 text-sm font-medium opacity-60"
            title="Em breve"
          >
            Filtros
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {mock.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border bg-white p-4 hover:bg-neutral-50"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{o.title}</div>
                  <div className="mt-1 text-xs text-neutral-600">{o.meta}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                    {o.status}
                  </span>
                  <div className="text-sm font-medium text-neutral-800">
                    {o.total}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                  type="button"
                  disabled
                  title="Em breve"
                >
                  Ver detalhes
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
