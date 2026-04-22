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
  title?: string | null;
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
  handle?: string | null;
  merchantHandle?: string | null;
  merchantTradeName?: string | null;
};

type PublicPhotoRole =
  | 'cover'
  | 'detail'
  | 'material'
  | 'context'
  | 'structure'
  | 'finish';

type PublicHotspotKind =
  | 'material'
  | 'finish'
  | 'structure'
  | 'comfort'
  | 'measure'
  | 'difference';

type ProductImageInsight = {
  role?: PublicPhotoRole | null;
  overview?: string[] | null;
  hotspots?: ImageHotspot[] | null;
};

type ImageHotspot = {
  x: number; // 0..100
  y: number; // 0..100
  title: string;
  description?: string | null;
  kind?: PublicHotspotKind | null;
  order?: number | null;
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

function normalizePublicPhotoRole(
  role: unknown,
  index = 0,
): PublicPhotoRole {
  const raw = String(role ?? '').trim();

  if (
    raw === 'cover' ||
    raw === 'detail' ||
    raw === 'material' ||
    raw === 'context' ||
    raw === 'structure' ||
    raw === 'finish'
  ) {
    return raw;
  }

  return index === 0 ? 'cover' : 'detail';
}

function publicPhotoRoleLabel(role: PublicPhotoRole) {
  switch (role) {
    case 'cover':
      return 'Capa';
    case 'detail':
      return 'Detalhe';
    case 'material':
      return 'Material';
    case 'context':
      return 'Contexto';
    case 'structure':
      return 'Estrutura';
    case 'finish':
      return 'Acabamento';
  }
}

function normalizePublicHotspotKind(kind: unknown): PublicHotspotKind {
  const raw = String(kind ?? '').trim();

  if (
    raw === 'material' ||
    raw === 'finish' ||
    raw === 'structure' ||
    raw === 'comfort' ||
    raw === 'measure' ||
    raw === 'difference'
  ) {
    return raw;
  }

  return 'difference';
}

function publicHotspotKindLabel(kind: unknown) {
  switch (normalizePublicHotspotKind(kind)) {
    case 'material':
      return 'Material';
    case 'finish':
      return 'Acabamento';
    case 'structure':
      return 'Estrutura';
    case 'comfort':
      return 'Conforto';
    case 'measure':
      return 'Proporção';
    case 'difference':
    default:
      return 'Diferencial';
  }
}

function sortPublicHotspots(hotspots?: ImageHotspot[] | null) {
  const base = Array.isArray(hotspots) ? hotspots.slice() : [];

  return base.sort((a, b) => {
    const ao =
      typeof a?.order === 'number' && Number.isFinite(a.order)
        ? a.order
        : Number.MAX_SAFE_INTEGER;
    const bo =
      typeof b?.order === 'number' && Number.isFinite(b.order)
        ? b.order
        : Number.MAX_SAFE_INTEGER;

    if (ao !== bo) return ao - bo;
    return 0;
  });
}

function isSameHotspot(a: ImageHotspot | null, b: ImageHotspot | null) {
  if (!a || !b) return false;

  return (
    a.x === b.x &&
    a.y === b.y &&
    a.title === b.title &&
    String(a.description ?? '') === String(b.description ?? '')
  );
}

function quickViewLabel(
  index: number,
  overview?: string[] | null,
  role?: PublicPhotoRole | null,
) {
  const first = Array.isArray(overview) ? String(overview[0] ?? '').trim() : '';
  if (first) return first;

  const normalizedRole = normalizePublicPhotoRole(role, index);

  switch (normalizedRole) {
    case 'cover':
      return 'Capa da peça';
    case 'detail':
      return 'Detalhe da peça';
    case 'material':
      return 'Material e textura';
    case 'context':
      return 'Peça em contexto';
    case 'structure':
      return 'Leitura estrutural';
    case 'finish':
      return 'Acabamento da peça';
    default:
      return `Vista ${index + 1}`;
  }
}

function stripMartoBlocks(desc: string) {
  let out = String(desc ?? '');

  out = out.replace(
    /---\s*\n### .*?\(Marto\)\n[\s\S]*?\n### \/.*?\n---/g,
    '',
  );

  out = out.replace(/^\s*---\s*$/gm, '');
  out = out.replace(/\n{3,}/g, '\n\n');

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

function ShippingEstimator({
  description,
  cep,
  onCepChange,
}: {
  description?: string | null;
  cep: string;
  onCepChange: (value: string) => void;
}) {
  const tech = extractTech(description ?? '');
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
      onCepChange(cepMask(digits));

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
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Meios de envio</div>
          <div className="mt-1 text-xs text-white/60">
            Estimativa inicial. A cotação real entra na fase de transportadoras.
          </div>
        </div>

        {hasWeight ? (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/78">
            {String(tech.weightKg).trim()} kg
          </span>
        ) : (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
            sem ficha técnica
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-white/62">Seu CEP</span>
          <input
            value={cep}
            onChange={(e) => onCepChange(cepMask(e.target.value))}
            className="rounded-xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
            placeholder="00000-000"
            inputMode="numeric"
          />
        </label>

        <div className="flex flex-wrap gap-2">
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
      </div>

      {where?.uf || err ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/66">
          {where?.uf ? (
            <span>
              Entrega para{' '}
              <span className="font-semibold text-white/84">
                {where.city}
              </span>{' '}
              •{' '}
              <span className="font-semibold text-white/84">
                {where.uf}
              </span>
            </span>
          ) : null}

          {err ? (
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-white/72">
              {err}
            </span>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/35 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/88">
                Entrega padrão (MVP)
              </div>
              <div className="mt-1 text-xs text-white/60">
                {result.days[0]}–{result.days[1]} dias úteis
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-white/90">
                {moneyBRL(result.min)} – {moneyBRL(result.max)}
              </div>
              <div className="mt-1 text-[11px] text-white/55">
                valor final no checkout
              </div>
            </div>
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
  const [essenceOpen, setEssenceOpen] = useState(false);
  const [destinationZipCode, setDestinationZipCode] = useState(() =>
    cepMask(readLocalCep()),
  );

  const publicCatalog = useMemo(
    () => extractCatalog(p?.description ?? ''),
    [p?.description],
  );

  const essenceText = useMemo(
    () => stripMartoBlocks(p?.description ?? ''),
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

  useEffect(() => {
    setEssenceOpen(false);
  }, [p?.id]);

  async function buyNow() {
    try {
      setBuying(true);
      setErr(null);

      const token = getToken();
      if (!token) {
        setErr('Você precisa estar logado como consumidor para comprar.');
        return;
      }
      if (!p) return;

      const zip = cepMask(destinationZipCode);

      if (onlyDigits(zip).length !== 8) {
        setErr('Informe o CEP antes de iniciar a compra.');
        return;
      }

      const cents =
        typeof p.priceCents === 'number'
          ? p.priceCents
          : typeof p.price === 'number'
            ? p.price
            : 0;

      router.push(
        `/checkout/pay?productId=${encodeURIComponent(p.id)}` +
          `&merchantId=${encodeURIComponent(p.merchantId)}` +
          `&unitPrice=${encodeURIComponent(String(cents))}` +
          `&qty=1` +
          `&destinationZipCode=${encodeURIComponent(zip)}`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao iniciar compra');
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

      <div className="relative mx-auto max-w-[1440px] px-6 py-6 xl:px-8">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/56">
              <Link href="/catalog" className="hover:text-white/78">
                Catálogo Marto
              </Link>
              <span className="text-white/30">/</span>
              <span className="text-white/68">Peça ativa</span>
              {p?.name ? (
                <>
                  <span className="text-white/30">/</span>
                  <span className="truncate text-white/72">{p.name}</span>
                </>
              ) : null}
            </div>

            <p className="mt-2 text-sm leading-6 text-white/66">
              Origem clara, compra pronta e continuidade viva dentro do Marto.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dash/consumer"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Ver central
            </Link>
          </div>
        </header>

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {err}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-white/70">Carregando...</p>
        ) : !p ? (
          <p className="text-sm text-white/70">Produto não encontrado.</p>
        ) : (
          <>
            {/* ===========================
               HERO (galeria + controle)
               =========================== */}
            <section className="overflow-hidden rounded-[32px] border border-white/15 bg-neutral-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {(() => {
                const cat = publicCatalog;
                const activeVariantSummary = formatVariantSummary(selectedVariant);
                const activeVariantStock = String(selectedVariant?.stock ?? '').trim();
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
                  role: normalizePublicPhotoRole(p.imageInsights?.[i]?.role, i),
                  overview: pickOverview3(p.imageInsights?.[i]?.overview),
                }));

                const safeIndex = Math.min(
                  galleryIndex,
                  Math.max(imagesWithOverview.length - 1, 0),
                );

                const current =
                  imagesWithOverview[safeIndex] ?? imagesWithOverview[0] ?? null;

                const hotspots = sortPublicHotspots(
                  (p?.imageInsights?.[safeIndex]?.hotspots as
                    | ImageHotspot[]
                    | undefined) ?? [],
                );

                const activeHotspot = hoverHotspot ?? null;

                const activeHotspotIndex = activeHotspot
                  ? hotspots.findIndex((hs) => isSameHotspot(hs, activeHotspot))
                  : -1;

                return (
                  <>
                    <div className="grid gap-5 p-5 xl:grid-cols-[96px_minmax(0,1fr)_460px] xl:p-6">
                      {/* miniaturas */}
                      <div className="order-2 xl:order-1">
                        {imagesWithOverview.length > 1 ? (
                          <div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">
                            {imagesWithOverview.map((img, idx) => (
                              <button
                                key={`${img.url}-${idx}`}
                                type="button"
                                onClick={() => {
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
                        <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-black/50">
                          {!current ? (
                            <div className="grid min-h-[620px] place-items-center bg-white/5 text-sm font-semibold text-white/60 xl:min-h-[720px]">
                              Sem foto
                            </div>
                          ) : (
                            <div
                              className="relative"
                              onClick={() => {
                                setHoverHotspot(null);
                                setHoverPos(null);
                              }}
                              onMouseLeave={() => {
                                if (hoverTimer.current)
                                  window.clearTimeout(hoverTimer.current);
                                if (hideTimer.current)
                                  window.clearTimeout(hideTimer.current);
                                setHoverHotspot(null);
                                setHoverPos(null);
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
                                const active = isSameHotspot(hs, activeHotspot);

                                return (
                                  <button
                                    key={`${i}-${hs.x}-${hs.y}`}
                                    type="button"
                                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{ left, top }}
                                    aria-label={hs.title}
                                    onMouseEnter={() => {
                                      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                                      if (hideTimer.current) window.clearTimeout(hideTimer.current);

                                      hoverTimer.current = window.setTimeout(() => {
                                        setHoverHotspot(hs);
                                        setHoverPos({
                                          x: clamp(hs.x, 12, 88),
                                          y: clamp(hs.y, 14, 86),
                                        });

                                        hideTimer.current = window.setTimeout(() => {
                                          setHoverHotspot(null);
                                          setHoverPos(null);
                                        }, 2200);
                                      }, 320);
                                    }}
                                    onMouseLeave={() => {
                                      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    <span
                                      className={[
                                        'relative block h-4.5 w-4.5 rounded-full border shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition',
                                        active
                                          ? 'border-white/70 bg-white/18'
                                          : 'border-white/38 bg-white/8 group-hover:border-white/58 group-hover:bg-white/14',
                                      ].join(' ')}
                                    >
                                      <span className="absolute inset-[3px] rounded-full bg-white/92" />
                                      <span className="absolute inset-[-6px] rounded-full border border-white/12 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                    </span>
                                  </button>
                                );
                              })}

                              {(() => {
                                const activePos = hoverPos;

                                if (!activeHotspot || !activePos) return null;

                                const alignLeft = activePos.x <= 52;
                                const openBelow = activePos.y <= 22;

                                return (
                                  <div
                                    className="pointer-events-none absolute z-20 w-[min(210px,62vw)] rounded-[16px] border border-white/12 bg-neutral-950/84 p-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.30)] backdrop-blur-xl"
                                    style={{
                                      left: `${activePos.x}%`,
                                      top: `${activePos.y}%`,
                                      transform: `translate(${alignLeft ? '18px' : '-100%'}, ${openBelow ? '18px' : '-100%'})`,
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/42">
                                          leitura marto
                                        </div>

                                        <div className="mt-1 text-[15px] font-semibold leading-tight text-white/92">
                                          {activeHotspot.title}
                                        </div>
                                      </div>

                                      {activeHotspotIndex >= 0 ? (
                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/58">
                                          {activeHotspotIndex + 1}/{hotspots.length}
                                        </span>
                                      ) : null}
                                    </div>

                                    {activeHotspot.description ? (
                                      <div className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-white/68">
                                        {activeHotspot.description}
                                      </div>
                                    ) : null}

                                    <div className="mt-3">
                                      <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold text-white/54">
                                        {publicHotspotKindLabel(activeHotspot.kind)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/12 bg-black/42 px-3 py-1 text-[10px] font-semibold text-white/76 backdrop-blur">
                                  rastro verificado
                                </span>
                                <span className="rounded-full border border-white/12 bg-black/38 px-3 py-1 text-[10px] font-semibold text-white/68 backdrop-blur">
                                  {publicPhotoRoleLabel(current?.role ?? 'cover')}
                                </span>
                              </div>

                              <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                                {imagesWithOverview.length > 1 ? (
                                  <div className="rounded-full border border-white/12 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-white/74 backdrop-blur">
                                    {safeIndex + 1}/{imagesWithOverview.length}
                                  </div>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => setGalleryOpen(true)}
                                  className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[10px] font-semibold text-white/76 backdrop-blur hover:bg-black/55"
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
                                        setGalleryIndex(
                                          (prev) =>
                                            (prev - 1 + imagesWithOverview.length) %
                                            imagesWithOverview.length,
                                        );
                                      }
                                    }
                                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/12 bg-black/38 p-2 text-white/76 backdrop-blur hover:bg-black/52"
                                    aria-label="Foto anterior"
                                  >
                                    ‹
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      {
                                        setGalleryIndex(
                                          (prev) =>
                                            (prev + 1) % imagesWithOverview.length,
                                        );
                                      }
                                    }
                                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/12 bg-black/38 p-2 text-white/76 backdrop-blur hover:bg-black/52"
                                    aria-label="Próxima foto"
                                  >
                                    ›
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>

                        <div className="rounded-[22px] border border-white/12 bg-black/24 p-4">
                          <div className="flex flex-wrap gap-2">
                            {cat.tipo ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                {cat.tipo}
                              </span>
                            ) : null}

                            {cat.inventario ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                {cat.inventario}
                              </span>
                            ) : null}

                            {cat.preparoDias ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                preparo em {cat.preparoDias} dias
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* lateral enxuta */}
                      <aside className="order-3 rounded-[28px] border border-white/15 bg-black/24 p-5 xl:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/56">
                              peça em destaque
                            </div>

                            <div className="mt-2 text-3xl font-semibold leading-tight text-white/96">
                              {p.name}
                            </div>
                          </div>

                          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/76">
                            rastro verificado
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-white/70">
                          Peça publicada com origem clara, versão ativa e compra
                          pronta dentro do Marto.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                            {merchantLabel}
                          </span>

                          {p.merchantHandle ? (
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                              @{p.merchantHandle}
                            </span>
                          ) : null}

                          {cat.tipo ? (
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                              {cat.tipo}
                            </span>
                          ) : null}
                        </div>

                        {false ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {Object.entries(selectedOptions).map(
                              ([name, value]) => (
                                <span
                                  key={`${name}-${value}`}
                                  className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/82"
                                >
                                  {name}: {value}
                                </span>
                              ),
                            )}
                          </div>
                        ) : null}

                        <div className="mt-5">
                          {hasRealChoices && activeVariantSummary ? (
                            <div className="mb-3 text-sm font-semibold text-white/84">
                              {activeVariantSummary}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-4xl font-semibold tracking-tight text-white/96">
                              {priceBRL}
                            </div>

                            {cat.preparoDias ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                                preparo em {cat.preparoDias} dias
                              </span>
                            ) : null}

                            {activeVariantStock ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                                estoque {activeVariantStock}
                              </span>
                            ) : cat.estoque ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                                lote {cat.estoque}
                              </span>
                            ) : null}

                            {cat.inventario ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/78">
                                {cat.inventario}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-6 grid gap-3">
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

                      </aside>
                    </div>
                  </>
                );
              })()}
            </section>

            {/* ===========================
               OPERAÇÃO DA PEÇA
               =========================== */}
            <section className="mt-6 rounded-[28px] border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur xl:p-5">
              {(() => {
                const cat = extractCatalog(p.description ?? '');
                const tech = extractTech(p.description ?? '');

                const merchantLabel =
                  String(p.merchantTradeName ?? '').trim() || 'Central Marto';

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
                        <div className="text-sm font-semibold text-white/88">
                          Operação da peça
                        </div>
                        <div className="mt-1 text-sm text-white/66">
                          O que importa para decidir com clareza: envio,
                          origem, preparo e medidas principais.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                      <div>
                        <ShippingEstimator
                          description={p.description ?? null}
                          cep={destinationZipCode}
                          onCepChange={setDestinationZipCode}
                        />
                      </div>

                      <div className="grid gap-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Sinais da operação
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                              origem {merchantLabel}
                            </span>

                            {cat.tipo ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                {cat.tipo}
                              </span>
                            ) : null}

                            {cat.inventario ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                {cat.inventario}
                              </span>
                            ) : null}

                            {cat.preparoDias ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                preparo {cat.preparoDias} dias
                              </span>
                            ) : null}

                            {String(tech.weightKg).trim() ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                {String(tech.weightKg).trim()} kg
                              </span>
                            ) : null}

                            {dims ? (
                              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                {dims}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Essência publicada
                          </div>

                          {essenceText ? (
                            <>
                              <div className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-white/74">
                                {essenceText}
                              </div>

                              {essenceText.length > 260 ? (
                                <div className="mt-4">
                                  <button
                                    type="button"
                                    onClick={() => setEssenceOpen(true)}
                                    className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white/82 hover:bg-white/12"
                                  >
                                    Abrir leitura completa
                                  </button>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="mt-3 text-sm text-white/65">
                              Esta peça ainda não recebeu uma leitura pública mais completa.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>

            {/* ===========================
               PROVA REAL DA PEÇA
               =========================== */}
            <section className="mt-8 rounded-[28px] border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur xl:p-5">
              {(() => {
                const proofMerchantLabel =
                  String(p.merchantTradeName ?? '').trim() || 'Central Marto';

                const hasProofPosts = posts.length > 0;
                const featuredPost = hasProofPosts ? posts[0] : null;

                const featuredRawMediaUrl =
                  featuredPost?.media?.[0]?.url != null
                    ? String(featuredPost.media[0].url)
                    : '';
                const featuredMedia = toAbsoluteUrl(featuredRawMediaUrl) ?? '';
                const featuredMediaType = String(
                  featuredPost?.media?.[0]?.type ?? 'IMAGE',
                ).toUpperCase();

                if (!postsLoading && !postsErr && !hasProofPosts) {
                  return (
                    <>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white/88">
                            Reputação desta peça
                          </div>
                          <div className="mt-1 text-sm text-white/68">
                            A peça já está pronta no Marto. A primeira compra
                            real é o que liga a reputação viva.
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
                        <div className="self-start rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Primeiro rastro desta peça
                          </div>

                          <div className="mt-2 text-sm font-semibold text-white/88">
                            A peça está pronta para gerar sua primeira prova real
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                              origem {proofMerchantLabel}
                            </span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                              compra pronta
                            </span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                              aguardando primeira experiência
                            </span>
                          </div>

                          <div className="mt-3 text-sm leading-6 text-white/66">
                            Quando a primeira compra concluída entrar no fluxo
                            do Marto, esta área muda de estado e começa a
                            mostrar reputação viva da peça.
                          </div>
                        </div>

                        <div className="self-start">
                          <VerifiedSocialSummary productId={p.id} />
                        </div>
                      </div>
                    </>
                  );
                }

                return (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white/88">
                          Prova real da peça
                        </div>
                        <div className="mt-1 text-sm text-white/70">
                          O que já foi validado pela origem, pela publicação e
                          pelas experiências reais no Marto.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
                      <div className="grid gap-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Resumo verificado
                          </div>

                          <div className="mt-3">
                            <VerifiedSocialSummary productId={p.id} />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="flex items-baseline justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                                Experiência em destaque
                              </div>
                              <div className="mt-1 text-sm text-white/66">
                                Uma prova viva da peça quando já existe conteúdo
                                real publicado.
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
                              Carregando prova real…
                            </div>
                          ) : postsErr ? (
                            <div className="mt-4 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-white/75">
                              {postsErr}
                            </div>
                          ) : !featuredPost ? (
                            <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-4">
                              <div className="text-sm font-semibold text-white/86">
                                Ainda sem experiência publicada
                              </div>
                              <div className="mt-2 text-sm leading-6 text-white/66">
                                Esta peça ainda não recebeu uma prova social
                                mais forte dentro do Marto.
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/35">
                              {featuredMedia ? (
                                <div className="overflow-hidden border-b border-white/10 bg-white/5">
                                  {featuredMediaType === 'VIDEO' ? (
                                    <video controls className="h-auto w-full" src={featuredMedia} />
                                  ) : (
                                    <img
                                      alt="Experiência real do produto"
                                      className="h-auto w-full object-cover"
                                      src={featuredMedia}
                                    />
                                  )}
                                </div>
                              ) : null}

                              <div className="p-4">
                                <div className="text-xs text-white/58">
                                  verificado •{' '}
                                  {new Date(featuredPost.createdAt).toLocaleString('pt-BR')}
                                </div>

                                <div className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-white/82">
                                  {featuredPost.caption || '(sem texto)'}
                                </div>

                                <div className="mt-4">
                                  <Link
                                    href={`/shop/p/${encodeURIComponent(p.id)}/posts`}
                                    className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                                  >
                                    Ver todas as experiências →
                                  </Link>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                          O que já foi provado
                        </div>

                        <div className="mt-4 grid gap-3">
                          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                            <div className="text-xs font-semibold text-white/60">
                              Origem visível
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white/88">
                              {proofMerchantLabel}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-white/58">
                              Peça publicada por uma central ativa dentro do
                              ecossistema.
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                            <div className="text-xs font-semibold text-white/60">
                              Compra pronta
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white/88">
                              Pedido pode começar agora
                            </div>
                            <div className="mt-1 text-xs leading-5 text-white/58">
                              A decisão principal já está montada na hero com
                              peça, preço e versão ativa.
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                            <div className="text-xs font-semibold text-white/60">
                              Reputação em construção
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white/88">
                              O próximo rastro vem da experiência real
                            </div>
                            <div className="mt-1 text-xs leading-5 text-white/58">
                              O Marto faz a prova crescer quando a peça entra no
                              fluxo de compra, serviço e avaliação.
                            </div>
                          </div>
                        </div>
                      </div>
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
                    Outras peças da mesma central, prontas para continuar a
                    descoberta dentro do Marto.
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
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                    const moreName =
                      String(it.name ?? '').trim() ||
                      String(it.title ?? '').trim() ||
                      String(it.productHandle ?? '').trim() ||
                      String(it.handle ?? '').trim() ||
                      'Peça da central';

                    return (
                      <Link
                        key={it.id}
                        href={`/shop/p/${encodeURIComponent(it.id)}`}
                        className="group overflow-hidden rounded-[24px] border border-white/15 bg-black/35 transition hover:border-white/25 hover:bg-black/45"
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
                          {img ? (
                            <img
                              src={img}
                              alt={moreName}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          ) : null}

                          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.22)_42%,rgba(0,0,0,0.03)_100%)] transition duration-300 group-hover:bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.34)_46%,rgba(0,0,0,0.06)_100%)]" />

                          <div className="absolute inset-x-0 bottom-0 p-3">
                            <div className="translate-y-1 transition duration-300 group-hover:translate-y-0">
                              <div className="line-clamp-2 text-[13px] font-semibold leading-5 text-white/96 transition duration-300 group-hover:text-white">
                                {moreName}
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-3">
                              <div className="text-xs font-semibold text-white/84">
                                {priceBRL}
                              </div>

                              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/76 opacity-0 transition duration-300 group-hover:opacity-100">
                                abrir peça
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {essenceOpen ? (
              <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Leitura completa da peça">
                <button
                  type="button"
                  onClick={() => setEssenceOpen(false)}
                  className="absolute inset-0 bg-black/70"
                  aria-label="Fechar leitura completa"
                />

                <div className="absolute left-1/2 top-1/2 w-[min(860px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/15 bg-neutral-950/95 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/52">
                        Essência da peça
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white/92">
                        Leitura completa
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEssenceOpen(false)}
                      className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/12"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
                    <div className="whitespace-pre-wrap text-sm leading-7 text-white/78">
                      {essenceText}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

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

