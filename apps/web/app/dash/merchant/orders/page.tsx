// apps/web/app/dash/merchant/orders/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type OrderItem = {
  quantity: number;
  unitPrice: string;
};

type Order = {
  id: string;
  status: string;
  city: string | null;
  state: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

type SalesOk = { ok: true; items: Order[] };
type SalesFail = { ok: false; message?: string; items?: Order[] };
type SalesResponse = SalesOk | SalesFail;

function isOk(res: unknown): res is SalesOk {
  if (!res || typeof res !== 'object') return false;
  const r = res as Record<string, unknown>;
  return r.ok === true && Array.isArray(r.items);
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('pt-BR');
  } catch {
    return dt;
  }
}

function parseBRNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (Number.isNaN(n)) return null;
  return n;
}

function totalLabel(order: Order) {
  const items = Array.isArray(order.items) ? order.items : [];
  let sum = 0;
  for (const it of items) {
    const q = Number(it.quantity ?? 0);
    const up = parseBRNumber(it.unitPrice) ?? 0;
    sum += q * up;
  }
  return sum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type RangeKey = 'ALL' | '7D' | '30D' | '90D';

function parseTime(value?: string | null) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return t;
}

export default function MerchantOrdersListPage() {
  const sp = useSearchParams();
  const debug = sp.get('debug') === '1';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [range, setRange] = useState<RangeKey>('ALL');

  function resetFilters() {
    setQ('');
    setStatus('ALL');
    setRange('ALL');
  }

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
        const res = await fetchJSON<SalesResponse>('/orders/sales', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!alive) return;

        if (!isOk(res)) {
          const msg =
            res && typeof res === 'object'
              ? String((res as Record<string, unknown>).message ?? '')
              : '';
          setError(msg || 'Falha ao carregar vendas.');
          setItems([]);
          return;
        }

        setItems(res.items);

                // ✅ debug no console sempre ajuda a não “ficar no escuro”
        // (não quebra nada em produção)
        console.log('[merchant/orders] sales:', {
          count: res.items.length,
          ids: res.items.map((x) => x.id),
        });

      } catch (e) {
        if (!alive) return;
        const err = e as ApiError;
        setError(err?.message || 'Falha ao carregar vendas.');
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

  // ✅ Se o status selecionado não existir mais (p.ex. depois de reload),
  // volta pra ALL pra não “sumir” tudo.
  useEffect(() => {
    if (status !== 'ALL' && !statuses.includes(status)) {
      setStatus('ALL');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses.join('|')]);

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
        String(o.state ?? '').toLowerCase().includes(qq);

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
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Vendas</h1>
            <p className="text-sm text-white/75">
              Pedidos recebidos • visão do lojista
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dash/merchant"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Voltar
            </Link>
          </div>
        </header>

        <section className="mb-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-white/80">
                Busca (ID/cidade/UF)
              </label>

              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setQ('');
                  }}
                  placeholder="Cole o ID do pedido, cidade ou UF…"
                  className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 pr-10 text-sm text-white placeholder:text-white/65 outline-none focus:border-white/25 focus:ring-2 focus:ring-white/10"
                />

                {q.trim() ? (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white/85 hover:bg-white/15"
                    aria-label="Limpar busca"
                    title="Limpar (Esc)"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="sm:w-56">
              <label className="mb-1 block text-xs font-semibold text-white/80">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white outline-none focus:border-white/25 focus:ring-2 focus:ring-white/10"
              >
                {statuses.map((s) => (
                  <option key={s} value={s} className="bg-neutral-950">
                    {s === 'ALL' ? 'Todos os status' : s}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:w-56">
              <label className="mb-1 block text-xs font-semibold text-white/80">
                Período
              </label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
                className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white outline-none focus:border-white/25 focus:ring-2 focus:ring-white/10"
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
            <div>
              Recebidos:{' '}
              <span className="text-white/85 font-semibold">{items.length}</span>{' '}
              • Após filtros:{' '}
              <span className="text-white/85 font-semibold">
                {sorted.length}
              </span>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/15"
            >
              Resetar filtros
            </button>
          </div>

          {debug ? (
            <div className="mt-3 rounded-xl border border-white/15 bg-black/60 p-3 text-xs text-white/80">
              <div className="font-semibold text-white/90">Debug</div>
              <div className="mt-1 text-white/75">
                IDs: {items.map((x) => x.id).join(', ') || '—'}
              </div>
            </div>
          ) : null}
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Carregando vendas…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-6 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-base font-semibold text-white/90">
              Nenhuma venda encontrada (após filtros).
            </div>

            <div className="mt-2 text-white/70">
              Se “Recebidos” for maior que 0, então algum filtro está escondendo
              tudo. Clique em <span className="text-white/85">Resetar filtros</span>.
            </div>
          </div>
        ) : (
          <section className="grid gap-3">
            {sorted.map((o) => (
              <article
                key={o.id}
                className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-neutral-950/80"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">
                      Pedido • <span className="text-white/80">{o.status}</span>
                    </div>

                    <div className="mt-2 grid gap-1 text-sm text-white/80">
                      <div className="truncate">
                        <span className="text-white/70">ID:</span>{' '}
                        <span className="font-mono text-white/90">{o.id}</span>
                      </div>

                      <div>
                        <span className="text-white/70">Cidade/UF:</span>{' '}
                        {(o.city ?? '—') + ' / ' + (o.state ?? '—')}
                      </div>

                      <div>
                        <span className="text-white/70">Criado:</span>{' '}
                        {fmt(o.createdAt)}
                      </div>

                      <div>
                        <span className="text-white/70">Total:</span>{' '}
                        <span className="text-white/90">{totalLabel(o)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/dash/merchant/orders/${o.id}`}
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                    >
                      Ver timeline
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
