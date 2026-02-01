// apps/web/app/shop/[merchant]/p/[product]/page.tsx
'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ResolveResponse =
  | { ok: true; productId?: string; id?: string; product?: { id?: string } }
  | { ok: false; message?: string };

function ensureAt(v: string) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.startsWith('@') ? s : `@${s}`;
}

function apiUrl() {
  // NEXT_PUBLIC_API_URL pode ser http://localhost:3001/api
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Erro desconhecido.';
  }
}

export default function ShopResolveByHandlePage({
  params,
}: {
  // ✅ Next pode entregar params como Promise em Client Components
  params: Promise<{ merchant: string; product: string }>;
}) {
  const router = useRouter();

  // ✅ unwrap correto
  const { merchant: rawMerchant, product: rawProduct } = use(params);

  const merchant = useMemo(() => ensureAt(decodeURIComponent(rawMerchant)), [rawMerchant]);
  const product = useMemo(() => ensureAt(decodeURIComponent(rawProduct)), [rawProduct]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);

      if (!merchant || !product) {
        setErr('Link inválido (faltando merchant/product).');
        setLoading(false);
        return;
      }

      try {
        const qs = new URLSearchParams({ merchant, product });

        const res = await fetch(`${apiUrl()}/products/resolve?${qs.toString()}`, {
          method: 'GET',
        });

        const data = (await res.json().catch(() => null)) as ResolveResponse | null;

        if (!alive) return;

        if (!res.ok) {
          const msg =
            data && typeof (data as { message?: unknown }).message === 'string'
              ? String((data as { message?: string }).message)
              : `HTTP ${res.status}`;
          setErr(msg);
          setLoading(false);
          return;
        }

        if (data && data.ok === true) {
          const pid =
            (typeof data.productId === 'string' && data.productId.trim()) ||
            (typeof data.id === 'string' && data.id.trim()) ||
            (typeof data.product?.id === 'string' && data.product.id.trim()) ||
            '';

          if (pid) {
            router.replace(`/shop/p/${encodeURIComponent(pid)}`);
            return;
          }
        }

        if (
          data &&
          data.ok === false &&
          typeof data.message === 'string' &&
          data.message.trim()
        ) {
          setErr(data.message);
        } else {
          setErr('Resolve ok, mas não veio productId (formato inesperado).');
        }
      } catch (e) {
        if (!alive) return;
        setErr(errorMessage(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [merchant, product, router]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-4">
          <div className="text-sm text-white/70">Marto / Shop</div>
          <h1 className="text-xl font-semibold text-white">Abrindo produto…</h1>
          <div className="mt-1 text-sm text-white/65">
            {merchant}/{product}
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          {loading ? (
            <div className="text-sm text-white/75">Resolvendo identidade…</div>
          ) : err ? (
            <div className="space-y-2">
              <div className="text-sm text-red-300">{err}</div>
              <button
                onClick={() => router.replace('/shop')}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
              >
                Voltar para Shop
              </button>
            </div>
          ) : (
            <div className="text-sm text-white/75">OK.</div>
          )}
        </div>
      </div>
    </main>
  );
}
