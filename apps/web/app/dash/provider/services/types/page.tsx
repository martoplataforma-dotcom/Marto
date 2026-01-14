'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'marto_provider_delivery_types_v1';
const LOCAL_EVENT = 'marto_storage';

// ✅ controla 1ª renderização no client (pra bater com SSR)
let didHydrateClient = false;

type DeliveryType = {
  key: string;
  title: string;
  desc: string;
  badge?: 'Alta demanda' | 'Premium' | 'Rápido';
};

const TYPES: DeliveryType[] = [
  {
    key: 'express',
    title: 'Entrega expressa',
    desc: 'Rápida, para quem quer receber logo. Ideal para rotas curtas.',
    badge: 'Rápido',
  },
  {
    key: 'scheduled',
    title: 'Entrega agendada',
    desc: 'Cliente escolhe janela. Você roda com previsibilidade.',
    badge: 'Premium',
  },
  {
    key: 'store_pickup',
    title: 'Retirada na loja',
    desc: 'Você faz apenas a retirada/transferência a partir da loja.',
    badge: 'Alta demanda',
  },
  {
    key: 'pickup_and_drop',
    title: 'Coleta + entrega',
    desc: 'Você coleta no ponto A e entrega no ponto B (rota completa).',
    badge: 'Alta demanda',
  },
];

function parseSelectedRaw(raw: string): string[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x)).filter(Boolean);
  } catch {
    return [];
  }
}

function subscribeStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) callback();
  };
  const onLocal = () => callback();

  window.addEventListener('storage', onStorage);
  window.addEventListener(LOCAL_EVENT, onLocal);

  // ✅ depois do mount, “libera” leitura real e força 1 re-render
  if (!didHydrateClient) {
    didHydrateClient = true;
    queueMicrotask(() => callback());
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(LOCAL_EVENT, onLocal);
  };
}

function getSnapshotRaw(): string {
  // ✅ SSR: sempre vazio
  if (typeof window === 'undefined') return '';

  // ✅ 1º render do client (hidratação): vazio (igual SSR) => sem mismatch
  if (!didHydrateClient) return '';

  // ✅ depois do mount: lê de verdade
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeSelected(next: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // ✅ atualiza na mesma aba
    window.dispatchEvent(new Event(LOCAL_EVENT));
  } catch {
    // silencioso
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/70">
      {children}
    </span>
  );
}

function Row({
  item,
  selected,
  onToggle,
}: {
  item: DeliveryType;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left shadow-sm backdrop-blur transition',
        'hover:bg-white/10',
        selected ? 'ring-1 ring-white/20' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">{item.title}</div>
            <Tag>Entrega</Tag>
            {item.badge ? <Badge>{item.badge}</Badge> : null}
          </div>
          <p className="mt-2 text-sm text-white/65">{item.desc}</p>
        </div>

        <span
          className={[
            'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
            selected
              ? 'border-white/15 bg-white text-black'
              : 'border-white/10 bg-black/20 text-white/75',
          ].join(' ')}
        >
          {selected ? '✓ Selecionado' : '+ Adicionar'}
        </span>
      </div>
    </button>
  );
}

const INPUT =
  'w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30';

export default function ProviderDeliveryTypesPage() {
  // ✅ estado vem do storage sem useEffect e sem mismatch
  const raw = useSyncExternalStore(subscribeStorage, getSnapshotRaw, () => '');
  const selected = useMemo(() => parseSelectedRaw(raw), [raw]);

  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? TYPES
      : TYPES.filter((t) => {
          const hay = `${t.title} ${t.desc} ${t.key}`.toLowerCase();
          return hay.includes(q);
        });

    return [...list].sort((a, b) => {
      const as = selected.includes(a.key) ? 1 : 0;
      const bs = selected.includes(b.key) ? 1 : 0;
      return bs - as;
    });
  }, [query, selected]);

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((x) => x !== key)
      : [...selected, key];
    writeSelected(next);
  }

  function save() {
    // “Salvar” = confirmar (já está no storage)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
      window.dispatchEvent(new Event(LOCAL_EVENT));
      setToast('Tipos salvos.');
      window.setTimeout(() => setToast(null), 1500);
    } catch {
      setToast('Não foi possível salvar no navegador.');
      window.setTimeout(() => setToast(null), 2200);
    }
  }

  function clearAll() {
    writeSelected([]);
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-white">
      {/* grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      {/* glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[56rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
              Provider • Operação
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Tipos de entrega
            </h1>

            <p className="mt-2 text-sm text-white/65">
              Isso define o que você aceita operar. No Marto, clareza vira{' '}
              <span className="font-semibold text-white">match melhor</span> — e
              match melhor vira reputação.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>Selecionados: {selected.length}</Badge>
              <Badge>Salvo localmente</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dash/provider/services"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              ← Voltar para Central
            </Link>

            <button
              type="button"
              onClick={clearAll}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Limpar
            </button>

            <button
              type="button"
              onClick={save}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Salvar
            </button>
          </div>
        </header>

        {toast ? (
          <div className="mb-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/85 shadow-sm backdrop-blur">
            {toast}
          </div>
        ) : null}

        <section className="mb-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <div className="text-sm font-semibold text-white">Buscar</div>
          <p className="mt-1 text-sm text-white/65">
            Filtre por “expressa”, “agendada”, “retirada”…
          </p>

          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tipo de entrega…"
              className={INPUT}
            />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {filtered.map((item) => (
            <Row
              key={item.key}
              item={item}
              selected={selected.includes(item.key)}
              onToggle={() => toggle(item.key)}
            />
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <div className="text-sm font-semibold text-white">Toque Marto</div>
          <p className="mt-2 text-sm text-white/65">
            Quando você define seus tipos de entrega, o Marto consegue montar
            pedidos com{' '}
            <span className="font-semibold text-white">promessa realista</span>.
            Promessa cumprida = reputação.
          </p>
        </section>
      </div>
    </main>
  );
}
