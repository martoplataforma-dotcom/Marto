// apps/web/app/shop/[id]/page.tsx
'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  merchantId: string;
  images?: string[];
};

type ProductDetailResponse =
  | { ok: true; product: Product }
  | { ok: false; message?: string };

// ✅ flexível sem usar any (lint-friendly)
type CreateOrderResponse = unknown;

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access'); // ✅ seu padrão
}

// ✅ sem any: extrai message de respostas ok:false (ou fallback)
function getApiMessage<T extends { ok: boolean; message?: string }>(
  data: T | null | undefined,
  fallback: string,
) {
  if (!data) return fallback;
  if (
    data.ok === false &&
    typeof data.message === 'string' &&
    data.message.trim()
  ) {
    return data.message;
  }
  return fallback;
}

export default function ShopProductPage({
  params,
}: {
  // ✅ Next pode entregar params como Promise em Client Components
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = useMemo(() => decodeURIComponent(rawId), [rawId]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<Product | null>(null);

  const [buying, setBuying] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // ✅ novos states (pagamento)
  const [paying, setPaying] = useState(false);
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setErr(null);
        setLoading(true);

        const res = await fetch(
          `http://localhost:3001/api/products/${encodeURIComponent(id)}`,
          { method: 'GET' },
        );

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${text}`);
        }

        const data = (await res.json()) as ProductDetailResponse;

        if (!alive) return;

        if (!data || data.ok !== true) {
          setP(null);
          setErr(getApiMessage(data, 'Produto não encontrado'));
          return;
        }

        setP(data.product);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [id]);

  async function buyNow() {
    try {
      setBuying(true);
      setCreatedOrderId(null);
      setPaidOrderId(null);
      setErr(null);

      const token = getToken();
      if (!token) {
        setErr('Você precisa estar logado como consumidor para comprar.');
        return;
      }
      if (!p) return;

      const payload = {
        merchantId: p.merchantId,
        items: [{ productId: p.id, qty: 1 }],
      };

      const res = await fetch(`http://localhost:3001/api/orders`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => '');
      let data: CreateOrderResponse = null;

      try {
        data = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        data = text; // pode ser texto puro
      }

      console.log(
        'CREATE ORDER status=',
        res.status,
        'payload=',
        payload,
        'response=',
        data,
      );

      // Se o backend devolveu erro HTTP, mostra o conteúdo real
      if (!res.ok) {
        const msg =
          (data &&
            typeof data === 'object' &&
            data !== null &&
            ('message' in data || 'error' in data) &&
            String(
              (data as Record<string, unknown>).message ??
                (data as Record<string, unknown>).error,
            )) ||
          (typeof data === 'string' && data) ||
          `HTTP ${res.status}`;

        throw new Error(String(msg));
      }

      // ✅ Aceitar formatos comuns de resposta:

      // 1) { ok: true, order: { id } }
      if (
        data &&
        typeof data === 'object' &&
        data !== null &&
        'ok' in data &&
        (data as Record<string, unknown>).ok === true &&
        'order' in data &&
        typeof (data as Record<string, unknown>).order === 'object' &&
        (data as Record<string, unknown>).order !== null &&
        'id' in
          ((data as Record<string, unknown>).order as Record<string, unknown>)
      ) {
        setCreatedOrderId(
          String(
            ((data as Record<string, unknown>).order as Record<string, unknown>)
              .id,
          ),
        );
        return;
      }

      // 2) { id: "...", status: "..." }
      if (data && typeof data === 'object' && data !== null && 'id' in data) {
        setCreatedOrderId(String((data as Record<string, unknown>).id));
        return;
      }

      // 3) { orderId: "..." }
      if (
        data &&
        typeof data === 'object' &&
        data !== null &&
        'orderId' in data
      ) {
        setCreatedOrderId(String((data as Record<string, unknown>).orderId));
        return;
      }

      // Se chegou aqui, a resposta foi “ok” mas num formato inesperado
      throw new Error(
        'Pedido não criado: formato de resposta inesperado (veja console.log).',
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao comprar');
    } finally {
      setBuying(false);
    }
  }

  async function payNow() {
    try {
      setPaying(true);
      setErr(null);

      const token = getToken();
      if (!token) {
        setErr('Você precisa estar logado como consumidor para pagar.');
        return;
      }

      const orderId = createdOrderId;
      if (!orderId) return;

      const res = await fetch(`http://localhost:3001/api/payments/mock`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const text = await res.text().catch(() => '');
      let data: unknown = null;

      try {
        data = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        data = text;
      }

      console.log(
        'PAY MOCK status=',
        res.status,
        'orderId=',
        orderId,
        'response=',
        data,
      );

      if (!res.ok) {
        const msg =
          (data &&
            typeof data === 'object' &&
            data !== null &&
            ('message' in data || 'error' in data) &&
            String(
              (data as Record<string, unknown>).message ??
                (data as Record<string, unknown>).error,
            )) ||
          (typeof data === 'string' && data) ||
          `HTTP ${res.status}`;

        throw new Error(String(msg));
      }

      // ✅ marcou como pago (mock)
      setPaidOrderId(orderId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao pagar');
    } finally {
      setPaying(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Produto</h1>
            <p className="text-sm text-white/70">Detalhe real + compra (MVP)</p>
          </div>

          <Link
            href="/shop"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Voltar
          </Link>
        </header>

        {loading ? (
          <p className="text-sm text-white/70">Carregando...</p>
        ) : err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        ) : !p ? (
          <p className="text-sm text-white/70">Produto não encontrado.</p>
        ) : (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="flex flex-col gap-2">
              <div className="text-xl font-semibold">{p.name}</div>
              <div className="text-sm text-white/70">
                R$ {(p.price / 100).toFixed(2).replace('.', ',')}
              </div>

              {p.description ? (
                <div className="text-sm text-white/75">{p.description}</div>
              ) : (
                <div className="text-sm text-white/65">Sem descrição.</div>
              )}

              <div className="mt-2 text-xs text-white/60">ID: {p.id}</div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={buyNow}
                disabled={buying}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
              >
                {buying ? 'Comprando...' : 'Comprar (1 unidade)'}
              </button>

              {createdOrderId ? (
                <>
                  <div className="text-sm text-white/80">
                    ✅ Pedido criado:{' '}
                    <span className="font-semibold">{createdOrderId}</span>
                  </div>

                  {!paidOrderId ? (
                    <button
                      onClick={payNow}
                      disabled={paying}
                      className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
                    >
                      {paying ? 'Pagando...' : 'Pagar agora'}
                    </button>
                  ) : (
                    <Link
                      href={`/dash/consumer/orders/${encodeURIComponent(
                        paidOrderId,
                      )}`}
                      className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                    >
                      Ver pedido →
                    </Link>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
