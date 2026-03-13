'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJSON, type ApiError } from '../../../../../src/lib/api';

type Specialty = {
  key: string;
  title: string;
  desc: string;
  category: 'Essenciais' | 'Técnico' | 'Casa' | 'Plus';
  badge?: 'Alta demanda' | 'Premium' | 'Rápido';
};

const SPECIALTIES: Specialty[] = [
  {
    key: 'assembly',
    title: 'Montagem',
    desc: 'Montagem de móveis e kits.',
    category: 'Essenciais',
    badge: 'Alta demanda',
  },
  {
    key: 'installation',
    title: 'Instalação',
    desc: 'Fixação, instalação e ajustes.',
    category: 'Essenciais',
    badge: 'Alta demanda',
  },
  {
    key: 'maintenance',
    title: 'Manutenção',
    desc: 'Correções, reforços e troca de peças.',
    category: 'Essenciais',
    badge: 'Rápido',
  },
  {
    key: 'delivery',
    title: 'Entregador',
    desc: 'Coleta e entrega local/rápida vinculada aos pedidos.',
    category: 'Essenciais',
    badge: 'Alta demanda',
  },
  {
    key: 'technical_visit',
    title: 'Visita técnica',
    desc: 'Diagnóstico e orçamento.',
    category: 'Técnico',
    badge: 'Rápido',
  },
  {
    key: 'electrical',
    title: 'Elétrica',
    desc: 'Pontos, luminárias e tomadas.',
    category: 'Casa',
    badge: 'Alta demanda',
  },
  {
    key: 'hydraulic',
    title: 'Hidráulica',
    desc: 'Conexões, ajustes e vazamentos.',
    category: 'Casa',
    badge: 'Alta demanda',
  },
  {
    key: 'carpentry',
    title: 'Marcenaria',
    desc: 'Ajustes, cortes e sob medida.',
    category: 'Plus',
    badge: 'Premium',
  },
  {
    key: 'upholstery',
    title: 'Estofaria',
    desc: 'Reparos e ajustes em estofados.',
    category: 'Plus',
    badge: 'Premium',
  },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/75">
      {children}
    </span>
  );
}

function Row({
  item,
  selected,
  onToggle,
}: {
  item: Specialty;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'w-full rounded-3xl border p-5 text-left shadow-sm backdrop-blur transition',
        'bg-neutral-950/70 border-white/10 hover:bg-white/5',
        selected ? 'ring-1 ring-white/25 border-white/20' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">
              {item.title}
            </div>

            {item.badge ? <Badge>{item.badge}</Badge> : null}

            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/60">
              {item.category}
            </span>
          </div>

          <p className="mt-2 text-sm text-white/65">
            {item.desc}
          </p>
        </div>

        <span
          className={[
            'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
            selected
              ? 'border-white/15 bg-white text-black'
              : 'border-white/10 bg-black/30 text-white/70',
          ].join(' ')}
        >
          {selected ? '✓ Selecionado' : '+ Adicionar'}
        </span>
      </div>
    </button>
  );
}

type SaveSpecialtiesResponse =
  | { ok: true; serviceProvider?: unknown }
  | { ok: false; message?: string };

export default function ProviderServicesOnboardingPage() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = selected.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? SPECIALTIES
      : SPECIALTIES.filter((s) => {
          const hay = `${s.title} ${s.desc} ${s.category} ${s.key}`.toLowerCase();
          return hay.includes(q);
        });

    // selecionadas primeiro
    return [...list].sort((a, b) => {
      const as = selected.includes(a.key) ? 1 : 0;
      const bs = selected.includes(b.key) ? 1 : 0;
      return bs - as;
    });
  }, [query, selected]);

  const groups = useMemo(() => {
    const order: Specialty['category'][] = ['Essenciais', 'Técnico', 'Casa', 'Plus'];
    const g = new Map<Specialty['category'], Specialty[]>();
    for (const c of order) g.set(c, []);
    for (const item of filtered) g.get(item.category)?.push(item);
    return order.map((c) => [c, g.get(c) ?? []] as const);
  }, [filtered]);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  async function continueFlow() {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      // ✅ PASSO ÚNICO: persistir no backend (decidido pra sempre)
      const res = await fetchJSON<SaveSpecialtiesResponse>(
  '/service-providers/me/specialties',
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ specialties: selected }),
  },
);


      if (!res || (typeof res === 'object' && 'ok' in res && res.ok === false)) {
        const msg =
          (res as { message?: string } | null)?.message ||
          'Falha ao salvar especialidades.';
        setError(msg);
        return;
      }


      // ✅ regra: entregador decidido -> profile
      // ✅ prestador genérico -> central de serviços
      router.replace('/dash/provider/services');
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2?.message || 'Erro inesperado ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    // pular -> vai pro profile (mas sem specialties salvas)
    router.replace('/dash/provider/profile');
  }

  return (
    <main className="relative min-h-screen bg-neutral-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[56rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              <span className="h-2 w-2 rounded-full bg-white/80" />
              Provider • Ativação inicial
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Selecione suas especialidades
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-[15px]">
              Essa escolha define a base do seu painel no Marto. Quanto mais
              clara sua atuação, melhor o match com pedidos, promessas e
              reputação operacional.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge>Etapa 2/2</Badge>
              <Badge>Selecionadas: {count}</Badge>
              <Badge>Você pode ajustar depois</Badge>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={skip}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                Pular por agora
              </button>

              <button
                type="button"
                onClick={continueFlow}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                disabled={busy}
              >
                {busy ? 'Salvando…' : 'Salvar e continuar →'}
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Leitura Marto
            </div>

            <div className="mt-3 text-xl font-semibold text-white">
              Seu papel precisa nascer com identidade
            </div>

            <p className="mt-2 text-sm leading-6 text-white/72">
              No Marto, prestador não entra como genérico. Primeiro definimos
              sua especialidade. Depois montamos a central operacional certa
              para agenda, região, SLA e próximos módulos.
            </p>

            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/55">Estado atual</div>
              <div className="mt-1 text-3xl font-semibold text-white">
                {count}
              </div>
              <div className="mt-1 text-xs text-white/55">
                {count === 0
                  ? 'Nenhuma especialidade definida'
                  : 'Especialidade(s) em definição'}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dash/provider/profile"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Meu perfil
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-5 rounded-[2rem] border border-white/10 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Buscar especialidade</div>
              <p className="mt-1 text-sm text-white/65">
                Filtre por montagem, entrega, instalação, elétrica…
              </p>
            </div>

            <div className="text-xs text-white/55">
              Base do Provider • seleção inicial
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar especialidade…"
              className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
            />
          </div>
        </section>

        <section className="grid gap-6">
          {groups.map(([cat, list]) => {
            if (!list.length) return null;
            return (
              <div key={cat} className="rounded-[2rem] border border-white/10 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">{cat}</div>
                  <div className="text-xs text-white/55">{list.length} opções</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((item) => (
                    <Row
                      key={item.key}
                      item={item}
                      selected={selected.includes(item.key)}
                      onToggle={() => toggle(item.key)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
