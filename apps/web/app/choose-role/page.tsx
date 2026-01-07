'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Role = 'CONSUMER' | 'SERVICE_PROVIDER' | 'MERCHANT';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Erro ao selecionar tipo.';
  }
}

export default function ChooseRolePage() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState<Role | null>(null);

  async function selectRole(role: Role) {
    setMsg('');
    setLoading(role);

    try {
      const token = localStorage.getItem('marto_access');
      if (!token) throw new Error('Sem token');

      const API_BASE = 'http://localhost:3001/api';

      // corpo conforme o papel escolhido
      const body =
        role === 'CONSUMER'
          ? { role: 'CONSUMER', consumer: {} }
          : role === 'SERVICE_PROVIDER'
            ? {
                role: 'SERVICE_PROVIDER',
                serviceProvider: {
                  cpf: '00000000000',
                  categories: [],
                },
              }
            : {
                role: 'MERCHANT',
                merchant: {
                  tradeName: 'Minha Loja',
                  document: '00000000000000',
                },
              };

      // ✅ POST /me/add-role
      const r = await fetch(`${API_BASE}/me/add-role`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `HTTP ${r.status}`);
      }

      // ✅ Depois do POST /me/add-role, faça o GET /me e redirecione usando home
      const me = await fetch('http://localhost:3001/api/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json() as Promise<{ home?: unknown }>);

      if ((me as { home?: unknown }).home === 'merchant') {
        router.replace('/dash/merchant');
      } else if ((me as { home?: unknown }).home === 'service_provider') {
        router.replace('/dash/provider');
      } else if ((me as { home?: unknown }).home === 'representative') {
        router.replace('/dash/representative');
      } else {
        router.replace('/dash/consumer');
      }
    } catch (err: unknown) {
      setMsg(errorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Como você começa no Marto?
          </h1>
          <p className="mt-3 text-base text-white/75">
            Sua escolha define como sua reputação começa.
            <br />
            Você poderá evoluir e expandir depois.
          </p>
        </div>

        {/* Error message */}
        {msg ? (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {msg}
          </div>
        ) : null}

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* CONSUMER */}
          <button
            disabled={loading !== null}
            className="group rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
            onClick={() => selectRole('CONSUMER')}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/70">Cliente</div>
              <div className="text-xl">🛒</div>
            </div>

            <h2 className="text-xl font-semibold">Comprar ou contratar</h2>

            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Use o Marto como cliente final. Suas ações constroem um histórico
              real.
            </p>

            <div className="mt-6 text-xs font-semibold text-white/60">
              {loading === 'CONSUMER'
                ? 'Selecionando…'
                : 'Reputação como consumidor →'}
            </div>
          </button>

          {/* SERVICE PROVIDER */}
          <button
            disabled={loading !== null}
            className="group rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
            onClick={() => selectRole('SERVICE_PROVIDER')}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/70">Prestador</div>
              <div className="text-xl">🧑‍🔧</div>
            </div>

            <h2 className="text-xl font-semibold">
              Trabalhar e prestar serviços
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Preste serviços e construa reputação com entregas reais.
            </p>

            <div className="mt-6 text-xs font-semibold text-white/60">
              {loading === 'SERVICE_PROVIDER'
                ? 'Selecionando…'
                : 'Reputação como prestador →'}
            </div>
          </button>

          {/* MERCHANT */}
          <button
            disabled={loading !== null}
            className="group rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
            onClick={() => selectRole('MERCHANT')}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/70">Negócio</div>
              <div className="text-xl">🏪</div>
            </div>

            <h2 className="text-xl font-semibold">Vender produtos</h2>

            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Venda como loja ou fabricante. Sua reputação cresce com avaliações
              reais.
            </p>

            <div className="mt-6 text-xs font-semibold text-white/60">
              {loading === 'MERCHANT'
                ? 'Selecionando…'
                : 'Reputação como vendedor →'}
            </div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="mt-12 max-w-xl text-sm text-white/50">
          Não se preocupe: você poderá adicionar outros papéis depois. No Marto,
          reputação cresce com o uso real.
        </div>
      </div>
    </main>
  );
}
