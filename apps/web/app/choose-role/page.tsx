'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type Role = 'CONSUMER' | 'SERVICE_PROVIDER' | 'MERCHANT';

type Home =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type MeResponse = { home?: Home | null };

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Erro ao selecionar tipo.';
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border border-white/25 border-t-white/70"
      aria-hidden
    />
  );
}

function Icon({
  name,
  className,
}: {
  name: 'consumer' | 'provider' | 'merchant';
  className?: string;
}) {
  const c = className ?? 'h-5 w-5';

  if (name === 'consumer') {
    return (
      <svg viewBox="0 0 24 24" className={c} fill="none" aria-hidden>
        <path
          d="M12 12.5c2.5 0 4.5-2.2 4.5-4.9S14.5 3 12 3 7.5 5.2 7.5 7.6 9.5 12.5 12 12.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M4.5 21c1.6-4 5-6.2 7.5-6.2s5.9 2.2 7.5 6.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === 'provider') {
    return (
      <svg viewBox="0 0 24 24" className={c} fill="none" aria-hidden>
        <path
          d="M10 3h4l1 3h4v4l-3 1v4l3 1v4h-4l-1 3h-4l-1-3H5v-4l3-1v-4L5 10V6h4l1-3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={c} fill="none" aria-hidden>
      <path
        d="M4 9h16l-1.2 12H5.2L4 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 9V7.2C8 5.4 9.8 4 12 4s4 1.4 4 3.2V9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ChooseRolePage() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState<Role | null>(null);

  // ✅ API pode vir como http://localhost:3001/api
  const API_BASE = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
    return base.replace(/\/+$/, '');
  }, []);

  const rolePayload = useMemo(() => {
    // Placeholders do MVP (quando houver onboarding real por perfil, isso vira formulário).
    return {
      CONSUMER: { role: 'CONSUMER', consumer: {} },
      SERVICE_PROVIDER: {
        role: 'SERVICE_PROVIDER',
        serviceProvider: {
          cpf: '00000000000',
          categories: [],
        },
      },
      MERCHANT: {
        role: 'MERCHANT',
        merchant: {
          tradeName: 'Minha Loja',
          document: '00000000000000',
        },
      },
    } as const;
  }, []);

  function redirectFromHome(home?: Home | null) {
    if (home === 'merchant') router.replace('/dash/merchant');
    else if (home === 'service_provider')
      router.replace('/dash/provider/services');
    else if (home === 'representative') router.replace('/dash/representative');
    else if (home === 'factory') router.replace('/dash/factory');
    else router.replace('/dash/consumer');
  }

  async function selectRole(role: Role) {
    if (loading) return;

    setMsg('');
    setLoading(role);

    try {
      const token = getToken();
      if (!token) throw new Error('Sem token (faça login novamente).');

      // ✅ POST /me/add-role
      const r = await fetch(`${API_BASE}/me/add-role`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rolePayload[role]),
      });

      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `HTTP ${r.status}`);
      }

      // ✅ GET /me e redireciona usando home
      const me = await fetch(`${API_BASE}/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json() as Promise<MeResponse>);

      redirectFromHome(me?.home ?? null);
    } catch (err: unknown) {
      setMsg(errorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Fundo Marto (vanguarda) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-neutral-950" />
        <div className="absolute -top-48 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl p-6">
        {/* Header */}
        <div className="mb-10 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white/75 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              Identidade inicial • 30s
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Escolha seu ponto de partida
            </h1>

            <p className="mt-3 text-base text-white/80">
              No Marto, reputação cresce com uso real: compra, entrega, serviço,
              avaliação e dados.
              <br />
              Você poderá adicionar outros papéis depois, sem perder histórico.
            </p>
          </div>

          {/* Side hint */}
          <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-xs font-semibold text-white/65">
              Como isso impacta você
            </div>
            <div className="mt-2 text-sm text-white/80">
              Seu “início” define quais telas aparecem primeiro e quais ações
              ficam prontas no seu painel.
            </div>
            <div className="mt-3 text-xs text-white/70">
              Dica: comece onde você executa mais ações reais hoje.
            </div>
          </div>
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
            type="button"
            disabled={loading !== null}
            onClick={() => selectRole('CONSUMER')}
            className={[
              'group relative rounded-3xl border border-white/15 bg-neutral-950/75 p-6 text-left',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition',
              'hover:bg-white/10 hover:border-white/25 disabled:opacity-60',
              loading === 'CONSUMER' ? 'ring-1 ring-white/25' : '',
            ].join(' ')}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/70">
                <span className="text-white/80">
                  <Icon name="consumer" />
                </span>
                Consumidor
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white/70">
                recomendado
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white">
              Comprar e contratar
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Compre produtos, contrate serviços e construa histórico real
              (pedidos, avaliações e posts verificados).
            </p>

            <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/70">
                Você ganha agora
              </div>
              <ul className="mt-2 space-y-1 text-xs text-white/70">
                <li>• Checkout + histórico</li>
                <li>• Avaliações e reputação</li>
                <li>• Base para pontos e recompensas</li>
              </ul>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-white/65">
              {loading === 'CONSUMER' ? (
                <>
                  <Spinner /> Selecionando…
                </>
              ) : (
                <>Entrar como consumidor →</>
              )}
            </div>
          </button>

          {/* SERVICE PROVIDER */}
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => selectRole('SERVICE_PROVIDER')}
            className={[
              'group relative rounded-3xl border border-white/15 bg-neutral-950/75 p-6 text-left',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition',
              'hover:bg-white/10 hover:border-white/25 disabled:opacity-60',
              loading === 'SERVICE_PROVIDER' ? 'ring-1 ring-white/25' : '',
            ].join(' ')}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/70">
                <span className="text-white/80">
                  <Icon name="provider" />
                </span>
                Prestador
              </div>
              <div className="text-xs text-white/65">serviços</div>
            </div>

            <h2 className="text-xl font-semibold text-white">
              Trabalhar e entregar
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Receba chamados, conclua checklists e construa reputação por
              entregas reais.
            </p>

            <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/70">
                Você ganha agora
              </div>
              <ul className="mt-2 space-y-1 text-xs text-white/70">
                <li>• Chamados e agenda</li>
                <li>• Checklist (qualidade)</li>
                <li>• Ranking por performance</li>
              </ul>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-white/65">
              {loading === 'SERVICE_PROVIDER' ? (
                <>
                  <Spinner /> Selecionando…
                </>
              ) : (
                <>Entrar como prestador →</>
              )}
            </div>
          </button>

          {/* MERCHANT */}
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => selectRole('MERCHANT')}
            className={[
              'group relative rounded-3xl border border-white/15 bg-neutral-950/75 p-6 text-left',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition',
              'hover:bg-white/10 hover:border-white/25 disabled:opacity-60',
              loading === 'MERCHANT' ? 'ring-1 ring-white/25' : '',
            ].join(' ')}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/70">
                <span className="text-white/80">
                  <Icon name="merchant" />
                </span>
                Negócio
              </div>
              <div className="text-xs text-white/65">vendas</div>
            </div>

            <h2 className="text-xl font-semibold text-white">Vender e escalar</h2>

            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Cadastre produtos, receba pedidos e cresça com reputação e dados
              reais.
            </p>

            <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/70">
                Você ganha agora
              </div>
              <ul className="mt-2 space-y-1 text-xs text-white/70">
                <li>• Catálogo e pedidos</li>
                <li>• Reputação de loja</li>
                <li>• Base para logística e insights</li>
              </ul>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-white/65">
              {loading === 'MERCHANT' ? (
                <>
                  <Spinner /> Selecionando…
                </>
              ) : (
                <>Entrar como vendedor →</>
              )}
            </div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="mt-10 grid gap-4 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-white">
              Você não está “preso” no papel
            </div>
            <p className="mt-2 text-sm text-white/75">
              Depois você pode adicionar transportadora, fábrica e representante
              quando esses módulos estiverem no fluxo. A identidade inicial só
              define o começo da jornada.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-white/70">Nota do MVP</div>
            <p className="mt-2 text-xs text-white/70">
              Hoje o Marto está estruturando o ciclo central (produto → serviço → avaliação → dados).
              O social do Marto é “útil e baseado em compra real”, não entretenimento genérico.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
