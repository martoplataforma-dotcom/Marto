// apps/web/app/dash/consumer/orders/[id]/page.tsx
'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState, type ReactNode } from 'react';
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

type ShipmentEvent = {
  id: string;
  shipmentId: string;
  status: string;
  description?: string | null;
  createdAt: string;
};

type Shipment = {
  id: string;
  orderId: string;
  status: string;
  transporterId?: string | null;
  events?: ShipmentEvent[];
  review?: {
    id: string;
    shipmentId: string;
    rating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
    comment?: string | null;
    createdAt: string;
  } | null;
};

type MyOrdersOk = { ok: true; items: Order[] };
type MyOrdersFail = { ok: false; message?: string; items?: Order[] };
type MyOrdersResponse = MyOrdersOk | MyOrdersFail;

type SetStatusOk = { ok: true; order: unknown };
type SetStatusFail = { ok: false; message?: string };
type SetStatusResponse = SetStatusOk | SetStatusFail;

type OrderStatus =
  | 'CREATED'
  | 'PAID'
  | 'CONFIRMED_BY_SELLER'
  | 'READY_FOR_PICKUP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | string;

type PayMode = 'PAYMENTS_MOCK' | 'DIRECT_PAID';

// ✅ troque aqui conforme seu backend hoje
const PAY_MODE: PayMode = 'PAYMENTS_MOCK';
// const PAY_MODE: PayMode = 'DIRECT_PAID';

function buyerActionsAllowed(status: OrderStatus) {
  const s = String(status ?? '').toUpperCase();

  // ajuste aqui se sua regra permitir cancelar em PAID
  const canCancel = s === 'CREATED' || s === 'PAID';

  return {
    canPay: s === 'CREATED',
    canCancel,
    canReturn: s === 'DELIVERED',
    isReturnRequested: s === 'RETURN_REQUESTED',
    isCompleted: s === 'COMPLETED',
  };
}

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

// ✅ NOVO: label PT-BR para status
function statusLabelPT(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'CREATED') return 'Criado';
  if (s === 'PAID') return 'Pago';
  if (s === 'CONFIRMED_BY_SELLER') return 'Confirmado pelo vendedor';
  if (s === 'READY_FOR_PICKUP') return 'Pronto para coleta';
  if (s === 'IN_TRANSIT') return 'Em trânsito';
  if (s === 'DELIVERED') return 'Entregue';
  if (s === 'COMPLETED') return 'Concluído';
  if (s === 'CANCELLED') return 'Cancelado';
  if (s === 'RETURN_REQUESTED') return 'Devolução solicitada';
  return s;
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

type ApiFailShape = { ok: false; message?: string };

function isApiFailShape(x: unknown): x is ApiFailShape {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return r.ok === false;
}

async function postOrderStatus(
  orderId: string,
  toStatus: string,
  message?: string,
) {
  const token = getToken();
  if (!token) throw new Error('Sem token. Faça login novamente.');

  const data = await fetchJSON<SetStatusResponse>(`/orders/${orderId}/status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ toStatus, message: message || undefined }),
  });

  if (isApiFailShape(data)) {
    throw new Error(
      typeof data.message === 'string' && data.message.trim()
        ? data.message
        : 'Falha ao atualizar status',
    );
  }

  return data;
}

async function postMockPayment(orderId: string) {
  const token = getToken();
  if (!token) throw new Error('Sem token. Faça login novamente.');

  const res = await fetch(`/api/payments/mock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      data && typeof data === 'object'
        ? (data as Record<string, unknown>).message ??
          (data as Record<string, unknown>).error
        : null;

    throw new Error(
      typeof msg === 'string' && msg.trim()
        ? msg
        : `Falha ao pagar (${res.status})`,
    );
  }

  return data;
}

function Btn({
  tone,
  disabled,
  children,
  onClick,
  title,
}: {
  tone: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const base = 'rounded-xl px-3 py-2 text-sm font-semibold transition border';
  const styles =
    tone === 'primary'
      ? 'border-white/15 bg-white text-black hover:opacity-90'
      : tone === 'danger'
        ? 'border-red-500/25 bg-red-500/10 text-red-100 hover:bg-red-500/15'
        : 'border-white/15 bg-white/10 text-white hover:bg-white/15';

  return (
    <button
      type="button"
      className={`${base} ${styles} ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
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

  const [toast, setToast] = useState<string>('');

  const [shipment, setShipment] = useState<Shipment | null>(null);

  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string>('');

  const [showCancelModal, setShowCancelModal] = useState(false);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const [actionLoading, setActionLoading] = useState<
    null | 'CANCEL' | 'PAY' | 'RETURN'
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // ✅ NOVO: ids vizinhos (front-only)
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);

  function reviewStarsLabel(
    rating: Shipment['review'] extends infer R
      ? R extends { rating: infer T }
        ? T
        : never
      : never,
  ) {
    const v = String(rating ?? '').toUpperCase();
    if (v === 'ONE') return '1';
    if (v === 'TWO') return '2';
    if (v === 'THREE') return '3';
    if (v === 'FOUR') return '4';
    if (v === 'FIVE') return '5';
    return '—';
  }

  async function submitShipmentReview() {
    if (!shipment?.id) return;

    if (shipment.review) {
      setReviewMsg('Este shipment já foi avaliado.');
      return;
    }

    setReviewLoading(true);
    setReviewMsg('');
    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      await fetchJSON(
        `/logistics/shipments/${encodeURIComponent(shipment.id)}/review`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rating: reviewRating, // 1..5
            comment: reviewComment?.trim() || undefined,
          }),
        },
      );

      setReviewMsg('✅ Avaliação enviada.');
      setReloadTick((t) => t + 1); // ✅ recarrega e traz shipment.review
    } catch (e) {
      setReviewMsg(e instanceof Error ? e.message : 'Erro ao enviar avaliação');
    } finally {
      setReviewLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      const res = await fetchJSON<MyOrdersResponse>('/orders/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!isOrdersOk(res)) throw new Error(errorMessageFromRes(res));

      const found = res.items.find((o) => String(o.id) === orderId) ?? null;
      setOrder(found);

      // ✅ NOVO: ordena e calcula prev/next (createdAt desc)
      const sorted = [...res.items].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      );
      const idx = sorted.findIndex((o) => String(o.id) === orderId);

      setPrevId(idx > 0 ? String(sorted[idx - 1]?.id ?? '') || null : null);
      setNextId(
        idx >= 0 && idx < sorted.length - 1
          ? String(sorted[idx + 1]?.id ?? '') || null
          : null,
      );

      if (found?.id) {
        try {
          const shRaw = await fetchJSON<unknown>(
            `/logistics/shipments/by-order/${encodeURIComponent(found.id)}`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          const sh =
            shRaw &&
            typeof shRaw === 'object' &&
            'ok' in shRaw &&
            (shRaw as Record<string, unknown>).ok === true &&
            'shipment' in shRaw
              ? ((shRaw as Record<string, unknown>).shipment as Shipment | null)
              : (shRaw as Shipment | null);

          setShipment(sh ?? null);
        } catch {
          setShipment(null);
        }
      } else {
        setShipment(null);
      }
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae?.message || 'Erro ao carregar');
      setOrder(null);
      setShipment(null);
      setPrevId(null);
      setNextId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, reloadTick]);

  // ✅ Timeline unificada (ORDER + SHIPMENT)
  type UnifiedEvent = {
    key: string;
    source: 'ORDER' | 'SHIPMENT';
    title: string;
    desc?: string | null;
    createdAt: string;
  };

  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    const list: UnifiedEvent[] = [];

    // Order events
    for (const ev of order?.events ?? []) {
      list.push({
        key: `order:${ev.id}`,
        source: 'ORDER',
        title:
          ev.fromStatus && ev.toStatus
            ? `${ev.fromStatus} → ${ev.toStatus}`
            : String(ev.toStatus ?? ev.type ?? 'EVENT'),
        desc:
          ev.message ??
          `Ação: ${(ev.actorRole ?? '—').toString().toLowerCase()} de ${
            ev.fromStatus ?? '—'
          } → ${ev.toStatus ?? '—'}`,
        createdAt: ev.createdAt,
      });
    }

    // Shipment events
    for (const sev of shipment?.events ?? []) {
      list.push({
        key: `ship:${sev.id}`,
        source: 'SHIPMENT',
        title: String(sev.status ?? 'SHIPMENT_EVENT'),
        desc: sev.description ?? null,
        createdAt: sev.createdAt,
      });
    }

    list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return list;
  }, [order?.events, shipment?.events]);

  const status = (order?.status ?? '') as OrderStatus;
  const allow = buyerActionsAllowed(status);

  async function doSetStatus(toStatus: string, message?: string) {
    if (!orderId) return;

    setToast('');
    try {
      await postOrderStatus(orderId, toStatus, message);
      setToast(`Status atualizado → ${toStatus}`);
      setReloadTick((t) => t + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao atualizar status.';
      setToast(msg);
    }
  }

  async function confirmCancel() {
    if (!order?.id) return;

    setActionError(null);
    setActionLoading('CANCEL');

    try {
      await postOrderStatus(order.id, 'CANCELLED');
      setShowCancelModal(false);
      setReloadTick((t) => t + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao cancelar');
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmPay() {
    if (!order?.id) return;

    setActionError(null);
    setActionLoading('PAY');

    try {
      if (PAY_MODE === 'PAYMENTS_MOCK') {
        await postMockPayment(order.id);
      } else {
        await postOrderStatus(order.id, 'PAID');
      }

      setReloadTick((t) => t + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao pagar');
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmReturn() {
    if (!order?.id) return;

    setActionError(null);
    setActionLoading('RETURN');

    try {
      await postOrderStatus(
        order.id,
        'RETURN_REQUESTED',
        returnReason?.trim() ? returnReason.trim() : undefined,
      );

      setShowReturnModal(false);
      setReturnReason('');
      setReloadTick((t) => t + 1);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Erro ao pedir devolução',
      );
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Pedido</h1>
            <p className="text-sm text-white/75">
              Linha do tempo Marto • Transparência total do que aconteceu
            </p>
          </div>

          {/* ✅ header com Voltar + Anterior/Próximo */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dash/consumer/orders"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              Voltar
            </Link>

            {prevId ? (
              <Link
                href={`/dash/consumer/orders/${prevId}`}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                ← Anterior
              </Link>
            ) : null}

            {nextId ? (
              <Link
                href={`/dash/consumer/orders/${nextId}`}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                Próximo →
              </Link>
            ) : null}
          </div>
        </header>

        {toast ? (
          <div className="mb-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            {toast}
          </div>
        ) : null}

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
            {/* Card resumo + ações buyer */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/75">ID</div>

                    <button
                      type="button"
                      className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(order.id);
                          setToast('✅ ID copiado');
                        } catch {
                          setToast('Não foi possível copiar o ID');
                        }
                      }}
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="break-all text-sm font-medium text-white/95">
                    {order.id}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                    order.status,
                  )}`}
                >
                  <div className="grid">
                    <div>{statusLabelPT(order.status)}</div>
                    <div className="mt-1 text-[11px] font-medium text-white/70">
                      Vendedor:{' '}
                      <span className="font-mono text-white/80">
                        {order.merchantId}
                      </span>
                    </div>
                  </div>
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Cidade/UF</span>
                  <span className="text-white/95">
                    {(order.city ?? '—') + ' / ' + (order.state ?? '—')}
                  </span>
                </div>

                {/* ✅ VENDEDOR NO LUGAR CERTO: entre Cidade/UF e Criado */}
                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Vendedor</span>
                  <span className="break-all text-white/95">
                    {order.merchantId ?? '—'}
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

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Total</span>
                  <span className="text-white/95">{totalLabel(order)}</span>
                </div>
              </div>

              {/* Itens */}
              <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="text-xs font-semibold text-white/85">Itens</div>

                {order.items?.length ? (
                  <div className="mt-3 grid gap-2">
                    {order.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-white/90">
                            Produto: {it.productId}
                          </div>
                          <div className="text-xs text-white/65">
                            Qtd: {it.quantity} • Unit: {String(it.unitPrice)}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-white/85">
                          {(
                            (Number(it.quantity ?? 0) || 0) *
                            (parseBRNumber(it.unitPrice) ?? 0)
                          ).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-white/70">Sem itens.</div>
                )}
              </div>

              {/* Entrega (shipment) */}
              <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="text-xs font-semibold text-white/85">Entrega</div>

                {!shipment ? (
                  <div className="mt-2 text-sm text-white/70">
                    Nenhum shipment ainda para este pedido.
                  </div>
                ) : (
                  <div className="mt-2 grid gap-2 text-sm text-white/80">
                    {/* ✅ ALTERADO: copiar shipment id */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Shipment</span>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white/85">
                          {shipment.id}
                        </span>

                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white/75 hover:bg-white/10"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(shipment.id);
                              setToast('✅ Shipment ID copiado');
                            } catch {
                              setToast('Não foi possível copiar o Shipment ID');
                            }
                          }}
                          title="Copiar Shipment ID"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Status</span>
                      <span className="text-white/95">{shipment.status}</span>
                    </div>

                    {/* ✅ NOVO: nudger de avaliação quando DELIVERED e sem review */}
                     {String(shipment.status ?? '').toUpperCase().trim() === 'DELIVERED' &&
                    !shipment.review ? (
                      <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                        Entrega concluída. Leva 30s: avalie agora para registrar
                        sua experiência.
                      </div>
                    ) : null}

                    {/* ✅ Já avaliado */}
                    {shipment.review ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                        ✅ Avaliado ({reviewStarsLabel(shipment.review.rating)}★)
                      </div>
                    ) : shipment.status !== 'DELIVERED' ? (
                      <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/75">
                        Avaliação disponível após a entrega ser marcada como{' '}
                        <b>DELIVERED</b>.
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
                        <div className="text-xs font-semibold text-white/85">
                          Avaliar entrega
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="text-xs text-white/70">
                            Nota (1–5)
                          </label>
                          <select
                            value={reviewRating}
                            onChange={(e) =>
                              setReviewRating(Number(e.target.value))
                            }
                            className="rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-sm text-white/85"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>

                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Opcional: como foi a entrega?"
                          className="mt-2 w-full rounded-xl border border-white/15 bg-black/60 p-2 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
                        />

                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={reviewLoading}
                            onClick={submitShipmentReview}
                            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reviewLoading ? 'Enviando…' : 'Enviar avaliação'}
                          </button>

                          {reviewMsg ? (
                            <div className="text-xs text-white/75">
                              {reviewMsg}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Ações do comprador */}
              <div className="mt-5 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="text-xs font-semibold text-white/85">
                  Ações do comprador
                </div>
                <div className="mt-2 text-xs text-white/70">
                  Os botões aparecem/somem conforme o status.
                </div>

                {actionError && (
                  <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                    {actionError}
                  </div>
                )}

                {String(status).toUpperCase() === 'RETURN_REQUESTED' && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
                    ⏳ Devolução solicitada
                  </div>
                )}

                {String(status).toUpperCase() === 'COMPLETED' && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
                    ✅ Pedido concluído
                  </div>
                )}

                {/* ✅ COLE AQUI (antes dos botões) */}
                {String(status).toUpperCase() === 'DELIVERED' ? (
                  <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                    Sua entrega foi marcada como <b>DELIVERED</b>. Confirme o
                    recebimento para concluir o pedido.
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {allow.canPay && (
                    <button
                      type="button"
                      disabled={
                        actionLoading === 'PAY' || actionLoading === 'CANCEL'
                      }
                      className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={confirmPay}
                    >
                      {actionLoading === 'PAY' ? 'Pagando…' : 'Pagar'}
                    </button>
                  )}

                  {allow.canCancel && (
                    <Btn
                      tone="ghost"
                      disabled={actionLoading !== null}
                      title="Cancelar"
                      onClick={() => {
                        setActionError(null);
                        setShowCancelModal(true);
                      }}
                    >
                      Cancelar
                    </Btn>
                  )}

                  {allow.canReturn && (
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        setActionError(null);
                        setShowReturnModal(true);
                      }}
                    >
                      Pedir devolução
                    </button>
                  )}

                  {String(status).toUpperCase() === 'DELIVERED' && (
                    <Btn
                      tone="primary"
                      disabled={actionLoading !== null}
                      title="Confirmar recebimento"
                      onClick={() => {
                        void doSetStatus('COMPLETED', 'recebido');
                      }}
                    >
                      Confirmar recebimento
                    </Btn>
                  )}
                </div>

                {!allow.canPay &&
                !allow.canCancel &&
                !allow.canReturn &&
                !allow.isReturnRequested &&
                !allow.isCompleted &&
                String(status).toUpperCase() !== 'DELIVERED' ? (
                  <div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3 text-xs text-white/75">
                    Nenhuma ação disponível agora.
                  </div>
                ) : null}
              </div>
            </div>

            {/* Card Timeline (coluna direita) */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Timeline</div>
                  <div className="mt-1 text-xs text-white/70">
                    Cada mudança vira um evento — reputação e verdade.
                  </div>
                </div>
              </div>

              {/* Estado atual */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-white/70">
                    Pedido agora
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white/90">
                    {statusLabelPT(order.status)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-white/70">
                    Entrega agora
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white/90">
                    {shipment ? statusLabelPT(shipment.status) : '—'}
                  </div>
                </div>
              </div>

              {unifiedEvents.length === 0 ? (
                <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-sm text-white/75">
                  Sem eventos ainda.
                </div>
              ) : (
                <div className="grid gap-3">
                  {unifiedEvents.map((ev) => (
                    <div
                      key={ev.key}
                      className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              ev.source === 'ORDER'
                                ? 'border-white/15 bg-white/10 text-white/80'
                                : 'border-sky-500/25 bg-sky-500/10 text-sky-100'
                            }`}
                          >
                            {ev.source === 'ORDER' ? 'Pedido' : 'Entrega'}
                          </span>

                          <div className="text-sm font-semibold text-white/90">
                            {ev.title}
                          </div>
                        </div>

                        <div className="text-xs text-white/70">
                          {fmt(ev.createdAt)}
                        </div>
                      </div>

                      {ev.desc ? (
                        <div className="mt-2 text-xs text-white/75">
                          {ev.desc}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Modal cancelar */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => (actionLoading ? null : setShowCancelModal(false))}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <h3 className="text-lg font-semibold text-white">Cancelar pedido?</h3>
            <p className="mt-2 text-sm text-white/75">
              Essa ação tenta cancelar o pedido imediatamente. Se o pedido já
              estiver avançado demais, o sistema pode negar.
            </p>

            {actionError && (
              <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                {actionError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setShowCancelModal(false)}
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={confirmCancel}
              >
                {actionLoading === 'CANCEL'
                  ? 'Cancelando…'
                  : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal devolução */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => (actionLoading ? null : setShowReturnModal(false))}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <h3 className="text-lg font-semibold text-white">Pedir devolução</h3>
            <p className="mt-2 text-sm text-white/75">
              Explique rapidamente o motivo (opcional). Você poderá acompanhar o
              status na timeline.
            </p>

            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Ex: produto com avaria, não serviu, etc."
              className="mt-3 min-h-[90px] w-full rounded-xl border border-white/15 bg-black/60 p-3 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
            />

            {actionError && (
              <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                {actionError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setShowReturnModal(false)}
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={confirmReturn}
              >
                {actionLoading ? 'Enviando…' : 'Confirmar devolução'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
