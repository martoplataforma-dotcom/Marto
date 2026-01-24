// apps/web/app/review/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type OrderLite = {
  id: string;
  status?: string | null;
};

type ShipmentLite = {
  id: string;
  orderId: string;
  status?: string | null;
  review?: unknown | null;
  reviewedAt?: string | null;
};

type ShipByOrderResponse =
  | { ok: true; shipment: ShipmentLite | null }
  | ShipmentLite
  | null;

function shipmentFromResponse(r: unknown): ShipmentLite | null {
  if (!r || typeof r !== 'object') return null;

  const rr = r as Record<string, unknown>;

  if (rr.ok === true && rr.shipment && typeof rr.shipment === 'object') {
    return rr.shipment as ShipmentLite;
  }

  // formato direto
  if (typeof rr.id === 'string' && typeof rr.orderId === 'string') {
    return rr as ShipmentLite;
  }

  return null;
}

function isDeliveredNoReview(s: ShipmentLite) {
  const st = String(s.status ?? '').toUpperCase();
  if (st !== 'DELIVERED') return false;
  if (s.review) return false;
  if (s.reviewedAt) return false;
  return true;
}

export default function ReviewPendenciesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [items, setItems] = useState<
    { orderId: string; shipmentId: string }[]
  >([]);

  async function load() {
    try {
      setLoading(true);
      setError('');
      setItems([]);

      const token = getToken();
      if (!token) throw new Error('Você precisa entrar novamente.');

      // 1) pega pedidos do consumidor
      const ordersRes = await fetchJSON<
        unknown[] | { orders?: unknown[]; items?: unknown[] }
      >('/orders/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = Array.isArray(ordersRes)
        ? ordersRes
        : Array.isArray(ordersRes.orders)
          ? ordersRes.orders
          : Array.isArray(ordersRes.items)
            ? ordersRes.items
            : [];

      const orders: OrderLite[] = list
        .map((o) => {
          if (!o || typeof o !== 'object') return null;
          const r = o as Record<string, unknown>;
          const id = typeof r.id === 'string' ? r.id : '';
          const status = typeof r.status === 'string' ? r.status : null;
          if (!id) return null;
          return { id, status };
        })
        .filter(Boolean) as OrderLite[];

      // 2) para cada pedido, busca shipment by-order e filtra DELIVERED sem review
      const shipments = await Promise.all(
        orders.map(async (o) => {
          try {
            const raw = await fetchJSON<ShipByOrderResponse>(
              `/logistics/shipments/by-order/${encodeURIComponent(o.id)}`,
              {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            return shipmentFromResponse(raw);
          } catch {
            return null;
          }
        }),
      );

      const pend = shipments
        .filter((s): s is ShipmentLite => Boolean(s))
        .filter(isDeliveredNoReview)
        .map((s) => ({ orderId: s.orderId, shipmentId: s.id }));

      setItems(pend);
    } catch (e: unknown) {
      const err = e as ApiError;
      setError(err?.message ?? (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const count = useMemo(() => items.length, [items.length]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Avaliar pendências
            </h1>
            <p className="text-sm text-white/75">
              Só aparece o que é real: entregas <b>DELIVERED</b> sem avaliação.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>

            <Link
              href="/dash/consumer"
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
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </div>
        ) : count === 0 ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Nenhuma pendência agora. ✅
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((it) => (
              <div
                key={it.shipmentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">
                    Entrega pendente
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    shipmentId:{' '}
                    <span className="break-all font-mono text-white/75">
                      {it.shipmentId}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    orderId:{' '}
                    <span className="break-all font-mono text-white/75">
                      {it.orderId}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/dash/consumer/orders/${encodeURIComponent(it.orderId)}`}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Abrir timeline →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
