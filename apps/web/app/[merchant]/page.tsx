// apps/web/app/loja/[handle]/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Copy, Instagram, MessageCircle, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';

type PublicMerchant = {
  id: string;
  handle?: string | null;
  tradeName?: string | null;
  city?: string | null;
  cepPrefix?: string | null;
  status?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

type ProductItem = {
  id: string;
  title: string;
  priceCents: number;
  active: boolean;
  images?: string[] | null;
};

// ✅ API pode vir como http://localhost:3001/api
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
// ✅ assets NÃO podem usar /api (uploads ficam em /uploads)
const ASSETS_URL = API_URL.replace(/\/api\/?$/, '');

function isRemoteHttp(src: string) {
  return /^https?:\/\//i.test(src);
}

// ✅ resolve de assets (idêntico ao padrão do resto do projeto)
function resolveAsset(urlOrPath?: string | null) {
  const v = String(urlOrPath ?? '').trim();
  if (!v) return null;

  // já é absoluto
  if (isRemoteHttp(v)) return v;

  // relativo do backend: /uploads/...
  if (v.startsWith('/uploads/')) return `${ASSETS_URL}${v}`;

  return null;
}

function moneyFromCentsBRL(cents: number) {
  const n = Number(cents ?? 0) / 100;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function statusLabel(status?: string | null) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'Ativa';
  if (s === 'REVIEW') return 'Em análise';
  if (s === 'BLOCKED') return 'Bloqueada';
  return '—';
}

function initials(name: string) {
  const s = String(name ?? '').trim();
  if (!s) return 'M';
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? '').toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
  const out = `${a}${b}`.slice(0, 2);
  return out || 'M';
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white/90">{value}</div>
    </div>
  );
}

function SectionTitle({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-lg font-semibold text-white/90">{title}</div>
        {desc ? <div className="mt-1 text-sm text-white/75">{desc}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
      {children}
    </span>
  );
}

export default function PublicShopByHandlePage({
  params,
}: {
  params: Promise<{ merchant: string }>;
}) {
  const { merchant } = use(params);
  const handle = merchant.replace(/^@/, '');
  const raw = String(merchant ?? handle ?? '');
  const decoded = decodeURIComponent(raw);
  const clean = decoded.replace(/^@+/, '').trim();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [m, setM] = useState<PublicMerchant | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [origin, setOrigin] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrMsg('');

      if (!handle) {
        setErrMsg('Loja inválida.');
        setLoading(false);
        return;
      }

      try {
        const merchant = await fetchJSON<PublicMerchant>(`/shops/handle/${handle}`, {
          method: 'GET',
        });

        const items = await fetchJSON<{ ok: boolean; items: ProductItem[] }>(
          `/shops/handle/${handle}/products`,
          { method: 'GET' },
        );

        setM(merchant);
        setProducts(Array.isArray(items?.items) ? items.items : []);
      } catch (e: unknown) {
        const a = e as ApiError;
        setErrMsg(a?.message ?? 'Não foi possível carregar a loja.');
        setM(null);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [handle]);

  const showName = m?.tradeName || (loading ? 'Carregando…' : 'Loja');
  const showCity = m?.city || '—';
  const showCep = m?.cepPrefix || '—';
  const canonicalPath = clean ? `/@${clean}` : '';
  const shortPath = clean ? `/s/${clean}` : '';
  const canonicalUrl = origin && canonicalPath ? `${origin}${canonicalPath}` : '';
  const shortUrl = origin && shortPath ? `${origin}${shortPath}` : '';
  const waHref = shortUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Veja a vitrine da ${showName}: ${shortUrl}`)}`
    : '#';

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!qrOpen || !shortUrl) return;
      const dataUrl = await QRCode.toDataURL(shortUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        scale: 8,
      });
      setQrDataUrl(dataUrl);
    };
    run();
  }, [qrOpen, shortUrl]);

  const visibleProducts = useMemo(
    () => products.filter((p) => p.active).slice(0, 24),
    [products],
  );

  const coverUrl = resolveAsset(m?.coverUrl ?? null);
  const logoUrl = resolveAsset(m?.logoUrl ?? null);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        {/* Top */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white/80">Marto • Loja</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/catalog"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Voltar ao catálogo
            </Link>
          </div>
        </div>

        {/* HERO */}
        <div className="overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="relative h-40 w-full">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt="Capa da loja"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1200px"
                priority
                unoptimized={isRemoteHttp(coverUrl)}
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_20%_10%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(900px_320px_at_80%_0%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.75))]" />
                <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
          </div>

          <div className="p-6 sm:p-8">
            <div className="-mt-14 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white/20 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt="Logo da loja"
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized={isRemoteHttp(logoUrl)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="text-xl font-black tracking-tight text-white/90">
                        {initials(showName)}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>@{handle}</Badge>
                    <Badge>
                      <span className="text-white/65">Status:</span>{' '}
                      <span className="text-white/90">{statusLabel(m?.status)}</span>
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-white">{showName}</h1>

                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                      @{clean}
                    </span>

                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={waHref === '#'}
                      onClick={(e) => {
                        if (waHref === '#') e.preventDefault();
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                      title="Compartilhar no WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!shortUrl) return;
                        await navigator.clipboard.writeText(shortUrl);
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                      title="Copiar link"
                      aria-label="Copiar link"
                      disabled={!shortUrl}
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!shortUrl) return;

                        await navigator.clipboard.writeText(shortUrl);

                        // abre Instagram
                        window.open('https://www.instagram.com/', '_blank');
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                      title="Compartilhar no Instagram"
                      aria-label="Compartilhar no Instagram"
                    >
                      <Instagram className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrOpen(true)}
                      className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                      title="QR Code"
                      aria-label="QR Code"
                      disabled={!shortUrl}
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
                    Loja pública no Marto. Aqui reputação nasce da experiência real — não
                    de promessa.
                  </p>

                  {errMsg ? (
                    <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                      {errMsg}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#produtos"
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Ver produtos
                </a>
              </div>
            </div>

            <div className="mt-6 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Chip label="Cidade" value={String(showCity)} />
              <Chip label="CEP (prefixo)" value={String(showCep)} />
              <Chip
                label="Produtos ativos"
                value={loading ? '…' : String(visibleProducts.length)}
              />
            </div>
          </div>
        </div>

        {/* Produtos */}
        <div
          id="produtos"
          className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <SectionTitle
            title="Produtos"
            desc="Itens ativos desta loja."
            right={
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                {loading ? '…' : `${visibleProducts.length} item(ns)`}
              </span>
            }
          />

          <div className="mt-5">
            {loading ? (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                Carregando…
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                Esta loja ainda não tem produtos ativos.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((p) => {
                  const img = resolveAsset(p.images?.[0] ?? null);

                  return (
                    <Link
                      key={p.id}
                      href={`/shop/p/${p.id}`}
                      className="group overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-neutral-950/80"
                    >
                      <div className="relative aspect-[16/11] w-full overflow-hidden rounded-t-3xl bg-black">
                        {img ? (
                          <Image
                            src={img}
                            alt={p.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover"
                            unoptimized={isRemoteHttp(img)}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="text-xs font-semibold text-white/70">
                              Sem foto
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="truncate text-sm font-semibold text-white/90">
                          {p.title}
                        </div>
                        <div className="mt-1 text-xs text-white/75">
                          R$ {moneyFromCentsBRL(p.priceCents)}
                        </div>

                        <div className="mt-4 text-xs font-semibold text-white/70 group-hover:text-white/85">
                          Ver detalhes →
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 text-sm text-white/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="font-semibold text-white/85">Sobre esta loja</div>
          <div className="mt-2">
            Local: {String(showCity)} • CEP {String(showCep)}. Status:{' '}
            {statusLabel(m?.status)}.
          </div>
          <div className="mt-2">
            No MVP, algumas métricas públicas ainda estão “em construção”. O objetivo é
            transformar experiência real em confiança verificável.
          </div>
        </div>
      </div>
      {qrOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* backdrop */}
          <button
            type="button"
            onClick={() => setQrOpen(false)}
            className="absolute inset-0 bg-black/70"
            aria-label="Fechar"
          />

          {/* card */}
          <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">QR da sua vitrine</div>
                <div className="text-xs text-white/65">Escaneie para abrir no Marto</div>
              </div>

              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative rounded-2xl border border-white/15 bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR Code" className="h-56 w-56" />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center text-sm text-neutral-600">
                    Gerando…
                  </div>
                )}

                {/* marca Marto (centro) */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-black/10 bg-white shadow-[0_6px_30px_rgba(0,0,0,0.18)]">
                    <span className="text-sm font-black tracking-tight text-neutral-950">M</span>
                  </div>
                </div>
              </div>

              <div className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                {shortUrl || '—'}
              </div>

              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!shortUrl) return;
                    await navigator.clipboard.writeText(shortUrl);
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
                  disabled={!shortUrl}
                >
                  Copiar link
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!qrDataUrl) return;
                    const a = document.createElement('a');
                    a.href = qrDataUrl;
                    a.download = `marto-${String(clean || 'vitrine')}.png`;
                    a.click();
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
                  disabled={!qrDataUrl}
                >
                  Baixar PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
