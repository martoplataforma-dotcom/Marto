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

export default function FactoryRepresentativesPage() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setMsg('');

        const token = getToken();
        if (!token) {
          setMsg('Sem token. Faça login primeiro.');
          return;
        }

        // valida autenticação da fábrica
        await fetchJSON<FactoryMeResponse>(`/factories/me`, {
          method: 'GET',
        });
      } catch (e) {
        const a = e as ApiError;
        setMsg(`${a.status} - ${a.message}`);
      }
    })();
  }, []);

  const mock = [
    {
      id: 'r1',
      name: 'Maria Sales',
      region: 'MG • Zona da Mata',
      status: 'Ativo',
    },
    {
      id: 'r2',
      name: 'João Almeida',
      region: 'RJ • Capital',
      status: 'Pendente',
    },
    {
      id: 'r3',
      name: 'Ana Ribeiro',
      region: 'SP • Interior',
      status: 'Ativo',
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Representantes</h1>

          <p className="text-sm text-neutral-600">
            Gerencie sua rede comercial no Marto •{' '}
            <span className="font-medium">Mock</span>
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
            <h2 className="text-sm font-semibold">Sua rede</h2>
            <p className="text-xs text-neutral-500">
              Representantes conectam sua fábrica a regiões e lojistas.
            </p>
          </div>

          <button
            disabled
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white opacity-60"
            title="Vamos habilitar convites no próximo passo"
            type="button"
          >
            Convidar representante
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {mock.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border bg-white p-4 hover:bg-neutral-50"
            >
              {/* ✅ CARD REFINADO */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{r.name}</div>

                  <div className="mt-1 text-xs text-neutral-600">
                    Região: {r.region}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                      Atuação: Lojistas
                    </span>
                    <span className="rounded-full border bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                      Experiência regional
                    </span>
                  </div>
                </div>

                <span className="rounded-full border bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                  {r.status}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                  type="button"
                  disabled
                  title="Perfil completo em breve"
                >
                  Ver perfil
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border bg-neutral-50 p-4 text-sm text-neutral-700">
          <div className="font-medium">
            Como funciona a rede de representantes
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Representantes atuam por região, conectando sua fábrica a
            oportunidades comerciais. Você poderá convidar, definir áreas e
            acompanhar desempenho.
          </p>
        </div>
      </section>
    </main>
  );
}
