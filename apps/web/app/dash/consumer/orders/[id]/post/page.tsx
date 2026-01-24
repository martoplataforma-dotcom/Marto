// apps/web/app/dash/consumer/orders/[id]/post/page.tsx
'use client';

import Link from 'next/link';
import { use } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
};

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type ApiError = { message?: string };

// ✅ helpers fora do componente (deps estáveis)
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function pickFirstItem(data: unknown): unknown | null {
  const root = asRecord(data);
  if (!root) return null;

  // items / order.items / orderItems / order.orderItems
  const directItems = root.items;
  if (Array.isArray(directItems) && directItems.length) return directItems[0];

  const order = asRecord(root.order);
  if (order) {
    const orderItems = order.items;
    if (Array.isArray(orderItems) && orderItems.length) return orderItems[0];

    const orderOrderItems = order.orderItems;
    if (Array.isArray(orderOrderItems) && orderOrderItems.length)
      return orderOrderItems[0];
  }

  const orderItemsAlt = root.orderItems;
  if (Array.isArray(orderItemsAlt) && orderItemsAlt.length)
    return orderItemsAlt[0];

  return null;
}

function pickProductIdFromItem(item: unknown): string | null {
  const it = asRecord(item);
  if (!it) return null;

  const pid = it.productId ?? it.product_id;
  if (typeof pid === 'string' || typeof pid === 'number') return String(pid);

  const product = asRecord(it.product);
  if (product) {
    const pid2 = product.id;
    if (typeof pid2 === 'string' || typeof pid2 === 'number') return String(pid2);
  }

  return null;
}

// ✅ extrair message do backend (vários shapes possíveis)
function extractMessage(data: unknown): string | null {
  const r = asRecord(data);
  if (!r) return null;

  const m = r.message;
  if (typeof m === 'string' && m.trim()) return m.trim();

  const e = r.error;
  if (typeof e === 'string' && e.trim()) return e.trim();

  return null;
}

function looksLikeDailyLimit(msg: string) {
  const s = msg.toLowerCase();
  return (
    s.includes('limite') ||
    s.includes('diário') ||
    s.includes('diario') ||
    s.includes('daily') ||
    s.includes('hoje') ||
    s.includes('24h') ||
    s.includes('24 h')
  );
}

type ErrorCard = {
  title: string;
  message: string;
  hint?: string;
  tone?: 'warn' | 'error';
};

export default function ConsumerOrderPostPage({ params }: Props) {
  const { id } = use(params);
  const orderId = String(id ?? '');

  const searchParams = useSearchParams();
  const nextUrlRaw = searchParams.get('next');
  const nextUrl =
    typeof nextUrlRaw === 'string' && nextUrlRaw.trim() ? nextUrlRaw.trim() : null;

  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ antes era string simples, agora é card Marto
  const [errorCard, setErrorCard] = useState<ErrorCard | null>(null);

  const [checking, setChecking] = useState(true);
  const [alreadyPosted, setAlreadyPosted] = useState(false);

  // ✅ NOVO: puxar productId do pedido
  const [productId, setProductId] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);

  // ✅ checa se já existe post por orderId
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setChecking(true);

        const res = await fetch(
          `/api/social/posts/by-order/${encodeURIComponent(orderId)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          // MVP: se der erro, não bloqueia
          return;
        }

        const data = (await res.json()) as { ok?: boolean; posts?: unknown[] };
        const has = Array.isArray(data.posts) && data.posts.length > 0;

        if (alive) setAlreadyPosted(has);
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orderId]);

  // ✅ carrega pedido pra descobrir productId
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoadingOrder(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoadingOrder(true);

        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data: unknown = await res.json().catch(() => null);

        const first = pickFirstItem(data);
        const pid = pickProductIdFromItem(first);

        if (alive) setProductId(pid);
      } finally {
        if (alive) setLoadingOrder(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orderId]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(255,255,255,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40%_30%_at_20%_30%,rgba(255,255,255,0.06),transparent_60%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-white/65">Consumidor • Pedido</div>
            <h1 className="mt-1 text-xl font-semibold text-white/85">
              Criar post verificado
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Esse post será marcado como{' '}
              <span className="text-white/85">verificado</span> porque veio de um
              pedido real.
            </p>
          </div>

          <Link
            href={`/dash/consumer/orders/${encodeURIComponent(orderId)}`}
            className="rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/5"
          >
            Voltar
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <label className="text-sm font-medium text-white/85">
            Conte sua experiência
          </label>

          {checking ? (
            <div className="mt-2 text-sm text-white/70">Checando posts…</div>
          ) : alreadyPosted ? (
            <div className="mt-2 text-sm text-white/75">
              ✅ Você já publicou um post verificado para este pedido.
            </div>
          ) : null}

          {loadingOrder ? (
            <div className="mt-2 text-sm text-white/70">Carregando pedido…</div>
          ) : !productId ? (
            <div className="mt-2 text-sm text-amber-100">
              ⚠️ Não consegui identificar o produto deste pedido (productId).
              Você ainda pode tentar recarregar a página.
            </div>
          ) : null}

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={checking || alreadyPosted}
            className="mt-2 h-36 w-full rounded-xl border border-white/15 bg-black/80 p-3 text-sm text-white/85 placeholder:text-white/65 focus:outline-none disabled:opacity-60"
            placeholder="O que você achou do produto e da entrega? O que vale saber antes de comprar?"
          />

          {/* ✅ erro agora é um “card Marto” */}
          {errorCard ? (
            <div
              className={`mt-3 rounded-2xl border p-4 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur ${
                errorCard.tone === 'warn'
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
                  : 'border-red-500/25 bg-red-500/10 text-red-100'
              }`}
            >
              <div className="text-xs font-semibold opacity-90">{errorCard.title}</div>
              <div className="mt-2 text-sm">{errorCard.message}</div>
              {errorCard.hint ? (
                <div className="mt-2 text-xs opacity-90">{errorCard.hint}</div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                loading || checking || alreadyPosted || loadingOrder || !productId
              }
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
              onClick={async () => {
                setErrorCard(null);

                const text = caption.trim();
                if (text.length < 10) {
                  setErrorCard({
                    title: 'Escreva um pouco mais',
                    message: 'Escreva pelo menos 10 caracteres.',
                    tone: 'warn',
                  });
                  return;
                }

                const token = getToken();
                if (!token) {
                  setErrorCard({
                    title: 'Sessão expirada',
                    message: 'Você precisa estar logado.',
                    tone: 'error',
                  });
                  return;
                }

                if (!productId) {
                  setErrorCard({
                    title: 'Produto não identificado',
                    message: 'Não consegui identificar o produto do pedido (productId).',
                    tone: 'warn',
                  });
                  return;
                }

                try {
                  setLoading(true);

                  const res = await fetch('/api/social/posts', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      orderId: orderId,
                      productId,
                      caption: text,
                      media: [],
                    }),
                  });

                  const data: unknown = await res.json().catch(() => null);

                  // ✅ trata também caso o backend responda 200 com ok:false
                  const okFlag =
                    data && typeof data === 'object'
                      ? (data as Record<string, unknown>).ok
                      : undefined;

                  const backendMsg = extractMessage(data);

                  if (!res.ok || okFlag === false) {
                    const msg =
                      backendMsg && backendMsg.trim()
                        ? backendMsg.trim()
                        : `Falha ao publicar (${res.status})`;

                    if (looksLikeDailyLimit(msg)) {
                      setErrorCard({
                        title: 'Limite diário',
                        message: msg,
                        hint: 'Volte amanhã para publicar novamente. No futuro, você poderá subir de nível para aumentar esse limite.',
                        tone: 'warn',
                      });
                    } else {
                      setErrorCard({
                        title: 'Não foi possível publicar',
                        message: msg,
                        tone: 'error',
                      });
                    }
                    return;
                  }

                  const fallback = `/dash/consumer/orders/${encodeURIComponent(orderId)}`;
                  window.location.href = nextUrl || fallback;
                  return;
                } catch (e) {
                  const err = e as ApiError;
                  const msg =
                    typeof err?.message === 'string' && err.message.trim()
                      ? err.message.trim()
                      : 'Falha ao publicar.';

                  if (looksLikeDailyLimit(msg)) {
                    setErrorCard({
                      title: 'Limite diário',
                      message: msg,
                      hint: 'Volte amanhã para publicar novamente. No futuro, você poderá subir de nível para aumentar esse limite.',
                      tone: 'warn',
                    });
                  } else {
                    setErrorCard({
                      title: 'Não foi possível publicar',
                      message: msg,
                      tone: 'error',
                    });
                  }
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loadingOrder
                ? 'Carregando pedido...'
                : alreadyPosted
                  ? 'Já publicado'
                  : loading
                    ? 'Publicando...'
                    : 'Publicar'}
            </button>

            <Link
              href={`/dash/consumer/orders/${encodeURIComponent(orderId)}`}
              className="rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/5"
            >
              Agora não
            </Link>
          </div>

          <div className="mt-3 text-xs text-white/70">
            Dica: fale do que foi bom, do que poderia melhorar e se compraria de
            novo.
          </div>
        </div>
      </div>
    </div>
  );
}
