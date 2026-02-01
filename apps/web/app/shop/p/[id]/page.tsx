// apps/web/app/shop/p/[id]/page.tsx
'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { VerifiedSocialSummary } from '../../../../components/marto/VerifiedSocialSummary';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price?: number; // legacy
  priceCents?: number | null;
  merchantId: string;
  images?: string[];
  productHandle?: string | null;
  merchantHandle?: string | null;
  merchantTradeName?: string | null;
};

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

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<Product | null>(null);

  const [buying, setBuying] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // ✅ novos states (pagamento)
  const [paying, setPaying] = useState(false);
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);

  // ✅ novos states (posts do produto)
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsErr, setPostsErr] = useState('');

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

  async function payNow() {
    try {
      setPaying(true);
      setErr(null);

      const token = getToken();
      if (!token) {
        setErr('Você precisa estar logado como consumidor para pagar.');
        return;
      }

      const orderId = createdOrderId;
      if (!orderId) return;

      const res = await fetch(`http://localhost:3001/api/payments/mock`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const text = await res.text().catch(() => '');
      let data: unknown = null;

      try {
        data = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        data = text;
      }

      console.log(
        'PAY MOCK status=',
        res.status,
        'orderId=',
        orderId,
        'response=',
        data,
      );

      if (!res.ok) {
        const msg = extractErrorMessage(data, `HTTP ${res.status}`);
        throw new Error(String(msg));
      }

      // ✅ marcou como pago (mock)
      setPaidOrderId(orderId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao pagar');
    } finally {
      setPaying(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-white/60">
              Rastro do Produto
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white/90">
              {p?.name ?? 'Produto'}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Compra real → experiência → reputação. Marto como consequência.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/catalog"
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-black/55"
            >
              Voltar ao catálogo
            </Link>

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
        ) : err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        ) : !p ? (
          <p className="text-sm text-white/70">Produto não encontrado.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {/* ✅ imagem do produto */}
              <div className="relative">
                {toAbsoluteUrl(coverFromImages(p.images)) ? (
                  <div className="h-56 w-full bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={toAbsoluteUrl(coverFromImages(p.images)) as string}
                      alt={p.name}
                      className="h-56 w-full object-cover"
                      loading="lazy"
                      onError={() => {
                        console.log(
                          'SHOP IMG ERROR:',
                          toAbsoluteUrl(coverFromImages(p.images)),
                        );
                      }}
                    />
                  </div>
                ) : (
                  <div className="grid h-56 w-full place-items-center bg-white/5 text-sm font-semibold text-white/60">
                    Sem foto
                  </div>
                )}

                <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
                  Verificado pelo rastro
                </div>
              </div>

              <div className="p-5">
                <div className="flex flex-col gap-2">
                  {(() => {
                    const ident = extractIdentity(p.description ?? '');
                    const cat = extractCatalog(p.description ?? '');
                    const handle = ident.handle ? `@${ident.handle}` : '';

                    return (
                      <div className="flex flex-col gap-2">
                        <div className="text-xl font-semibold">{p.name}</div>
                        {p.merchantHandle && p.productHandle ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                              Link público:
                            </span>

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
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm text-white/70">
                            {(() => {
                              const cents =
                                typeof p.priceCents === 'number'
                                  ? p.priceCents
                                  : typeof p.price === 'number'
                                    ? p.price
                                    : 0;

                              const v = cents / 100;
                              return v.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              });
                            })()}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
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

                          {cat.inventario ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              Inventário: {cat.inventario}
                            </span>
                          ) : null}

                          {cat.preparoDias ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              Preparo: {cat.preparoDias} dias
                            </span>
                          ) : null}

                          {cat.estoque ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              Estoque: {cat.estoque}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ✅ Frete (MVP) — perto do preço/botões */}
                  <ShippingEstimator description={p.description ?? null} />

                  {(() => {
                    const clean = stripMartoBlocks(p.description ?? '');
                    return clean ? (
                      <div className="whitespace-pre-wrap text-sm text-white/75">
                        {clean}
                      </div>
                    ) : (
                      <div className="text-sm text-white/65">Sem descrição.</div>
                    );
                  })()}

                  <div className="mt-2 text-xs text-white/60">ID: {p.id}</div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    onClick={buyNow}
                    disabled={buying}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    {buying ? 'Comprando...' : 'Comprar (1 unidade)'}
                  </button>

                  {createdOrderId ? (
                    <>
                      <div className="text-sm text-white/80">
                        ✅ Pedido criado:{' '}
                        <span className="font-semibold">{createdOrderId}</span>
                      </div>

                      {!paidOrderId ? (
                        <button
                          onClick={payNow}
                          disabled={paying}
                          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
                        >
                          {paying ? 'Pagando...' : 'Pagar agora'}
                        </button>
                      ) : (
                        <Link
                          href={`/dash/consumer/orders/${encodeURIComponent(
                            paidOrderId,
                          )}`}
                          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                        >
                          Ver pedido →
                        </Link>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ✅ Resumo “Social verificado” (componente) */}
            <section className="mt-8">
              <VerifiedSocialSummary productId={p.id} />
            </section>

            {/* ✅ Experiências reais */}
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
                <div className="mt-4 space-y-3">
                  {posts.slice(0, 3).map((post) => {
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
                        className="rounded-xl border border-white/15 bg-black/60 p-3"
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

                        <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">
                          {post.caption || '(sem texto)'}
                        </div>
                      </div>
                    );
                  })}

                  <Link
                    href={`/shop/p/${encodeURIComponent(p.id)}/posts`}
                    className="mt-3 inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Ver todos →
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
