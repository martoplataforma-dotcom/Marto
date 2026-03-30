'use client';

import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type ProductItem = {
  id: string;
  title: string;
  description?: string | null;
  priceCents: number;
  active: boolean;
  requiresShipping?: boolean | null;
  productType?: string | null;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  images?: string[] | null;
  imageCaptions?: string[] | null;
  imageInsights?: ImageInsight[] | null;
  meta?: {
    tech?: Partial<TechSpec> | null;
    catalog?: Partial<CatalogSpec> | null;
  } | null;
  serviceLinks?: Array<{
    id: string;
    serviceType: string;
    isRequired: boolean;
    sortOrder: number;
  }>;

  // (futuro) quando o backend mandar
  ordersCount?: number | null;
  reviewsCount?: number | null;
  hasService?: boolean | null;
};

type ShippingMode =
  | 'CORREIOS'
  | 'TRANSPORTADORA'
  | 'LOCAL_DELIVERY'
  | 'PICKUP';

type ShippingSize = 'SMALL' | 'MEDIUM' | 'LARGE';

type ShippingOptionsResponse = {
  analysis: {
    shippingSize: ShippingSize;
    canUseCorreios: boolean;
    shouldPrioritizeTransportadora: boolean;
    recommendedShippingModes: ShippingMode[];
    reason: string;
  };
  availableShippingModes: ShippingMode[];
  blockedModes: Array<{
    mode: ShippingMode;
    reason: string;
  }>;
  suggestedPrimaryShippingMode: ShippingMode | null;
};

type ProductsResponse = {
  ok: boolean;
  items: ProductItem[];
};

type CreateProductResponse =
  | { ok: true; created: ProductItem }
  | { ok: false; message: string };

type UpdateProductResponse =
  | { ok: true; updated: ProductItem }
  | { ok: false; message: string };

type ImageInsight = {
  overview?: string[]; // 3 linhas
  hotspots?: unknown[]; // vamos ignorar agora
};

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

function toPublicImageUrl(src: string) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return `http://localhost:3001${src}`;
}

function brlFromCents(cents: number) {
  const n = Number(cents ?? 0) / 100;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

const PRODUCT_SERVICE_OPTIONS = [
  { key: 'assembly', label: 'Montagem' },
  { key: 'installation', label: 'Instalação' },
  { key: 'maintenance', label: 'Manutenção' },
  { key: 'delivery', label: 'Entrega' },
  { key: 'technical_visit', label: 'Visita técnica' },
];

function normalizeCaptions(len: number, prev?: string[] | null): string[] {
  const base = Array.isArray(prev) ? prev.slice(0, len) : [];
  while (base.length < len) base.push('');
  return base;
}

function normalizeOverview3(lines: unknown): [string, string, string] {
  if (!Array.isArray(lines)) return ['', '', ''];
  const a = String(lines?.[0] ?? '').trim();
  const b = String(lines?.[1] ?? '').trim();
  const c = String(lines?.[2] ?? '').trim();
  return [a, b, c];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function normalizeInsightsForLen(
  len: number,
  existing: unknown,
): ImageInsight[] {
  const base: ImageInsight[] = Array.isArray(existing)
    ? existing.map((it) => {
        const r = asRecord(it);
        return {
          overview: normalizeOverview3(r?.overview),
          hotspots: Array.isArray(r?.hotspots) ? (r.hotspots as unknown[]) : [],
        };
      })
    : [];

  const next = [...base];
  while (next.length < len) next.push({ overview: ['', '', ''], hotspots: [] });
  if (next.length > len) next.length = len;

  // força overview sempre com 3 linhas
  for (let i = 0; i < next.length; i++) {
    next[i] = {
      ...next[i],
      overview: normalizeOverview3(next[i]?.overview),
      hotspots: Array.isArray(next[i]?.hotspots) ? next[i]!.hotspots : [],
    };
  }

  return next;
}

function moveItem<T>(arr: T[], from: number, to: number) {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function removeAt<T>(arr: T[], idx: number) {
  return arr.filter((_, i) => i !== idx);
}

function catalogLabelKind(kind?: ProductKind | null) {
  if (kind === 'DIGITAL') return 'Digital';
  if (kind === 'SERVICE') return 'Serviço';
  return 'Físico';
}

function catalogLabelInv(inv?: InventoryMode | null) {
  return inv === 'LIMITED' ? 'Limitado' : 'Infinito';
}

function catalogSummary(cat?: Partial<CatalogSpec> | null) {
  if (!cat) return null;

  const kind = (cat.kind ?? 'PHYSICAL') as ProductKind;
  const inventoryMode = (cat.inventoryMode ?? 'INFINITE') as InventoryMode;
  const prepDays = String(cat.prepDays ?? '').trim();
  const stockTotal = String(cat.stockTotal ?? '').trim();

  const options = Array.isArray(cat.options) ? cat.options : [];
  const variants = Array.isArray(cat.variants) ? cat.variants : [];

  const hasOptions =
    options.some((o) => String(o?.name ?? '').trim() && (o?.values ?? []).length > 0);

  const hasVariants = variants.length > 0;

  const variantsCount = hasOptions && hasVariants ? variants.length : 0;

  const limited = inventoryMode === 'LIMITED' && kind === 'PHYSICAL';

  const stockInfo =
    limited && variantsCount > 0
      ? `Estoque por variação (${variantsCount})`
      : limited
        ? stockTotal
          ? `Estoque: ${stockTotal}`
          : 'Estoque: —'
        : 'Estoque: ∞';

  return {
    kindLabel: catalogLabelKind(kind),
    invLabel: catalogLabelInv(inventoryMode),
    prep: prepDays ? `${prepDays} dia(s)` : '—',
    variantsCount,
    stockInfo,
  };
}

function MartoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-neutral-950" />
      <div className="absolute -top-48 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
    </div>
  );
}

function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* panel */}
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-full sm:max-h-none sm:w-[560px] sm:rounded-none sm:rounded-l-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-black/30 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white/90">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-xs text-white/65">{subtitle}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[92vh] overflow-auto p-5 sm:h-[calc(100%-64px)] sm:max-h-none">
          {children}
        </div>
      </div>
    </div>
  );
}

function Chip({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'good'
      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
      : tone === 'warn'
        ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
        : tone === 'bad'
          ? 'border-rose-400/25 bg-rose-400/10 text-rose-100'
          : 'border-white/15 bg-white/5 text-white/80';

  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        toneCls,
      )}
    >
      {text}
    </span>
  );
}

/**
 * ✅ MARTO: Ficha técnica sem quebrar backend (por enquanto)
 * - Guardamos a ficha dentro da description com marcador.
 * - Quando você quiser, migramos isso pra colunas do Prisma.
 */
const TECH_MARKER_START = '---\n### Ficha técnica (Marto)\n';
const TECH_MARKER_END = '\n### /Ficha técnica (Marto)\n---';

type TechSpec = {
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  sku: string;
  barcode: string;
  brand: string;
  tags: string;
};

function stripTechBlock(desc: string) {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(TECH_MARKER_START);
  if (startIdx === -1) return s.trim();
  const endIdx = s.indexOf(TECH_MARKER_END, startIdx);
  if (endIdx === -1) return s.slice(0, startIdx).trim();
  return (
    s.slice(0, startIdx) + s.slice(endIdx + TECH_MARKER_END.length)
  ).trim();
}

function extractTechBlock(desc: string): Partial<TechSpec> {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(TECH_MARKER_START);
  if (startIdx === -1) return {};
  const endIdx = s.indexOf(TECH_MARKER_END, startIdx);
  if (endIdx === -1) return {};
  const inside = s.slice(startIdx + TECH_MARKER_START.length, endIdx).trim();

  const out: Partial<TechSpec> = {};

  const lines = inside.split('\n').map((l) => l.trim());
  for (const line of lines) {
    if (!line) continue;

    if (line.toLowerCase().startsWith('peso:')) {
      out.weightKg = line
        .split(':')
        .slice(1)
        .join(':')
        .trim()
        .replace('kg', '')
        .trim();
    } else if (line.toLowerCase().startsWith('dimensões:')) {
      const raw = line.split(':').slice(1).join(':').trim();
      const nums = raw
        .replace(/cm/gi, '')
        .split('x')
        .map((p) => p.trim());
      if (nums.length >= 3) {
        out.lengthCm = nums[0] ?? '';
        out.widthCm = nums[1] ?? '';
        out.heightCm = nums[2] ?? '';
      }
    } else if (line.toLowerCase().startsWith('sku:')) {
      out.sku = line.split(':').slice(1).join(':').trim();
    } else if (line.toLowerCase().startsWith('código de barras:')) {
      out.barcode = line.split(':').slice(1).join(':').trim();
    } else if (line.toLowerCase().startsWith('marca:')) {
      out.brand = line.split(':').slice(1).join(':').trim();
    } else if (line.toLowerCase().startsWith('tags:')) {
      out.tags = line.split(':').slice(1).join(':').trim();
    }
  }

  return out;
}

function hasAnyTech(spec: TechSpec | Partial<TechSpec>) {
  const s = spec as Partial<TechSpec>;
  return !!(
    String(s.weightKg ?? '').trim() ||
    String(s.lengthCm ?? '').trim() ||
    String(s.widthCm ?? '').trim() ||
    String(s.heightCm ?? '').trim() ||
    String(s.sku ?? '').trim() ||
    String(s.barcode ?? '').trim() ||
    String(s.brand ?? '').trim() ||
    String(s.tags ?? '').trim()
  );
}

function buildTechBlock(spec: TechSpec) {
  const lines: string[] = [];

  const w = spec.weightKg.trim();
  const l = spec.lengthCm.trim();
  const wi = spec.widthCm.trim();
  const h = spec.heightCm.trim();

  if (w) lines.push(`Peso: ${w} kg`);
  if (l || wi || h) {
    const a = l || '—';
    const b = wi || '—';
    const c = h || '—';
    lines.push(`Dimensões: ${a} x ${b} x ${c} cm`);
  }

  if (spec.sku.trim()) lines.push(`SKU: ${spec.sku.trim()}`);
  if (spec.barcode.trim())
    lines.push(`Código de barras: ${spec.barcode.trim()}`);
  if (spec.brand.trim()) lines.push(`Marca: ${spec.brand.trim()}`);
  if (spec.tags.trim()) lines.push(`Tags: ${spec.tags.trim()}`);

  if (lines.length === 0) return '';
  return `${TECH_MARKER_START}${lines.join('\n')}${TECH_MARKER_END}`;
}

function mergeDescriptionWithTech(userDesc: string, spec: TechSpec) {
  const base = stripTechBlock(userDesc);
  const tech = buildTechBlock(spec);
  if (!tech) return base || null;
  if (!base) return tech;
  return `${base}\n\n${tech}`;
}

/**
 * ✅ MARTO: Catálogo (tipo/estoque/variações) sem quebrar backend (por enquanto)
 * - Guardamos o catálogo dentro da description com marcador.
 * - Depois migra pra campos reais no Prisma.
 */
const CATALOG_MARKER_START = '---\n### Catálogo (Marto)\n';
const CATALOG_MARKER_END = '\n### /Catálogo (Marto)\n---';

/**
 * ✅ MARTO: Identidade do Produto (handle/slug) sem mudar backend (por enquanto)
 * - Guardamos dentro da description com marcador.
 */
const ID_MARKER_START = '---\n### Identidade (Marto)\n';
const ID_MARKER_END = '\n### /Identidade (Marto)\n---';

type IdentitySpec = {
  handle: string; // slug público
};

function slugifyMarto(input: string) {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // tudo vira -
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function stripIdentityBlock(desc: string) {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(ID_MARKER_START);
  if (startIdx === -1) return s.trim();
  const endIdx = s.indexOf(ID_MARKER_END, startIdx);
  if (endIdx === -1) return s.slice(0, startIdx).trim();
  return (s.slice(0, startIdx) + s.slice(endIdx + ID_MARKER_END.length)).trim();
}

function extractIdentityBlock(desc: string): Partial<IdentitySpec> {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(ID_MARKER_START);
  if (startIdx === -1) return {};
  const endIdx = s.indexOf(ID_MARKER_END, startIdx);
  if (endIdx === -1) return {};

  const inside = s.slice(startIdx + ID_MARKER_START.length, endIdx).trim();
  const out: Partial<IdentitySpec> = {};

  for (const line of inside.split('\n').map((l) => l.trim())) {
    if (!line) continue;
    if (line.toLowerCase().startsWith('handle:')) {
      out.handle = line.split(':').slice(1).join(':').trim();
    }
  }

  return out;
}

function buildIdentityBlock(idn: IdentitySpec) {
  const h = slugifyMarto(idn.handle);
  if (!h) return '';
  return `${ID_MARKER_START}Handle: ${h}${ID_MARKER_END}`;
}

function mergeDescWithIdentity(desc: string, idn: IdentitySpec) {
  const base = stripIdentityBlock(desc);
  const block = buildIdentityBlock(idn);
  if (!block) return base || null;
  if (!base) return block;
  return `${base}\n\n${block}`;
}

/**
 * ✅ MARTO: DNA do Produto (operacional)
 */
const DNA_MARKER_START = '---\n### DNA do Produto (Marto)\n';
const DNA_MARKER_END = '\n### /DNA do Produto (Marto)\n---';

type ProductDNA = {
  skuRoot: string;
  collection: string;
  version: string;
};

function stripDNABlock(desc: string) {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(DNA_MARKER_START);
  if (startIdx === -1) return s.trim();
  const endIdx = s.indexOf(DNA_MARKER_END, startIdx);
  if (endIdx === -1) return s.slice(0, startIdx).trim();
  return (s.slice(0, startIdx) + s.slice(endIdx + DNA_MARKER_END.length)).trim();
}

function extractDNABlock(desc: string): Partial<ProductDNA> {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(DNA_MARKER_START);
  if (startIdx === -1) return {};
  const endIdx = s.indexOf(DNA_MARKER_END, startIdx);
  if (endIdx === -1) return {};

  const inside = s.slice(startIdx + DNA_MARKER_START.length, endIdx).trim();
  const out: Partial<ProductDNA> = {};

  for (const line of inside.split('\n').map((l) => l.trim())) {
    if (line.toLowerCase().startsWith('sku raiz:'))
      out.skuRoot = line.split(':').slice(1).join(':').trim();
    if (line.toLowerCase().startsWith('coleção:'))
      out.collection = line.split(':').slice(1).join(':').trim();
    if (line.toLowerCase().startsWith('versão:'))
      out.version = line.split(':').slice(1).join(':').trim();
  }

  return out;
}

function buildDNABlock(dna: ProductDNA) {
  const lines: string[] = [];
  if (dna.skuRoot.trim()) lines.push(`SKU raiz: ${dna.skuRoot.trim()}`);
  if (dna.collection.trim()) lines.push(`Coleção: ${dna.collection.trim()}`);
  if (dna.version.trim()) lines.push(`Versão: ${dna.version.trim()}`);

  if (!lines.length) return '';
  return `${DNA_MARKER_START}${lines.join('\n')}${DNA_MARKER_END}`;
}

function mergeDescWithDNA(desc: string, dna: ProductDNA) {
  const base = stripDNABlock(desc);
  const block = buildDNABlock(dna);
  if (!block) return base || null;
  if (!base) return block;
  return `${base}\n\n${block}`;
}

type ProductKind = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
type InventoryMode = 'INFINITE' | 'LIMITED';

type VariantRow = {
  key: string; // "Cor=Preto | Tamanho=G"
  sku: string;
  stock: string; // string pra input
};

type CatalogSpec = {
  kind: ProductKind;
  inventoryMode: InventoryMode;
  stockTotal: string; // usado quando não tem variações
  prepDays: string; // prazo de preparação
  options: Array<{ name: string; values: string[] }>;
  variants: VariantRow[];
};

function stripCatalogBlock(desc: string) {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(CATALOG_MARKER_START);
  if (startIdx === -1) return s.trim();
  const endIdx = s.indexOf(CATALOG_MARKER_END, startIdx);
  if (endIdx === -1) return s.slice(0, startIdx).trim();
  return (
    s.slice(0, startIdx) + s.slice(endIdx + CATALOG_MARKER_END.length)
  ).trim();
}

function extractCatalogBlock(desc: string): Partial<CatalogSpec> {
  const s = String(desc ?? '');
  const startIdx = s.indexOf(CATALOG_MARKER_START);
  if (startIdx === -1) return {};
  const endIdx = s.indexOf(CATALOG_MARKER_END, startIdx);
  if (endIdx === -1) return {};
  const inside = s.slice(startIdx + CATALOG_MARKER_START.length, endIdx).trim();

  const out: Partial<CatalogSpec> = {};
  const lines = inside.split('\n').map((l) => l.trim());

  const variants: VariantRow[] = [];
  let inVariants = false;

  for (const line of lines) {
    if (!line) continue;

    const low = line.toLowerCase();

    if (low.startsWith('tipo:')) {
      const v = line.split(':').slice(1).join(':').trim().toLowerCase();
      if (v.includes('fís')) out.kind = 'PHYSICAL';
      else if (v.includes('dig')) out.kind = 'DIGITAL';
      else if (v.includes('serv')) out.kind = 'SERVICE';
    } else if (low.startsWith('inventário:')) {
      const v = line.split(':').slice(1).join(':').trim().toLowerCase();
      out.inventoryMode = v.includes('limit') ? 'LIMITED' : 'INFINITE';
    } else if (low.startsWith('prazo de preparação:')) {
      const v = line
        .split(':')
        .slice(1)
        .join(':')
        .trim()
        .replace(/dias?/gi, '')
        .trim();
      out.prepDays = v;
    } else if (low.startsWith('estoque:')) {
      const v = line.split(':').slice(1).join(':').trim();
      out.stockTotal = v;
    } else if (low.startsWith('variações:')) {
      inVariants = true;
    } else if (inVariants && line.startsWith('- ')) {
      // - Cor=Preto | Tamanho=G | SKU=... | Estoque=...
      const raw = line.slice(2).trim();
      const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);

      const keyParts: string[] = [];
      let sku = '';
      let stock = '';

      for (const p of parts) {
        const plow = p.toLowerCase();
        if (plow.startsWith('sku=')) sku = p.split('=').slice(1).join('=').trim();
        else if (plow.startsWith('estoque=')) stock = p.split('=').slice(1).join('=').trim();
        else keyParts.push(p);
      }

      const key = keyParts.join(' | ').trim();
      if (key) variants.push({ key, sku, stock });
    }
  }

  if (variants.length) out.variants = variants;

  return out;
}

function buildCatalogBlock(cat: CatalogSpec) {
  const lines: string[] = [];

  const kindLabel =
    cat.kind === 'PHYSICAL' ? 'Físico' : cat.kind === 'DIGITAL' ? 'Digital' : 'Serviço';

  lines.push(`Tipo: ${kindLabel}`);
  lines.push(`Inventário: ${cat.inventoryMode === 'INFINITE' ? 'Infinito' : 'Limitado'}`);

  const prep = String(cat.prepDays ?? '').trim();
  if (prep) lines.push(`Prazo de preparação: ${prep} dias`);

  const hasOptions =
    Array.isArray(cat.options) && cat.options.some((o) => o.name && o.values?.length);
  const hasVariants = Array.isArray(cat.variants) && cat.variants.length > 0;

  if (!hasOptions || !hasVariants) {
    const stock = String(cat.stockTotal ?? '').trim();
    if (cat.inventoryMode === 'LIMITED' && stock) lines.push(`Estoque: ${stock}`);
  } else {
    lines.push('Variações:');
    for (const v of cat.variants) {
      const sku = String(v.sku ?? '').trim();
      const stock = String(v.stock ?? '').trim();
      const skuPart = sku ? ` | SKU=${sku}` : '';
      const stockPart = stock ? ` | Estoque=${stock}` : '';
      lines.push(`- ${v.key}${skuPart}${stockPart}`);
    }
  }

  return `${CATALOG_MARKER_START}${lines.join('\n')}${CATALOG_MARKER_END}`;
}

// combos (cartesian)
function cartesian(options: Array<{ name: string; values: string[] }>) {
  const clean = options
    .map((o) => ({
      name: String(o.name ?? '').trim(),
      values: (o.values ?? []).map((v) => String(v).trim()).filter(Boolean),
    }))
    .filter((o) => o.name && o.values.length);

  if (!clean.length) return [] as string[];

  let acc: Array<Record<string, string>> = [{}];
  for (const opt of clean) {
    const next: Array<Record<string, string>> = [];
    for (const row of acc) {
      for (const val of opt.values) next.push({ ...row, [opt.name]: val });
    }
    acc = next;
  }

  return acc.map((row) =>
    Object.entries(row)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | '),
  );
}

function WizardCard({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Modo Marto</div>
          <div className="mt-1 text-xs text-white/70">
            Produto no Marto não é “anúncio”. É uma peça do ciclo:{' '}
            <span className="font-semibold text-white/85">
              produto → serviço → avaliação → dados
            </span>
            .
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Criar produto
          </button>

          <button
            type="button"
            onClick={onImport}
            className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-black/55"
            title="Stub: CSV/colar lista (MVP depois)"
          >
            Importar rápido
          </button>

          <button
            type="button"
            onClick={() => {
              alert(
                'Em breve: wizard “Preparar para vender + montar” (serviço + checklist + pós-compra).',
              );
            }}
            className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-black/55"
            title="Stub: wizard de prontidão (MVP depois)"
          >
            Preparar para vender + montar
          </button>
        </div>
      </div>
    </div>
  );
}

/** ✅ Dropzone simples (sem libs) */
function FilesDropzone({
  label,
  hint,
  files,
  setFiles,
  insights,
  setInsights,
  disabled,
  maxFiles = 10,
}: {
  label: string;
  hint?: string;
  files: File[];
  setFiles: (next: File[]) => void;
  insights?: ImageInsight[];
  setInsights?: (next: ImageInsight[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragZoneOver, setDragZoneOver] = useState(false);

  const previews = useMemo(() => {
    const out = files.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    return out;
  }, [files]);

  const ins = insights ?? [];

  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    };
  }, [previews]);

  function add(newFiles: File[]) {
    const merged = [...files, ...newFiles].slice(0, maxFiles);
    setFiles(merged);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const arr = Array.from(e.target.files ?? []);
    const imgs = arr.filter((f) => f.type.startsWith('image/'));
    add(imgs);
    e.target.value = '';
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white/85">{label}</span>
        <span className="text-xs text-white/55">
          {files.length}/{maxFiles}
        </span>
      </div>

      <div
        className={classNames(
          'rounded-2xl border border-white/15 bg-black/80 p-4 transition',
          dragZoneOver ? 'border-white/30 bg-black/70' : '',
          disabled ? 'opacity-70' : '',
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragZoneOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragZoneOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragZoneOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragZoneOver(false);
          if (disabled) return;

          const arr = Array.from(e.dataTransfer.files ?? []);
          const imgs = arr.filter((f) => f.type.startsWith('image/'));
          add(imgs);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/70">
            Arraste e solte aqui, ou selecione.
            {hint ? <div className="mt-1 text-white/55">{hint}</div> : null}
          </div>

          <label className="inline-flex cursor-pointer items-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10">
            Selecionar fotos
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={onPick}
              disabled={disabled}
            />
          </label>
        </div>

        {files.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {previews.map((p, idx) => (
              <div
                key={`${p.file.name}-${idx}`}
                draggable={!disabled}
                onDragStart={() => setDragFrom(idx)}
                onDragEnter={() => setDragOver(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDrop={() => {
                  if (disabled) return;
                  if (dragFrom === null) return;
                  if (dragOver === null) return;
                  if (dragFrom === dragOver) return;

                  const nextFiles = moveItem(files, dragFrom, dragOver);
                  setFiles(nextFiles);

                  if (setInsights) {
                    const nextIns = moveItem(ins, dragFrom, dragOver);
                    setInsights(nextIns);
                  }

                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={[
                  'group relative overflow-hidden rounded-2xl border bg-black',
                  dragOver === idx ? 'border-white/40' : 'border-white/10',
                ].join(' ')}
                style={{ cursor: disabled ? 'default' : 'grab' }}
              >
                <div className="absolute left-2 top-2 z-10 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/80 backdrop-blur">
                  Arraste
                </div>
                <div className="overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.file.name}
                    className="h-24 w-full object-cover"
                  />
                </div>

                <div className="p-2">
                  {/* Visão rápida */}
                  {setInsights ? (
                    <div className="px-2 pb-2">
                      <div className="mb-1 text-[10px] font-semibold text-white/70">
                        Visão rápida (3 linhas)
                      </div>

                      {[0, 1, 2].map((lineIdx) => {
                        const ov = normalizeOverview3(ins[idx]?.overview);
                        const val = ov[lineIdx] ?? '';

                        return (
                          <input
                            key={`ov-${idx}-${lineIdx}`}
                            value={val}
                            onChange={(e) => {
                              const v = e.target.value;

                              const next = Array.isArray(ins) ? [...ins] : [];
                              const cur = next[idx] ?? { overview: ['', '', ''], hotspots: [] };
                              const nextOv = normalizeOverview3(cur.overview);
                              nextOv[lineIdx] = v;

                              next[idx] = { ...cur, overview: nextOv };
                              setInsights(next);
                            }}
                            maxLength={42}
                            placeholder={
                              lineIdx === 0
                                ? 'Ex: MDF de alta densidade'
                                : lineIdx === 1
                                  ? 'Ex: Acabamento nogueira'
                                  : 'Ex: Resistente a riscos'
                            }
                            className="mb-2 w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs text-white/85 outline-none placeholder:text-white/50"
                            disabled={disabled}
                          />
                        );
                      })}

                      <div className="mt-1 text-[10px] text-white/60">
                        Aparece no botão “i” na página do produto.
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-black/60 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFiles(removeAt(files, idx));
                      if (setInsights) {
                        setInsights(removeAt(normalizeInsightsForLen(files.length, ins), idx));
                      }
                    }}
                    className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/15"
                    disabled={disabled}
                    title="Remover"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CatalogEditor({
  cat,
  setCat,
  disabled,
}: {
  cat: CatalogSpec;
  setCat: (updater: (prev: CatalogSpec) => CatalogSpec) => void;
  disabled?: boolean;
}) {
  const kindLabel =
    cat.kind === 'PHYSICAL'
      ? 'FÍSICO'
      : cat.kind === 'DIGITAL'
        ? 'DIGITAL'
        : 'SERVIÇO';

  const invLabel =
    cat.inventoryMode === 'INFINITE' ? 'ESTOQUE INFINITO' : 'ESTOQUE LIMITADO';

  return (
    <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Venda & disponibilidade (Marto)
          </div>
          <div className="mt-1 text-xs text-white/65">
            Isso vira confiança e reduz dor de cabeça no pós-venda.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip text={kindLabel} />
          <Chip text={invLabel} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-white/65">Tipo</span>
          <select
            value={cat.kind}
            onChange={(e) => {
              const nextKind = e.target.value as ProductKind;
              setCat((p) => ({
                ...p,
                kind: nextKind,
                inventoryMode:
                  nextKind === 'PHYSICAL' ? p.inventoryMode : 'INFINITE',
                stockTotal: nextKind === 'PHYSICAL' ? p.stockTotal : '',
              }));
            }}
            className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm font-semibold text-white/85 outline-none focus:border-white/30"
            disabled={disabled}
          >
            <option value="PHYSICAL">Físico</option>
            <option value="DIGITAL">Digital</option>
            <option value="SERVICE">Serviço</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold text-white/65">Inventário</span>
          <select
            value={cat.inventoryMode}
            onChange={(e) =>
              setCat((p) => ({ ...p, inventoryMode: e.target.value as InventoryMode }))
            }
            className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm font-semibold text-white/85 outline-none focus:border-white/30"
            disabled={disabled || cat.kind !== 'PHYSICAL'}
            title={cat.kind !== 'PHYSICAL' ? 'Digital/serviço: infinito no MVP' : undefined}
          >
            <option value="INFINITE">Infinito</option>
            <option value="LIMITED">Limitado</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold text-white/65">
            Prazo de preparação (dias)
          </span>
          <input
            value={cat.prepDays}
            onChange={(e) => setCat((p) => ({ ...p, prepDays: e.target.value }))}
            className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
            placeholder="Ex.: 2"
            inputMode="numeric"
            disabled={disabled}
          />
        </label>

        {cat.inventoryMode === 'LIMITED' && cat.kind === 'PHYSICAL' ? (
          <label className="grid gap-2">
            <span className="text-xs font-semibold text-white/65">
              Estoque (sem variações)
            </span>
            <input
              value={cat.stockTotal}
              onChange={(e) => setCat((p) => ({ ...p, stockTotal: e.target.value }))}
              className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
              placeholder="Ex.: 12"
              inputMode="numeric"
              disabled={disabled}
            />
          </label>
        ) : null}
      </div>

      {/* VARIAÇÕES */}
      <div className="mt-5 rounded-3xl border border-white/15 bg-black/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white/90">Variações (Marto)</div>
            <div className="mt-1 text-xs text-white/65">
              Sem mudar preço (por enquanto): variação controla SKU e estoque.
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setCat((p) => ({
                ...p,
                options: [...p.options, { name: '', values: [] }],
              }))
            }
            className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 disabled:opacity-60"
            disabled={disabled || cat.kind !== 'PHYSICAL'}
            title={
              cat.kind !== 'PHYSICAL'
                ? 'Variações fazem mais sentido para produto físico'
                : undefined
            }
          >
            + Adicionar propriedade
          </button>
        </div>

        {cat.options.length ? (
          <div className="mt-4 grid gap-3">
            {cat.options.map((opt, idx) => (
              <div key={idx} className="rounded-2xl border border-white/15 bg-black/40 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Propriedade</span>
                    <input
                      value={opt.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCat((p) => {
                          const next = [...p.options];
                          next[idx] = { ...next[idx], name: v };
                          return { ...p, options: next };
                        });
                      }}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                      placeholder="Ex.: Cor"
                      disabled={disabled}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Valores (vírgula)</span>
                    <input
                      value={opt.values.join(', ')}
                      onChange={(e) => {
                        const values = e.target.value
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean);

                        setCat((p) => {
                          const next = [...p.options];
                          next[idx] = { ...next[idx], values };
                          return { ...p, options: next };
                        });
                      }}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                      placeholder="Ex.: Preto, Marrom"
                      disabled={disabled}
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCat((p) => {
                        const next = p.options.filter((_, i) => i !== idx);
                        // se remove opções, zera variants também (evita chaves velhas)
                        return { ...p, options: next, variants: [] };
                      });
                    }}
                    className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-black/55 disabled:opacity-60"
                    disabled={disabled}
                  >
                    Remover
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const keys = cartesian(cat.options);
                      const variants: VariantRow[] = keys.map((k) => {
                        const existing = cat.variants.find((v) => v.key === k);
                        return (
                          existing ?? {
                            key: k,
                            sku: '',
                            stock: '',
                          }
                        );
                      });

                      setCat((p) => ({
                        ...p,
                        variants,
                      }));
                    }}
                    className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                    disabled={disabled}
                  >
                    Gerar combinações
                  </button>
                </div>
              </div>
            ))}

            {cat.variants.length ? (
              <div className="rounded-2xl border border-white/15 bg-black/35 p-3">
                <div className="mb-2 text-xs font-semibold text-white/70">
                  Combinações ({cat.variants.length})
                </div>

                <div className="grid gap-2">
                  {cat.variants.map((v, i) => (
                    <div
                      key={v.key}
                      className="grid gap-2 rounded-2xl border border-white/10 bg-black/40 p-3 lg:grid-cols-[1fr_200px_140px]"
                    >
                      <div className="text-xs font-semibold text-white/85">{v.key}</div>

                      <input
                        value={v.sku}
                        onChange={(e) => {
                          const sku = e.target.value;
                          setCat((p) => {
                            const next = [...p.variants];
                            next[i] = { ...next[i], sku };
                            return { ...p, variants: next };
                          });
                        }}
                        className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                        placeholder="SKU"
                        disabled={disabled}
                      />

                      {cat.inventoryMode === 'LIMITED' && cat.kind === 'PHYSICAL' ? (
                        <input
                          value={v.stock}
                          onChange={(e) => {
                            const stock = e.target.value;
                            setCat((p) => {
                              const next = [...p.variants];
                              next[i] = { ...next[i], stock };
                              return { ...p, variants: next };
                            });
                          }}
                          className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                          placeholder="Estoque"
                          inputMode="numeric"
                          disabled={disabled}
                        />
                      ) : (
                        <div className="flex items-center text-xs text-white/55">Estoque infinito</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-2 text-[11px] text-white/55">
                  Regra Marto: se inventário é{' '}
                  <span className="font-semibold text-white/75">Limitado</span> e há variações,
                  o estoque vale por variação (não pelo “estoque total”).
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 text-xs text-white/60">
            Sem variações por enquanto. (Opcional) Adicione “Cor”, “Tamanho”, “Voltagem” etc.
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   PATCH 1 — HELPERS CHECKLIST
   ========================= */
type ChecklistItem = {
  id: string;
  label: string;
  required?: boolean;
  done: boolean;
  hint?: string;
};

function lsKeyChecklist(productId: string) {
  return `marto:product_checklist:${productId}`;
}

function loadChecklistDone(productId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(lsKeyChecklist(productId));
    if (!raw) return {};
    const json = JSON.parse(raw) as { done?: Record<string, boolean> };
    return json?.done && typeof json.done === 'object' ? json.done : {};
  } catch {
    return {};
  }
}

function saveChecklistDone(productId: string, done: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(lsKeyChecklist(productId), JSON.stringify({ done }));
}

function hasTechFilled(spec: {
  weightKg?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
}) {
  const w = String(spec.weightKg ?? '').trim();
  const l = String(spec.lengthCm ?? '').trim();
  const wi = String(spec.widthCm ?? '').trim();
  const h = String(spec.heightCm ?? '').trim();
  // regra simples: ou peso, ou 3 dimensões (melhor)
  const dimsOk = !!l && !!wi && !!h;
  return !!w || dimsOk;
}

function hasClearDescription(desc: string) {
  const t = String(desc ?? '').trim();
  if (!t) return false;
  // heurística simples: 40+ chars ou 8+ palavras
  if (t.length >= 40) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 8;
}

function catalogHasVariants(cat: {
  options?: Array<{ name: string; values: string[] }>;
  variants?: Array<{ key: string; sku: string; stock: string }>;
}) {
  const hasOpts =
    Array.isArray(cat.options) &&
    cat.options.some(
      (o) => String(o.name ?? '').trim() && (o.values ?? []).length,
    );
  const hasVars = Array.isArray(cat.variants) && cat.variants.length > 0;
  return hasOpts && hasVars;
}

function checklistForDraft(input: {
  kind: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  inventoryMode: 'INFINITE' | 'LIMITED';
  prepDays: string;
  photosCount: number;
  description: string;
  spec: { weightKg: string; lengthCm: string; widthCm: string; heightCm: string };
  hasVariants: boolean;
  variants: Array<{ sku: string; stock: string }>;
  stockTotal: string;
}) {
  const items: ChecklistItem[] = [];

  const kind = input.kind;
  const limited = input.inventoryMode === 'LIMITED';

  // fotos (mínimo varia por tipo)
  const minPhotos = kind === 'PHYSICAL' ? 4 : kind === 'DIGITAL' ? 2 : 1;
  items.push({
    id: 'photos',
    label: `Fotos reais (${minPhotos}+ )`,
    required: true,
    done: input.photosCount >= minPhotos,
    hint:
      kind === 'PHYSICAL'
        ? 'Capa + detalhe + ambiente + etiqueta/embalagem.'
        : kind === 'DIGITAL'
          ? 'Arte/capa + preview do conteúdo.'
          : 'Imagem que represente o serviço.',
  });

  // descrição
  items.push({
    id: 'desc',
    label: 'Descrição clara (sem dúvida)',
    required: true,
    done: hasClearDescription(input.description),
    hint: 'Material, medidas/itens inclusos, regras e garantia.',
  });

  // prazo
  items.push({
    id: 'prep',
    label: 'Prazo de preparação',
    required: kind !== 'DIGITAL', // digital pode ser imediata
    done: !!String(input.prepDays ?? '').trim(),
    hint: 'Quantos dias até estar pronto para envio/execução.',
  });

  // físico: peso/dimensões
  if (kind === 'PHYSICAL') {
    items.push({
      id: 'dims',
      label: 'Peso e dimensões',
      required: true,
      done: hasTechFilled(input.spec),
      hint: 'Frete mais correto e menos reclamação.',
    });
  }

  // inventário
  if (limited) {
    if (input.hasVariants) {
      items.push({
        id: 'variant_stock',
        label: 'Estoque por variação',
        required: true,
        done: input.variants.every((v) => Number(String(v.stock).trim()) > 0),
        hint: 'Evita vender o que não tem.',
      });
    } else {
      items.push({
        id: 'stock_total',
        label: 'Estoque (quantidade)',
        required: true,
        done: Number(String(input.stockTotal).trim()) > 0,
        hint: 'Evita vender sem disponibilidade.',
      });
    }
  }

  // variações: sku (sempre bom)
  if (input.hasVariants) {
    items.push({
      id: 'variant_sku',
      label: 'SKU por variação',
      required: false,
      done: input.variants.every((v) => !!String(v.sku ?? '').trim()),
      hint: 'Organiza e facilita suporte/garantia.',
    });
  }

  return items;
}

function scoreFromChecklist(items: ChecklistItem[]) {
  const applicable = items.filter((i) => i.required || i.done || i.hint !== undefined);
  const total = applicable.length || 1;
  const done = applicable.filter((i) => i.done).length;
  const score = Math.round((done / total) * 100);

  const missing = applicable.filter((i) => !i.done);
  const recs = missing.slice(0, 3).map((i) => ({
    label: i.label,
    hint: i.hint ?? '',
  }));

  return { score, done, total, recs };
}

export default function MerchantProductsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);

  // ✅ PATCH 3: força re-render do checklist manual
  const [checkTick, setCheckTick] = useState(0);

  type NewStep = 'BASIC' | 'PHOTOS' | 'CATALOG' | 'TECH' | 'REVIEW';

  const [newStep, setNewStep] = useState<NewStep>('BASIC');

  function canGoNext(step: NewStep) {
    if (step === 'BASIC') return !!title.trim() && Number(price.replace(',', '.')) > 0;
    if (step === 'PHOTOS') return true; // no MVP pode avançar sem foto (mas score vai cobrar)
    if (step === 'CATALOG') return true;
    if (step === 'TECH') return true;
    return true;
  }

  function stepLabel(step: NewStep) {
    if (step === 'BASIC') return 'Básico';
    if (step === 'PHOTOS') return 'Fotos';
    if (step === 'CATALOG') return 'Catálogo';
    if (step === 'TECH') return 'Ficha';
    return 'Revisão';
  }

  const stepOrder: NewStep[] = ['BASIC', 'PHOTOS', 'CATALOG', 'TECH', 'REVIEW'];

  function goPrev() {
    const i = stepOrder.indexOf(newStep);
    setNewStep(stepOrder[Math.max(0, i - 1)]!);
  }

  function goNext() {
    const i = stepOrder.indexOf(newStep);
    const next = stepOrder[Math.min(stepOrder.length - 1, i + 1)]!;
    if (!canGoNext(newStep)) {
      setMsg('Preencha o básico (nome + preço) para avançar.');
      return;
    }
    setMsg('');
    setNewStep(next);
  }

  // form novo produto
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [productServices, setProductServices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleProductService(service: string) {
    setProductServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service],
    );
  }

  // ✅ Fotos múltiplas (novo)
  const [files, setFiles] = useState<File[]>([]);
  const [imageInsights, setImageInsights] = useState<ImageInsight[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(''); // ex.: "2/5"

  // Ficha técnica (novo)
  const [spec, setSpec] = useState<TechSpec>({
    weightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    sku: '',
    barcode: '',
    brand: '',
    tags: '',
  });

  // ✅ Catálogo (novo)
  const [cat, setCat] = useState<CatalogSpec>({
    kind: 'PHYSICAL',
    inventoryMode: 'INFINITE',
    stockTotal: '',
    prepDays: '',
    options: [],
    variants: [],
  });
  const [idn, setIdn] = useState<IdentitySpec>({ handle: '' });
  const [dna, setDna] = useState<ProductDNA>({
    skuRoot: '',
    collection: '',
    version: '',
  });

  // edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProductTitle, setSheetProductTitle] = useState('');
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eProductServices, setEProductServices] = useState<string[]>([]);
  const [eIdn, setEIdn] = useState<IdentitySpec>({ handle: '' });
  const [eDna, setEDna] = useState<ProductDNA>({
    skuRoot: '',
    collection: '',
    version: '',
  });
  const [eSaving, setESaving] = useState(false);
  const [editShippingOptions, setEditShippingOptions] =
    useState<ShippingOptionsResponse | null>(null);
  const [editShippingLoading, setEditShippingLoading] = useState(false);
  const [editShippingError, setEditShippingError] = useState<string | null>(null);

  // ✅ Fotos múltiplas (edição)
  const [eFiles, setEFiles] = useState<File[]>([]);
  const [eKeepInsights, setEKeepInsights] = useState<ImageInsight[]>([]);
  const [eInsights, setEInsights] = useState<ImageInsight[]>([]);
  const [eOpenInsightIdx, setEOpenInsightIdx] = useState<number | null>(null);
  const [eUploading, setEUploading] = useState(false);
  const [eUploadProgress, setEUploadProgress] = useState('');

  // ✅ NOVO: controle de imagens atuais (remover na edição)
  const [eKeepImages, setEKeepImages] = useState<string[]>([]);
  const [eKeepCaptions, setEKeepCaptions] = useState<string[]>([]);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Ficha técnica (edição)
  const [eSpec, setESpec] = useState<TechSpec>({
    weightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    sku: '',
    barcode: '',
    brand: '',
    tags: '',
  });

  // ✅ Catálogo (edição)
  const [eCat, setECat] = useState<CatalogSpec>({
    kind: 'PHYSICAL',
    inventoryMode: 'INFINITE',
    stockTotal: '',
    prepDays: '',
    options: [],
    variants: [],
  });

  type EditStep = 'BASIC' | 'PHOTOS' | 'CATALOG' | 'TECH' | 'REVIEW';
  const [editStep, setEditStep] = useState<EditStep>('BASIC');

  const editOrder: EditStep[] = ['BASIC', 'PHOTOS', 'CATALOG', 'TECH', 'REVIEW'];

  function editLabel(s: EditStep) {
    if (s === 'BASIC') return 'Básico';
    if (s === 'PHOTOS') return 'Fotos';
    if (s === 'CATALOG') return 'Catálogo';
    if (s === 'TECH') return 'Ficha';
    return 'Revisão';
  }

  function canEditNext(step: EditStep) {
    if (step === 'BASIC')
      return !!String(eTitle ?? '').trim() && Number(ePrice.replace(',', '.')) > 0;
    return true;
  }

  function editPrev() {
    const i = editOrder.indexOf(editStep);
    setEditStep(editOrder[Math.max(0, i - 1)]!);
  }

  function editNext() {
    if (!canEditNext(editStep)) {
      setMsg('Preencha o básico (título + preço) para avançar.');
      return;
    }
    const i = editOrder.indexOf(editStep);
    setMsg('');
    setEditStep(editOrder[Math.min(editOrder.length - 1, i + 1)]!);
  }

  function toggleEditProductService(service: string) {
    setEProductServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service],
    );
  }

  // lightbox (ver fotos existentes do produto)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxAlt, setLightboxAlt] = useState('');

  // UI (busca/filtro)
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState<'all' | 'active' | 'inactive'>('all');

  async function loadProducts() {
    const token = getToken();
    if (!token) {
      setMsg('Sem token. Faça login novamente.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchJSON<ProductsResponse>('/merchants/me/products', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      setProducts(res.items ?? []);
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (!lightboxOpen) return;

    if (e.key === 'Escape') {
      setLightboxOpen(false);
      setLightboxImages([]);
      setLightboxIndex(0);
      setLightboxAlt('');
      return;
    }

    if (e.key === 'ArrowRight') {
      setLightboxIndex((i) => {
        const n = lightboxImages.length || 1;
        return (i + 1) % n;
      });
      return;
    }

    if (e.key === 'ArrowLeft') {
      setLightboxIndex((i) => {
        const n = lightboxImages.length || 1;
        return (i - 1 + n) % n;
      });
    }
  }

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [lightboxOpen, lightboxImages.length]);

  async function uploadMany(inputFiles: File[], setProg: (s: string) => void) {
    if (!inputFiles.length) return null as string[] | null;

    setUploading(true);
    setProg('');
    try {
      const uploaded: string[] = [];

      for (let i = 0; i < inputFiles.length; i++) {
        const f = inputFiles[i]!;
        setProg(`${i + 1}/${inputFiles.length}`);

        const fd = new FormData();
        fd.append('file', f);

        const resp = await fetch('/api/uploads', {
          method: 'POST',
          body: fd,
        });

        const json = (await resp.json()) as { ok?: boolean; url?: string };

        if (!resp.ok || !json?.ok || !json?.url) {
          setMsg('Upload falhou. Tente outra imagem.');
          return null;
        }

        const rel = toRelativeUploadsPath(json.url);
        if (!rel) {
          setMsg('Upload retornou URL inválida.');
          return null;
        }

        uploaded.push(rel);
      }

      return uploaded;
    } catch {
      setMsg('Erro ao enviar imagens.');
      return null;
    } finally {
      setUploading(false);
      setProg('');
    }
  }

  async function uploadManyEdit(inputFiles: File[], setProg: (s: string) => void) {
    if (!inputFiles.length) return null as string[] | null;

    setEUploading(true);
    setProg('');
    try {
      const uploaded: string[] = [];

      for (let i = 0; i < inputFiles.length; i++) {
        const f = inputFiles[i]!;
        setProg(`${i + 1}/${inputFiles.length}`);

        const fd = new FormData();
        fd.append('file', f);

        const resp = await fetch('/api/uploads', {
          method: 'POST',
          body: fd,
        });

        const json = (await resp.json()) as { ok?: boolean; url?: string };

        if (!resp.ok || !json?.ok || !json?.url) {
          setMsg('Upload da foto (edição) falhou.');
          return null;
        }

        const rel = toRelativeUploadsPath(json.url);
        if (!rel) {
          setMsg('Upload da foto (edição) retornou URL inválida.');
          return null;
        }

        uploaded.push(rel);
      }

      return uploaded;
    } catch {
      setMsg('Erro ao enviar fotos (edição).');
      return null;
    } finally {
      setEUploading(false);
      setProg('');
    }
  }

  function parseOptionalNumber(value: string): number | null {
    const n = Number(String(value ?? '').replace(',', '.').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function parseOptionalInt(value: string): number | null {
    const n = parseOptionalNumber(value);
    return n === null ? null : Math.round(n);
  }

  function parseOptionalWeightGrams(weightKg: string): number | null {
    const kg = parseOptionalNumber(weightKg);
    return kg === null ? null : Math.round(kg * 1000);
  }

  function formatOptionalWeightKgFromGrams(
    weightGrams: number | null | undefined,
  ): string {
    if (
      typeof weightGrams !== 'number' ||
      !Number.isFinite(weightGrams) ||
      weightGrams <= 0
    ) {
      return '';
    }

    return String(weightGrams / 1000);
  }

  async function createProduct() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token.');
      return;
    }

    const priceNum = Number(price.replace(',', '.'));
    const priceCents = Math.round(priceNum * 100);

    if (!title.trim()) {
      setMsg('Informe o nome do produto.');
      return;
    }

    if (!Number.isFinite(priceNum) || priceCents <= 0) {
      setMsg('Preço inválido.');
      return;
    }

    setSaving(true);
    try {
    const images = await uploadMany(files, setUploadProgress);
    if (files.length && !images) return;

    const insightsToSend = normalizeInsightsForLen(images?.length ?? 0, imageInsights);

    const baseDesc = description.trim();

      // 1) descrição + ficha técnica
      const withTech = mergeDescriptionWithTech(baseDesc, spec);

      // 2) + identidade
      const handleToUse = slugifyMarto(idn.handle || title.trim());
      const withId = mergeDescWithIdentity(withTech ?? '', { handle: handleToUse }) ?? null;

      const withDna = mergeDescWithDNA(withId ?? '', dna) ?? null;

      // 3) + catálogo (sempre salva bloco catálogo)
      const finalDesc = (withDna ?? '').trim()
        ? `${stripCatalogBlock(withDna ?? '')}\n\n${buildCatalogBlock(cat)}`
        : buildCatalogBlock(cat);

      const requiresShipping = cat.kind === 'PHYSICAL';
      const productType = cat.kind;

      const weightGrams = parseOptionalWeightGrams(spec.weightKg);
      const lengthCm = parseOptionalInt(spec.lengthCm);
      const widthCm = parseOptionalInt(spec.widthCm);
      const heightCm = parseOptionalInt(spec.heightCm);

      const res = await fetchJSON<CreateProductResponse>('/merchants/me/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: finalDesc,
          priceCents,
          requiresShipping,
          productType,
          weightGrams,
          lengthCm,
          widthCm,
          heightCm,
          images: images ?? null,
          imageInsights: insightsToSend,
          productServices,
          meta: {
            tech: hasAnyTech(spec) ? spec : null,
            catalog: cat ?? null,
          },
        }),
      });

      if (!res.ok) {
        setMsg(res.message || 'Erro ao criar produto.');
        return;
      }

      setTitle('');
      setDescription('');
      setPrice('');
      setProductServices([]);
      setFiles([]);
      setImageInsights([]);
      setSpec({
        weightKg: '',
        lengthCm: '',
        widthCm: '',
        heightCm: '',
        sku: '',
        barcode: '',
        brand: '',
        tags: '',
      });
      setCat({
        kind: 'PHYSICAL',
        inventoryMode: 'INFINITE',
        stockTotal: '',
        prepDays: '',
        options: [],
        variants: [],
      });
      setIdn({ handle: '' });
      setDna({
        skuRoot: '',
        collection: '',
        version: '',
      });

      await loadProducts();
      setMsg('Produto criado.');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, nextActive: boolean) {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token.');
      return;
    }

    try {
      const res = await fetchJSON<UpdateProductResponse>(`/merchants/me/products/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: nextActive }),
      });

      if (!res.ok) {
        setMsg(res.message || 'Não foi possível atualizar.');
        return;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: res.updated.active } : p)),
      );
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Erro ao atualizar produto.');
    }
  }

  async function loadEditShippingOptions(productId: string) {
    setEditShippingLoading(true);
    setEditShippingError(null);

    try {
      const res = await fetchJSON<ShippingOptionsResponse>(
        `/merchants/me/products/${productId}/shipping-options`,
      );
      setEditShippingOptions(res);
    } catch (err) {
      setEditShippingOptions(null);
      setEditShippingError(
        err instanceof Error ? err.message : 'Falha ao carregar leitura logística.',
      );
    } finally {
      setEditShippingLoading(false);
    }
  }

  function startEdit(p: ProductItem) {
    setMsg('');
    setEditStep('BASIC');
    setEditingId(p.id);
    setEditShippingOptions(null);
    setEditShippingError(null);
    void loadEditShippingOptions(p.id);
    setETitle(p.title ?? '');

    const metaTech = (p.meta?.tech ?? null) as Partial<TechSpec> | null;
    const metaCat = (p.meta?.catalog ?? null) as Partial<CatalogSpec> | null;

    const extractedId = extractIdentityBlock(p.description ?? '');
    setEIdn({ handle: String(extractedId.handle ?? '') });
    const extractedDna = extractDNABlock(p.description ?? '');
    setEDna({
      skuRoot: String(extractedDna.skuRoot ?? ''),
      collection: String(extractedDna.collection ?? ''),
      version: String(extractedDna.version ?? ''),
    });

    const base = stripCatalogBlock(
      stripTechBlock(stripIdentityBlock(stripDNABlock(p.description ?? ''))),
    );
    setEDesc(base);

    // se tiver meta, usa meta; senão, fallback nos marcadores antigos
    const extractedTech = metaTech ?? extractTechBlock(p.description ?? '');
    const extractedCat = metaCat ?? extractCatalogBlock(p.description ?? '');
    const productKind =
      p.productType === 'PHYSICAL' || p.productType === 'DIGITAL' || p.productType === 'SERVICE'
        ? p.productType
        : extractedCat.kind === 'PHYSICAL' ||
            extractedCat.kind === 'DIGITAL' ||
            extractedCat.kind === 'SERVICE'
          ? extractedCat.kind
          : 'PHYSICAL';

    setESpec({
      weightKg: formatOptionalWeightKgFromGrams(p.weightGrams) || String(extractedTech.weightKg ?? ''),
      lengthCm:
        (typeof p.lengthCm === 'number' && p.lengthCm > 0
          ? String(p.lengthCm)
          : String(extractedTech.lengthCm ?? '')),
      widthCm:
        (typeof p.widthCm === 'number' && p.widthCm > 0
          ? String(p.widthCm)
          : String(extractedTech.widthCm ?? '')),
      heightCm:
        (typeof p.heightCm === 'number' && p.heightCm > 0
          ? String(p.heightCm)
          : String(extractedTech.heightCm ?? '')),
      sku: String(extractedTech.sku ?? ''),
      barcode: String(extractedTech.barcode ?? ''),
      brand: String(extractedTech.brand ?? ''),
      tags: String(extractedTech.tags ?? ''),
    });

    setECat({
      ...(metaCat ?? {}),
      kind: productKind,
      inventoryMode: (extractedCat.inventoryMode as InventoryMode) ?? 'INFINITE',
      stockTotal: String(extractedCat.stockTotal ?? ''),
      prepDays: String(extractedCat.prepDays ?? ''),
      options: Array.isArray(extractedCat.options) ? extractedCat.options : [],
      variants: Array.isArray(extractedCat.variants) ? extractedCat.variants : [],
    });

    setEPrice((p.priceCents / 100).toFixed(2).replace('.', ','));
    setEFiles([]);

    // ✅ inicializa keepImages com imagens atuais
    setEKeepImages(Array.isArray(p.images) ? p.images : []);
    setEKeepCaptions(
      normalizeCaptions((p.images ?? []).length, p.imageCaptions ?? []),
    );

    setEKeepInsights(
      normalizeInsightsForLen((p.images ?? []).length, p.imageInsights ?? []),
    );
    setEInsights(normalizeInsightsForLen(0, []));
    setEOpenInsightIdx(null);
    setEProductServices(
      Array.isArray(
        (p as { serviceLinks?: Array<{ serviceType?: string | null }> })
          .serviceLinks,
      )
        ? (
            (p as { serviceLinks?: Array<{ serviceType?: string | null }> })
              .serviceLinks ?? []
          )
            .map((x) => String(x?.serviceType ?? '').trim())
            .filter(Boolean)
        : [],
    );

    setSheetProductTitle(p.title ?? 'Editar produto');
    setSheetOpen(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditShippingOptions(null);
    setEditShippingError(null);
    setEditShippingLoading(false);
    setETitle('');
    setEDesc('');
    setEPrice('');
    setEIdn({ handle: '' });
    setEDna({
      skuRoot: '',
      collection: '',
      version: '',
    });
    setEFiles([]);
    setEKeepImages([]);
    setEKeepCaptions([]);
    setEKeepInsights([]);
    setEInsights([]);
    setEProductServices([]);
    setESpec({
      weightKg: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
      sku: '',
      barcode: '',
      brand: '',
      tags: '',
    });
    setECat({
      kind: 'PHYSICAL',
      inventoryMode: 'INFINITE',
      stockTotal: '',
      prepDays: '',
      options: [],
      variants: [],
    });

    setSheetOpen(false);
    setSheetProductTitle('');
  }

  async function saveEdit() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token.');
      return;
    }
    if (!editingId) return;

    const titleTrimmed = eTitle.trim();
    const priceNum = Number(ePrice.replace(',', '.'));
    const priceCents = Math.round(priceNum * 100);

    if (!titleTrimmed) {
      setMsg('Título não pode ficar vazio.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceCents <= 0) {
      setMsg('Preço inválido.');
      return;
    }

    // ✅ usa eKeepImages + uploads novos (adiciona sem apagar)
    let imagesToSend: string[] | undefined = undefined;

    const baseImgs = Array.isArray(eKeepImages) ? eKeepImages : [];

    if (eFiles.length) {
      const uploaded = await uploadManyEdit(eFiles, setEUploadProgress);
      if (!uploaded) return;

      imagesToSend = [...baseImgs, ...uploaded];
    } else {
      // se ele removeu alguma foto, ainda precisamos mandar a lista final
      imagesToSend = baseImgs;
    }

    const baseDesc = eDesc.trim();

    // 1) descrição + ficha técnica
    const withTech = mergeDescriptionWithTech(baseDesc, eSpec);

    // 2) + identidade
    const handleToUse = slugifyMarto(eIdn.handle || eTitle.trim());
    const withId = mergeDescWithIdentity(withTech ?? '', { handle: handleToUse }) ?? null;

    const withDna = mergeDescWithDNA(withId ?? '', eDna) ?? null;

    // 3) + catálogo
    const finalDesc = (withDna ?? '').trim()
      ? `${stripCatalogBlock(withDna ?? '')}\n\n${buildCatalogBlock(eCat)}`
      : buildCatalogBlock(eCat);

    const insightsToSend = normalizeInsightsForLen(baseImgs.length, eKeepInsights);
    const requiresShipping = eCat.kind === 'PHYSICAL';
    const productType = eCat.kind;

    const weightGrams = parseOptionalWeightGrams(eSpec.weightKg);
    const lengthCm = parseOptionalInt(eSpec.lengthCm);
    const widthCm = parseOptionalInt(eSpec.widthCm);
    const heightCm = parseOptionalInt(eSpec.heightCm);

    setESaving(true);
    try {
      const res = await fetchJSON<UpdateProductResponse>(
        `/merchants/me/products/${editingId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: titleTrimmed,
            description: finalDesc,
            priceCents,
            requiresShipping,
            productType,
            weightGrams,
            lengthCm,
            widthCm,
            heightCm,
            images: imagesToSend ?? undefined,
            imageInsights: insightsToSend,
            productServices: eProductServices,
            meta: {
              tech: hasAnyTech(eSpec) ? eSpec : null,
              catalog: eCat ?? null,
            },
          }),
        },
      );

      if (!res.ok) {
        setMsg(res.message || 'Não foi possível salvar.');
        return;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === editingId ? { ...p, ...res.updated } : p)),
      );

      cancelEdit();
      setMsg('Produto atualizado.');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Erro ao salvar.');
    } finally {
      setESaving(false);
    }
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return products
      .filter((p) => {
        if (onlyActive === 'active') return !!p.active;
        if (onlyActive === 'inactive') return !p.active;
        return true;
      })
      .filter((p) => {
        if (!qq) return true;
        const t = String(p.title ?? '').toLowerCase();
        const d = String(p.description ?? '').toLowerCase();
        return t.includes(qq) || d.includes(qq);
      });
  }, [products, q, onlyActive]);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.active).length;
    const withImg = products.filter((p) => Array.isArray(p.images) && p.images.length > 0).length;
    const withTech = products.filter((p) => {
      const metaTech = p.meta?.tech ?? null;
      if (metaTech && hasAnyTech(metaTech)) return true;
      return String(p.description ?? '').includes(TECH_MARKER_START);
    }).length;

    const withCatalog = products.filter((p) => {
      if (p.meta?.catalog) return true;
      return String(p.description ?? '').includes(CATALOG_MARKER_START);
    }).length;

    const ready = products.filter((p) => {
      const hasImg = Array.isArray(p.images) && p.images.length > 0;
      const baseDesc = stripCatalogBlock(
        stripTechBlock(stripIdentityBlock(stripDNABlock(p.description ?? ''))),
      );
      const hasDesc = !!String(baseDesc ?? '').trim();
      const hasPrice = Number(p.priceCents ?? 0) > 0;
      return hasImg && hasDesc && hasPrice && !!p.active;
    }).length;

    return { total, active, withImg, withTech, withCatalog, ready };
  }, [products]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <MartoBackground />

      <div className="mx-auto max-w-6xl p-6">
        {/* HEADER */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white/90">Produtos</h1>
              <Chip text="Merchant OS" />
            </div>

            <p className="mt-1 text-sm text-white/70">
              No Marto, produto é ativo de confiança. Prepare com foto, ficha técnica e clareza — e
              o ciclo vira dado.
            </p>
          </div>

          <Link
            href="/dash/merchant"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {/* ALERT */}
        {msg ? (
          <div className="mb-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80">
            {msg}
          </div>
        ) : null}

        {/* TOP BAR */}
        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-xs font-semibold text-white/65">Visão rápida</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div className="text-xs text-white/60">Total</div>
                <div className="mt-1 text-lg font-bold text-white/90">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div className="text-xs text-white/60">Ativos</div>
                <div className="mt-1 text-lg font-bold text-white/90">{stats.active}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div className="text-xs text-white/60">Com foto</div>
                <div className="mt-1 text-lg font-bold text-white/90">{stats.withImg}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div className="text-xs text-white/60">Com ficha</div>
                <div className="mt-1 text-lg font-bold text-white/90">{stats.withTech}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div className="text-xs text-white/60">Com catálogo</div>
                <div className="mt-1 text-lg font-bold text-white/90">{stats.withCatalog}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div className="text-xs text-white/60">Prontos (MVP)</div>
                <div className="mt-1 text-lg font-bold text-white/90">{stats.ready}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <WizardCard
              onCreate={() => {
                const el = document.getElementById('novo-produto');
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onImport={() => {
                alert('Em breve: importar rápido (CSV/colar lista).');
              }}
            />
          </div>
        </div>

        {/* NOVO PRODUTO */}
        <div
          id="novo-produto"
          className="mb-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Novo produto</div>
              <div className="mt-1 text-xs text-white/65">
                Foto + ficha técnica + disponibilidade = menos dúvida, mais conversão, melhor frete,
                mais dado.
              </div>
            </div>

            <div className="flex items-center gap-2">
              {uploadProgress ? <Chip text={`UPLOAD ${uploadProgress}`} /> : null}
              <Chip text={uploading ? 'ENVIANDO' : saving ? 'SALVANDO' : 'PRONTO'} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {stepOrder.map((s) => {
                const active = s === newStep;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewStep(s)}
                    className={classNames(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      active
                        ? 'border-white/25 bg-white/10 text-white/90'
                        : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10',
                    )}
                  >
                    {stepLabel(s)}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={newStep === 'BASIC' || saving || uploading}
                className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-black/55 disabled:opacity-60"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={newStep === 'REVIEW' || saving || uploading}
                className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
              >
                Avançar
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {newStep === 'BASIC' ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-sm font-semibold text-white/85">Nome do produto</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      disabled={saving || uploading}
                      placeholder="Ex.: Mesa Lua 1,60m"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-sm font-semibold text-white/85">Descrição</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      rows={3}
                      disabled={saving || uploading}
                      placeholder="Foque no que evita dúvidas: material, medidas, acabamento, uso…"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-white/85">Preço (R$)</span>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      disabled={saving || uploading}
                      inputMode="decimal"
                      placeholder="Ex.: 1299,90"
                    />
                  </label>

                  <div className="rounded-2xl border border-white/15 bg-black/60 p-4">
                    <div className="text-xs font-semibold text-white/70">Marto dica</div>
                    <div className="mt-1 text-xs text-white/60">
                      A primeira foto vira CAPA. Use uma clara/frontal. Depois detalhe (textura,
                      canto, embalagem, ambiente).
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-white">
                    Serviços associados ao produto
                  </div>

                  <p className="mt-1 text-xs text-white/60">
                    Selecione serviços que podem ser necessários após a compra.
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {PRODUCT_SERVICE_OPTIONS.map((opt) => {
                      const selected = productServices.includes(opt.key);

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleProductService(opt.key)}
                          className={[
                            'rounded-2xl border px-4 py-3 text-left text-sm transition',
                            selected
                              ? 'border-white bg-white text-black'
                              : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
                          ].join(' ')}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        Identidade do produto
                      </div>
                      <div className="mt-1 text-xs text-white/65">
                        Link público + rastreio de reputação. Curto, estável e sem acento.
                      </div>
                    </div>

                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                      @{slugifyMarto(idn.handle || title)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold text-white/65">Handle (slug)</span>
                      <input
                        value={idn.handle}
                        onChange={(e) => setIdn({ handle: e.target.value })}
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                        placeholder="Ex.: mesa-lua-160"
                        disabled={saving || uploading}
                      />
                      <div className="text-[11px] text-white/55">
                        Se deixar vazio, o Marto sugere baseado no nome.
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => setIdn({ handle: slugifyMarto(title) })}
                      className="h-[46px] self-end rounded-2xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white/85 hover:bg-white/10 disabled:opacity-60"
                      disabled={saving || uploading || !title.trim()}
                      title="Gerar a partir do nome"
                    >
                      Gerar do nome
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
                  <div>
                    <div className="text-sm font-semibold text-white/90">DNA do produto</div>
                    <div className="mt-1 text-xs text-white/65">
                      Controle interno. Ajuda o Marto a gerar dados, alertas e evolução do item.
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold text-white/65">SKU raiz</span>
                      <input
                        value={dna.skuRoot}
                        onChange={(e) => setDna((p) => ({ ...p, skuRoot: e.target.value }))}
                        placeholder="Ex.: MESA-LUA"
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-semibold text-white/65">Coleção / linha</span>
                      <input
                        value={dna.collection}
                        onChange={(e) => setDna((p) => ({ ...p, collection: e.target.value }))}
                        placeholder="Ex.: Linha Lua"
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-semibold text-white/65">Versão</span>
                      <input
                        value={dna.version}
                        onChange={(e) => setDna((p) => ({ ...p, version: e.target.value }))}
                        placeholder="Ex.: v1 / 2025-A"
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90"
                      />
                    </label>
                  </div>
                </div>
              </>
            ) : null}

            {newStep === 'PHOTOS' ? (
              <FilesDropzone
                label="Fotos do produto"
                hint="Recomendado: 1024px+. Formatos: WEBP/PNG/JPEG/GIF. A 1ª vira capa."
                files={files}
                setFiles={(next) => {
                  setFiles(next);
                  // insights acompanha as fotos (cria vazios / corta)
                  setImageInsights(normalizeInsightsForLen(next.length, imageInsights));
                }}
                insights={imageInsights}
                setInsights={setImageInsights}
                disabled={saving || uploading}
                maxFiles={10}
              />
            ) : null}

            {newStep === 'CATALOG' ? (
              <CatalogEditor
                cat={cat}
                setCat={(updater) => setCat((prev) => updater(prev))}
                disabled={saving || uploading}
              />
            ) : null}

            {newStep === 'TECH' ? (
              <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      Ficha técnica (Marto)
                    </div>
                    <div className="mt-1 text-xs text-white/65">
                      Isso melhora confiança + calcula frete + vira dado limpo (sem atrito).
                    </div>
                  </div>
                  {hasAnyTech(spec) ? (
                    <Chip text="FICHA OK" tone="good" />
                  ) : (
                    <Chip text="OPCIONAL" />
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Peso (kg)</span>
                    <input
                      value={spec.weightKg}
                      onChange={(e) => setSpec((p) => ({ ...p, weightKg: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 12,5"
                      disabled={saving || uploading}
                      inputMode="decimal"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">
                      Comprimento (cm)
                    </span>
                    <input
                      value={spec.lengthCm}
                      onChange={(e) => setSpec((p) => ({ ...p, lengthCm: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 160"
                      disabled={saving || uploading}
                      inputMode="numeric"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Largura (cm)</span>
                    <input
                      value={spec.widthCm}
                      onChange={(e) => setSpec((p) => ({ ...p, widthCm: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 90"
                      disabled={saving || uploading}
                      inputMode="numeric"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Altura (cm)</span>
                    <input
                      value={spec.heightCm}
                      onChange={(e) => setSpec((p) => ({ ...p, heightCm: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 75"
                      disabled={saving || uploading}
                      inputMode="numeric"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">SKU (interno)</span>
                    <input
                      value={spec.sku}
                      onChange={(e) => setSpec((p) => ({ ...p, sku: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: MESA-LUA-160"
                      disabled={saving || uploading}
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">
                      Código de barras
                    </span>
                    <input
                      value={spec.barcode}
                      onChange={(e) => setSpec((p) => ({ ...p, barcode: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 7891234567890"
                      disabled={saving || uploading}
                      inputMode="numeric"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">Marca</span>
                    <input
                      value={spec.brand}
                      onChange={(e) => setSpec((p) => ({ ...p, brand: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: Marto Studio"
                      disabled={saving || uploading}
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">
                      Tags (separe por vírgula)
                    </span>
                    <input
                      value={spec.tags}
                      onChange={(e) => setSpec((p) => ({ ...p, tags: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: mesa, jantar, madeira, 6 lugares"
                      disabled={saving || uploading}
                    />
                  </label>
                </div>

                <div className="mt-3 text-xs text-white/55">
                  * Por enquanto a ficha é salva dentro da descrição (padrão Marto). Quando você
                  quiser, a gente migra pra campos reais no banco.
                </div>
              </div>
            ) : null}

            {newStep === 'REVIEW' ? (
              <>
                {/* =========================
                   PATCH 2 — SCORE + CHECKLIST NO “NOVO PRODUTO”
                   ========================= */}
                {(() => {
                  const hasVariants = catalogHasVariants(cat);
                  const items = checklistForDraft({
                    kind: cat.kind,
                    inventoryMode: cat.inventoryMode,
                    prepDays: cat.prepDays,
                    photosCount: files.length,
                    description,
                    spec,
                    hasVariants,
                    variants: (cat.variants ?? []).map((v) => ({
                      sku: v.sku,
                      stock: v.stock,
                    })),
                    stockTotal: cat.stockTotal,
                  });

                  const s = scoreFromChecklist(items);

                  return (
                    <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-white/90">
                            Produto pronto
                          </div>
                          <div className="mt-1 text-xs text-white/65">
                            O Marto te guia para reduzir pós-venda e aumentar confiança.
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
                            {s.score}/100
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-white/40" style={{ width: `${s.score}%` }} />
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white/85">
                                {it.label}
                              </div>
                              {it.hint ? (
                                <div className="mt-1 text-[11px] text-white/55">
                                  {it.hint}
                                </div>
                              ) : null}
                            </div>
                            <span className="text-xs font-semibold text-white/70">
                              {it.done ? '✅' : '—'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {s.recs.length ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3">
                          <div className="text-xs font-semibold text-white/80">
                            Próximos passos
                          </div>
                          <ul className="mt-2 grid gap-1 text-xs text-white/65">
                            {s.recs.map((r, idx) => (
                              <li key={idx}>
                                •{' '}
                                <span className="font-semibold text-white/80">{r.label}</span>
                                {r.hint ? (
                                  <span className="text-white/55"> — {r.hint}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                <div className="mt-4 rounded-3xl border border-white/15 bg-black/35 p-5">
                  <div className="text-sm font-semibold text-white/90">Resumo</div>
                  <div className="mt-2 text-xs text-white/70">
                    <div>
                      <span className="font-semibold text-white/85">Nome:</span> {title || '—'}
                    </div>
                    <div>
                      <span className="font-semibold text-white/85">Preço:</span> {price || '—'}
                    </div>
                    <div>
                      <span className="font-semibold text-white/85">Fotos:</span> {files.length}
                    </div>
                    <div>
                      <span className="font-semibold text-white/85">Tipo:</span> {cat.kind}
                    </div>
                    <div>
                      <span className="font-semibold text-white/85">Inventário:</span>{' '}
                      {cat.inventoryMode}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-end">
                  <button
                    onClick={createProduct}
                    disabled={saving || uploading}
                    className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    {uploading
                      ? uploadProgress
                        ? `Enviando (${uploadProgress})…`
                        : 'Enviando…'
                      : saving
                        ? 'Salvando…'
                        : 'Criar produto'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* LISTA */}
        <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">
                Produtos cadastrados ({filtered.length})
              </div>
              <div className="mt-1 text-xs text-white/65">
                Produtos com ficha, catálogo e fotos boas viram reputação mais rápido.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome/descrição…"
                className="w-[260px] max-w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
              />

              <select
                value={onlyActive}
                onChange={(e) => setOnlyActive(e.target.value as typeof onlyActive)}
                className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm font-semibold text-white/85 outline-none focus:border-white/30"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setOnlyActive('all');
                }}
                className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-black/55"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              <div className="text-sm text-white/70">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-white/70">
                Nenhum produto encontrado. Crie seu primeiro produto acima.
              </div>
            ) : (
              filtered.map((p) => {
                const currentImages = Array.isArray(p.images) ? p.images : [];

                const hasImg = currentImages.length > 0;
                const first = hasImg ? String(currentImages[0] ?? '') : '';
                const imgUrl = hasImg ? toPublicImageUrl(first) : '';

                const baseDesc = stripCatalogBlock(
                  stripTechBlock(stripIdentityBlock(stripDNABlock(p.description ?? ''))),
                );
                const hasDesc = !!String(baseDesc ?? '').trim();
                const hasPrice = Number(p.priceCents ?? 0) > 0;
                const ready = p.active && hasImg && hasDesc && hasPrice;

                const ordersCount = Number(p.ordersCount ?? 0);
                const reviewsCount = Number(p.reviewsCount ?? 0);
                const hasService = !!p.hasService;

                const hasTech = (() => {
                  const metaTech = p.meta?.tech ?? null;
                  if (metaTech && hasAnyTech(metaTech)) return true;
                  return String(p.description ?? '').includes(TECH_MARKER_START);
                })();

                const hasCatalog = p.meta?.catalog
                  ? true
                  : String(p.description ?? '').includes(CATALOG_MARKER_START);

                const photosCount = currentImages.length;
                const catSum = catalogSummary(
                  (p.meta?.catalog ?? null) as Partial<CatalogSpec> | null,
                );

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-white/15 bg-black/35 px-4 py-4 hover:bg-black/45"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          {hasImg ? (
                            <button
                              type="button"
                              onClick={() => {
                                const imgs = (Array.isArray(currentImages) ? currentImages : [])
                                  .map((s) => toPublicImageUrl(String(s ?? '')))
                                  .filter(Boolean);

                                if (!imgs.length) return;

                                setLightboxImages(imgs);
                                setLightboxIndex(0);
                                setLightboxAlt(p.title);
                                setLightboxOpen(true);
                              }}
                              className="shrink-0"
                              title="Ampliar imagem"
                            >
                              <Image
                                src={imgUrl}
                                alt={p.title}
                                width={56}
                                height={56}
                                unoptimized
                                className="h-14 w-14 rounded-2xl border border-white/15 object-cover hover:opacity-90"
                              />
                            </button>
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
                              <span className="text-[10px] font-semibold text-white/60">
                                Sem foto
                              </span>
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate font-semibold text-white/90">{p.title}</div>
                              {p.active ? (
                                <Chip text="ATIVO" tone="good" />
                              ) : (
                                <Chip text="INATIVO" tone="warn" />
                              )}
                              {hasTech ? <Chip text="FICHA" /> : null}
                              {hasCatalog ? <Chip text="CATÁLOGO" /> : null}
                              {photosCount ? <Chip text={`${photosCount} FOTOS`} /> : null}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70">
                              <span className="font-semibold text-white/85">
                                R$ {brlFromCents(p.priceCents)}
                              </span>

                              {!hasDesc ? <Chip text="FALTA DESCRIÇÃO" tone="warn" /> : null}
                              {!hasImg ? <Chip text="FALTA FOTO" tone="warn" /> : null}

                              {ready ? (
                                <Chip text="PRONTO (MVP)" tone="good" />
                              ) : (
                                <Chip text="EM PREPARO" />
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/65">
                              <span
                                className={classNames(
                                  'rounded-full border px-2 py-1 font-semibold',
                                  hasImg
                                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                                    : 'border-white/15 bg-white/5 text-white/70',
                                )}
                              >
                                📷 {hasImg ? `${photosCount}` : '0'}
                              </span>

                              <span
                                className={classNames(
                                  'rounded-full border px-2 py-1 font-semibold',
                                  hasService
                                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                                    : 'border-white/15 bg-white/5 text-white/70',
                                )}
                              >
                                🧰 {hasService ? 'ligado' : '—'}
                              </span>

                              <span
                                className={classNames(
                                  'rounded-full border px-2 py-1 font-semibold',
                                  reviewsCount > 0
                                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                                    : 'border-white/15 bg-white/5 text-white/70',
                                )}
                              >
                                ⭐ {reviewsCount}
                              </span>

                              <span
                                className={classNames(
                                  'rounded-full border px-2 py-1 font-semibold',
                                  ordersCount > 0
                                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                                    : 'border-white/15 bg-white/5 text-white/70',
                                )}
                              >
                                🧾 {ordersCount}
                              </span>
                            </div>

                            {catSum ? (
                              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-white/80">
                                    Catálogo
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Chip text={catSum.kindLabel.toUpperCase()} />
                                    <Chip text={`ESTOQUE ${catSum.invLabel.toUpperCase()}`} />
                                    {catSum.variantsCount ? (
                                      <Chip text={`${catSum.variantsCount} VARIAÇÕES`} />
                                    ) : null}
                                  </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2">
                                    <div className="text-[11px] font-semibold text-white/60">
                                      Prazo
                                    </div>
                                    <div className="text-xs font-semibold text-white/85">
                                      {catSum.prep}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 sm:col-span-2">
                                    <div className="text-[11px] font-semibold text-white/60">
                                      Disponibilidade
                                    </div>
                                    <div className="text-xs font-semibold text-white/85">
                                      {catSum.stockInfo}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          onClick={() => toggleActive(p.id, !p.active)}
                          className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-black/55"
                        >
                          {p.active ? 'Desativar' : 'Ativar'}
                        </button>

                        <button
                          onClick={() => startEdit(p)}
                          className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-black/55"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Sheet
        open={sheetOpen && !!editingId}
        title={sheetProductTitle || 'Editar produto'}
        subtitle="Marto OS — edição profunda sem bagunçar a lista"
        onClose={() => cancelEdit()}
      >
        {editingId ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {editOrder.map((s) => {
                    const active = s === editStep;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditStep(s)}
                        className={classNames(
                          'rounded-full border px-3 py-1 text-xs font-semibold transition',
                          active
                            ? 'border-white/25 bg-white/10 text-white/90'
                            : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10',
                        )}
                      >
                        {editLabel(s)}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={editPrev}
                    disabled={editStep === 'BASIC' || eSaving || eUploading}
                    className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-black/55 disabled:opacity-60"
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={editNext}
                    disabled={editStep === 'REVIEW' || eSaving || eUploading}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    Avançar
                  </button>
                </div>
              </div>
            </div>

            {/* CHECKLIST (EDIÇÃO) */}
            {editStep === 'REVIEW' ? (
              <>
                {(() => {
                  void checkTick; // força rerender do bloco

                  const saved = loadChecklistDone(editingId);

                  const hasVariants = catalogHasVariants(eCat);
                  const items = checklistForDraft({
                    kind: eCat.kind,
                    inventoryMode: eCat.inventoryMode,
                    prepDays: eCat.prepDays,
                    photosCount: eKeepImages.length + eFiles.length,
                    description: eDesc,
                    spec: eSpec,
                    hasVariants,
                    variants: (eCat.variants ?? []).map((v) => ({
                      sku: v.sku,
                      stock: v.stock,
                    })),
                    stockTotal: eCat.stockTotal,
                  });

                  const toggleable = new Set(['desc', 'prep']);

                  const withManual = items.map((it) => ({
                    ...it,
                    done: toggleable.has(it.id) ? !!saved[it.id] || it.done : it.done,
                  }));

                  const s = scoreFromChecklist(withManual);

                  return (
                    <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-white/90">
                            Preparar para vender + montar
                          </div>
                          <div className="mt-1 text-xs text-white/65">
                            Checklist adaptativo. Só aparece o que é relevante pro tipo/inventário.
                          </div>
                        </div>

                        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
                          {s.score}/100
                        </span>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-white/40"
                          style={{ width: `${s.score}%` }}
                        />
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {withManual.map((it) => {
                          const canToggle = toggleable.has(it.id);

                          return (
                            <div
                              key={it.id}
                              className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white/85">
                                    {it.label}
                                  </div>
                                  {it.hint ? (
                                    <div className="mt-1 text-[11px] text-white/55">
                                      {it.hint}
                                    </div>
                                  ) : null}
                                </div>

                                {canToggle ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = { ...saved, [it.id]: !saved[it.id] };
                                      saveChecklistDone(editingId, next);
                                      setCheckTick((t) => t + 1);
                                    }}
                                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85 hover:bg-white/10"
                                  >
                                    {saved[it.id] ? 'Feito ✅' : 'Marcar'}
                                  </button>
                                ) : (
                                  <span className="text-xs font-semibold text-white/70">
                                    {it.done ? '✅' : '—'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {s.recs.length ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3">
                          <div className="text-xs font-semibold text-white/80">
                            Recomendações
                          </div>
                          <ul className="mt-2 grid gap-1 text-xs text-white/65">
                            {s.recs.map((r, idx) => (
                              <li key={idx}>
                                • <span className="font-semibold text-white/80">{r.label}</span>
                                {r.hint ? (
                                  <span className="text-white/55"> — {r.hint}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </>
            ) : null}

            {/* CAMPOS BÁSICOS */}
            {editStep === 'BASIC' ? (
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/65">Título</span>
                  <input
                    value={eTitle}
                    onChange={(e) => setETitle(e.target.value)}
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    disabled={eSaving || eUploading}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/65">Descrição</span>
                  <textarea
                    value={eDesc}
                    onChange={(e) => setEDesc(e.target.value)}
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    rows={3}
                    disabled={eSaving || eUploading}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/65">Preço (R$)</span>
                  <input
                    value={ePrice}
                    onChange={(e) => setEPrice(e.target.value)}
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    disabled={eSaving || eUploading}
                    inputMode="decimal"
                  />
                </label>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-white">
                    Serviços associados ao produto
                  </div>

                  <p className="mt-1 text-xs text-white/60">
                    Ajuste os serviços que podem ser necessários após a compra.
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {PRODUCT_SERVICE_OPTIONS.map((opt) => {
                      const selected = eProductServices.includes(opt.key);

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleEditProductService(opt.key)}
                          className={[
                            'rounded-2xl border px-4 py-3 text-left text-sm transition',
                            selected
                              ? 'border-white bg-white text-black'
                              : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
                          ].join(' ')}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/65">Handle (slug)</span>
                  <input
                    value={eIdn.handle}
                    onChange={(e) => setEIdn({ handle: e.target.value })}
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    placeholder="Ex.: mesa-lua-160"
                    disabled={eSaving || eUploading}
                  />
                  <div className="text-[11px] text-white/55">
                    @{slugifyMarto(eIdn.handle || eTitle)}
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/65">SKU raiz</span>
                  <input
                    value={eDna.skuRoot}
                    onChange={(e) => setEDna((p) => ({ ...p, skuRoot: e.target.value }))}
                    placeholder="Ex.: MESA-LUA"
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    disabled={eSaving || eUploading}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/65">Coleção / linha</span>
                  <input
                    value={eDna.collection}
                    onChange={(e) => setEDna((p) => ({ ...p, collection: e.target.value }))}
                    placeholder="Ex.: Linha Lua"
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    disabled={eSaving || eUploading}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-white/65">Versão</span>
                  <input
                    value={eDna.version}
                    onChange={(e) => setEDna((p) => ({ ...p, version: e.target.value }))}
                    placeholder="Ex.: v1 / 2025-A"
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    disabled={eSaving || eUploading}
                  />
                </label>
              </div>
            ) : null}

            {/* FOTOS ATUAIS */}
            {editStep === 'PHOTOS' ? (
              <>
                <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white/90">Fotos atuais</div>
                      <div className="mt-1 text-xs text-white/65">
                        Dica: a 1ª foto é a capa. Remova ou reordene (próximo passo).
                      </div>
                    </div>
                    <Chip text={`${eKeepImages.length} FOTOS`} />
                  </div>

                  {eKeepImages.length ? (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      {eKeepImages.map((src, idx) => {
                        const url = toPublicImageUrl(src);
                        return (
                          <div
                            key={`${src}-${idx}`}
                            draggable={!eSaving && !eUploading}
                            onDragStart={() => setDragFromIdx(idx)}
                            onDragEnter={() => setDragOverIdx(idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={() => {
                              setDragFromIdx(null);
                              setDragOverIdx(null);
                            }}
                            onDrop={() => {
                              if (eSaving || eUploading) return;
                              if (dragFromIdx === null || dragOverIdx === null) return;
                              if (dragFromIdx === dragOverIdx) return;

                              setEKeepImages((prev) =>
                                moveItem(prev, dragFromIdx, dragOverIdx),
                              );
                              setEKeepCaptions((prev) =>
                                moveItem(prev, dragFromIdx, dragOverIdx),
                              );
                              setEKeepInsights((prev) =>
                                moveItem(prev, dragFromIdx, dragOverIdx),
                              );

                              setDragFromIdx(null);
                              setDragOverIdx(null);
                            }}
                            className={[
                              'group relative overflow-hidden rounded-2xl border bg-black',
                              dragOverIdx === idx ? 'border-white/40' : 'border-white/10',
                            ].join(' ')}
                            style={{ cursor: eSaving || eUploading ? 'default' : 'grab' }}
                            title="Arraste para reordenar"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Foto ${idx + 1}`} className="h-24 w-full object-cover" />

                            <div className="absolute left-2 top-2 z-10 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/80 backdrop-blur">
                              {idx === 0 ? 'CAPA' : `#${idx + 1}`}
                            </div>

                            <div className="p-2">
                              <div className="mb-1 text-[10px] font-semibold text-white/70">
                                Legenda curta
                              </div>

                              <input
                                value={eKeepCaptions[idx] ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEKeepCaptions((prev) => {
                                    const next = [...prev];
                                    next[idx] = v;
                                    return next;
                                  });
                                }}
                                maxLength={120}
                                placeholder="Ex: detalhe do acabamento, cor nogueira..."
                                className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs text-white/85 outline-none placeholder:text-white/50"
                                disabled={eSaving || eUploading}
                              />

                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEOpenInsightIdx(
                                      eOpenInsightIdx === idx ? null : idx,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/15"
                                  disabled={eSaving || eUploading}
                                >
                                  Visão rápida
                                </button>

                                {eOpenInsightIdx === idx ? (
                                  <div className="mt-2 rounded-2xl border border-white/15 bg-black/60 p-3 backdrop-blur">
                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                                      VISÃO RÁPIDA (3 linhas)
                                    </div>

                                    {[0, 1, 2].map((k) => (
                                      <input
                                        key={k}
                                        value={eKeepInsights[idx]?.overview?.[k] ?? ''}
                                        onChange={(e) => {
                                          const v = e.target.value;

                                          setEKeepInsights((prev) => {
                                            const next = [...prev];
                                            const cur =
                                              next[idx] ?? ({
                                                overview: ['', '', ''],
                                                hotspots: [],
                                              } as ImageInsight);
                                            const ov = normalizeOverview3(cur.overview);
                                            ov[k] = v;
                                            next[idx] = { ...cur, overview: ov };
                                            return next;
                                          });
                                        }}
                                        maxLength={60}
                                        placeholder={
                                          k === 0 ? 'Linha 1' : k === 1 ? 'Linha 2' : 'Linha 3'
                                        }
                                        className="mb-2 w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs text-white/85 outline-none placeholder:text-white/50"
                                        disabled={eSaving || eUploading}
                                      />
                                    ))}
                                  </div>
                                ) : null}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setEKeepImages((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  );
                                  setEKeepCaptions((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  );
                                  setEKeepInsights((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  );
                                  if (eOpenInsightIdx === idx)
                                    setEOpenInsightIdx(null);
                                }}
                                className="mt-2 w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                                disabled={eSaving || eUploading}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-white/60">
                      Nenhuma foto atual. Você pode adicionar novas abaixo.
                    </div>
                  )}
                </div>

                <FilesDropzone
                  label="Adicionar fotos (opcional)"
                  hint="Se selecionar novas fotos, elas serão adicionadas às atuais."
                  files={eFiles}
                  setFiles={(next) => {
                  setEFiles(next);
                  setEInsights(normalizeInsightsForLen(next.length, eInsights));
                }}
                insights={eInsights}
                setInsights={setEInsights}
                disabled={eSaving || eUploading}
                  maxFiles={10}
                />
              </>
            ) : null}

            {/* CATÁLOGO (EDIÇÃO) */}
            {editStep === 'CATALOG' ? (
              <CatalogEditor
                cat={eCat}
                setCat={(updater) => setECat((prev) => updater(prev))}
                disabled={eSaving || eUploading}
              />
            ) : null}

            {/* FICHA TÉCNICA (EDIÇÃO) */}
            {editStep === 'TECH' ? (
              <div className="grid gap-4">
                <div className="rounded-3xl border border-white/15 bg-black/35 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        Ficha técnica (Marto)
                    </div>
                    <div className="mt-1 text-xs text-white/65">
                      Mesmo padrão do produto novo.
                    </div>
                  </div>
                  {hasAnyTech(eSpec) ? (
                    <Chip text="FICHA OK" tone="good" />
                  ) : (
                    <Chip text="OPCIONAL" />
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Peso (kg)</span>
                    <input
                      value={eSpec.weightKg}
                      onChange={(e) => setESpec((x) => ({ ...x, weightKg: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Comprimento (cm)</span>
                    <input
                      value={eSpec.lengthCm}
                      onChange={(e) => setESpec((x) => ({ ...x, lengthCm: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Largura (cm)</span>
                    <input
                      value={eSpec.widthCm}
                      onChange={(e) => setESpec((x) => ({ ...x, widthCm: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Altura (cm)</span>
                    <input
                      value={eSpec.heightCm}
                      onChange={(e) => setESpec((x) => ({ ...x, heightCm: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">SKU (interno)</span>
                    <input
                      value={eSpec.sku}
                      onChange={(e) => setESpec((x) => ({ ...x, sku: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">
                      Código de barras
                    </span>
                    <input
                      value={eSpec.barcode}
                      onChange={(e) => setESpec((x) => ({ ...x, barcode: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">Marca</span>
                    <input
                      value={eSpec.brand}
                      onChange={(e) => setESpec((x) => ({ ...x, brand: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-white/65">Tags</span>
                    <input
                      value={eSpec.tags}
                      onChange={(e) => setESpec((x) => ({ ...x, tags: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </label>
                </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Leitura logística Marto</p>
                      <p className="text-xs text-white/70">
                        Diagnóstico real do produto com base no backend.
                      </p>
                    </div>
                  </div>

                  {editShippingLoading ? (
                    <p className="mt-3 text-sm text-white/70">Analisando logística...</p>
                  ) : editShippingError ? (
                    <p className="mt-3 text-sm text-rose-300">{editShippingError}</p>
                  ) : editShippingOptions ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/55">Porte</p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {editShippingOptions.analysis.shippingSize}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                            Modo principal sugerido
                          </p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {editShippingOptions.suggestedPrimaryShippingMode ?? '—'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                          Modos disponíveis
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {editShippingOptions.availableShippingModes.length ? (
                            editShippingOptions.availableShippingModes.map((mode) => (
                              <span
                                key={mode}
                                className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
                              >
                                {mode}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-white/65">Nenhum modo disponível.</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                          Bloqueios
                        </p>
                        <div className="mt-2 space-y-2">
                          {editShippingOptions.blockedModes.length ? (
                            editShippingOptions.blockedModes.map((item) => (
                              <div
                                key={item.mode}
                                className="rounded-xl border border-white/10 bg-black/40 p-3"
                              >
                                <p className="text-sm font-medium text-white">{item.mode}</p>
                                <p className="mt-1 text-xs text-white/70">{item.reason}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-white/65">Sem bloqueios.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                          Motivo da análise
                        </p>
                        <p className="mt-1 text-sm text-white/80">
                          {editShippingOptions.analysis.reason}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-white/65">Sem leitura logística carregada.</p>
                  )}
                </div>
              </div>
            ) : null}

            {/* AÇÕES */}
            {editStep === 'REVIEW' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void saveEdit()}
                  disabled={eSaving || eUploading}
                  className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                >
                  {eUploading
                    ? eUploadProgress
                      ? `Enviando (${eUploadProgress})…`
                      : 'Enviando…'
                    : eSaving
                      ? 'Salvando…'
                      : 'Salvar'}
                </button>

                <button
                  onClick={cancelEdit}
                  disabled={eSaving || eUploading}
                  className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-black/55 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-white/70">Nenhum produto selecionado.</div>
        )}
      </Sheet>

      {/* LIGHTBOX (galeria) */}
      {lightboxOpen && lightboxImages.length ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setLightboxOpen(false);
            setLightboxImages([]);
            setLightboxIndex(0);
            setLightboxAlt('');
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setLightboxOpen(false);
                setLightboxImages([]);
                setLightboxIndex(0);
                setLightboxAlt('');
              }}
              className="absolute right-2 top-2 rounded-2xl bg-black/60 px-3 py-2 text-xs font-semibold text-white hover:bg-black/70"
              aria-label="Fechar"
            >
              ✕
            </button>

            {/* navegação */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((i) => {
                  const n = lightboxImages.length || 1;
                  return (i - 1 + n) % n;
                })
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold text-white hover:bg-black/70"
              aria-label="Anterior"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() =>
                setLightboxIndex((i) => {
                  const n = lightboxImages.length || 1;
                  return (i + 1) % n;
                })
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold text-white hover:bg-black/70"
              aria-label="Próximo"
            >
              →
            </button>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={lightboxImages[lightboxIndex] ?? lightboxImages[0]!}
                  unoptimized
                  alt={lightboxAlt || 'Imagem do produto'}
                  fill
                  className="object-contain"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black px-4 py-3">
                <div className="text-sm font-semibold text-white/90">
                  {lightboxAlt || 'Fotos'}
                </div>
                <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                  {lightboxIndex + 1}/{lightboxImages.length}
                </div>
              </div>

              {/* thumbnails */}
              {lightboxImages.length > 1 ? (
                <div className="border-t border-white/10 bg-black px-4 py-3">
                  <div className="flex max-w-full gap-2 overflow-x-auto">
                    {lightboxImages.map((src, idx) => (
                      <button
                        key={`${src}-${idx}`}
                        type="button"
                        onClick={() => setLightboxIndex(idx)}
                        className={[
                          'shrink-0 overflow-hidden rounded-2xl border',
                          idx === lightboxIndex
                            ? 'border-white/40'
                            : 'border-white/10 hover:border-white/25',
                        ].join(' ')}
                        title={`Foto ${idx + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Foto ${idx + 1}`}
                          className="h-14 w-14 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
