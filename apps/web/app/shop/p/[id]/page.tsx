// apps/web/app/shop/p/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { VerifiedSocialSummary } from '../../../../components/marto/VerifiedSocialSummary';
import { ImageWithCaption } from './ImageWithCaption';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price?: number; // legacy
  priceCents?: number | null;
  merchantId: string;
  images?: string[];
  /**
   * (opcional) Permite definir uma legenda rápida para cada foto do produto.
   * Exemplo: ["Fabricada em MDF de alta qualidade", "Detalhe do acabamento em couro"].
   * Se omitido ou menor que o número de fotos, nenhuma legenda aparecerá.
   */
  imageCaptions?: (string | null)[];
  imageInsights?: ProductImageInsight[] | null;
  productHandle?: string | null;
  merchantHandle?: string | null;
  merchantTradeName?: string | null;
};

type ProductImageInsight = {
  overview?: string[] | null;
  hotspots?: ImageHotspot[] | null;
};

type ImageHotspot = {
  x: number; // 0..100
  y: number; // 0..100
  title: string;
  description?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type ProductDetailResponse =
  | { ok: true; product: Product }
  | { ok: false; message?: string };

// ✅ flexível sem usar any (lint-friendly)
type CreateOrderResponse = unknown;

// ✅ Social posts do produto (verificados)
type SocialPost = {
  id: string;
  caption?: string | null;
  createdAt: string;
  userId: string;

  // ✅ agora aceita mídia (MVP)
  media?: Array<{ type?: 'IMAGE' | 'VIDEO'; url?: string | null }> | null;
};

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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function extractErrorMessage(data: unknown, fallback: string) {
  const r = asRecord(data);
  const msg = r?.message ?? r?.error;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof data === 'string' && data.trim()) return data;
  return fallback;
}

function isSocialPostsByProductOk(
  x: unknown,
): x is { ok: true; posts: SocialPost[] } {
  const r = asRecord(x);
  if (!r) return false;
  if (r.ok !== true) return false;
  return Array.isArray(r.posts);
}

function socialPostsErrorMessage(x: unknown) {
  const r = asRecord(x);
  const msg = r?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'Não foi possível carregar experiências.';
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

function coverFromImages(images?: string[] | null): string | null {
  if (!images || !Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (typeof first === 'string' && first.trim()) return first.trim();
  return null;
}

/* ===========================
   ✅ SHIPPING ESTIMATOR (MVP)
   - viaCEP + heurística simples
   - usa ficha técnica (peso/dimensões) dentro da description
   =========================== */

type ViaCep = {
  erro?: boolean;
  cep?: string;
  localidade?: string;
  uf?: string;
};

function onlyDigits(s: string) {
  return String(s ?? '').replace(/\D/g, '');
}

function cepMask(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function readLocalCep() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('marto:last_cep') ?? '';
}

function saveLocalCep(cep: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('marto:last_cep', cep);
}

/**
 * ✅ Extrai peso/dimensões da description (se você está usando o bloco "Ficha técnica (Marto)")
 * Ajuste se seu marcador tiver nome diferente.
 */
function extractTech(desc: string) {
  const s = String(desc ?? '');

  const startMarker = '---\n### Ficha técnica (Marto)\n';
  const endMarker = '\n### /Ficha técnica (Marto)\n---';

  const start = s.indexOf(startMarker);
  if (start === -1) return { weightKg: '', l: '', w: '', h: '' };

  const end = s.indexOf(endMarker, start);
  if (end === -1) return { weightKg: '', l: '', w: '', h: '' };

  const inside = s.slice(start, end);

  const weightMatch = inside.match(/Peso:\s*([0-9.,]+)\s*kg/i);
  const dimsMatch = inside.match(
    /Dimensões:\s*([0-9.,]+)\s*x\s*([0-9.,]+)\s*x\s*([0-9.,]+)\s*cm/i,
  );

  return {
    weightKg: weightMatch?.[1] ?? '',
    l: dimsMatch?.[1] ?? '',
    w: dimsMatch?.[2] ?? '',
    h: dimsMatch?.[3] ?? '',
  };
}

function extractIdentity(desc: string) {
  const s = String(desc ?? '');

  const startMarker = '---\n### Identidade (Marto)\n';
  const endMarker = '\n### /Identidade (Marto)\n---';

  const start = s.indexOf(startMarker);
  if (start === -1) return { handle: '' };

  const end = s.indexOf(endMarker, start);
  if (end === -1) return { handle: '' };

  const inside = s.slice(start, end);

  const handleMatch = inside.match(/Handle:\s*([a-z0-9-_.]+)/i);

  return {
    handle: String(handleMatch?.[1] ?? '').trim(),
  };
}

type PublicCatalogOptionGroup = {
  name: string;
  values: string[];
};

type PublicCatalogVariant = {
  key: string;
  sku: string;
  stock: string;
  attributes: Array<{ name: string; value: string }>;
};

function extractCatalog(desc: string) {
  const s = String(desc ?? '');

  const startMarker = '---\n### Catálogo (Marto)\n';
  const endMarker = '\n### /Catálogo (Marto)\n---';

  const start = s.indexOf(startMarker);
  if (start === -1) {
    return {
      tipo: '',
      inventario: '',
      preparoDias: '',
      estoque: '',
      optionGroups: [] as PublicCatalogOptionGroup[],
      variants: [] as PublicCatalogVariant[],
    };
  }

  const end = s.indexOf(endMarker, start);
  if (end === -1) {
    return {
      tipo: '',
      inventario: '',
      preparoDias: '',
      estoque: '',
      optionGroups: [] as PublicCatalogOptionGroup[],
      variants: [] as PublicCatalogVariant[],
    };
  }

  const inside = s.slice(start, end);
  const lines = inside
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const tipo = inside.match(/Tipo:\s*(.+)/i)?.[1]?.trim() ?? '';
  const inventario = inside.match(/Inventário:\s*(.+)/i)?.[1]?.trim() ?? '';
  const preparoDias =
    inside.match(/Prazo de preparação:\s*([0-9]+)/i)?.[1]?.trim() ?? '';
  const estoque = inside.match(/Estoque:\s*([0-9]+)/i)?.[1]?.trim() ?? '';

  const variants: PublicCatalogVariant[] = [];
  let inVariants = false;

  for (const line of lines) {
    const low = line.toLowerCase();

    if (low.startsWith('variações:')) {
      inVariants = true;
      continue;
    }

    if (!inVariants || !line.startsWith('- ')) continue;

    const raw = line.slice(2).trim();
    const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);

    const attributes: Array<{ name: string; value: string }> = [];
    let sku = '';
    let stockValue = '';

    for (const part of parts) {
      const [rawName, ...rest] = part.split('=');
      const name = String(rawName ?? '').trim();
      const value = rest.join('=').trim();

      if (!name) continue;

      const lowName = name.toLowerCase();
      if (lowName === 'sku') {
        sku = value;
        continue;
      }
      if (lowName === 'estoque') {
        stockValue = value;
        continue;
      }

      attributes.push({ name, value });
    }

    const key = attributes.map((a) => `${a.name}=${a.value}`).join(' | ').trim();

    if (key) {
      variants.push({
        key,
        sku,
        stock: stockValue,
        attributes,
      });
    }
  }

  const map = new Map<string, Set<string>>();

  for (const variant of variants) {
    for (const attr of variant.attributes) {
      const name = String(attr.name ?? '').trim();
      const value = String(attr.value ?? '').trim();
      if (!name || !value) continue;

      if (!map.has(name)) map.set(name, new Set<string>());
      map.get(name)?.add(value);
    }
  }

  const optionGroups: PublicCatalogOptionGroup[] = Array.from(map.entries()).map(
    ([name, values]) => ({
      name,
      values: Array.from(values),
    }),
  );

  return {
    tipo,
    inventario,
    preparoDias,
    estoque,
    optionGroups,
    variants,
  };
}

function findVariantFromSelected(
  variants: PublicCatalogVariant[],
  selected: Record<string, string>,
) {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  return (
    variants.find((variant) => {
      if (!Array.isArray(variant.attributes) || variant.attributes.length === 0) {
        return false;
      }

      return variant.attributes.every(
        (attr) => selected[attr.name] === attr.value,
      );
    }) ?? null
  );
}

function formatVariantSummary(variant: PublicCatalogVariant | null) {
  if (!variant) return '';
  return variant.attributes.map((a) => `${a.name}: ${a.value}`).join(' • ');
}

function quickViewLabel(index: number, overview?: string[] | null) {
  const first = Array.isArray(overview) ? String(overview[0] ?? '').trim() : '';
  if (first) return first;
  if (index === 0) return 'Vista principal';
  if (index === 1) return 'Detalhe da peça';
  if (index === 2) return 'Textura e material';
  if (index === 3) return 'Leitura lateral';
  return `Vista ${index + 1}`;
}

function stripMartoBlocks(desc: string) {
  const s = String(desc ?? '');

  const blocks = [
    {
      start: '---\n### Ficha técnica (Marto)\n',
      end: '\n### /Ficha técnica (Marto)\n---',
    },
    {
      start: '---\n### Identidade (Marto)\n',
      end: '\n### /Identidade (Marto)\n---',
    },
    {
      start: '---\n### Catálogo (Marto)\n',
      end: '\n### /Catálogo (Marto)\n---',
    },
  ];

  let out = s;

  for (const b of blocks) {
    const a = out.indexOf(b.start);
    if (a === -1) continue;
    const z = out.indexOf(b.end, a);
    if (z === -1) {
      out = out.slice(0, a).trim();
      continue;
    }
    out = (out.slice(0, a) + out.slice(z + b.end.length)).trim();
  }

  return out.trim();
}

/**
 * ✅ Estimativa MVP (sem transportadora):
 * - usa UF (distância aproximada) + peso (faixas)
 * - retorna faixa de preço + prazo aproximado
 * (depois substituímos por cotação real com Transportadora)
 */
function estimateShipping(params: { uf?: string; weightKg?: number }) {
  const uf = String(params.uf ?? '').toUpperCase();
  const w = Number(params.weightKg ?? 0);

  const weightBand =
    w <= 1 ? 1 : w <= 5 ? 2 : w <= 10 ? 3 : w <= 20 ? 4 : 5;

  // “perto/médio/longe” bem simples (MVP)
  const southSE = new Set(['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS']);
  const mid = new Set(['GO', 'DF', 'MS', 'MT', 'BA']);
  const far = new Set([
    'AM',
    'PA',
    'RO',
    'RR',
    'AP',
    'AC',
    'TO',
    'MA',
    'PI',
    'CE',
    'RN',
    'PB',
    'PE',
    'AL',
    'SE',
  ]);

  const zone = southSE.has(uf)
    ? 'NEAR'
    : mid.has(uf)
      ? 'MID'
      : far.has(uf)
        ? 'FAR'
        : 'MID';

  // faixa base por zona
  const base = zone === 'NEAR' ? 25 : zone === 'MID' ? 35 : 45;

  // incremento por peso
  const add =
    weightBand === 1
      ? 8
      : weightBand === 2
        ? 18
        : weightBand === 3
          ? 28
          : weightBand === 4
            ? 38
            : 55;

  const min = Math.round(base + add);
  const max = Math.round(min + (zone === 'FAR' ? 35 : 25));

  const days =
    zone === 'NEAR'
      ? ([2, 5] as [number, number])
      : zone === 'MID'
        ? ([4, 8] as [number, number])
        : ([6, 12] as [number, number]);

  return { min, max, days, zone };
}

function moneyBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ShippingEstimator({ description }: { description?: string | null }) {
  const tech = extractTech(description ?? '');
  const [cep, setCep] = useState(() => cepMask(readLocalCep()));
  const [loading, setLoading] = useState(false);
  const [where, setWhere] = useState<{ city?: string; uf?: string } | null>(
    null,
  );
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{
    min: number;
    max: number;
    days: [number, number];
    zone: string;
    usedWeight?: number;
  } | null>(null);

  const weightNum = Number(String(tech.weightKg).replace(',', '.'));
  const hasWeight = Number.isFinite(weightNum) && weightNum > 0;

  async function calc() {
    setErr('');
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      setErr('Digite um CEP válido (8 números).');
      return;
    }

    setLoading(true);
    try {
      saveLocalCep(cepMask(digits));

      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = (await resp.json()) as ViaCep;

      if (!resp.ok || json?.erro) {
        setErr('CEP não encontrado.');
        setWhere(null);
        setResult(null);
        return;
      }

      const uf = json.uf ?? '';
      setWhere({ city: json.localidade ?? '', uf });

      if (!hasWeight) {
        setResult(null);
        setErr(
          'Este produto ainda não tem peso/dimensões. Frete preciso exige ficha técnica.',
        );
        return;
      }

      const est = estimateShipping({ uf, weightKg: weightNum });
      setResult({ ...est, usedWeight: weightNum });
    } catch {
      setErr('Erro ao calcular. Tente novamente.');
      setWhere(null);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Meios de envio
          </div>
          <div className="mt-1 text-xs text-white/65">
            Estimativa (MVP). Depois: cotação real por transportadoras no Marto.
          </div>
        </div>

        {hasWeight ? (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80">
            Peso: {String(tech.weightKg).trim()} kg
          </span>
        ) : (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
            Falta ficha técnica
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-2">
          <span className="text-xs font-semibold text-white/65">Seu CEP</span>
          <input
            value={cep}
            onChange={(e) => setCep(cepMask(e.target.value))}
            className="rounded-xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
            placeholder="00000-000"
            inputMode="numeric"
          />
        </label>

        <button
          type="button"
          onClick={calc}
          disabled={loading}
          className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          {loading ? 'Calculando…' : 'Calcular'}
        </button>

        <button
          type="button"
          onClick={() => window.open('https://viacep.com.br', '_blank')}
          className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-black/55"
        >
          Não sei meu CEP
        </button>
      </div>

      {where?.uf ? (
        <div className="mt-3 text-xs text-white/70">
          Entrega para{' '}
          <span className="font-semibold text-white/85">{where.city}</span> •{' '}
          <span className="font-semibold text-white/85">{where.uf}</span>
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/75">
          {err}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-white/90">
              Entrega padrão (MVP)
            </div>
            <div className="text-xs text-white/65">
              {result.days[0]}–{result.days[1]} dias úteis
            </div>
          </div>

          <div className="mt-2 text-sm text-white/80">
            {moneyBRL(result.min)} – {moneyBRL(result.max)}
          </div>

          <div className="mt-2 text-[11px] text-white/55">
            Estimativa baseada em região + peso (sem transportadora ainda). Valor
            final no checkout.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ===========================
   PAGE
   =========================== */


export default function ShopProductPage({
  params,
}: {
  // ✅ Next pode entregar params como Promise em Client Components
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = useMemo(() => decodeURIComponent(rawId), [rawId]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<Product | null>(null);

  const publicCatalog = useMemo(
    () => extractCatalog(p?.description ?? ''),
    [p?.description],
  );

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {},
  );

  const hasRealChoices =
    (publicCatalog.optionGroups?.length ?? 0) > 0 &&
    (publicCatalog.variants?.length ?? 0) > 0;

  useEffect(() => {
    if (!hasRealChoices) {
      setSelectedOptions({});
      return;
    }

    setSelectedOptions((prev) => {
      const next: Record<string, string> = {};

      for (const group of publicCatalog.optionGroups) {
        const values = Array.isArray(group.values) ? group.values : [];
        if (!values.length) continue;

        const current = prev[group.name];
        next[group.name] =
          current && values.includes(current) ? current : values[0]!;
      }

      return next;
    });
  }, [p?.description, hasRealChoices, publicCatalog.optionGroups]);

  const selectedVariant = useMemo(
    () => findVariantFromSelected(publicCatalog.variants ?? [], selectedOptions),
    [publicCatalog.variants, selectedOptions],
  );

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [hoverHotspot, setHoverHotspot] = useState<ImageHotspot | null>(null);
  const [pinnedHotspot, setPinnedHotspot] = useState<ImageHotspot | null>(null);
  const [pinnedHotspotPos, setPinnedHotspotPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const hoverTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  // “Mais deste perfil”
  const [more, setMore] = useState<Product[]>([]);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreErr, setMoreErr] = useState('');

  const [buying, setBuying] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // ✅ novos states (pagamento)
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payStatus, setPayStatus] = useState<
    'IDLE' | 'PENDING' | 'PAID' | 'FAILED'
  >('IDLE');
  const [payMsg, setPayMsg] = useState<string>('');

  // ✅ novos states (posts do produto)
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsErr, setPostsErr] = useState('');

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setErr(null);
        setLoading(true);

        const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: 'GET',
        });

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

  // ✅ extrai fetch de posts para função loadPosts()
  async function loadPosts(productId: string) {
    setPostsLoading(true);
    setPostsErr('');

    try {
      const res = await fetch(
        `${apiOrigin()}/api/social/products/${encodeURIComponent(productId)}/posts`,
      );

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          extractErrorMessage(data, 'Não foi possível carregar experiências.'),
        );
      }

      if (!isSocialPostsByProductOk(data)) {
        throw new Error(socialPostsErrorMessage(data));
      }

      setPosts(data.posts);
    } catch (e) {
      setPostsErr(
        e instanceof Error ? e.message : 'Erro ao carregar experiências.',
      );
    } finally {
      setPostsLoading(false);
    }
  }

  function isProductsListOk(
    x: unknown,
  ): x is { ok: true; products: Product[] } {
    const r = asRecord(x);
    if (!r) return false;
    if (r.ok !== true) return false;
    return Array.isArray(r.products);
  }

  async function loadMoreFromSameMerchant(
    merchantId: string,
    excludeId: string,
  ) {
    setMoreLoading(true);
    setMoreErr('');

    const endpoints = [
      // 1) mais provável (catalog)
      `${apiOrigin()}/api/products?merchantId=${encodeURIComponent(merchantId)}`,
      // 2) variações comuns (shops)
      `${apiOrigin()}/api/shops/${encodeURIComponent(merchantId)}/products`,
      `${apiOrigin()}/api/merchants/shops/${encodeURIComponent(merchantId)}/products`,
      `${apiOrigin()}/api/public/shops/${encodeURIComponent(merchantId)}/products`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        const data: unknown = await res.json().catch(() => null);

        if (!res.ok) continue;

        // formato A: { ok:true, products:[...] }
        if (isProductsListOk(data)) {
          const items = data.products
            .filter((x) => x && x.id !== excludeId)
            .slice(0, 4);
          setMore(items);
          setMoreLoading(false);
          return;
        }

        // formato B: { ok:true, items:[...] } ou { products:[...] }
        const r = asRecord(data);
        const arr =
          (Array.isArray(r?.items) ? (r?.items as unknown[]) : null) ??
          (Array.isArray(r?.products) ? (r?.products as unknown[]) : null);

        if (arr) {
          const items = arr
            .map((x) => x as Product)
            .filter((x) => x && x.id && x.id !== excludeId)
            .slice(0, 4);
          if (items.length) {
            setMore(items);
            setMoreLoading(false);
            return;
          }
        }
      } catch {
        // tenta próximo endpoint
      }
    }

    setMore([]);
    setMoreErr('Não foi possível carregar mais produtos desta loja (MVP).');
    setMoreLoading(false);
  }

  useEffect(() => {
    if (!p?.merchantId || !p?.id) return;
    loadMoreFromSameMerchant(p.merchantId, p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  // ✅ buscar posts verificados do produto (NestJS 3001)
  // endpoint retorna { ok: true, posts }
  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      if (!alive) return;
      await loadPosts(id);
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function buyNow() {
    try {
      setBuying(true);
      setCreatedOrderId(null);
      setPaidOrderId(null);
      setPaymentId(null);
      setPayOpen(false);
      setPayStatus('IDLE');
      setPayMsg('');
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
        const msg = extractErrorMessage(data, `HTTP ${res.status}`);
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
            (
              (data as Record<string, unknown>).order as Record<string, unknown>
            ).id,
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

  async function confirmPay() {
    if (!paymentId) return;
    setPayMsg('');
    try {
      const token = getToken();
      if (!token) throw new Error('Sem token');

      const res = await fetch(
        `http://localhost:3001/api/payments/${encodeURIComponent(paymentId)}/confirm`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
        },
      );

      const data = (await res.json()) as {
        ok?: boolean;
        status?: 'PAID' | 'PENDING' | 'FAILED';
        orderId?: string;
        message?: string;
      };

      if (!res.ok || data.ok === false || data.status !== 'PAID') {
        throw new Error(data.message || `Falha ao confirmar (${res.status})`);
      }

      setPayStatus('PAID');
      setPaidOrderId(createdOrderId);
      window.setTimeout(() => setPayOpen(false), 600);
    } catch (e) {
      setPayMsg(e instanceof Error ? e.message : 'Falha ao confirmar');
      setPayStatus('FAILED');
    }
  }

    return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Marto background (sutil, sem poluir) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_15%_10%,rgba(255,255,255,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_85%_20%,rgba(255,255,255,0.06),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_40%_95%,rgba(255,255,255,0.05),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:60px_60px]" />
      </div>

      <div className="relative mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/60">
              <Link href="/catalog" className="hover:text-white/80">
                Catálogo Marto
              </Link>
              <span className="text-white/35">/</span>
              <span className="text-white/70">Peça ativa</span>
              {p?.name ? (
                <>
                  <span className="text-white/35">/</span>
                  <span className="truncate text-white/80">{p.name}</span>
                </>
              ) : null}
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white/95">
              {p?.name ?? 'Produto'}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
              Peça ativa no ecossistema Marto. Origem, compra, continuidade e
              reputação conectadas no mesmo fluxo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dash/consumer"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Minha central →
            </Link>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-white/70">Carregando...</p>
        ) : err ? null : !p ? (
          <p className="text-sm text-white/70">Produto não encontrado.</p>
        ) : (
          <>
            {/* ===========================
               HERO (galeria + controle)
               =========================== */}
            <section className="overflow-hidden rounded-[32px] border border-white/15 bg-neutral-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {(() => {
                const ident = extractIdentity(p.description ?? '');
                const cat = publicCatalog;
                const activeVariantSummary = formatVariantSummary(selectedVariant);
                const activeVariantStock = String(selectedVariant?.stock ?? '').trim();
                const handle = ident.handle ? `@${ident.handle}` : '';
                const merchantLabel =
                  String(p.merchantTradeName ?? '').trim() || 'Central Marto';

                const cents =
                  typeof p.priceCents === 'number'
                    ? p.priceCents
                    : typeof p.price === 'number'
                      ? p.price
                      : 0;

                const priceBRL = (Number(cents ?? 0) / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                });

                function pickOverview3(v: unknown): string[] | null {
                  if (!Array.isArray(v)) return null;
                  const out = v
                    .map((x) => String(x ?? '').trim())
                    .filter(Boolean)
                    .slice(0, 3);
                  return out.length ? out : null;
                }

                const urls = (p.images ?? [])
                  .map((x) => toAbsoluteUrl(String(x ?? '').trim()))
                  .filter(Boolean) as string[];

                const imagesWithOverview = urls.map((url, i) => ({
                  url,
                  overview: pickOverview3(p.imageInsights?.[i]?.overview),
                }));

                const safeIndex = Math.min(
                  galleryIndex,
                  Math.max(imagesWithOverview.length - 1, 0),
                );

                const current =
                  imagesWithOverview[safeIndex] ?? imagesWithOverview[0] ?? null;

                const hotspots: ImageHotspot[] =
                  (p?.imageInsights?.[safeIndex]?.hotspots as
                    | ImageHotspot[]
                    | undefined) ?? [];

                return (
                  <>
                    <div className="grid gap-4 p-4 xl:grid-cols-[92px_minmax(0,1fr)_420px] xl:p-5">
                      {/* miniaturas */}
                      <div className="order-2 xl:order-1">
                        {imagesWithOverview.length > 1 ? (
                          <div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">
                            {imagesWithOverview.map((img, idx) => (
                              <button
                                key={`${img.url}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setPinnedHotspot(null);
                                  setPinnedHotspotPos(null);
                                  setGalleryIndex(idx);
                                }}
                                className={[
                                  'h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border bg-black/40 transition',
                                  idx === safeIndex
                                    ? 'border-white/55'
                                    : 'border-white/15 hover:border-white/35',
                                ].join(' ')}
                                aria-label={`Miniatura ${idx + 1}`}
                              >
                                <img
                                  src={img.url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* palco da peça */}
                      <div className="order-1 flex flex-col gap-4 xl:order-2">
                        <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-black/50">
                          {!current ? (
                            <div className="grid min-h-[560px] place-items-center bg-white/5 text-sm font-semibold text-white/60 xl:min-h-[640px]">
                              Sem foto
                            </div>
                          ) : (
                            <div
                              className="relative"
                              onClick={() => {
                                setPinnedHotspot(null);
                                setPinnedHotspotPos(null);
                              }}
                              onMouseLeave={() => {
                                if (hoverTimer.current)
                                  window.clearTimeout(hoverTimer.current);
                                if (hideTimer.current)
                                  window.clearTimeout(hideTimer.current);

                                if (!pinnedHotspot) {
                                  setHoverHotspot(null);
                                  setHoverPos(null);
                                }
                              }}
                            >
                              <ImageWithCaption
                                url={current.url}
                                alt={p.name}
                                lines={current.overview}
                              />

                              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.20)_0%,rgba(0,0,0,0.02)_30%,rgba(0,0,0,0.04)_100%)]" />

                              {hotspots.map((hs, i) => {
                                const left = `${clamp(hs.x, 0, 100)}%`;
                                const top = `${clamp(hs.y, 0, 100)}%`;
                                const isPinned =
                                  pinnedHotspot?.x === hs.x &&
                                  pinnedHotspot?.y === hs.y &&
                                  pinnedHotspot?.title === hs.title;

                                return (
                                  <button
                                    key={`${i}-${hs.x}-${hs.y}`}
                                    type="button"
                                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{ left, top }}
                                    aria-label={hs.title}
                                    onMouseEnter={() => {
                                      if (hoverTimer.current)
                                        window.clearTimeout(hoverTimer.current);
                                      if (hideTimer.current)
                                        window.clearTimeout(hideTimer.current);

                                      hoverTimer.current = window.setTimeout(() => {
                                        setHoverHotspot(hs);
                                        setHoverPos({
                                          x: clamp(hs.x, 10, 90),
                                          y: clamp(hs.y, 12, 88),
                                        });

                                        hideTimer.current = window.setTimeout(() => {
                                          if (!pinnedHotspot) {
                                            setHoverHotspot(null);
                                            setHoverPos(null);
                                          }
                                        }, 2800);
                                      }, 180);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPinnedHotspot(hs);
                                      setPinnedHotspotPos({
                                        x: clamp(hs.x, 10, 90),
                                        y: clamp(hs.y, 12, 88),
                                      });
                                      setHoverHotspot(hs);
                                      setHoverPos({
                                        x: clamp(hs.x, 10, 90),
                                        y: clamp(hs.y, 12, 88),
                                      });
                                    }}
                                  >
                                    <span className="relative block h-5 w-5">
                                      <span
                                        className={[
                                          'absolute inset-0 rounded-full border transition',
                                          isPinned
                                            ? 'border-white/80 bg-white/25'
                                            : 'border-white/55 bg-white/12 group-hover:bg-white/20',
                                        ].join(' ')}
                                      />
                                      <span className="absolute inset-[3px] rounded-full bg-white/92" />
                                      <span className="absolute inset-[-7px] rounded-full border border-white/18 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                    </span>
                                  </button>
                                );
                              })}

                              {(() => {
                                const activeHotspot = pinnedHotspot ?? hoverHotspot;
                                const activePos = pinnedHotspotPos ?? hoverPos;

                                if (!activeHotspot || !activePos) return null;

                                return (
                                  <div
                                    className="absolute z-20 w-[min(320px,78vw)] -translate-x-1/2 rounded-[24px] border border-white/15 bg-neutral-950/86 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl"
                                    style={{
                                      left: `${activePos.x}%`,
                                      top: `${activePos.y}%`,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/52">
                                          leitura marto
                                        </div>
                                        <div className="mt-2 text-lg font-semibold leading-tight text-white/94">
                                          {activeHotspot.title}
                                        </div>
                                      </div>

                                      {pinnedHotspot ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPinnedHotspot(null);
                                            setPinnedHotspotPos(null);
                                            setHoverHotspot(null);
                                            setHoverPos(null);
                                          }}
                                          className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/78 hover:bg-white/12"
                                        >
                                          fechar
                                        </button>
                                      ) : null}
                                    </div>

                                    {activeHotspot.description ? (
                                      <div className="mt-3 text-sm leading-6 text-white/74">
                                        {activeHotspot.description}
                                      </div>
                                    ) : (
                                      <div className="mt-3 text-sm leading-6 text-white/58">
                                        Este ponto destaca uma leitura relevante
                                        da peça.
                                      </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/62">
                                        ponto relevante da peça
                                      </span>
                                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/62">
                                        toque ou passe o mouse
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white/82 backdrop-blur">
                                  verificado pelo rastro
                                </span>
                                <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/72 backdrop-blur">
                                  peça ativa
                                </span>
                              </div>

                              <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                                {imagesWithOverview.length > 1 ? (
                                  <div className="rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[11px] font-semibold text-white/82 backdrop-blur">
                                    {safeIndex + 1}/{imagesWithOverview.length}
                                  </div>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => setGalleryOpen(true)}
                                  className="rounded-full border border-white/15 bg-black/45 px-3 py-2 text-[11px] font-semibold text-white/84 backdrop-blur hover:bg-black/60"
                                >
                                  {imagesWithOverview.length > 1
                                    ? 'Tela cheia'
                                    : 'Ampliar'}
                                </button>
                              </div>

                              {imagesWithOverview.length > 1 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      {
                                        setPinnedHotspot(null);
                                        setPinnedHotspotPos(null);
                                        setGalleryIndex(
                                          (prev) =>
                                            (prev - 1 + imagesWithOverview.length) %
                                            imagesWithOverview.length,
                                        );
                                      }
                                    }
                                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-2 text-white/84 backdrop-blur hover:bg-black/60"
                                    aria-label="Foto anterior"
                                  >
                                    ‹
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      {
                                        setPinnedHotspot(null);
                                        setPinnedHotspotPos(null);
                                        setGalleryIndex(
                                          (prev) =>
                                            (prev + 1) % imagesWithOverview.length,
                                        );
                                      }
                                    }
                                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-2 text-white/84 backdrop-blur hover:bg-black/60"
                                    aria-label="Próxima foto"
                                  >
                                    ›
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>

                        <section className="rounded-[28px] border border-white/15 bg-black/24 p-4 xl:p-5">
                          <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              {hasRealChoices ? (
                                <>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                                    escolhas desta peça
                                  </div>

                                  <div className="mt-2 text-sm leading-6 text-white/70">
                                    Escolha a combinação real publicada no
                                    catálogo desta peça.
                                  </div>

                                  <div className="mt-4 grid gap-3">
                                    {cat.optionGroups.map((group) => (
                                      <div
                                        key={group.name}
                                        className="rounded-2xl border border-white/10 bg-black/35 p-4"
                                      >
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52">
                                          {group.name}
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {group.values.map((value) => {
                                            const active =
                                              selectedOptions[group.name] ===
                                              value;

                                            return (
                                              <button
                                              key={`${group.name}-${value}`}
                                              type="button"
                                              onClick={() =>
                                                setSelectedOptions((prev) => ({
                                                  ...prev,
                                                  [group.name]: value,
                                                }))
                                              }
                                              className={[
                                                'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                                                active
                                                  ? 'border-white/35 bg-white/12 text-white'
                                                  : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10',
                                              ].join(' ')}
                                            >
                                              {value}
                                            </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52">
                                      combinação selecionada
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-white/88">
                                      {activeVariantSummary ||
                                        'Escolha uma combinação publicada.'}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {selectedVariant?.sku ? (
                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/66">
                                          SKU {selectedVariant.sku}
                                        </span>
                                      ) : null}

                                      {activeVariantStock ? (
                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/66">
                                          estoque {activeVariantStock}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                                    detalhes desta peça
                                  </div>

                                  <div className="mt-2 text-sm leading-6 text-white/70">
                                    Esta peça ainda não tem escolhas publicadas
                                    no catálogo. Então o Marto destaca
                                    operação, preparo e leitura visual da peça.
                                  </div>

                                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52">
                                        disponibilidade
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {cat.tipo ? (
                                          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/82">
                                            {cat.tipo}
                                          </span>
                                        ) : null}
                                        {cat.inventario ? (
                                          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/82">
                                            {cat.inventario}
                                          </span>
                                        ) : null}
                                        {cat.estoque ? (
                                          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/82">
                                            lote {cat.estoque}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52">
                                        preparo
                                      </div>
                                      <div className="mt-3 text-sm font-semibold text-white/88">
                                        {cat.preparoDias
                                          ? `${cat.preparoDias} dias de preparo`
                                          : 'preparo não publicado'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52">
                                      o que importa
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-white/72">
                                      O Marto ajuda a decidir melhor quando a
                                      peça mostra, com clareza, como ela se
                                      apresenta, como opera e em quanto tempo
                                      fica pronta.
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                                ângulos da peça
                              </div>

                              {imagesWithOverview.length === 0 ? (
                                <div className="mt-4 text-sm text-white/65">
                                  Sem leituras adicionais desta peça.
                                </div>
                              ) : (
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  {imagesWithOverview.slice(0, 4).map((img, idx) => {
                                    const realIndex = idx;
                                    const active = realIndex === safeIndex;
                                    const hotspotsCount =
                                      p?.imageInsights?.[realIndex]?.hotspots
                                        ?.length ?? 0;

                                    return (
                                      <button
                                        key={`${img.url}-quick-${idx}`}
                                        type="button"
                                        onClick={() => {
                                          setPinnedHotspot(null);
                                          setPinnedHotspotPos(null);
                                          setGalleryIndex(realIndex);
                                        }}
                                        className={[
                                          'group overflow-hidden rounded-2xl border text-left transition',
                                          active
                                            ? 'border-white/45 bg-white/[0.04]'
                                            : 'border-white/10 bg-black/30 hover:border-white/28',
                                        ].join(' ')}
                                      >
                                        <div className="aspect-[4/3] w-full bg-white/5">
                                          <img
                                            src={img.url}
                                            alt=""
                                            className="h-full w-full object-cover"
                                          />
                                        </div>

                                        <div className="p-3">
                                          <div className="text-sm font-semibold text-white/86">
                                            {quickViewLabel(
                                              realIndex,
                                              img.overview,
                                            )}
                                          </div>

                                          <div className="mt-1 text-[11px] leading-5 text-white/60">
                                            {Array.isArray(img.overview) &&
                                            img.overview[0]
                                              ? img.overview[0]
                                              : 'abrir esta leitura'}
                                          </div>

                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {hotspotsCount > 0 ? (
                                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/58">
                                                {hotspotsCount} ponto(s)
                                              </span>
                                            ) : null}

                                            {active ? (
                                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-white/70">
                                                ângulo ativo
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </section>
                      </div>

                      {/* lateral enxuta */}
                      <aside className="order-3 rounded-[28px] border border-white/15 bg-black/24 p-5 xl:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                              central da peça
                            </div>
                            <div className="mt-2 text-2xl font-semibold leading-tight text-white/94">
                              {merchantLabel}
                            </div>
                          </div>

                          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/76">
                            rastro verificado
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-white/70">
                          Origem ativa desta peça no Marto. A central sustenta a
                          continuidade, a leitura pública e a reputação ao longo do fluxo.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {p.merchantHandle ? (
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                              @{p.merchantHandle}
                            </span>
                          ) : null}

                          {cat.inventario ? (
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                              operação {cat.inventario}
                            </span>
                          ) : null}

                          {cat.tipo ? (
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                              {cat.tipo}
                            </span>
                          ) : null}
                        </div>

                        {p.merchantHandle ? (
                          <div className="mt-4">
                            <Link
                              href={`/loja/${encodeURIComponent(p.merchantHandle)}`}
                              className="inline-flex rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
                            >
                              Entrar na central →
                            </Link>
                          </div>
                        ) : null}

                        <div className="mt-6 border-t border-white/10 pt-6">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                            peça em destaque
                          </div>

                          <div className="mt-2 text-3xl font-semibold leading-tight text-white/96">
                            {p.name}
                          </div>

                          <p className="mt-3 text-sm leading-6 text-white/72">
                            Uma peça publicada dentro de uma central viva, pronta para
                            entrar no seu fluxo de compra e continuar gerando rastro no
                            Marto.
                          </p>

                          {hasRealChoices ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52">
                                opção ativa
                              </div>

                              <div className="mt-2 text-sm font-semibold text-white/88">
                                {activeVariantSummary ||
                                  'Escolha uma combinação publicada.'}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {selectedVariant?.sku ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/66">
                                    SKU {selectedVariant.sku}
                                  </span>
                                ) : null}

                                {activeVariantStock ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/66">
                                    estoque {activeVariantStock}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-5 flex flex-wrap items-center gap-3">
                            <div className="text-3xl font-semibold text-white/95">
                              {priceBRL}
                            </div>

                            {activeVariantStock ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                                estoque desta opção {activeVariantStock}
                              </span>
                            ) : cat.estoque ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                                lote ativo {cat.estoque}
                              </span>
                            ) : null}

                            {cat.preparoDias ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                                preparo em {cat.preparoDias} dias
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <button
                              onClick={buyNow}
                              disabled={buying}
                              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
                            >
                              {buying ? 'Iniciando…' : 'Iniciar compra'}
                            </button>

                            {p.merchantHandle && p.productHandle ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const url = `${window.location.origin}/shop/@${p.merchantHandle}/p/@${p.productHandle}`;
                                  navigator.clipboard.writeText(url);
                                }}
                                className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-semibold text-white/84 hover:bg-white/12"
                              >
                                Copiar link da peça
                              </button>
                            ) : null}
                          </div>

                          {createdOrderId ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-white/82">
                                  ✅ Pedido criado:{' '}
                                  <span className="font-semibold">{createdOrderId}</span>
                                </div>

                                {!paidOrderId ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!createdOrderId) return;
                                      router.push(
                                        `/dash/consumer/orders/${encodeURIComponent(createdOrderId)}`,
                                      );
                                    }}
                                    disabled={!createdOrderId}
                                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Ir para pagamento →
                                  </button>
                                ) : (
                                  <Link
                                    href={`/dash/consumer/orders/${encodeURIComponent(
                                      paidOrderId,
                                    )}`}
                                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                                  >
                                    Ver pedido →
                                  </Link>
                                )}
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-6 border-t border-white/10 pt-6">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                              fluxo marto desta peça
                            </div>

                            <div className="mt-3 grid gap-3">
                              {[
                                [
                                  'Comprar',
                                  'A peça entra no seu fluxo com origem e intenção registradas.',
                                ],
                                [
                                  'Receber',
                                  'Entrega e continuidade operacional passam a fazer parte da jornada.',
                                ],
                                [
                                  'Registrar',
                                  'Uso real, contexto e experiência começam a virar prova.',
                                ],
                                [
                                  'Reputação',
                                  'O rastro amadurece e fortalece a central no ecossistema.',
                                ],
                              ].map(([title, desc]) => (
                                <div
                                  key={title}
                                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                                >
                                  <div className="text-sm font-semibold text-white/90">
                                    {title}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-white/64">
                                    {desc}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-6 border-t border-white/10 pt-6">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                              leitura pública
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                Central: {merchantLabel}
                              </span>

                              {handle ? (
                                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                  Rastro público: {handle}
                                </span>
                              ) : null}

                              {cat.tipo ? (
                                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/74">
                                  Operação: {cat.tipo}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </>
                );
              })()}
            </section>

            <section className="mt-6 rounded-[28px] border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur xl:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/88">
                    Continuidade da central
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    Outras peças publicadas dentro da mesma origem viva no Marto.
                  </div>
                </div>

                {p.merchantHandle ? (
                  <Link
                    href={`/loja/${encodeURIComponent(p.merchantHandle)}`}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
                  >
                    Ver central →
                  </Link>
                ) : null}
              </div>

              {moreLoading ? (
                <div className="mt-4 text-sm text-white/70">Carregando…</div>
              ) : moreErr ? (
                <div className="mt-4 text-sm text-white/75">{moreErr}</div>
              ) : more.length === 0 ? (
                <div className="mt-4 text-sm text-white/70">
                  Esta central ainda não publicou outras peças por enquanto.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {more.map((it) => {
                    const img = toAbsoluteUrl(coverFromImages(it.images ?? []));
                    const cents =
                      typeof it.priceCents === 'number'
                        ? it.priceCents
                        : typeof it.price === 'number'
                          ? it.price
                          : 0;

                    const priceBRL = (Number(cents ?? 0) / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    });

                    return (
                      <Link
                        key={it.id}
                        href={`/shop/p/${encodeURIComponent(it.id)}`}
                        className="group overflow-hidden rounded-2xl border border-white/15 bg-black/35 hover:bg-black/50"
                      >
                        <div className="aspect-[4/3] w-full bg-white/5">
                          {img ? (
                            <img
                              src={img}
                              alt={it.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>

                        <div className="p-3">
                          <div className="line-clamp-2 text-sm font-semibold text-white/86">
                            {it.name}
                          </div>
                          <div className="mt-1 text-xs text-white/65">{priceBRL}</div>
                          <div className="mt-2 text-[11px] text-white/52">
                            continuidade ativa • central
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ✅ Entrega (MVP) — seção própria (não infla o Hero) */}
            <section className="mt-6">
              <ShippingEstimator description={p.description ?? null} />
            </section>

            {/* ✅ Leitura da peça — seção própria (controle) */}
            <section className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {(() => {
                const clean = stripMartoBlocks(p.description ?? '');
                const ident = extractIdentity(p.description ?? '');
                const cat = extractCatalog(p.description ?? '');
                const tech = extractTech(p.description ?? '');

                const merchantLabel =
                  String(p.merchantTradeName ?? '').trim() || 'Central Marto';
                const publicHandle = ident.handle
                  ? `@${String(ident.handle).trim()}`
                  : '';

                const hasDimensions =
                  String(tech.l).trim() &&
                  String(tech.w).trim() &&
                  String(tech.h).trim();

                const dims = hasDimensions
                  ? `${String(tech.l).trim()} × ${String(tech.w).trim()} × ${String(tech.h).trim()} cm`
                  : '';

                return (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white/85">
                          Leitura da peça
                        </div>
                        <div className="mt-1 text-sm text-white/70">
                          Origem, operação e rastro técnico apresentados de forma
                          mais viva dentro do Marto.
                        </div>
                      </div>

                      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                        peça conectada ao ecossistema
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                          Origem desta peça
                        </div>

                        <div className="mt-3 text-sm font-semibold text-white/88">
                          {merchantLabel}
                        </div>

                        <div className="mt-2 space-y-1 text-sm text-white/72">
                          <div>
                            Central ativa no Marto com jornada pública da peça.
                          </div>
                          {publicHandle ? (
                            <div>
                              Rastro público:{' '}
                              <span className="font-semibold text-white/82">
                                {publicHandle}
                              </span>
                            </div>
                          ) : null}
                          {p.merchantHandle ? (
                            <div>
                              Central pública:{' '}
                              <span className="font-semibold text-white/82">
                                @{p.merchantHandle}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                          Leitura operacional
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-white/72">
                          <div>
                            Operação:{' '}
                            <span className="font-semibold text-white/82">
                              {cat.tipo || 'não informada'}
                            </span>
                          </div>
                          <div>
                            Inventário:{' '}
                            <span className="font-semibold text-white/82">
                              {cat.inventario || 'em definição'}
                            </span>
                          </div>
                          <div>
                            Preparo:{' '}
                            <span className="font-semibold text-white/82">
                              {cat.preparoDias
                                ? `${cat.preparoDias} dias`
                                : 'sem prazo publicado'}
                            </span>
                          </div>
                          <div>
                            Lote ativo:{' '}
                            <span className="font-semibold text-white/82">
                              {cat.estoque || 'não informado'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                          Rastro técnico
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-white/72">
                          <div>
                            Peso:{' '}
                            <span className="font-semibold text-white/82">
                              {String(tech.weightKg).trim()
                                ? `${String(tech.weightKg).trim()} kg`
                                : 'não publicado'}
                            </span>
                          </div>
                          <div>
                            Dimensões:{' '}
                            <span className="font-semibold text-white/82">
                              {dims || 'não publicadas'}
                            </span>
                          </div>
                          <div className="pt-1 text-xs leading-5 text-white/58">
                            Esses sinais estruturam a continuidade da peça no
                            frete, na experiência e na reputação do ecossistema.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                        Essência publicada
                      </div>

                      {clean ? (
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/76">
                          {clean}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-white/65">
                          Esta peça ainda não recebeu uma leitura pública mais
                          completa.
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </section>

            {/* ===========================
               VERIFIED SOCIAL (resumo)
               =========================== */}
            <section className="mt-8">
              <VerifiedSocialSummary productId={p.id} />
            </section>

            {/* ===========================
               IMPACT (discreto, sem hype)
               =========================== */}
            <section className="mt-8 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    Impacto no ecossistema
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    Recompensa é consequência do fluxo bem feito.
                  </div>
                </div>

                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                  MVP • sem números finais ainda
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-semibold text-white/65">
                    Experiências verificadas
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white/90">
                    {postsLoading ? '—' : String(posts.length)}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    Baseado nos posts ligados ao produto.
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-semibold text-white/65">
                    Entrega (MVP)
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white/90">
                    estimativa
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    Cotação real entra na fase Transportadoras.
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-semibold text-white/65">
                    Reputação
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white/90">
                    progressiva
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    O rastro vira confiança ao longo do ciclo.
                  </div>
                </div>
              </div>
            </section>

            {/* ===========================
               EXPERIÊNCIAS REAIS (posts)
               =========================== */}
            <section className="mt-8 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    Experiências reais
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    Posts ligados a compras reais (verificados).
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => loadPosts(p.id)}
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                >
                  Recarregar
                </button>
              </div>

              {postsLoading ? (
                <div className="mt-4 text-sm text-white/70">
                  Carregando experiências…
                </div>
              ) : postsErr ? (
                <div className="mt-4 text-sm text-white/75">{postsErr}</div>
              ) : posts.length === 0 ? (
                <div className="mt-4 text-sm text-white/70">
                  Ainda não há experiências verificadas para este produto.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {posts.slice(0, 4).map((post) => {
                    const rawMediaUrl =
                      post.media?.[0]?.url != null
                        ? String(post.media[0].url)
                        : '';
                    const media0 = toAbsoluteUrl(rawMediaUrl) ?? '';
                    const mediaType = String(
                      post.media?.[0]?.type ?? 'IMAGE',
                    ).toUpperCase();

                    return (
                      <div
                        key={post.id}
                        className="rounded-2xl border border-white/15 bg-black/60 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-white/65">
                            verificado •{' '}
                            {new Date(post.createdAt).toLocaleString('pt-BR')}
                          </div>
                        </div>

                        {media0 ? (
                          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            {mediaType === 'VIDEO' ? (
                              <video
                                controls
                                className="h-auto w-full"
                                src={media0}
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt="Mídia do post"
                                className="h-auto w-full object-cover"
                                src={media0}
                              />
                            )}
                          </div>
                        ) : null}

                        <div className="mt-3 whitespace-pre-wrap text-sm text-white/85">
                          {post.caption || '(sem texto)'}
                        </div>
                      </div>
                    );
                  })}

                  <div className="md:col-span-2">
                    <Link
                      href={`/shop/p/${encodeURIComponent(p.id)}/posts`}
                      className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                    >
                      Ver todos →
                    </Link>
                  </div>
                </div>
              )}
            </section>

            {payOpen ? (
              <div
                className="fixed inset-0 z-50"
                role="dialog"
                aria-modal="true"
                aria-label="Marto Pay"
              >
                <button
                  type="button"
                  onClick={() => setPayOpen(false)}
                  className="absolute inset-0 cursor-default bg-black/70"
                  aria-label="Fechar"
                />

                <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2">
                  <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white/90">
                          Marto Pay
                        </div>
                        <div className="mt-1 text-sm text-white/70">
                          Sandbox - fechando o ciclo de pagamento antes do
                          provedor.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPayOpen(false)}
                        className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        Fechar
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-3">
                      <div className="text-xs font-semibold text-white/60">
                        Status
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white/85">
                        {payStatus === 'PENDING' ? 'Aguardando pagamento' : null}
                        {payStatus === 'PAID' ? 'Pago' : null}
                        {payStatus === 'FAILED' ? 'Falhou' : null}
                      </div>

                      <div className="mt-2 text-xs text-white/65">
                        Payment:{' '}
                        <span className="font-semibold text-white/80">
                          {paymentId}
                        </span>
                      </div>

                      {payMsg ? (
                        <div className="mt-2 text-xs font-semibold text-white/70">
                          {payMsg}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmPay()}
                        disabled={payStatus !== 'PENDING'}
                        className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                      >
                        Simular aprovado
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* ✅ Modal da galeria (Apple minimal) */}
            {(() => {
              const imgs = (p.images ?? [])
                .map((x) => toAbsoluteUrl(String(x ?? '').trim()))
                .filter(Boolean) as string[];

              const cover = toAbsoluteUrl(coverFromImages(p.images));
              const list = imgs.length ? imgs : cover ? [cover] : [];

              if (!galleryOpen || list.length === 0) return null;

              const idx = Math.min(galleryIndex, list.length - 1);
              const current = list[idx] ?? list[0];

              return (
                <div
                  className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
                  onClick={() => setGalleryOpen(false)}
                  role="dialog"
                  aria-modal="true"
                >
                  <div
                    className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-neutral-950/90 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white/85">
                          {p.name}
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          {idx + 1} / {list.length}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setGalleryOpen(false)}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                      >
                        Fechar
                      </button>
                    </div>

                    <div className="grid gap-0 md:grid-cols-[1fr_260px]">
                      <div className="bg-black/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={current}
                          alt=""
                          className="h-[60vh] w-full object-contain"
                        />
                      </div>

                      <div className="max-h-[60vh] overflow-auto border-l border-white/10 p-4">
                        <div className="grid grid-cols-2 gap-2">
                          {list.map((src, i) => {
                            const is = i === idx;
                            return (
                              <button
                                key={`${src}-${i}`}
                                type="button"
                                onClick={() => setGalleryIndex(i)}
                                className={[
                                  'overflow-hidden rounded-xl border bg-black/40',
                                  is
                                    ? 'border-white/30'
                                    : 'border-white/10 hover:border-white/20',
                                ].join(' ')}
                                aria-label={`Foto ${i + 1}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt=""
                                  className="h-20 w-full object-cover"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </main>
  );}

