// apps/web/app/dash/consumer/orders/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type OrderItem = {
  // lista pode vir com shape “leve” ou “completo”
  title?: string | null;
  qty?: number | null;

  // shape real do detalhe (backend)
  quantity?: number | null;
  unitPrice?: string | null;

  // se existir num futuro
  priceCents?: number | null;
};

type Order = {
  id: string;
  status: string;
  city?: string | null;
  uf?: string | null;

  // backend usa "state" no detalhe; deixo os dois
  state?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;

  // total opcional (se algum endpoint mandar)
  totalCents?: number | null;

  items?: OrderItem[];
};

type MyOrdersResponse = {
  ok: boolean;
  items: Order[];
};

function formatMoneyBRLFromCents(cents?: number | null) {
  const v = Number(cents ?? 0) / 100;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMoneyBRLFromNumber(value: number) {
  const v = Number(value ?? 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTimeBR(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function niceCityUF(o: Order) {
  const city = String(o.city ?? '').trim();
  const uf = String(o.uf ?? o.state ?? '').trim();
  if (!city && !uf) return '—';
  return `${city.toUpperCase()}${uf ? ` / ${uf.toUpperCase()}` : ''}`;
}

function StatusPill({ status }: { status: string }) {
  const s = String(status || '—');
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
      <span className="text-white/90">{s}</span>
    </span>
  );
}

function parseTime(value?: string | null) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return t;
}

// converte "500" / "500.00" / "500,00" → número
function parseBRNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // se vier "500,00" (pt-BR) converte pra ponto
  const normalized = s.replace(/\./g, '').replace(',', '.'); // remove milhar e troca vírgula por ponto
  const n = Number(normalized);
  if (Number.isNaN(n)) return null;
  return n;
}

// total preferencial: totalCents → senão soma items (quantity * unitPrice)
function computeTotal(order: Order): { ok: boolean; label: string } {
  if (
    typeof order.totalCents === 'number' &&
    Number.isFinite(order.totalCents)
  ) {
    return { ok: true, label: formatMoneyBRLFromCents(order.totalCents) };
  }

  const items = Array.isArray(order.items) ? order.items : null;
  if (!items || items.length === 0) return { ok: false, label: '—' };

  let sum = 0;
  let hasAny = false;

  for (const it of items) {
    const q =
      typeof it.quantity === 'number'
        ? it.quantity
        : typeof it.qty === 'number'
          ? it.qty
          : null;

    if (!q || q <= 0) continue;

    if (
      typeof it.priceCents === 'number' &&
      Number.isFinite(it.priceCents)
    ) {
      sum += (it.priceCents / 100) * q;
      hasAny = true;
      continue;
    }

    const up = parseBRNumber(it.unitPrice);
    if (up === null) continue;

    sum += up * q;
    hasAny = true;
  }

  if (!hasAny) return { ok: false, label: '—' };
  return { ok: true, label: formatMoneyBRLFromNumber(sum) };
}

type RangeKey = 'ALL' | '7D' | '30D' | '90D';

export default function ConsumerOrdersListPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [range, setRange] = useState<RangeKey>('ALL');

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        if (!alive) return;
        setItems([]);
        setError('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetchJSON<MyOrdersResponse>('/orders/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!alive) return;
        setItems(Array.isArray(res?.items) ? res.items : []);
      } catch (e) {
        if (!alive) return;
        const err = e as ApiError;
        setError(err?.message || 'Falha ao carregar pedidos.');
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const o of items) {
      if (o?.status) s.add(String(o.status));
    }
    return ['ALL', ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const days =
      range === '7D' ? 7 : range === '30D' ? 30 : range === '90D' ? 90 : null;

    const minTime = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;

    return items.filter((o) => {
      const okStatus = status === 'ALL' ? true : String(o.status) === status;

      const okQ =
        !qq ||
        String(o.id ?? '').toLowerCase().includes(qq) ||
        String(o.city ?? '').toLowerCase().includes(qq) ||
        String(o.uf ?? o.state ?? '').toLowerCase().includes(qq);

      const t = parseTime(o.createdAt);
      const okRange = minTime ? (t ? t >= minTime : false) : true;

      return okStatus && okQ && okRange;
    });
  }, [items, q, status, range]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const ta = parseTime(a.createdAt) ?? 0;
      const tb = parseTime(b.createdAt) ?? 0;
      return tb - ta;
    });
    return copy;
  }, [filtered]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto (sutil) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Meus pedidos</h1>
            <p className="text-sm text-white/75">
              Linha do tempo Marto • Transparência total do que aconteceu
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dash/consumer"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              Voltar
            </Link>
          </div>
        </header>

        {/* filtros */}
        <section className="mb-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-white/80">
                Busca
              </label>

              {/* ✅ (1) input de busca trocado pelo bloco com Limpar + Esc */}
              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setQ('');
                  }}
                  placeholder="Cole o ID do pedido, cidade ou UF…"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 pr-10 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />

                {q.trim() ? (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
                    aria-label="Limpar busca"
                    title="Limpar (Esc)"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="sm:w-56">
              <label className="mb-1 block text-xs font-medium text-white/80">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10"
              >
                {statuses.map((s) => (
                  <option key={s} value={s} className="bg-neutral-950">
                    {s === 'ALL' ? 'Todos os status' : s}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:w-56">
              <label className="mb-1 block text-xs font-medium text-white/80">
                Período
              </label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
                className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10"
              >
                <option value="ALL" className="bg-neutral-950">
                  Todos
                </option>
                <option value="7D" className="bg-neutral-950">
                  Últimos 7 dias
                </option>
                <option value="30D" className="bg-neutral-950">
                  Últimos 30 dias
                </option>
                <option value="90D" className="bg-neutral-950">
                  Últimos 90 dias
                </option>
              </select>
            </div>
          </div>

          <div className="mt-3 text-xs text-white/70">
            Mostrando <span className="text-white/95">{sorted.length}</span> de{' '}
            <span className="text-white/95">{items.length}</span>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Carregando pedidos…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Nenhum pedido encontrado.
          </div>
        ) : (
          <section className="grid gap-3">
            {sorted.map((o) => {
              const firstItem =
                Array.isArray(o.items) && o.items.length > 0 ? o.items[0] : null;

              const labelItem = firstItem?.title
                ? `${firstItem.title}${typeof firstItem.qty === 'number' ? ` × ${firstItem.qty}` : ''}`
                : firstItem
                  ? `Item${(firstItem.quantity ?? 0) ? ` × ${firstItem.quantity}` : ''}`
                  : 'Itens';

              const total = computeTotal(o).label;

              return (
                <article
                  key={o.id}
                  className="group rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:border-white/25 hover:bg-neutral-950/85"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white">
                          Pedido
                        </div>
                        <StatusPill status={String(o.status ?? '—')} />
                      </div>

                      <div className="mt-2 grid gap-1 text-sm text-white/85">
                        <div className="truncate">
                          <span className="text-white/65">ID:</span>{' '}
                          <span className="font-mono text-white/95">{o.id}</span>
                        </div>

                        <div>
                          <span className="text-white/65">Cidade/UF:</span>{' '}
                          <span className="text-white/95">{niceCityUF(o)}</span>
                        </div>

                        <div>
                          <span className="text-white/65">Criado:</span>{' '}
                          <span className="text-white/95">
                            {formatDateTimeBR(o.createdAt)}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/65">Atualizado:</span>{' '}
                          <span className="text-white/95">
                            {formatDateTimeBR(o.updatedAt)}
                          </span>
                        </div>

                        <div className="truncate">
                          <span className="text-white/65">Itens:</span>{' '}
                          <span className="text-white/95">{labelItem}</span>
                        </div>

                        <div>
                          <span className="text-white/65">Total:</span>{' '}
                          <span className="text-white">{total}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={`/dash/consumer/orders/${o.id}`}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
                      >
                        Ver timeline
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 h-px w-full bg-white/10" />

                  <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                    <span>Reputação e verdade: cada mudança vira um evento.</span>
                    <span className="opacity-0 transition group-hover:opacity-100">
                      Abrir → Timeline
                    </span>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
