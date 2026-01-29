// apps/web/app/dash/merchant/orders/[id]/page.tsx
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
  unitPrice: string; // pode vir "299.90" ou "299,90"
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

type SalesOk = { ok: true; items: Order[] };
type SalesFail = { ok: false; message?: string; items?: Order[] };
type SalesResponse = SalesOk | SalesFail;

type SetStatusOk = { ok: true; order: { id: string; status: string } };
type SetStatusFail = { ok: false; message?: string };
type SetStatusResponse = SetStatusOk | SetStatusFail;

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

function isSalesOk(res: unknown): res is SalesOk {
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

function isSetStatusOk(res: unknown): res is SetStatusOk {
  if (!res || typeof res !== 'object') return false;
  const r = res as Record<string, unknown>;
  if (r.ok !== true) return false;
  const ord = r.order as Record<string, unknown> | undefined;
  return !!ord && typeof ord.id === 'string' && typeof ord.status === 'string';
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

function moneyBRL(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function itemTotal(it: OrderItem) {
  const q = Number(it.quantity ?? 0);
  const up = parseBRNumber(it.unitPrice) ?? 0;
  return q * up;
}

function totalLabel(order: Order) {
  const items = Array.isArray(order.items) ? order.items : [];
  let sum = 0;
  for (const it of items) sum += itemTotal(it);
  return moneyBRL(sum);
}

function sellerActionsForStatus(statusRaw: string) {
  const status = String(statusRaw ?? '').toUpperCase();

  const actions: Array<{
    key: string;
    toStatus: string;
    title: string;
    desc: string;
    tone: 'primary' | 'ghost' | 'danger';
  }> = [];

  if (status === 'PAID') {
    actions.push({
      key: 'confirm',
      toStatus: 'CONFIRMED_BY_SELLER',
      title: 'Confirmar pedido',
      desc: 'Você confirma que vai preparar e expedir.',
      tone: 'primary',
    });
    actions.push({
      key: 'cancel',
      toStatus: 'CANCELLED',
      title: 'Cancelar',
      desc: 'Usar apenas quando realmente necessário.',
      tone: 'danger',
    });
  }

  if (status === 'CONFIRMED_BY_SELLER') {
    actions.push({
      key: 'ready',
      toStatus: 'READY_FOR_PICKUP',
      title: 'Pronto para coleta',
      desc: 'Pedido embalado e aguardando retirada.',
      tone: 'primary',
    });
    actions.push({
      key: 'cancel',
      toStatus: 'CANCELLED',
      title: 'Cancelar',
      desc: 'Se ocorrer problema antes da coleta.',
      tone: 'danger',
    });
  }

  if (status === 'READY_FOR_PICKUP') {
    actions.push({
      key: 'transit',
      toStatus: 'IN_TRANSIT',
      title: 'Entregue à transportadora',
      desc: 'A coleta foi feita e o envio começou.',
      tone: 'primary',
    });
  }

  if (status === 'IN_TRANSIT') {
    actions.push({
      key: 'delivered',
      toStatus: 'DELIVERED',
      title: 'Marcar como entregue',
      desc: 'Entrega concluída ao cliente.',
      tone: 'primary',
    });
  }

  return actions;
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
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const base =
    'rounded-xl px-3 py-2 text-sm font-semibold transition border select-none';
  const styles =
    tone === 'primary'
      ? 'border-white/15 bg-white text-black hover:opacity-90'
      : tone === 'danger'
        ? 'border-red-500/25 bg-red-500/10 text-red-100 hover:bg-red-500/15'
        : 'border-white/15 bg-white/10 text-white hover:bg-white/15';

  return (
    <button
      type="button"
      className={`${base} ${styles} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function StepDot({ active }: { active: boolean }) {
  return (
    <div
      className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border ${
        active ? 'border-white/30 bg-white' : 'border-white/15 bg-white/10'
      }`}
      aria-hidden="true"
    />
  );
}

function statusLabel(s?: string | null) {
  const v = String(s ?? '').toUpperCase();
  if (v === 'PAID') return 'Pago';
  if (v === 'CONFIRMED_BY_SELLER') return 'Confirmado';
  if (v === 'READY_FOR_PICKUP') return 'Pronto p/ coleta';
  if (v === 'IN_TRANSIT') return 'Em trânsito';
  if (v === 'DELIVERED') return 'Entregue';
  if (v === 'CANCELLED') return 'Cancelado';
  return s ?? '—';
}

export default function MerchantOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = String(id ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string>('');

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      // MVP: usa /orders/sales e filtra pelo id
      const res = await fetchJSON<SalesResponse>('/orders/sales', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!isSalesOk(res)) throw new Error(errorMessageFromRes(res));

      const found = res.items.find((o) => String(o.id) === orderId) ?? null;
      setOrder(found);
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae?.message || 'Erro ao carregar');
      setOrder(null);
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
  }, [orderId]);

  const events = useMemo(() => {
    const list = order?.events ? [...order.events] : [];
    list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return list;
  }, [order?.events]);

  const computed = useMemo(() => {
    const items = order?.items ?? [];
    const qty = items.reduce((acc, it) => acc + Number(it.quantity ?? 0), 0);
    const subtotal = items.reduce((acc, it) => acc + itemTotal(it), 0);
    return { qty, subtotal };
  }, [order]);

  async function doSetStatus(toStatus: string) {
    const token = getToken();
    if (!token) {
      setToast('Sessão expirada. Faça login novamente.');
      return;
    }

    setActing(true);
    setToast('');

    try {
      const res = await fetchJSON<SetStatusResponse>(`/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toStatus }),
      });

      if (!isSetStatusOk(res)) {
        const msg =
          res && typeof res === 'object'
            ? String((res as Record<string, unknown>).message ?? '')
            : '';
        throw new Error(msg || 'Falha ao atualizar status.');
      }

      setToast(`Status atualizado → ${res.order.status}`);
      await load();
    } catch (e) {
      const ae = e as ApiError;
      const msg = ae?.message || (e instanceof Error ? e.message : '');
      setToast(msg || 'Falha ao atualizar status.');
    } finally {
      setActing(false);
    }
  }

  const actions = useMemo(() => {
    return order ? sellerActionsForStatus(order.status) : [];
  }, [order]);

  const timelineSteps = useMemo(() => {
    const current = String(order?.status ?? '').toUpperCase();

    const flow = ['PAID', 'CONFIRMED_BY_SELLER', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'] as const;

    // se cancelado, a timeline vira “encerrado”
    if (current.includes('CANCEL')) {
      return [
        { key: 'PAID', label: 'Pago', done: true },
        { key: 'CANCELLED', label: 'Cancelado', done: true },
      ];
    }

    // se status não existir no flow, mostra o que tiver
    const idx = flow.indexOf(current as (typeof flow)[number]);
    const safeIdx = idx >= 0 ? idx : 0;

    return flow.map((k, i) => ({
      key: k,
      label: statusLabel(k),
      done: i <= safeIdx,
    }));
  }, [order?.status]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto (sutil) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Pedido • visão do lojista</h1>
            <p className="text-sm text-white/75">
              Ação + histórico (tudo vira evento).
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dash/merchant/orders"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Voltar
            </Link>
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
            Pedido não encontrado em /orders/sales.
          </div>
        ) : (
          <section className="grid gap-4 lg:grid-cols-3">
            {/* resumo + ações */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white/75">ID</div>
                  <div className="break-all text-sm font-medium text-white/95">
                    {order.id}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Btn
                      tone="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(order.id);
                        setToast('ID copiado.');
                      }}
                      title="Copiar ID"
                    >
                      Copiar ID
                    </Btn>

                    <Btn tone="ghost" onClick={load} disabled={acting} title="Recarregar">
                      Recarregar
                    </Btn>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                    order.status,
                  )}`}
                >
                  {statusLabel(order.status)}
                </span>
              </div>

              {/* mini timeline */}
              <div className="mt-5 rounded-2xl border border-white/15 bg-black/30 p-4">
                <div className="text-xs font-semibold text-white/85">Timeline</div>
                <div className="mt-3 grid gap-2">
                  {timelineSteps.map((s) => (
                    <div key={s.key} className="flex items-start gap-3">
                      <StepDot active={s.done} />
                      <div className="min-w-0">
                        <div className={`text-sm ${s.done ? 'text-white/90 font-semibold' : 'text-white/70'}`}>
                          {s.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-2 text-sm">
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

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Itens</span>
                  <span className="text-white/95">{computed.qty}</span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Total</span>
                  <span className="text-white/95">{moneyBRL(computed.subtotal)}</span>
                </div>
              </div>

              {/* ações */}
              <div className="mt-5 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="text-xs font-semibold text-white/85">
                  Ações do lojista
                </div>
                <div className="mt-2 text-xs text-white/70">
                  Disponível conforme o status atual.
                </div>

                <div className="mt-3 grid gap-2">
                  {actions.length === 0 ? (
                    <div className="rounded-xl border border-white/15 bg-neutral-950/75 p-3 text-xs text-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                      Nenhuma ação disponível agora.
                    </div>
                  ) : (
                    actions.map((a) => (
                      <div
                        key={a.key}
                        className="rounded-2xl border border-white/15 bg-neutral-950/75 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white/90">
                              {a.title}
                            </div>
                            <div className="mt-1 text-xs text-white/70">
                              {a.desc}
                            </div>
                          </div>

                          <Btn
                            tone={
                              a.tone === 'danger'
                                ? 'danger'
                                : a.tone === 'primary'
                                  ? 'primary'
                                  : 'ghost'
                            }
                            disabled={acting}
                            title={`Alterar para ${a.toStatus}`}
                            onClick={() => {
                              if (a.toStatus === 'CANCELLED') {
                                const ok = window.confirm(
                                  'Tem certeza que deseja cancelar este pedido?',
                                );
                                if (!ok) return;
                              }
                              void doSetStatus(a.toStatus);
                            }}
                          >
                            {acting ? 'Executando…' : 'Executar'}
                          </Btn>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* itens + histórico */}
            <div className="grid gap-4 lg:col-span-2">
              {/* itens */}
              <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Itens</div>
                    <div className="mt-1 text-xs text-white/70">
                      MVP: mostra IDs e valores; depois liga com catálogo (nome/foto).
                    </div>
                  </div>

                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                    Total: {totalLabel(order)}
                  </div>
                </div>

                {Array.isArray(order.items) && order.items.length > 0 ? (
                  <div className="grid gap-2">
                    {order.items.map((it) => {
                      const up = parseBRNumber(it.unitPrice) ?? 0;
                      const line = itemTotal(it);

                      return (
                        <div
                          key={it.id}
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                                ProductId
                              </div>
                              <div className="break-all text-sm font-semibold text-white/90">
                                {it.productId}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/70">
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                                  Qtd: <span className="text-white/85 font-semibold">{it.quantity}</span>
                                </span>
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                                  Unit: <span className="text-white/85 font-semibold">{moneyBRL(up)}</span>
                                </span>
                              </div>
                            </div>

                            <div className="text-sm font-semibold text-white/90">
                              {moneyBRL(line)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/15 bg-neutral-950/75 p-4 text-sm text-white/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    Nenhum item no pedido.
                  </div>
                )}
              </div>

              {/* histórico */}
              <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Histórico</div>
                    <div className="mt-1 text-xs text-white/70">
                      Cada mudança vira evento — reputação e verdade.
                    </div>
                  </div>
                </div>

                {events.length === 0 ? (
                  <div className="rounded-xl border border-white/15 bg-neutral-950/75 p-4 text-sm text-white/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    Sem eventos ainda.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-white/90">
                            {statusLabel(ev.toStatus ?? ev.type)}
                          </div>
                          <div className="text-xs text-white/70">{fmt(ev.createdAt)}</div>
                        </div>

                        <div className="mt-2 text-xs text-white/75">
                          {ev.message ? (
                            <span>{ev.message}</span>
                          ) : (
                            <span>
                              Ação:{' '}
                              <span className="font-medium text-white/85">
                                {String(ev.actorRole ?? '—').toLowerCase()}
                              </span>{' '}
                              de{' '}
                              <span className="font-medium text-white/85">
                                {ev.fromStatus ?? '—'}
                              </span>{' '}
                              →{' '}
                              <span className="font-medium text-white/85">
                                {ev.toStatus ?? '—'}
                              </span>
                            </span>
                          )}
                        </div>

                        {(ev.fromStatus || ev.toStatus) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {ev.fromStatus ? (
                              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
                                de: {ev.fromStatus}
                              </span>
                            ) : null}
                            {ev.toStatus ? (
                              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
                                para: {ev.toStatus}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
