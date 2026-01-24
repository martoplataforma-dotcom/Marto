// apps/web/app/catalog/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJSON, type ApiError } from '../../src/lib/api';
import { PageHeader } from '@/components/marto/PageHeader';

type Product = {
  id: string;
  title?: string | null;
  name?: string | null;
  price?: string | number | null;
  priceCents?: number | null;
  merchantId: string;
  images?: unknown;
};

function priceToLabel(
  price: string | number | null | undefined,
  priceCents?: number | null,
): string {
  if (typeof priceCents === 'number' && Number.isFinite(priceCents)) {
    const v = priceCents / 100;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const raw = price ?? '';
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).replace(/\./g, '').replace(',', '.'));

  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function coverFromImages(images: unknown): string | null {
  if (!images) return null;

  if (Array.isArray(images)) {
    const first = images[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first && typeof first === 'object') {
      const url = (first as Record<string, unknown>).url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
    return null;
  }

  if (typeof images === 'object') {
    const r = images as Record<string, unknown>;
    const arr = Array.isArray(r.urls)
      ? r.urls
      : Array.isArray(r.items)
        ? r.items
        : null;
    if (arr && arr.length) return coverFromImages(arr);
  }

  return null;
}

function apiOrigin() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  return base.replace(/\/api\/?$/, '');
}

function toAbsoluteUrl(url: string | null) {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;

  if (u.startsWith('http://') || u.startsWith('https://')) return u;

  const origin = apiOrigin();
  if (u.startsWith('/')) return `${origin}${u}`;
  return `${origin}/${u}`;
}

export default function CatalogPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ✅ NOVO: filtros
  const [q, setQ] = useState('');
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetchJSON<Product[]>('/products');
        setItems(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        const err = e as ApiError;
        setError(err?.message ?? (e instanceof Error ? e.message : String(e)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ NOVO: lista filtrada
  const filtered = items.filter((it) => {
    const title = (it.title ?? it.name ?? '').toString().toLowerCase();
    const okQ = !q.trim() || title.includes(q.trim().toLowerCase());

    const hasPhoto = Boolean(toAbsoluteUrl(coverFromImages(it.images)));
    const okPhoto = !onlyWithPhoto || hasPhoto;

    return okQ && okPhoto;
  });

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Catálogo"
          description="Escolha um item para ver o ciclo funcionando."
        />

        {/* ✅ NOVO: filter bar */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar no catálogo…"
              className="w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/85 outline-none placeholder:text-white/50 focus:border-white/40"
            />
          </div>

          <label className="inline-flex select-none items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={onlyWithPhoto}
              onChange={(e) => setOnlyWithPhoto(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            Só com foto
          </label>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Carregando produtos…
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Nada encontrado.
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it) => {
              const href = `/shop/${encodeURIComponent(it.id)}`;
              const title = (it.title ?? it.name ?? 'Produto').toString();
              const img = toAbsoluteUrl(coverFromImages(it.images));

              return (
                <li
                  key={it.id}
                  className="overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                >
                  <Link href={href} className="block">
                    <div className="relative">
                      {img ? (
                        <div className="h-44 w-full bg-black/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={title}
                            className="h-44 w-full object-cover"
                            loading="lazy"
                            onError={() => {
                              // evita flood; debug rápido se algum upload estiver quebrado
                              console.log('CATALOG IMG ERROR:', img);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="grid h-44 w-full place-items-center bg-white/5 text-sm font-semibold text-white/60">
                          Sem foto
                        </div>
                      )}

                      <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
                        Verificado pelo rastro
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="line-clamp-2 text-base font-semibold text-white/90">
                        {title}
                      </div>

                      <div className="mt-2 text-sm font-semibold text-white">
                        {priceToLabel(it.price ?? null, it.priceCents ?? null)}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-white/60">
                          Loja:{' '}
                          <span className="font-mono text-white/70">
                            {it.merchantId.slice(0, 8)}…
                          </span>
                        </div>

                        <span className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">
                          Ver produto →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
