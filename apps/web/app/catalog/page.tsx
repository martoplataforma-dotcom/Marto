// apps/web/app/catalog/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJSON, type ApiError } from '../../src/lib/api';
import { PageHeader } from '@/components/marto/PageHeader';

type MerchantPublic = {
  id: string;
  tradeName?: string | null;
  displayName?: string | null;
  name?: string | null;
};

type Product = {
  id: string;
  title?: string | null;
  name?: string | null;
  price?: string | number | null;
  priceCents?: number | null;
  merchantId: string;

  // ✅ opcional (se o backend já retornar embed)
  merchant?: MerchantPublic | null;

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

  if (!Number.isFinite(n)) return String(raw || '—');
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

function merchantBestName(m?: MerchantPublic | null): string | null {
  const n =
    (m?.tradeName ?? m?.displayName ?? m?.name ?? '').toString().trim();
  return n ? n : null;
}

function shortId(id: string) {
  const s = String(id ?? '');
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-2)}`;
}

async function tryFetchMerchantsBatch(
  ids: string[],
): Promise<Record<string, string>> {
  // tenta endpoint batch (se existir)
  // ✅ opção A: /merchants/public?ids=a,b,c
  // ✅ opção B: /merchants?ids=a,b,c
  const qs = encodeURIComponent(ids.join(','));
  const candidates = [
    `/merchants/public?ids=${qs}`,
    `/merchants?ids=${qs}`,
  ] as const;

  for (const url of candidates) {
    try {
      const data = await fetchJSON<unknown>(url);

      // aceitamos array ou { merchants: [...] }
      const list = Array.isArray(data)
        ? data
        : (data &&
            typeof data === 'object' &&
            Array.isArray((data as Record<string, unknown>).merchants)) 
          ? ((data as Record<string, unknown>).merchants as unknown[])
          : null;

      if (!list) continue;

      const out: Record<string, string> = {};
      for (const row of list) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const id = typeof r.id === 'string' ? r.id : null;
        if (!id) continue;

        const name =
          (typeof r.tradeName === 'string' ? r.tradeName : null) ??
          (typeof r.displayName === 'string' ? r.displayName : null) ??
          (typeof r.name === 'string' ? r.name : null);

        const clean = (name ?? '').trim();
        if (clean) out[id] = clean;
      }
      return out;
    } catch {
      // segue pro próximo candidato
    }
  }

  return {};
}

async function tryFetchMerchantById(id: string): Promise<string | null> {
  const candidates = [
    `/merchants/${encodeURIComponent(id)}/public`,
    `/merchants/${encodeURIComponent(id)}`,
  ] as const;

  for (const url of candidates) {
    try {
      const data = await fetchJSON<unknown>(url);
      if (!data || typeof data !== 'object') continue;
      const r = data as Record<string, unknown>;

      // aceita { merchant: {...} } ou direto {...}
      const obj =
        r.merchant && typeof r.merchant === 'object'
          ? (r.merchant as Record<string, unknown>)
          : r;

      const name =
        (typeof obj.tradeName === 'string' ? obj.tradeName : null) ??
        (typeof obj.displayName === 'string' ? obj.displayName : null) ??
        (typeof obj.name === 'string' ? obj.name : null);

      const clean = (name ?? '').trim();
      if (clean) return clean;
    } catch {
      // next
    }
  }

  return null;
}

export default function CatalogPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // filtros
  const [q, setQ] = useState('');
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(false);

  // ✅ NOVO: map merchantId -> nome (resolvido)
  const [merchantNameById, setMerchantNameById] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetchJSON<Product[]>('/products');
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);

        // 1) aproveita embed do backend (se existir)
        const embedded: Record<string, string> = {};
        for (const p of arr) {
          const n = merchantBestName(p.merchant);
          if (n) embedded[p.merchantId] = n;
        }
        if (Object.keys(embedded).length) {
          setMerchantNameById((prev) => ({ ...prev, ...embedded }));
        }

        // 2) tenta resolver o resto via API (sem quebrar se não existir)
        const ids = Array.from(
          new Set(
            arr
              .map((p) => p.merchantId)
              .filter((id) => typeof id === 'string' && id.trim()),
          ),
        );

        // evita spam: resolve no máximo 60 lojistas nesse MVP
        const target = ids.slice(0, 60).filter((id) => !(embedded[id]));

        if (target.length) {
          // primeiro tenta batch
          const batch = await tryFetchMerchantsBatch(target);
          if (Object.keys(batch).length) {
            setMerchantNameById((prev) => ({ ...prev, ...batch }));
          }

          // depois tenta por-id somente os que ainda faltam (limite)
          const stillMissing = target
            .filter((id) => !(batch[id]))
            .slice(0, 18);

          if (stillMissing.length) {
            const results = await Promise.allSettled(
              stillMissing.map(async (id) => {
                const name = await tryFetchMerchantById(id);
                return { id, name };
              }),
            );

            const extra: Record<string, string> = {};
            for (const r of results) {
              if (r.status !== 'fulfilled') continue;
              const { id, name } = r.value;
              if (name) extra[id] = name;
            }
            if (Object.keys(extra).length) {
              setMerchantNameById((prev) => ({ ...prev, ...extra }));
            }
          }
        }
      } catch (e: unknown) {
        const err = e as ApiError;
        setError(err?.message ?? (e instanceof Error ? e.message : String(e)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
          description="Marto Index — descoberta + confiança. Produtos com rastro e lojas com reputação."
        />

        {/* filter bar */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="relative p-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_220px_at_20%_30%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(700px_220px_at_80%_10%,rgba(255,255,255,0.05),transparent_65%)]" />

            <div className="relative">
              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-white/60">Marto Index</div>
                <div className="text-lg font-semibold text-white/90">
                  Ache rápido. Confie rápido.
                </div>
                <div className="text-sm text-white/70">
                  Descoberta não é feed. É consequência de compra real.
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar produto, intenção, categoria…"
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

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70">
                  Rastro visual
                </span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70">
                  Multi-loja
                </span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70">
                  Experiências verificadas
                </span>

                <span className="ml-auto hidden text-xs text-white/55 sm:block">
                  Quanto mais rastro, menor risco.
                </span>
              </div>
            </div>
          </div>
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
              const href = `/shop/p/${encodeURIComponent(it.id)}`;
              const title = (it.title ?? it.name ?? 'Produto').toString();
              const img = toAbsoluteUrl(coverFromImages(it.images));

              const merchantName =
                merchantBestName(it.merchant) ??
                merchantNameById[it.merchantId] ??
                null;

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
                        {img ? 'Rastro visual ativo' : 'Rastro pendente'}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="line-clamp-2 text-base font-semibold text-white/90">
                        {title}
                      </div>

                      <div className="mt-2 text-sm font-semibold text-white">
                        {priceToLabel(it.price ?? null, it.priceCents ?? null)}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 text-xs text-white/60">
                          Loja:{' '}
                          <span className="truncate font-semibold text-white/80">
                            {merchantName ?? shortId(it.merchantId)}
                          </span>
                          {!merchantName && (
                            <span className="ml-2 font-mono text-white/45">
                              ({it.merchantId.slice(0, 6)}…)
                            </span>
                          )}
                        </div>

                        <span className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">
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
