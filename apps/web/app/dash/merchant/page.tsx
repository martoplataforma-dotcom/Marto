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

  handle?: string | null; // ✅ NOVO (sem @ no banco)

  // ✅ NOVO
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

function statusLabel(status?: string | null) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'Ativa';
  if (s === 'REVIEW') return 'Em análise';
  if (s === 'BLOCKED') return 'Bloqueada';
  return '—';
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

  // já é absoluto
  if (isRemoteHttp(v)) return v;

  // ✅ relativo do backend: /uploads/...
  // (sempre servir por ASSETS_URL, nunca /api)
  if (v.startsWith('/uploads/')) return `${ASSETS_URL}${v}`;

  // se vier algo estranho, não quebra UI
  return null;
}

function toRelativeUploadsPath(urlOrPath: string) {
  if (!urlOrPath) return null;

  // Se já vier relativo (/uploads/...), mantém
  if (urlOrPath.startsWith('/uploads/')) return urlOrPath;

  // Se vier absoluto, converte para pathname
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

function ProgressRow({
  ok,
  title,
  desc,
}: {
  ok: boolean;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border ${
          ok
            ? 'border-white/20 bg-white text-black'
            : 'border-white/15 bg-white/10 text-white'
        } text-xs font-bold`}
        aria-hidden="true"
      >
        {ok ? '✓' : '•'}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="mt-0.5 text-xs text-white/70">{desc}</div>
      </div>
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

  // ✅ NOVO: branding (logo/capa) (só leitura aqui no dashboard)
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

      const token = getToken();
      if (!token) {
        setMsg('Sem token. Faça login novamente.');
        setLoading(false);
        setProductsLoading(false);
        setProducts([]);
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

        // ✅ branding
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
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar o perfil da loja.');
        setProductsMsg('');
        setProducts([]);
        setProductsLoading(false);
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
      // ✅ Se tiver arquivo, sobe primeiro e salva em images[]
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
    tradeName.trim() ||
    data?.tradeName ||
    (loading ? 'Carregando…' : 'Minha Loja');

  const showCity = city.trim() || data?.city || '—';
  const showCep = (cepPrefix.trim() || data?.cepPrefix || '—') as string;

  // ✅ agora a vitrine pública é por handle (/loja/<handle>)
  const publicHandle = cleanHandle(data?.handle);
  const publicShopHref = publicHandle
    ? `/loja/${publicHandle}`
    : '/dash/merchant/profile';

  const profileProgress = useMemo(() => {
    const hasName = Boolean(tradeName.trim());
    const hasCnpj = /^\d{14}$/.test(docNumber);
    const hasCity = Boolean(city.trim());
    const hasCep = cepPrefix ? /^\d{5}$/.test(cepPrefix) : false;

    const hasProduct = products.length > 0;
    const hasProductWithPhoto = products.some(
      (p) => Array.isArray(p.images) && p.images.length > 0,
    );

    const steps = [
      {
        ok: hasName,
        title: 'Nome da loja',
        desc: 'É como você aparece pro cliente.',
      },
      {
        ok: hasCnpj,
        title: 'CNPJ válido',
        desc: 'Base pra vender com confiança e NF.',
      },
      {
        ok: hasCity || hasCep,
        title: 'Região',
        desc: 'Cidade e/ou CEP ajudam a entregar melhor.',
      },
      {
        ok: hasProduct,
        title: 'Primeiros produtos',
        desc: 'Catálogo simples, depois evolui.',
      },
      {
        ok: hasProductWithPhoto,
        title: 'Produto com foto',
        desc: 'Foto real aumenta conversão e reputação.',
      },
    ];

    const total = steps.length;
    const done = steps.filter((s) => s.ok).length;
    const pct = Math.round((done / total) * 100);

    // ✅ pega no máximo 3 pendências (as mais impactantes primeiro)
    const pending = steps.filter((s) => !s.ok).slice(0, 3);

    // ✅ próximo melhor CTA (agora vai pra página nova)
    const nextFocus =
      !hasName || !hasCnpj || (!hasCity && !hasCep) ? 'perfil' : 'produtos';

    return { steps, done, total, pct, pending, nextFocus };
  }, [tradeName, docNumber, city, cepPrefix, products]);

  const topProducts = useMemo(() => {
    // mostra ativos primeiro, depois recentes
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

  const profileBarW = `${Math.max(0, Math.min(100, profileProgress.pct))}%`;

  // ✅ branding previews
  const coverAbs = assetUrl(coverUrl);
  const logoAbs = assetUrl(logoUrl);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        {/* Topbar (compacta) */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white/80">Lojista • Marto</div>

          <div className="flex flex-wrap gap-2">
            {/* ✅ A) Meu perfil agora vai pra página nova */}
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

            <a
              href="/profile"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Configurações
            </a>

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

        {/* ✅ Hero com capa + logo (reais quando existir) */}
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
                  <div className="truncate text-lg font-bold text-white/95">
                    {showName}
                  </div>

                  {/* ✅ mostra @handle se existir */}
                  {publicHandle ? (
                    <div className="mt-1 text-xs font-semibold text-white/70">
                      @{publicHandle}
                    </div>
                  ) : null}
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
                O começo que mais vende:{' '}
                <span className="font-semibold text-white/85">perfil completo</span>{' '}
                + <span className="font-semibold text-white/85">produto com foto</span>.
                Depois, o Marto amplifica sua visibilidade pela reputação.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {/* ✅ B) botão agora leva pra página nova */}
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

                <a
                  href="/review"
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Avaliações (MVP)
                </a>

                <a
                  href="/choose-role"
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Adicionar papel
                </a>
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

        {/* Hoje */}
        <div className="mt-5 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <SectionTitle
            title="Hoje"
            desc="O que destrava venda e confiança mais rápido."
            right={
              <div className="flex items-center gap-2">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                  {profileProgress.pct}%
                </div>

                {profileProgress.nextFocus === 'perfil' ? (
                  <Link
                    href="/dash/merchant/profile"
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                  >
                    Fazer agora →
                  </Link>
                ) : (
                  <button
                    onClick={() => scrollTo('produtos')}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                  >
                    Fazer agora →
                  </button>
                )}
              </div>
            }
          />

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full border border-white/15 bg-black/40">
              <div
                className="h-full bg-white"
                style={{ width: profileBarW }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-2 text-xs text-white/70">
              {profileProgress.done}/{profileProgress.total} passos concluídos • Reputação
              vira ativo.
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {(profileProgress.pending.length > 0
              ? profileProgress.pending
              : profileProgress.steps.slice(0, 3)
            ).map((s) => (
              <ProgressRow key={s.title} ok={s.ok} title={s.title} desc={s.desc} />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
            Dica: <span className="font-semibold text-white/85">foto real</span> +{' '}
            <span className="font-semibold text-white/85">descrição honesta</span> =
            menos disputa, mais confiança.
          </div>
        </div>

        {/* Vitrine pública */}
        <div className="mt-5 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <SectionTitle
            title="Vitrine pública"
            desc="É assim que o cliente te vê — e é aqui que a confiança começa."
            right={
              <Link
                href={publicShopHref}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Abrir →
              </Link>
            }
          />

          {/* ✅ aviso quando não tiver handle */}
          {!publicHandle ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              Você ainda não definiu seu <span className="font-semibold">@handle</span>. Vá
              em{' '}
              <Link className="underline" href="/dash/merchant/profile">
                Meu perfil
              </Link>{' '}
              para criar a URL pública da loja.
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            {/* card Loja */}
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 lg:col-span-5">
              <div className="flex items-start gap-3">
                {logoAbs ? (
                  <div className="relative h-14 w-14 overflow-hidden rounded-3xl border border-white/20 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <Image
                      src={logoAbs}
                      alt="Logo da loja"
                      fill
                      unoptimized={isRemoteHttp(logoAbs)}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <PlaceholderLogo name={showName} size={56} />
                )}

                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                    Loja
                  </div>
                  <div className="mt-1 truncate text-lg font-bold text-white/95">
                    {showName}
                  </div>
                  <div className="mt-1 text-sm text-white/75">
                    {String(showCity)} • CEP {String(showCep)}
                  </div>
                  {publicHandle ? (
                    <div className="mt-1 text-xs font-semibold text-white/70">
                      @{publicHandle}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                  Status: {statusLabel(data?.status)}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                  Produtos: {productsLoading ? '…' : products.length}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80">
                Reputação é mais forte que volume. Comece pelo básico bem feito.
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Destaques
              </div>

              <div className="mt-3 grid gap-3">
                {productsLoading ? (
                  <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    Carregando produtos…
                  </div>
                ) : products.length === 0 ? (
                  <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    Nenhum produto ainda. Cadastre pelo menos 1 com foto.
                  </div>
                ) : (
                  products.slice(0, 3).map((p) => {
                    const thumb = assetUrl(p.images?.[0] ?? null);

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                      >
                        <div className="flex items-center gap-3">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt={p.title}
                              width={44}
                              height={44}
                              unoptimized={isRemoteHttp(thumb)}
                              className="h-11 w-11 rounded-xl border border-white/15 object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                              <span className="text-[10px] font-semibold text-white/70">
                                Sem foto
                              </span>
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white/90">
                              {p.title}
                            </div>
                            <div className="mt-0.5 text-xs text-white/75">
                              R$ {moneyFromCentsBRL(p.priceCents)} •{' '}
                              {p.active ? 'Ativo' : 'Inativo'}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-white/70">Em breve →</div>
                      </div>
                    );
                  })
                )}

                <div className="text-sm text-white/70">
                  O cliente descobre pelo{' '}
                  <span className="font-semibold text-white/85">catálogo</span> e decide
                  pela <span className="font-semibold text-white/85">confiança</span>.
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
                            <span className="text-[10px] font-semibold text-white/70">
                              Sem foto
                            </span>
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white/90">
                            {p.title}
                          </div>
                          <div className="mt-1 text-xs text-white/75">
                            R$ {moneyFromCentsBRL(p.priceCents)} •{' '}
                            {p.active ? 'Ativo' : 'Inativo'}
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
              Histórico real reduz risco e aumenta conversão. No começo: perfil completo +
              produto com foto.
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

        {/* ✅ C) Seção “Perfil da loja” REMOVIDA (agora é /dash/merchant/profile) */}
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
