// apps/web/app/dash/merchant/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

// ✅ API pode vir como http://localhost:3001/api
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
// ✅ assets NÃO podem usar /api (uploads ficam em /uploads)
const ASSETS_URL = API_URL.replace(/\/api\/?$/, '');

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function moneyFromCentsBRL(cents: number) {
  const n = Number(cents ?? 0) / 100;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

type Merchant = {
  id?: string;
  tradeName?: string | null;
  legalName?: string | null;
  document?: string | null;
  city?: string | null;
  cepPrefix?: string | null;
  status?: string | null;

  handle?: string | null; // ✅ (sem @ no banco)

  logoUrl?: string | null;
  coverUrl?: string | null;
};

type ProductItem = {
  id: string;
  title: string;
  description?: string | null;
  priceCents: number;
  active: boolean;
  images?: string[] | null;
  createdAt?: string;
};

type ProductsResponse = {
  ok: boolean;
  items: ProductItem[];
};

type CreateProductResponse =
  | { ok: true; created: ProductItem }
  | { ok: false; message: string };

type MerchantOrdersSummaryResponse = {
  ok: boolean;
  counts: Record<string, number>;
  needsActionCount: number;
  needsAction: Array<{
    id: string;
    status: string;
    createdAt: string;
    city: string | null;
    state: string | null;
  }>;
};

function statusLabel(status?: string | null) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'Ativa';
  if (s === 'REVIEW') return 'Em análise';
  if (s === 'BLOCKED') return 'Bloqueada';
  return '—';
}

/** ✅ helpers de status (pedidos) */
function orderStatusLabel(s?: string | null) {
  const k = String(s ?? '').toUpperCase();

  if (k === 'CREATED') return 'Criado';
  if (k === 'PAID') return 'Pago';
  if (k === 'CONFIRMED_BY_SELLER') return 'Confirmado';
  if (k === 'READY_FOR_PICKUP') return 'Pronto p/ retirada';
  if (k === 'IN_TRANSIT') return 'Em transporte';
  if (k === 'DELIVERED') return 'Entregue';
  if (k === 'COMPLETED') return 'Concluído';

  if (k === 'RETURN_REQUESTED') return 'Devolução solicitada';
  if (k === 'RETURN_IN_TRANSIT') return 'Devolução em trânsito';
  if (k === 'RETURNED') return 'Devolvido';
  if (k === 'DISPUTE') return 'Em disputa';

  if (k === 'CANCELLED' || k === 'CANCELED') return 'Cancelado';

  return k ? k.replace(/_/g, ' ') : '—';
}

function orderStatusTone(s?: string | null) {
  const k = String(s ?? '').toUpperCase();

  // final
  if (k === 'COMPLETED') return 'done';
  if (k === 'DELIVERED') return 'delivered';

  // ação
  if (k === 'RETURN_REQUESTED' || k === 'DISPUTE') return 'risk';
  if (k === 'READY_FOR_PICKUP' || k === 'CONFIRMED_BY_SELLER') return 'action';
  if (k === 'PAID') return 'paid';

  return 'neutral';
}

function StatusChip({ status }: { status: string }) {
  const tone = orderStatusTone(status);

  const cls =
    tone === 'done'
      ? 'border-white/25 bg-white text-black'
      : tone === 'delivered'
        ? 'border-white/20 bg-white/15 text-white'
        : tone === 'paid'
          ? 'border-white/20 bg-white/10 text-white'
          : tone === 'action'
            ? 'border-white/25 bg-white/10 text-white'
            : tone === 'risk'
              ? 'border-white/25 bg-white/10 text-white'
              : 'border-white/15 bg-black/40 text-white';

  const dot =
    tone === 'done'
      ? 'bg-black'
      : tone === 'risk'
        ? 'bg-white'
        : tone === 'action'
          ? 'bg-white'
          : tone === 'paid'
            ? 'bg-white'
            : 'bg-white/60';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {orderStatusLabel(status)}
    </span>
  );
}

// ✅ helper pequeno: limpar handle (sem @)
function cleanHandle(raw?: string | null) {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

// ✅ helper p/ decidir unoptimized no <Image />
function isRemoteHttp(src: string) {
  return /^https?:\/\//i.test(src);
}

// ✅ transforma qualquer coisa em URL válida p/ mostrar imagem
function assetUrl(urlOrPath?: string | null) {
  const v = String(urlOrPath ?? '').trim();
  if (!v) return null;

  if (isRemoteHttp(v)) return v;

  if (v.startsWith('/uploads/')) return `${ASSETS_URL}${v}`;

  return null;
}

function toRelativeUploadsPath(urlOrPath: string) {
  if (!urlOrPath) return null;

  if (urlOrPath.startsWith('/uploads/')) return urlOrPath;

  if (/^https?:\/\//i.test(urlOrPath)) {
    try {
      const u = new URL(urlOrPath);
      return u.pathname.startsWith('/uploads/') ? u.pathname : null;
    } catch {
      return null;
    }
  }

  return null;
}

/** ✅ helpers de placeholder */
function initialsFromName(name?: string | null) {
  const s = String(name ?? '').trim();
  if (!s) return 'M';
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'M';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return (a + b).toUpperCase();
}

function PlaceholderLogo({ name, size = 48 }: { name: string; size?: number }) {
  const initials = initialsFromName(name);
  return (
    <div
      className="grid place-items-center rounded-2xl border border-white/15 bg-white/10 font-bold text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
      style={{ width: size, height: size }}
      aria-label="Logo da loja (placeholder)"
    >
      <span className="text-sm">{initials}</span>
    </div>
  );
}

function PlaceholderCover() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="absolute inset-0 bg-[radial-gradient(700px_240px_at_20%_20%,rgba(255,255,255,0.10),transparent_60%),radial-gradient(700px_240px_at_80%_0%,rgba(255,255,255,0.08),transparent_60%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(0,0,0,0.6))]" />
      <div className="relative h-24 sm:h-28" />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white/90">{value}</div>
    </div>
  );
}

// ✅ (1) helper novo: InboxItem
function InboxItem({
  title,
  desc,
  right,
}: {
  title: string;
  desc: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="mt-0.5 text-xs text-white/70">{desc}</div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export default function MerchantDash() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [data, setData] = useState<Merchant | null>(null);

  const [tradeName, setTradeName] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsMsg, setProductsMsg] = useState('');

  const [ordersSummary, setOrdersSummary] =
    useState<MerchantOrdersSummaryResponse | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersMsg, setOrdersMsg] = useState('');

  const [pTitle, setPTitle] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pSaving, setPSaving] = useState(false);

  // ✅ foto do produto (upload)
  const [pFile, setPFile] = useState<File | null>(null);
  const [pUploading, setPUploading] = useState(false);

  // ✅ lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');

  // ✅ branding (logo/capa)
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  useEffect(() => {
    (async () => {
      setMsg('');
      setProductsMsg('');
      setOrdersMsg('');

      const token = getToken();
      if (!token) {
        setMsg('Sem token. Faça login novamente.');
        setLoading(false);

        setProductsLoading(false);
        setProducts([]);
        setProductsMsg('');

        setOrdersLoading(false);
        setOrdersSummary(null);

        return;
      }

      try {
        const m = await fetchJSON<Merchant>('/merchants/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setData(m);
        setTradeName(m.tradeName ?? '');
        setDocNumber(String(m.document ?? '').replace(/\D/g, '').slice(0, 14));
        setCity(m.city ?? '');
        setCepPrefix(m.cepPrefix ?? '');

        setLogoUrl(m.logoUrl ?? null);
        setCoverUrl(m.coverUrl ?? null);

        setProductsLoading(true);
        try {
          const pr = await fetchJSON<ProductsResponse>('/merchants/me/products', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });

          setProducts(Array.isArray(pr?.items) ? pr.items : []);
          setProductsMsg('');
        } catch (e: unknown) {
          const err = e as ApiError;
          setProductsMsg(err?.message ?? 'Não foi possível carregar produtos.');
          setProducts([]);
        } finally {
          setProductsLoading(false);
        }

        // ✅ Orders summary (Inbox real)
        setOrdersLoading(true);
        try {
          const os = await fetchJSON<MerchantOrdersSummaryResponse>(
            '/merchants/me/orders/summary',
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (os?.ok) {
            setOrdersSummary(os);
            setOrdersMsg('');
          } else {
            setOrdersSummary(null);
            setOrdersMsg('Não foi possível carregar as pendências de pedidos.');
          }
        } catch (e: unknown) {
          const err = e as ApiError;
          setOrdersSummary(null);
          setOrdersMsg(err?.message ?? 'Não foi possível carregar pedidos.');
        } finally {
          setOrdersLoading(false);
        }
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar o perfil da loja.');

        setProductsMsg('');
        setProducts([]);
        setProductsLoading(false);

        setOrdersSummary(null);
        setOrdersLoading(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ fecha com ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setLightboxSrc(null);
        setLightboxAlt('');
      }
    }

    if (lightboxOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }

    return undefined;
  }, [lightboxOpen]);

  // ✅ faz upload e devolve pathname "/uploads/arquivo.ext"
  async function uploadProductImage(file: File): Promise<string | null> {
    setProductsMsg('');
    setPUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      // ✅ usa rewrite do Next: /api -> http://localhost:3001/api (ou env)
      const resp = await fetch('/api/uploads', {
        method: 'POST',
        body: fd,
      });

      const json = (await resp.json()) as { ok?: boolean; url?: string };

      if (!resp.ok || !json?.ok || !json?.url) {
        setProductsMsg('Upload falhou. Tente outra imagem.');
        return null;
      }

      const rel = toRelativeUploadsPath(json.url);
      if (!rel) {
        setProductsMsg('Upload retornou URL inválida.');
        return null;
      }

      return rel;
    } catch {
      setProductsMsg('Erro ao enviar imagem.');
      return null;
    } finally {
      setPUploading(false);
    }
  }

  async function createProductQuick() {
    setMsg('');
    setProductsMsg('');

    const token = getToken();
    if (!token) {
      setMsg('Sem token. Faça login novamente.');
      return;
    }

    const title = pTitle.trim();
    const priceNum = Number(String(pPrice).replace(',', '.'));
    const priceCents = Math.round(priceNum * 100);

    if (!title) {
      setProductsMsg('Informe o nome do produto.');
      return;
    }

    if (!Number.isFinite(priceNum) || priceCents <= 0) {
      setProductsMsg('Informe um preço válido (ex: 299.90).');
      return;
    }

    setPSaving(true);
    try {
      let images: string[] | undefined;

      if (pFile) {
        const rel = await uploadProductImage(pFile);
        if (!rel) return; // productsMsg já foi setado no upload
        images = [rel];
      }

      const res = await fetchJSON<CreateProductResponse>('/merchants/me/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description: null,
          priceCents,
          images: images ?? null,
        }),
      });

      if (!res?.ok) {
        setProductsMsg(res?.message ?? 'Não foi possível criar o produto.');
        return;
      }

      setPTitle('');
      setPPrice('');
      setPFile(null);

      setProductsLoading(true);
      const pr = await fetchJSON<ProductsResponse>('/merchants/me/products', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(Array.isArray(pr?.items) ? pr.items : []);
      setProductsMsg('Produto criado.');
    } catch (e: unknown) {
      const err = e as ApiError;
      setProductsMsg(err?.message ?? 'Erro ao criar produto.');
    } finally {
      setPSaving(false);
      setProductsLoading(false);
    }
  }

  const showName =
    tradeName.trim() || data?.tradeName || (loading ? 'Carregando…' : 'Minha Loja');

  const showCity = city.trim() || data?.city || '—';
  const showCep = (cepPrefix.trim() || data?.cepPrefix || '—') as string;

  const publicHandle = cleanHandle(data?.handle);
  const publicShopHref = publicHandle
    ? `/loja/${publicHandle}`
    : '/dash/merchant/profile';

  const topProducts = useMemo(() => {
    const copy = [...products];
    copy.sort((a, b) => {
      const aa = a.active ? 1 : 0;
      const bb = b.active ? 1 : 0;
      if (aa !== bb) return bb - aa;
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    return copy.slice(0, 6);
  }, [products]);

  const coverAbs = assetUrl(coverUrl);
  const logoAbs = assetUrl(logoUrl);

  // ✅ Atalhos inteligentes (sem inventar feature)
  // ✅ (2) Inbox memo
  const inbox = useMemo(() => {
    const hasName = Boolean(tradeName.trim());
    const hasCnpj = /^\d{14}$/.test(docNumber);
    const hasCityOrCep =
      Boolean(city.trim()) || (cepPrefix ? /^\d{5}$/.test(cepPrefix) : false);
    const hasHandle = Boolean(publicHandle);

    const hasProduct = products.length > 0;
    const hasProductWithPhoto = products.some(
      (p) => Array.isArray(p.images) && p.images.length > 0,
    );

    const items: Array<{
      key: string;
      title: string;
      desc: string;
      ctaLabel: string;
      ctaHref?: string;
      ctaOnClick?: () => void;
    }> = [];

    // 1) Vitrine
    if (!hasHandle) {
      items.push({
        key: 'handle',
        title: 'Ativar vitrine pública',
        desc: 'Defina seu @handle para ter URL pública e compartilhar sua loja.',
        ctaLabel: 'Criar @handle',
        ctaHref: '/dash/merchant/profile',
      });
    }

    // 2) Perfil essencial
    if (!hasName || !hasCnpj || !hasCityOrCep) {
      items.push({
        key: 'perfil',
        title: 'Completar perfil essencial',
        desc: 'Nome, CNPJ e região aumentam confiança e reduzem atrito na venda.',
        ctaLabel: 'Completar',
        ctaHref: '/dash/merchant/profile',
      });
    }

    // 3) Produto vendável
    if (!hasProduct) {
      items.push({
        key: 'produto',
        title: 'Cadastrar 1º produto',
        desc: 'Um produto já vira vitrine. Depois você refina com calma.',
        ctaLabel: 'Cadastrar',
        ctaOnClick: () => scrollTo('produtos'),
      });
    } else if (!hasProductWithPhoto) {
      items.push({
        key: 'foto',
        title: 'Adicionar foto real em 1 produto',
        desc: 'Foto real aumenta conversão e melhora reputação.',
        ctaLabel: 'Gerenciar',
        ctaHref: '/dash/merchant/products',
      });
    }

    // Fallback: quando tudo está ok, ainda assim damos um próximo passo “Marto”
    if (items.length < 3) {
      items.push({
        key: 'operacao',
        title: 'Manter operação enxuta',
        desc: 'Confirme pedidos, evite atrasos e feche ciclo — reputação vira ativo.',
        ctaLabel: 'Abrir vendas',
        ctaHref: '/dash/merchant/orders',
      });
    }

    if (items.length < 3) {
      items.push({
        key: 'refinar',
        title: 'Refinar vitrine',
        desc: 'Ajuste título, descrição honesta e preço — menos disputa, mais confiança.',
        ctaLabel: 'Ver produtos',
        ctaHref: '/dash/merchant/products',
      });
    }

    return items.slice(0, 3);
  }, [tradeName, docNumber, city, cepPrefix, publicHandle, products]);

  const opsScore = useMemo(() => {
    const counts = (ordersSummary?.counts ?? {}) as Record<string, number>;
    const n = (k: string) => Number(counts?.[k] ?? 0);

    const returnReq = n('RETURN_REQUESTED'); // pós-venda/risco
    const readyPickup = n('READY_FOR_PICKUP'); // operação travando
    const confirmed = n('CONFIRMED_BY_SELLER'); // gargalo leve/médio
    const needs = Number(ordersSummary?.needsActionCount ?? 0);

    let score = 100;
    score -= returnReq * 18;
    score -= readyPickup * 8;
    score -= confirmed * 6;
    score -= needs * 5;

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    return score;
  }, [ordersSummary]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        {/* Topbar (compacta) */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white/80">Lojista • Marto</div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dash/merchant/profile"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Meu perfil
            </Link>

            <Link
              href="/dash/merchant/orders"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Vendas
            </Link>

            <Link
              href={publicShopHref}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Vitrine
            </Link>

            <Link
              href="/me"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Conta
            </Link>


            <button
              onClick={() => {
                localStorage.removeItem('marto_access');
                window.location.href = '/login';
              }}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Hero com capa + logo */}
        <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          {/* Cover */}
          <div className="-mx-7 -mt-7 mb-5">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              {coverAbs ? (
                <div className="relative h-24 sm:h-28">
                  <Image
                    src={coverAbs}
                    alt="Capa da loja"
                    fill
                    unoptimized={isRemoteHttp(coverAbs)}
                    className="object-cover"
                  />
                </div>
              ) : (
                <PlaceholderCover />
              )}
            </div>

            <div className="-mt-10 px-7">
              <div className="flex items-end gap-3">
                {logoAbs ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white/20 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <Image
                      src={logoAbs}
                      alt="Logo da loja"
                      fill
                      unoptimized={isRemoteHttp(logoAbs)}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <PlaceholderLogo name={showName} size={64} />
                )}

                <div className="min-w-0 pb-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                    Loja
                  </div>
                  <div className="truncate text-lg font-bold text-white/95">{showName}</div>

                  {publicHandle ? (
                    <div className="mt-1 text-xs font-semibold text-white/70">
                      @{publicHandle}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs font-semibold text-white/65">
                      defina seu @handle para ativar a vitrine pública
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                <span className="truncate">{showName}</span>
                <span className="text-white/65">•</span>
                <span className="text-white/75">reputação vira venda</span>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Painel do Lojista
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
                No Marto, o básico bem feito cria vantagem:{' '}
                <span className="font-semibold text-white/85">perfil completo</span> +{' '}
                <span className="font-semibold text-white/85">produto com foto real</span>.
                Depois, a plataforma amplifica sua visibilidade pela confiança.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/dash/merchant/profile"
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Editar perfil da loja
                </Link>

                <button
                  onClick={() => scrollTo('produtos')}
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Cadastrar produto
                </button>

              </div>

              {msg ? (
                <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  {msg}
                </div>
              ) : null}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[520px]">
              <Metric label="Status" value={statusLabel(data?.status)} />
              <Metric label="Cidade" value={String(showCity)} />
              <Metric label="CEP (prefixo)" value={String(showCep)} />
              <Metric
                label="Produtos"
                value={productsLoading ? '…' : String(products.length)}
              />
            </div>
          </div>
        </div>

        {/* Inbox do dia */}
        <div className="mt-5 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <SectionTitle
            title="Inbox do dia"
            desc="Ações curtas que destravam confiança agora. Operação simples, impacto real."
            right={
              <Link
                href="/dash/merchant/orders"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Abrir Vendas →
              </Link>
            }
          />

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Operação hoje
              </div>

              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-2xl font-bold text-white/95">{opsScore}</div>
                <div className="text-xs font-semibold text-white/70">score (0–100)</div>
              </div>

              <div className="mt-2 text-sm text-white/75">
                {opsScore >= 90
                  ? 'Fluxo saudável. Mantenha constância e foto real.'
                  : opsScore >= 75
                    ? 'Boa operação. Tem pequenos gargalos para destravar.'
                    : opsScore >= 55
                      ? 'Atenção: pedidos travando. Aja antes de virar disputa.'
                      : 'Risco alto: pós-venda e atrasos ameaçam reputação.'}
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-white/15 bg-black/40">
                <div className="h-full bg-white" style={{ width: `${opsScore}%` }} aria-hidden="true" />
              </div>

              <div className="mt-3 text-xs text-white/70">
                {ordersLoading
                  ? 'Carregando sinais…'
                  : `${ordersSummary?.needsActionCount ?? 0} pendência(s) exigem ação`}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Próximas ações
              </div>

              <div className="mt-3 grid gap-3">
                {inbox.length === 0 ? (
                  <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    Tudo certo por aqui. Próximo passo: evoluir vitrine e reputação.
                  </div>
                ) : (
                  inbox.map((it) => (
                    <InboxItem
                      key={it.key}
                      title={it.title}
                      desc={it.desc}
                      right={
                        it.ctaHref ? (
                          <Link
                            href={it.ctaHref}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
                          >
                            {it.ctaLabel} →
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={it.ctaOnClick}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
                          >
                            {it.ctaLabel} →
                          </button>
                        )
                      }
                    />
                  ))
                )}

                {/* ✅ Pedidos do dia (real) */}
                <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/90">Pedidos do dia</div>
                      <div className="mt-0.5 text-xs text-white/70">
                        Pendências que exigem ação do lojista.
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                        {ordersLoading ? '…' : String(ordersSummary?.needsActionCount ?? 0)}
                      </div>

                      <Link
                        href="/dash/merchant/orders"
                        className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
                      >
                        Abrir →
                      </Link>
                    </div>
                  </div>

                  {ordersMsg ? (
                    <div className="mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                      {ordersMsg}
                    </div>
                  ) : null}

                  {/* Mini contadores (Marto quick glance) */}
                  {!ordersLoading && ordersSummary?.counts ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                          A confirmar
                        </div>
                        <div className="mt-1 text-sm font-bold text-white/90">
                          {String(ordersSummary.counts.PAID ?? 0)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                          A preparar
                        </div>
                        <div className="mt-1 text-sm font-bold text-white/90">
                          {String(ordersSummary.counts.READY_FOR_PICKUP ?? 0)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                          Devolução
                        </div>
                        <div className="mt-1 text-sm font-bold text-white/90">
                          {String(ordersSummary.counts.RETURN_REQUESTED ?? 0)}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80">
                    {ordersLoading
                      ? 'Lendo operação…'
                      : (ordersSummary?.needsActionCount ?? 0) > 0
                        ? 'Prioridade: destravar pendências para proteger reputação.'
                        : 'Sem pendências críticas agora. Mantenha constância no fluxo.'}
                  </div>

                  <div className="mt-3 grid gap-2">
                    {ordersLoading ? (
                      <div className="text-xs text-white/70">Carregando pendências…</div>
                    ) : (ordersSummary?.needsAction?.length ?? 0) === 0 ? (
                      <div className="text-xs text-white/70">
                        Sem pendências agora. Reputação também é constância.
                      </div>
                    ) : (
                      ordersSummary!.needsAction.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <StatusChip status={o.status} />
                            <div className="mt-0.5 text-[11px] text-white/65">
                              {o.city ? String(o.city) : '—'}
                              {o.state ? ` • ${String(o.state)}` : ''}
                            </div>
                          </div>

                          <div className="shrink-0 text-[11px] font-semibold text-white/70">
                            {new Date(o.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/90">Fechar ciclo</div>
                      <div className="mt-0.5 text-xs text-white/70">
                        Venda → entrega/serviço → avaliação → dados. (MVP: em breve)
                      </div>
                    </div>

                    <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                      Em breve
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-white/70">
                    Quando isso estiver ativo, você vai ver aqui: avaliações pendentes, pós-venda e sinais de qualidade.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Produtos */}
        <div
          id="produtos"
          className="mt-5 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <SectionTitle
            title="Produtos"
            desc="Catálogo simples agora. Gestão completa depois."
            right={
              <a
                href="/dash/merchant/products"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Gerenciar →
              </a>
            }
          />

          {productsMsg ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {productsMsg}
            </div>
          ) : null}

          {/* Quick add */}
          <div className="mt-5 grid gap-3 sm:grid-cols-12">
            <label className="sm:col-span-5">
              <span className="text-sm font-semibold text-white/85">Nome do produto</span>
              <input
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                placeholder="Ex: Cadeira Madeira"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                disabled={productsLoading || pSaving || pUploading}
              />
            </label>

            <label className="sm:col-span-3">
              <span className="text-sm font-semibold text-white/85">Preço (R$)</span>
              <input
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                placeholder="Ex: 299.90"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                disabled={productsLoading || pSaving || pUploading}
                inputMode="decimal"
              />
            </label>

            <label className="sm:col-span-3">
              <span className="text-sm font-semibold text-white/85">Foto (opcional)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPFile(f);
                }}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-[10px] text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
                disabled={productsLoading || pSaving || pUploading}
              />
            </label>

            <div className="sm:col-span-1 flex items-end">
              <button
                onClick={createProductQuick}
                disabled={productsLoading || pSaving || pUploading}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {pUploading ? 'Enviando…' : pSaving ? 'Criando…' : 'Adicionar'}
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="mt-5">
            {productsLoading ? (
              <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                Buscando seus produtos…
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                Você ainda não tem produtos cadastrados.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topProducts.map((p) => {
                  const thumb = assetUrl(p.images?.[0] ?? null);

                  return (
                    <div
                      key={p.id}
                      className="rounded-3xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                    >
                      <div className="flex items-start gap-3">
                        {thumb ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxSrc(thumb);
                              setLightboxAlt(p.title);
                              setLightboxOpen(true);
                            }}
                            className="shrink-0"
                            title="Ampliar imagem"
                          >
                            <Image
                              src={thumb}
                              alt={p.title}
                              width={56}
                              height={56}
                              unoptimized={isRemoteHttp(thumb)}
                              className="h-14 w-14 rounded-2xl border border-white/15 object-cover hover:opacity-90"
                            />
                          </button>
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
                            <span className="text-[10px] font-semibold text-white/70">Sem foto</span>
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white/90">{p.title}</div>
                          <div className="mt-1 text-xs text-white/75">
                            R$ {moneyFromCentsBRL(p.priceCents)} • {p.active ? 'Ativo' : 'Inativo'}
                          </div>
                          <div className="mt-3 text-xs font-semibold text-white/70">
                            Ver detalhes → (em breve)
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!productsLoading && products.length > topProducts.length ? (
              <div className="mt-4 text-sm text-white/75">
                Mostrando {topProducts.length}. Gestão completa em breve.
              </div>
            ) : null}
          </div>
        </div>

        {/* Reputação */}
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <a
            href="/review"
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-neutral-950/80 lg:col-span-7"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Prioridade do Marto
            </div>
            <div className="mt-2 text-2xl font-bold text-white/95">Reputação</div>
            <div className="mt-2 text-sm text-white/75">
              Histórico real reduz risco e aumenta conversão. No começo: perfil completo + produto com foto.
            </div>
            <div className="mt-6 text-xs font-semibold text-white/80">Abrir →</div>
          </a>

          <div className="grid gap-4 lg:col-span-5">
            <ActionCard
              title="Vendas"
              desc="Acompanhe pedidos recebidos, timeline e ações do lojista."
              href="/dash/merchant/orders"
            />
            <ActionCard
              title="Produtos"
              desc="Cadastre itens com foto e prepare sua vitrine."
              href="/dash/merchant/products"
            />
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && lightboxSrc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setLightboxOpen(false);
            setLightboxSrc(null);
            setLightboxAlt('');
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setLightboxOpen(false);
                setLightboxSrc(null);
                setLightboxAlt('');
              }}
              className="absolute right-2 top-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              aria-label="Fechar"
            >
              ✕
            </button>

            <div className="overflow-hidden rounded-3xl border border-white/15 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={lightboxSrc}
                  unoptimized={isRemoteHttp(lightboxSrc)}
                  alt={lightboxAlt || 'Imagem do produto'}
                  fill
                  className="object-contain"
                />
              </div>

              {lightboxAlt ? (
                <div className="border-t border-white/15 bg-black px-4 py-3 text-sm font-semibold text-white/85">
                  {lightboxAlt}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ActionCard({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-neutral-950/80"
    >
      <div className="text-base font-semibold text-white/90">{title}</div>
      <div className="mt-2 text-sm text-white/75">{desc}</div>
      <div className="mt-6 text-xs font-semibold text-white/80">Abrir →</div>
    </Link>
  );
}
