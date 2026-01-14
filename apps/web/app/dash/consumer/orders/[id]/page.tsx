'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
};

type OrderEvent = {
  id: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  message?: string | null;
  meta?: unknown;
  createdAt: string;
};

type Order = {
  id: string;
  status: string;
  merchantId: string;
  userId: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
};

type MyOrdersOk = { ok: true; items: Order[] };
type MyOrdersFail = { ok: false; message?: string; items?: Order[] };
type MyOrdersResponse = MyOrdersOk | MyOrdersFail;

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('pt-BR');
  } catch {
    return dt;
  }
}

function badgeClass(status: string) {
  const s = String(status || '').toUpperCase();
  if (s.includes('CANCEL'))
    return 'bg-red-500/15 text-red-100 border-red-500/25';
  if (s.includes('RETURN') || s.includes('DISPUTE'))
    return 'bg-amber-500/15 text-amber-100 border-amber-500/25';
  if (s.includes('DELIVER'))
    return 'bg-emerald-500/15 text-emerald-100 border-emerald-500/25';
  if (s.includes('TRANSIT'))
    return 'bg-sky-500/15 text-sky-100 border-sky-500/25';
  if (s.includes('PAID') || s.includes('CONFIRM'))
    return 'bg-violet-500/15 text-violet-100 border-violet-500/25';
  return 'bg-white/10 text-white/90 border-white/15';
}

function isOrdersOk(res: unknown): res is MyOrdersOk {
  if (!res || typeof res !== 'object') return false;
  const r = res as Record<string, unknown>;
  return r.ok === true && Array.isArray(r.items);
}

function errorMessageFromRes(res: unknown): string {
  if (!res || typeof res !== 'object') return 'Falha ao carregar pedidos';
  const r = res as Record<string, unknown>;
  const msg = r.message;
  return typeof msg === 'string' && msg.trim()
    ? msg
    : 'Falha ao carregar pedidos';
}

export default function ConsumerOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = String(id ?? '');

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        const token = getToken();
        if (!token) throw new Error('Sem token. Faça login novamente.');

        // ✅ Sem /api aqui (seu fetchJSON/rewrites já cuidam disso)
        const res = await fetchJSON<MyOrdersResponse>('/orders/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!alive) return;

        if (!isOrdersOk(res)) {
          throw new Error(errorMessageFromRes(res));
        }

        const found = res.items.find((o) => String(o.id) === orderId) ?? null;
        setOrder(found);
      } catch (e) {
        const ae = e as ApiError;
        setErr(ae?.message || 'Erro ao carregar');
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [orderId]);

  const events = useMemo(() => {
    const list = order?.events ? [...order.events] : [];
    list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return list;
  }, [order?.events]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto (sutil) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Pedido</h1>
            <p className="text-sm text-white/75">
              Linha do tempo Marto • Transparência total do que aconteceu
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dash/consumer/orders"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              Voltar
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Carregando…
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {err}
          </div>
        ) : !order ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Pedido não encontrado em /orders/me.
          </div>
        ) : (
          <section className="grid gap-4 lg:grid-cols-3">
            {/* Card resumo */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white/75">ID</div>
                  <div className="break-all text-sm font-medium text-white/95">
                    {order.id}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                    order.status,
                  )}`}
                >
                  {order.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Cidade/UF</span>
                  <span className="text-white/95">
                    {(order.city ?? '—') + ' / ' + (order.state ?? '—')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Criado</span>
                  <span className="text-white/95">{fmt(order.createdAt)}</span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Atualizado</span>
                  <span className="text-white/95">{fmt(order.updatedAt)}</span>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white/15 bg-black/80 p-4">
                <div className="mb-2 text-sm font-semibold text-white">
                  Itens
                </div>
                <div className="space-y-2 text-sm text-white/80">
                  {order.items?.length ? (
                    order.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 truncate">
                          <span className="text-white/95">{it.productId}</span>
                          <span className="text-white/70"> × {it.quantity}</span>
                        </div>
                        <div className="shrink-0 text-white/95">
                          R$ {it.unitPrice}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/75">Sem itens.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Timeline</h2>
                  <p className="text-sm text-white/75">
                    Cada mudança vira um evento — reputação e verdade.
                  </p>
                </div>
              </div>

              {!events.length ? (
                <div className="text-sm text-white/80">Sem eventos ainda.</div>
              ) : (
                <ol className="space-y-3">
                  {events.map((ev, idx) => {
                    const to = String(ev.toStatus ?? ev.type ?? '').toUpperCase();
                    return (
                      <li
                        key={ev.id}
                        className="group rounded-xl border border-white/15 bg-black/80 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                                  to,
                                )}`}
                              >
                                {ev.toStatus ?? ev.type}
                              </span>
                              <span className="text-xs text-white/70">
                                {fmt(ev.createdAt)}
                              </span>
                            </div>

                            <div className="mt-2 text-sm text-white/85">
                              {ev.message ? (
                                <span className="text-white/95">
                                  {ev.message}
                                </span>
                              ) : (
                                <span className="text-white/75">
                                  Evento registrado pelo Marto.
                                </span>
                              )}
                            </div>

                            <div className="mt-2 text-xs text-white/70">
                              {ev.actorRole ? (
                                <span>
                                  Ação:{' '}
                                  <span className="text-white/85">
                                    {ev.actorRole}
                                  </span>
                                </span>
                              ) : (
                                <span>—</span>
                              )}

                              {ev.fromStatus || ev.toStatus ? (
                                <span className="ml-2">
                                  <span className="text-white/55">•</span>{' '}
                                  {ev.fromStatus ? `de ${ev.fromStatus}` : ''}
                                  {ev.toStatus ? ` → ${ev.toStatus}` : ''}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-xs text-white/45">{idx + 1}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
