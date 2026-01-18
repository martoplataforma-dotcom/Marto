'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function asInt(raw: string | null, fallback: number) {
  const n = Number(String(raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function asMoneyString(raw: string | null): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  // aceita "100", "100.00", "100,00"
  const normalized = s.replace(/\./g, '').replace(',', '.'); // "1.000,50" -> "1000.50"
  const n = Number(normalized);

  if (!Number.isFinite(n) || n <= 0) return null;
  // OrdersService espera unitPrice como string decimal
  return n.toFixed(2);
}

type CreateOrderResponse = {
  id: string;
};

export default function PayPage() {
  const params = useSearchParams();
  const router = useRouter();

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const qOrderId = params.get('orderId');
  const qMerchantId = params.get('merchantId');
  const qProductId = params.get('productId');

  const qty = useMemo(() => asInt(params.get('qty'), 1), [params]);
  const unitPrice = useMemo(
    () => asMoneyString(params.get('unitPrice')),
    [params],
  );

  const [orderId, setOrderId] = useState<string | null>(qOrderId);

  // sempre reflete query inicial
  useEffect(() => {
    setOrderId(qOrderId);
  }, [qOrderId]);

  async function criarPedidoSePrecisar(): Promise<string | null> {
    if (orderId) return orderId;

    const token = getToken();
    if (!token) {
      setMsg('Você precisa entrar novamente.');
      return null;
    }

    const merchantId = String(qMerchantId ?? '').trim();
    const productId = String(qProductId ?? '').trim();

    if (!merchantId || !productId || !unitPrice) {
      setMsg('Falta merchantId e productId (ou passe um orderId real).');
      return null;
    }

    const created = await fetchJSON<CreateOrderResponse>('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantId,
        // city/state podem entrar depois (MVP ok sem)
        items: [
          {
            productId,
            quantity: qty,
            unitPrice,
          },
        ],
      }),
    });

    const newId = String(created?.id ?? '').trim();
    if (!newId) {
      setMsg('Falha ao criar pedido (id vazio).');
      return null;
    }

    setOrderId(newId);
    return newId;
  }

  async function pagarMock() {
    setMsg('');
    setLoading(true);

    try {
      const token = getToken();
      if (!token) {
        setMsg('Você precisa entrar novamente.');
        return;
      }

      const realOrderId = await criarPedidoSePrecisar();
      if (!realOrderId) return;

      // ✅ chama o /payments/mock autenticado (transição CREATED -> PAID como buyer)
      await fetchJSON<{ ok: boolean; status?: string }>('/payments/mock', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: realOrderId }),
      });

      router.push(`/dash/consumer/orders/${realOrderId}`);
    } catch (e: unknown) {
      const a = e as ApiError;
      setMsg(`${a.status ?? 0} - ${a.message ?? 'Erro ao pagar'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Pagamento</h1>
            <p className="text-sm text-white/75">
              Checkout MVP • cria pedido real e confirma pagamento (mock)
            </p>
          </div>

          <Link
            href="/catalog"
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Voltar ao catálogo
          </Link>
        </header>

        <section className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="orderId (query)"
              value={orderId ?? '— (vai criar)'}
              mono
            />
            <Field label="merchantId" value={qMerchantId ?? '—'} mono />
            <Field label="productId" value={qProductId ?? '—'} mono />
            <Field label="quantidade" value={String(qty)} />

            <Field
              label="unitPrice"
              value={unitPrice ? String(unitPrice) : '—'}
            />
          </div>

          {msg ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
              {msg}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={pagarMock}
              disabled={loading}
              className="rounded-xl border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Processando…' : 'Pagar (mock)'}
            </button>

            {orderId ? (
              <Link
                href={`/dash/consumer/orders/${orderId}`}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Ver pedido →
              </Link>
            ) : null}
          </div>

          <div className="mt-4 text-xs text-white/70">
            Observação: para o fluxo “real”, use um usuário consumidor diferente
            do usuário dono da loja.
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="text-xs font-semibold text-white/80">{label}</div>
      <div className={`mt-2 text-sm text-white/85 ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}
