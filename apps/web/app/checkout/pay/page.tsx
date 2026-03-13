'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchJSON } from '../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type MartoPayStage =
  | 'created_charge'
  | 'awaiting_confirmation'
  | 'captured'
  | 'already_captured'
  | 'payout_released'
  | 'payout_paid';

type MartoPayResponse = {
  ok: true;
  idempotent?: boolean;
  stage?: MartoPayStage;
  message?: string;
  order: { reservedUntil?: Date | string | null } & Record<string, unknown>;
  payment?: { status?: string } | null;
  payout?: { status?: string } | null;
  pixCharge?:
    | {
        brCode?: string | null;
        expiresAt?: Date | string | null;
        status?: string;
      }
    | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export default function CheckoutPayPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const token = useMemo(() => getToken(), []);

  const productId = sp.get('productId') ?? '';
  const merchantId = sp.get('merchantId') ?? '';
  const unitPriceStr = sp.get('unitPrice') ?? '';
  const qtyStr = sp.get('qty') ?? '1';
  const orderIdFromQuery = sp.get('orderId');

  const qty = Math.max(1, parseInt(qtyStr, 10) || 1);
  const canStart = Boolean(productId && merchantId && unitPriceStr && qty > 0);

  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [orderId, setOrderId] = useState<string | null>(orderIdFromQuery);
  const [pay, setPay] = useState<MartoPayResponse | null>(null);
  const [reserveLeftMs, setReserveLeftMs] = useState<number | null>(null);
  const reserveLeftMsRef = useRef<number | null>(null);

  function fmtMmSs(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  async function createOrder(): Promise<string> {
    if (orderId) return orderId;

    const created = await fetchJSON<{ id: string }>('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantId,
        items: [
          {
            productId,
            quantity: qty,
            unitPrice: unitPriceStr,
          },
        ],
      }),
    });

    const id = String(created?.id ?? '').trim();
    if (!id) throw new Error('Falha ao criar pedido.');
    setOrderId(id);
    return id;
  }

  async function startPay() {
    setErr(null);
    setLoading(true);

    try {
      if (!canStart) {
        throw new Error('Faltam dados para iniciar o pagamento.');
      }

      const id = await createOrder();

      const res = await fetchJSON<MartoPayResponse>(`/orders/${id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setPay(res);

      if (!orderIdFromQuery) {
        const qs = new URLSearchParams(Array.from(sp.entries()));
        qs.set('orderId', id);
        router.replace(`/checkout/pay?${qs.toString()}`);
      }
    } catch (error: unknown) {
      setErr(getErrorMessage(error, 'Falha ao iniciar pagamento.'));
    } finally {
      setLoading(false);
    }
  }

  async function refreshPayStatus(id: string) {
    const res = await fetchJSON<MartoPayResponse>(`/orders/${id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    setPay(res);
    return res;
  }

  async function confirmPayMock() {
    if (!orderId) return;
    setConfirming(true);
    setErr(null);

    try {
      const res = await fetchJSON<MartoPayResponse>(
        `/orders/${orderId}/pay/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      setPay(res);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, 'Falha ao confirmar pagamento.'));
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;

    async function boot() {
      try {
        await startPay();

        const id = orderIdFromQuery ?? orderId;
        if (!id) return;
        if (reserveLeftMsRef.current !== null && reserveLeftMsRef.current <= 0) {
          return;
        }

        const loop = async () => {
          if (!alive) return;
          if (reserveLeftMsRef.current !== null && reserveLeftMsRef.current <= 0) {
            return;
          }

          try {
            const latest = await refreshPayStatus(id);

            const stage = latest?.stage;
            const captured =
              stage === 'captured' ||
              stage === 'already_captured' ||
              latest?.payment?.status === 'captured';

            if (captured) return;
          } catch {
            // se falhar, não trava; tenta de novo no próximo tick
          }

          if (reserveLeftMsRef.current !== null && reserveLeftMsRef.current <= 0) {
            return;
          }
          t = setTimeout(loop, 3000);
        };

        t = setTimeout(loop, 3000);
      } catch {
        // erros já caem no state do startPay
      }
    }

    void boot();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const untilRaw = pay?.order?.reservedUntil;
    if (!untilRaw) {
      setReserveLeftMs(null);
      reserveLeftMsRef.current = null;
      return;
    }

    const until = new Date(untilRaw).getTime();
    if (!Number.isFinite(until)) {
      setReserveLeftMs(null);
      reserveLeftMsRef.current = null;
      return;
    }

    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (!alive) return;
      const left = until - Date.now();
      setReserveLeftMs(left);
      reserveLeftMsRef.current = left;
      t = setTimeout(tick, 500);
    };

    tick();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [pay?.order?.reservedUntil]);

  const stage = pay?.stage;
  const pix = pay?.pixCharge;
  const brCode = String(pix?.brCode ?? '').trim();

  const isCaptured =
    stage === 'captured' ||
    stage === 'already_captured' ||
    pay?.payment?.status === 'captured';

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-white/60">
              Marto Pay • Checkout
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Pagar com Pix (mock)
            </h1>
            <p className="mt-1 text-sm text-white/75">
              Geramos a cobrança e você confirma (mock) para finalizar.
            </p>
          </div>

          <Link
            href={`/checkout?productId=${encodeURIComponent(
              productId,
            )}&merchantId=${encodeURIComponent(
              merchantId,
            )}&unitPrice=${encodeURIComponent(unitPriceStr)}&qty=${encodeURIComponent(
              String(qty),
            )}`}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Voltar
          </Link>
        </header>

        {!canStart ? (
          <section className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-sm text-white/85">
              Faltam dados para iniciar. Volte ao checkout e tente novamente.
            </div>
          </section>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    Status do pagamento
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    {loading ? 'Iniciando…' : stage ?? '—'}
                  </div>
                  {pay?.message ? (
                    <div className="mt-2 text-xs text-white/60">
                      {pay.message}
                    </div>
                  ) : null}
                </div>

                {!loading ? (
                  <button
                    onClick={startPay}
                    className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Recarregar
                  </button>
                ) : null}
              </div>

              {err ? (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {err}
                </div>
              ) : null}
              {err?.includes('Pedido expirou') ? (
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/checkout"
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15"
                  >
                    Atualizar compra
                  </Link>
                  <Link
                    href="/catalog"
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15"
                  >
                    Voltar ao catálogo
                  </Link>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="text-sm font-semibold text-white/85">
                  Copia e cola (BR Code)
                </div>

                {pay?.message ? (
                  <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85">
                    <div className="font-semibold text-white/90">Marto Pay</div>
                    <div className="mt-1 text-white/75">{pay.message}</div>
                  </div>
                ) : null}

                <textarea
                  value={brCode}
                  readOnly
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/15 bg-black/80 p-3 text-xs text-white/80"
                  placeholder="Gerando BR Code…"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={!brCode}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(brCode);
                      } catch {
                        // noop
                      }
                    }}
                    className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
                  >
                    Copiar
                  </button>

                  <button
                    disabled={!orderId || isCaptured || confirming}
                    onClick={confirmPayMock}
                    className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
                  >
                    {confirming ? 'Confirmando…' : 'Já paguei (mock)'}
                  </button>

                  {isCaptured ? (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                      Pagamento confirmado
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                      Aguardando confirmação
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-white/60">
                  Expira em:{' '}
                  <span className="text-white/75">
                    {pix?.expiresAt ? String(pix.expiresAt) : '—'}
                  </span>
                </div>

                {reserveLeftMs !== null ? (
                  <div className="mt-3 text-xs text-white/60">
                    Reserva do pedido:{' '}
                    {reserveLeftMs > 0 ? (
                      <span className="text-white/75">
                        expira em {fmtMmSs(reserveLeftMs)}
                      </span>
                    ) : (
                      <span className="text-red-200">
                        expirada — atualize sua compra
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-sm font-semibold text-white/85">
                Resumo do checkout
              </div>

              <div className="mt-3 space-y-2 text-sm text-white/75">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">productId</span>
                  <span className="max-w-[60%] break-all text-white/85">
                    {productId}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">merchantId</span>
                  <span className="max-w-[60%] break-all text-white/85">
                    {merchantId}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">unitPrice</span>
                  <span className="text-white/85">{unitPriceStr}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">qty</span>
                  <span className="text-white/85">{qty}</span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/65">
                <div className="font-semibold text-white/80">Marto Pay</div>
                <div className="mt-1">
                  Payment:{' '}
                  <span className="text-white/80">
                    {pay?.payment?.status ?? '—'}
                  </span>
                </div>
                <div>
                  PixCharge:{' '}
                  <span className="text-white/80">{pix?.status ?? '—'}</span>
                </div>
                <div>
                  Payout:{' '}
                  <span className="text-white/80">{pay?.payout?.status ?? '—'}</span>
                </div>
              </div>

              {orderId ? (
                <div className="mt-4 text-xs text-white/60">
                  orderId: <span className="break-all text-white/75">{orderId}</span>
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
