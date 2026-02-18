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

function extractCatalog(desc: string) {
  const s = String(desc ?? '');

  const startMarker = '---\n### Catálogo (Marto)\n';
  const endMarker = '\n### /Catálogo (Marto)\n---';

  const start = s.indexOf(startMarker);
  if (start === -1) {
    return { tipo: '', inventario: '', preparoDias: '', estoque: '' };
  }

  const end = s.indexOf(endMarker, start);
  if (end === -1) {
    return { tipo: '', inventario: '', preparoDias: '', estoque: '' };
  }

  const inside = s.slice(start, end);

  const tipo = inside.match(/Tipo:\s*(.+)/i)?.[1]?.trim() ?? '';
  const inv = inside.match(/Inventário:\s*(.+)/i)?.[1]?.trim() ?? '';
  const prep =
    inside.match(/Prazo de preparação:\s*([0-9]+)/i)?.[1]?.trim() ?? '';
  const est = inside.match(/Estoque:\s*([0-9]+)/i)?.[1]?.trim() ?? '';

  return { tipo, inventario: inv, preparoDias: prep, estoque: est };
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
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/60">
              <Link href="/catalog" className="hover:text-white/80">
                Catálogo
              </Link>
              <span className="text-white/35">/</span>
              <span className="text-white/70">Produto</span>
              {p?.name ? (
                <>
                  <span className="text-white/35">/</span>
                  <span className="truncate text-white/80">{p.name}</span>
                </>
              ) : null}
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white/90">
              {p?.name ?? 'Produto'}
            </h1>

            <p className="mt-1 text-sm text-white/70">
              Ciclo completo: compra → serviço → avaliação → social → dados.
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
            <section className="overflow-hidden rounded-2xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="grid gap-0 md:grid-cols-2">
                {/* LEFT: Galeria com navegação e miniaturas */}
                <div className="border-b border-white/10 md:border-b-0 md:border-r">
                  <div className="relative">
                    {(() => {
                      const urls = (p.images ?? [])
                        .map((x) => toAbsoluteUrl(String(x ?? '').trim()))
                        .filter(Boolean) as string[];

                      function pickOverview3(v: unknown): string[] | null {
                        if (!Array.isArray(v)) return null;
                        const out = v
                          .map((x) => String(x ?? '').trim())
                          .filter(Boolean)
                          .slice(0, 3);
                        return out.length ? out : null;
                      }

                      const imagesWithOverview = urls.map((url, i) => ({
                        url,
                        overview: pickOverview3(p.imageInsights?.[i]?.overview),
                      }));
                      if (!imagesWithOverview.length) {
                        return (
                          <div className="grid h-72 w-full place-items-center bg-white/5 text-sm font-semibold text-white/60 sm:h-80">
                            Sem foto
                          </div>
                        );
                      }

                      const safeIndex = Math.min(
                        galleryIndex,
                        imagesWithOverview.length - 1,
                      );
                      const current =
                        imagesWithOverview[safeIndex] ??
                        imagesWithOverview[0];
                      const hotspots: ImageHotspot[] =
                        (p?.imageInsights?.[safeIndex]?.hotspots as
                          | ImageHotspot[]
                          | undefined) ?? [];

                      return (
                        <>
                          {/* imagem principal com overlay Marto */}
                          <div className="relative group overflow-hidden rounded-3xl border border-white/10 bg-black">
                            <div
                              className="relative"
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

                              {/* Hotspots */}
                              {hotspots.map((hs, i) => {
                                const left = `${clamp(hs.x, 0, 100)}%`;
                                const top = `${clamp(hs.y, 0, 100)}%`;

                                return (
                                  <button
                                    key={`${i}-${hs.x}-${hs.y}`}
                                    type="button"
                                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{ left, top }}
                                    aria-label={hs.title}
                                    onMouseEnter={() => {
                                      if (hoverTimer.current)
                                        window.clearTimeout(
                                          hoverTimer.current,
                                        );
                                      if (hideTimer.current)
                                        window.clearTimeout(
                                          hideTimer.current,
                                        );

                                      hoverTimer.current = window.setTimeout(
                                        () => {
                                          setHoverHotspot(hs);

                                          setHoverPos({
                                            x: clamp(hs.x, 8, 92),
                                            y: clamp(hs.y, 8, 92),
                                          });

                                          hideTimer.current =
                                            window.setTimeout(() => {
                                              setHoverHotspot(null);
                                              setHoverPos(null);
                                            }, 2600);
                                        },
                                        450,
                                      );
                                    }}
                                  >
                                    {/* ponto */}
                                    <span className="relative block h-3 w-3">
                                      <span className="absolute inset-0 rounded-full bg-white/25 blur-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                      <span className="absolute inset-0 rounded-full bg-white/35" />
                                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" />
                                    </span>
                                  </button>
                                );
                              })}

                              {/* Tooltip (delay + auto-hide) */}
                              {hoverHotspot && hoverPos ? (
                                <div
                                  className="pointer-events-none absolute z-20 w-[260px] -translate-x-1/2 rounded-2xl border border-white/15 bg-neutral-950/70 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                                  style={{
                                    left: `${hoverPos.x}%`,
                                    top: `${hoverPos.y}%`,
                                  }}
                                >
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                                    detalhe
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-white/90">
                                    {hoverHotspot.title}
                                  </div>
                                  {hoverHotspot.description ? (
                                    <div className="mt-1 text-xs text-white/75">
                                      {hoverHotspot.description}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            {/* botão anterior */}
                            {imagesWithOverview.length > 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setGalleryIndex(
                                    (prev) =>
                                      (prev - 1 + imagesWithOverview.length) %
                                      imagesWithOverview.length,
                                  )
                                }
                                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60"
                                aria-label="Foto anterior"
                              >
                                ‹
                              </button>
                            ) : null}

                            {/* botão próximo */}
                            {imagesWithOverview.length > 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setGalleryIndex(
                                    (prev) =>
                                      (prev + 1) % imagesWithOverview.length,
                                  )
                                }
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60"
                                aria-label="Próxima foto"
                              >
                                ›
                              </button>
                            ) : null}

                            {/* indicador de posição */}
                            {imagesWithOverview.length > 1 ? (
                              <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                                {safeIndex + 1} / {imagesWithOverview.length}
                              </div>
                            ) : null}

                            {/* selo de verificação */}
                            <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white/80">
                              Verificado pelo rastro
                            </div>
                          </div>

                          {/* miniaturas */}
                          {imagesWithOverview.length > 1 ? (
                            <div className="mt-3 flex gap-2 overflow-x-auto">
                              {imagesWithOverview.map((img, idx) => (
                                <button
                                  key={`${img.url}-${idx}`}
                                  type="button"
                                  onClick={() => setGalleryIndex(idx)}
                                  className={[
                                    'h-14 w-14 rounded-md border',
                                    idx === safeIndex
                                      ? 'border-white/50'
                                      : 'border-white/20 hover:border-white/40',
                                  ].join(' ')}
                                  aria-label={`Miniatura ${idx + 1}`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {/* botão de tela cheia / zoom */}
                          <button
                            type="button"
                            onClick={() => setGalleryOpen(true)}
                            className="mt-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-black/55"
                          >
                          {imagesWithOverview.length > 1
                            ? 'Tela cheia'
                            : 'Ampliar'}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* RIGHT: Identidade + ações */}
                <div className="p-5">
                  {(() => {
                    const ident = extractIdentity(p.description ?? '');
                    const cat = extractCatalog(p.description ?? '');
                    const handle = ident.handle ? `@${ident.handle}` : '';

                    const cents =
                      typeof p.priceCents === 'number'
                        ? p.priceCents
                        : typeof p.price === 'number'
                          ? p.price
                          : 0;

                    const priceBRL = (Number(cents ?? 0) / 100).toLocaleString(
                      'pt-BR',
                      { style: 'currency', currency: 'BRL' },
                    );

                    return (
                      <div className="flex flex-col gap-4">
                        {/* status line */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white/80">
                            Produto ativo no Marto
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                            Verificado pelo rastro
                          </span>
                          {cat.inventario ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                              Inventário: {cat.inventario}
                            </span>
                          ) : null}
                        </div>

                        {/* name + price */}
                        <div className="flex flex-col gap-1">
                          <div className="text-xl font-semibold text-white/90">
                            {p.name}
                          </div>

                          <div className="flex flex-wrap items-baseline gap-3">
                            <div className="text-lg font-semibold text-white/90">
                              {priceBRL}
                            </div>

                            {cat.preparoDias ? (
                              <div className="text-xs text-white/65">
                                preparo ~{' '}
                                <span className="font-semibold text-white/80">
                                  {cat.preparoDias} dias
                                </span>
                              </div>
                            ) : null}

                            {cat.estoque ? (
                              <div className="text-xs text-white/65">
                                estoque:{' '}
                                <span className="font-semibold text-white/80">
                                  {cat.estoque}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* identity chips */}
                        <div className="flex flex-wrap items-center gap-2">
                          {handle ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                              {handle}
                            </span>
                          ) : null}

                          {cat.tipo ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              Tipo: {cat.tipo}
                            </span>
                          ) : null}

                          {p.merchantTradeName ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              Loja: {p.merchantTradeName}
                            </span>
                          ) : null}
                        </div>

                        {/* public link (se tiver handle) */}
                        {p.merchantHandle && p.productHandle ? (
                          <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                            <div className="text-xs font-semibold text-white/70">
                              Link público
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <code className="rounded-md bg-black/60 px-2 py-1 text-xs text-white/85">
                                /shop/@{p.merchantHandle}/p/@{p.productHandle}
                              </code>

                              <button
                                type="button"
                                onClick={() => {
                                  const url = `${window.location.origin}/shop/@${p.merchantHandle}/p/@${p.productHandle}`;
                                  navigator.clipboard.writeText(url);
                                }}
                                className="rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {/* CTA block */}
                        <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white/85">
                                Iniciar compra pelo Marto
                              </div>
                              <div className="mt-1 text-xs text-white/65">
                                Fluxo completo: compra → serviço → avaliação →
                                social → dados.
                              </div>
                            </div>

                            <button
                              onClick={buyNow}
                              disabled={buying}
                              className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                            >
                              {buying ? 'Iniciando…' : 'Iniciar ciclo Marto'}
                            </button>
                          </div>

                          {createdOrderId ? (
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-white/80">
                                  ✅ Pedido criado:{' '}
                                  <span className="font-semibold">
                                    {createdOrderId}
                                  </span>
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
                        </div>

                        {/* ✅ Mais deste perfil (continuidade Marto) */}
                        <section className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                          <div className="flex items-baseline justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white/85">
                                Mais deste perfil
                              </div>
                              <div className="mt-1 text-sm text-white/70">
                                Continuidade da loja no Marto (sem recomendação
                                genérica).
                              </div>
                            </div>

                            {p.merchantHandle ? (
                              <Link
                                href={`/loja/${encodeURIComponent(
                                  p.merchantHandle,
                                )}`}
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                              >
                                Ver loja →
                              </Link>
                            ) : null}
                          </div>

                          {moreLoading ? (
                            <div className="mt-4 text-sm text-white/70">
                              Carregando…
                            </div>
                          ) : moreErr ? (
                            <div className="mt-4 text-sm text-white/75">
                              {moreErr}
                            </div>
                          ) : more.length === 0 ? (
                            <div className="mt-4 text-sm text-white/70">
                              Sem mais produtos desta loja por enquanto.
                            </div>
                          ) : (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              {more.map((it) => {
                                const img = toAbsoluteUrl(
                                  coverFromImages(it.images ?? []),
                                );
                                const cents =
                                  typeof it.priceCents === 'number'
                                    ? it.priceCents
                                    : typeof it.price === 'number'
                                      ? it.price
                                      : 0;

                                const priceBRL = (
                                  Number(cents ?? 0) / 100
                                ).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                });

                                return (
                                  <Link
                                    key={it.id}
                                    href={`/shop/p/${encodeURIComponent(
                                      it.id,
                                    )}`}
                                    className="group overflow-hidden rounded-2xl border border-white/15 bg-black/40 hover:bg-black/55"
                                  >
                                    <div className="h-28 w-full bg-white/5">
                                      {img ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={img}
                                          alt={it.name}
                                          className="h-28 w-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : null}
                                    </div>

                                    <div className="p-3">
                                      <div className="line-clamp-2 text-sm font-semibold text-white/85">
                                        {it.name}
                                      </div>
                                      <div className="mt-1 text-xs text-white/65">
                                        {priceBRL}
                                      </div>
                                      <div className="mt-2 text-[11px] text-white/55">
                                        rastro ativo • marto
                                      </div>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </section>

            {/* ✅ Entrega (MVP) — seção própria (não infla o Hero) */}
            <section className="mt-6">
              <ShippingEstimator description={p.description ?? null} />
            </section>

            {/* ✅ Descrição — seção própria (controle) */}
            <section className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-sm font-semibold text-white/85">
                Descrição
              </div>
              {(() => {
                const clean = stripMartoBlocks(p.description ?? '');
                return clean ? (
                  <div className="mt-3 whitespace-pre-wrap text-sm text-white/75">
                    {clean}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/65">
                    Sem descrição.
                  </div>
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

