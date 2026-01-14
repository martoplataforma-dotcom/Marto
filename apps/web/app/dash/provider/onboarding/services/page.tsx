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
    <span className="rounded-full border bg-neutral-50 px-2 py-1 text-[11px] text-neutral-700">
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
        'w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition',
        'hover:shadow-md',
        selected ? 'border-neutral-900' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-neutral-900">
              {item.title}
            </div>
            {item.badge ? <Badge>{item.badge}</Badge> : null}
            <Badge>{item.category}</Badge>
          </div>
          <p className="mt-1 text-xs text-neutral-600">{item.desc}</p>
        </div>

        <span className="shrink-0 rounded-full border bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
          {selected ? '✓' : '+'}
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
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="rounded-full border bg-white px-2 py-1">Etapa 2/2</span>
            <span className="rounded-full border bg-white px-2 py-1">Serviços</span>
          </div>

          <h1 className="mt-3 text-2xl font-semibold">Selecione suas especialidades</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Isso define seu painel e melhora o match com pedidos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dash/provider/profile"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Voltar
          </Link>
          <Link
            href="/dash/provider/profile"
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Meu perfil
          </Link>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">{count}</span>{' '}
            selecionada(s)
            <span className="mx-2 text-neutral-300">•</span>
            <span className="text-neutral-600">Você pode ajustar depois.</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={skip}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
              disabled={busy}
            >
              Pular
            </button>
            <button
              type="button"
              onClick={continueFlow}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={busy}
            >
              {busy ? 'Salvando…' : 'Continuar →'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar especialidade…"
            className="w-full rounded-xl border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
          />
        </div>
      </section>

      <section className="grid gap-6">
        {groups.map(([cat, list]) => {
          if (!list.length) return null;
          return (
            <div key={cat}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">{cat}</div>
                <div className="text-xs text-neutral-500">{list.length} opções</div>
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
    </main>
  );
}
