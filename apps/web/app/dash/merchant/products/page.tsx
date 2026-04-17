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

type PhotoRole =
  | 'cover'
  | 'detail'
  | 'material'
  | 'context'
  | 'structure'
  | 'finish';

type HotspotKind =
  | 'material'
  | 'finish'
  | 'structure'
  | 'comfort'
  | 'measure'
  | 'difference';

type HotspotDraft = {
  x: number;
  y: number;
  title: string;
  description: string;
  kind?: HotspotKind;
};

type ImageInsight = {
  role?: PhotoRole;
  overview?: string[]; // 3 linhas de leitura viva
  hotspots?: HotspotDraft[];
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

function normalizePhotoRole(role: unknown, index = 0): PhotoRole {
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

function photoRoleMeta(role: PhotoRole) {
  switch (role) {
    case 'cover':
      return {
        label: 'Capa',
        hint: 'É a foto principal. Ela abre a compreensão da peça.',
      };
    case 'detail':
      return {
        label: 'Detalhe',
        hint: 'Mostra um ponto específico que aprofunda o entendimento.',
      };
    case 'material':
      return {
        label: 'Material',
        hint: 'Ajuda a provar textura, matéria-prima e densidade visual.',
      };
    case 'context':
      return {
        label: 'Contexto',
        hint: 'Mostra a peça em uso, ambiente ou proporção real.',
      };
    case 'structure':
      return {
        label: 'Estrutura',
        hint: 'Explica sustentação, construção e parte técnica visível.',
      };
    case 'finish':
      return {
        label: 'Acabamento',
        hint: 'Valoriza borda, costura, toque, pintura ou lapidação final.',
      };
  }
}

function normalizeHotspotKind(kind: unknown): HotspotKind {
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

function hotspotKindMeta(kind: HotspotKind) {
  switch (kind) {
    case 'material':
      return { label: 'Material' };
    case 'finish':
      return { label: 'Acabamento' };
    case 'structure':
      return { label: 'Estrutura' };
    case 'comfort':
      return { label: 'Conforto' };
    case 'measure':
      return { label: 'Proporção' };
    case 'difference':
    default:
      return { label: 'Diferencial' };
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function clampPct(n: number) {
  return Math.max(4, Math.min(96, Number(n)));
}

function normalizeHotspots(hs: unknown): HotspotDraft[] {
  if (!Array.isArray(hs)) return [];

  return hs
    .map((item) => {
      const r = asRecord(item);
      return {
        x: clampPct(Number(r?.x ?? 50)),
        y: clampPct(Number(r?.y ?? 50)),
        title: String(r?.title ?? '').trim(),
        description: String(r?.description ?? '').trim(),
        kind: normalizeHotspotKind(r?.kind),
      };
    })
    .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
}

function normalizeInsightsForLen(
  len: number,
  existing: unknown,
): ImageInsight[] {
  const base: ImageInsight[] = Array.isArray(existing)
    ? existing.map((it, index) => {
        const r = asRecord(it);
        return {
          role: normalizePhotoRole(r?.role, index),
          overview: normalizeOverview3(r?.overview),
          hotspots: normalizeHotspots(r?.hotspots),
        };
      })
    : [];

  const next = [...base];
  while (next.length < len) {
    next.push({
      role: normalizePhotoRole(undefined, next.length),
      overview: ['', '', ''],
      hotspots: [],
    });
  }
  if (next.length > len) next.length = len;

  for (let i = 0; i < next.length; i++) {
    next[i] = {
      ...next[i],
      role: normalizePhotoRole(next[i]?.role, i),
      overview: normalizeOverview3(next[i]?.overview),
      hotspots: normalizeHotspots(next[i]?.hotspots),
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

  const normalized = normalizeCatalogSpec(
    cat,
    (cat.kind ?? 'PHYSICAL') as ProductKind,
  );

  const { kind, inventoryMode, prepDays, stockTotal, options, variants } =
    normalized;

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

        <div className="scrollbar-marto max-h-[92vh] overflow-auto p-5 sm:h-[calc(100%-64px)] sm:max-h-none">
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

  if (variants.length) {
    out.variants = variants;
    out.options = normalizeCatalogOptions([], variants);
  }

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

function normalizeCatalogOptions(
  options: Array<{ name: string; values: string[] }> | null | undefined,
  variants: VariantRow[] = [],
) {
  const map = new Map<string, Set<string>>();

  for (const opt of Array.isArray(options) ? options : []) {
    const name = String(opt?.name ?? '').trim();
    if (!name) continue;

    if (!map.has(name)) map.set(name, new Set());

    for (const raw of Array.isArray(opt?.values) ? opt.values : []) {
      const value = String(raw ?? '').trim();
      if (value) map.get(name)!.add(value);
    }
  }

  for (const variant of Array.isArray(variants) ? variants : []) {
    const key = String(variant?.key ?? '').trim();
    if (!key) continue;

    for (const piece of key.split('|').map((item) => item.trim()).filter(Boolean)) {
      const eq = piece.indexOf('=');
      if (eq <= 0) continue;

      const name = piece.slice(0, eq).trim();
      const value = piece.slice(eq + 1).trim();
      if (!name || !value) continue;

      if (!map.has(name)) map.set(name, new Set());
      map.get(name)!.add(value);
    }
  }

  return Array.from(map.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
}

function normalizeCatalogSpec(
  input: Partial<CatalogSpec> | null | undefined,
  fallbackKind: ProductKind = 'PHYSICAL',
): CatalogSpec {
  const variants: VariantRow[] = Array.isArray(input?.variants)
    ? input.variants
        .map((item) => ({
          key: String(item?.key ?? '').trim(),
          sku: String(item?.sku ?? '').trim(),
          stock: String(item?.stock ?? '').trim(),
        }))
        .filter((item) => item.key)
    : [];

  const kind =
    input?.kind === 'PHYSICAL' ||
    input?.kind === 'DIGITAL' ||
    input?.kind === 'SERVICE'
      ? input.kind
      : fallbackKind;

  const inventoryMode: InventoryMode =
    input?.inventoryMode === 'LIMITED' ? 'LIMITED' : 'INFINITE';

  return {
    kind,
    inventoryMode,
    stockTotal: String(input?.stockTotal ?? '').trim(),
    prepDays: String(input?.prepDays ?? '').trim(),
    options: normalizeCatalogOptions(input?.options ?? [], variants),
    variants,
  };
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

function SurfaceMetric({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const toneCls =
    tone === 'good'
      ? 'border-emerald-400/20 bg-emerald-400/10'
      : tone === 'warn'
        ? 'border-amber-400/20 bg-amber-400/10'
        : 'border-white/10 bg-black/35';

  return (
    <div className={classNames('rounded-3xl border p-4', toneCls)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white/92">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/62">{hint}</div> : null}
    </div>
  );
}

function SurfaceRail({
  label,
  value,
  total,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  total: number;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const pct =
    total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;

  const fillCls =
    tone === 'good'
      ? 'bg-emerald-300/80'
      : tone === 'warn'
        ? 'bg-amber-300/80'
        : 'bg-white/75';

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-white/78">{label}</div>
        <div className="text-xs font-semibold text-white/62">
          {value}/{total}
        </div>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <div className={classNames('h-full rounded-full', fillCls)} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 text-[11px] text-white/52">{pct}% do catálogo</div>
    </div>
  );
}

function FormSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/12 bg-black/30 p-5">
      <div className="mb-4">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/48">
            {eyebrow}
          </div>
        ) : null}

        <div className="mt-2 text-lg font-semibold text-white/92">{title}</div>

        {description ? (
          <div className="mt-1 text-sm leading-6 text-white/64">{description}</div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function SoftHint({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/52">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-white/70">{children}</div>
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
  const [photoEditorIdx, setPhotoEditorIdx] = useState<number | null>(null);
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState(0);
  const [photoEditorTab, setPhotoEditorTab] = useState<
    'overview' | 'hotspots'
  >('overview');
  const [hotspotSelectedIdx, setHotspotSelectedIdx] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!files.length) {
      setSelectedPreviewIdx(0);
      setPhotoEditorIdx(null);
      setHotspotSelectedIdx(null);
      return;
    }

    if (selectedPreviewIdx > files.length - 1) {
      setSelectedPreviewIdx(files.length - 1);
    }
  }, [files.length, selectedPreviewIdx, setPhotoEditorIdx]);

  const previews = useMemo(() => {
    const out = files.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    return out;
  }, [files]);

  const ins = insights ?? [];
  const normalizedInsights = normalizeInsightsForLen(files.length, ins);
  const selectedPreview = previews[selectedPreviewIdx] ?? null;
  const selectedInsight =
    selectedPreviewIdx >= 0 ? normalizedInsights[selectedPreviewIdx] ?? null : null;

  const selectedRole = selectedInsight
    ? normalizePhotoRole(selectedInsight.role, selectedPreviewIdx)
    : 'cover';

  const selectedRoleMeta = photoRoleMeta(selectedRole);

  const selectedPreviewHotspots =
    selectedPreviewIdx >= 0
      ? normalizeHotspots(normalizedInsights[selectedPreviewIdx]?.hotspots)
      : [];

  function updateInsightAt(
    index: number,
    updater: (prev: ImageInsight) => ImageInsight,
  ) {
    if (!setInsights) return;

    const next = normalizeInsightsForLen(files.length, ins);
    const current = next[index] ?? { overview: ['', '', ''], hotspots: [] };
    next[index] = updater(current);
    setInsights(next);
  }

  const editingHotspots =
    photoEditorIdx !== null ? normalizeHotspots(ins[photoEditorIdx]?.hotspots) : [];

  const selectedHotspot =
    photoEditorIdx !== null && hotspotSelectedIdx !== null
      ? editingHotspots[hotspotSelectedIdx] ?? null
      : null;

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
          <div className="mt-4 grid gap-4">
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-3">
                {previews.map((p, idx) => {
                  const role = normalizePhotoRole(normalizedInsights[idx]?.role, idx);
                  const roleMeta = photoRoleMeta(role);
                  const hotspotsCount = normalizeHotspots(
                    normalizedInsights[idx]?.hotspots,
                  ).length;

                  const isActive = idx === selectedPreviewIdx;

                  return (
                    <button
                      key={`${p.file.name}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedPreviewIdx(idx);
                        setPhotoEditorIdx(idx);
                        setPhotoEditorTab('overview');
                        setHotspotSelectedIdx(null);
                      }}
                      className={classNames(
                        'group w-[96px] shrink-0 rounded-2xl border p-2 text-left transition',
                        isActive
                          ? 'border-white/30 bg-white/[0.06]'
                          : 'border-white/10 bg-black/35 hover:border-white/20',
                      )}
                    >
                      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.file.name}
                          className="h-20 w-full object-cover"
                        />

                        <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/82 backdrop-blur">
                          {roleMeta.label}
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] font-semibold text-white/75">
                        Foto {idx + 1}
                      </div>
                      <div className="mt-1 text-[10px] text-white/50">
                        {hotspotsCount} ponto(s)
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPreview ? (
              <div className="rounded-[28px] border border-white/12 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      Foto em foco
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Trabalhe a leitura viva e os pontos de leitura em uma imagem maior.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Chip text={selectedRoleMeta.label.toUpperCase()} />
                    <Chip text={`${selectedPreviewHotspots.length} PONTO(S)`} />
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/12 bg-black">
                  <div
                    className="relative"
                    onClick={(e) => {
                      if (photoEditorTab !== 'hotspots') return;
                      if (photoEditorIdx !== selectedPreviewIdx) {
                        setPhotoEditorIdx(selectedPreviewIdx);
                      }

                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = clampPct(((e.clientX - rect.left) / rect.width) * 100);
                      const y = clampPct(((e.clientY - rect.top) / rect.height) * 100);

                      const nextPoint: HotspotDraft = {
                        x,
                        y,
                        title: '',
                        description: '',
                        kind: 'difference',
                      };

                      const nextIndex = selectedPreviewHotspots.length;

                      updateInsightAt(selectedPreviewIdx, (prev) => ({
                        ...prev,
                        hotspots: [...normalizeHotspots(prev.hotspots), nextPoint],
                      }));

                      setPhotoEditorIdx(selectedPreviewIdx);
                      setHotspotSelectedIdx(nextIndex);
                      setPhotoEditorTab('hotspots');
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedPreview.url}
                      alt={selectedPreview.file.name}
                      className="max-h-[52vh] w-full object-contain"
                    />

                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.16),rgba(0,0,0,0.04))]" />

                    {selectedPreviewHotspots.map((hs, pointIdx) => {
                      const active = hotspotSelectedIdx === pointIdx;

                      return (
                        <span
                          key={`${pointIdx}-${hs.x}-${hs.y}`}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                        >
                          <span
                            className={classNames(
                              'relative block h-6 w-6 rounded-full border shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
                              active
                                ? 'border-white/80 bg-white/25'
                                : 'border-white/55 bg-white/12',
                            )}
                          >
                            <span className="absolute inset-[4px] rounded-full bg-white/95" />
                          </span>
                        </span>
                      );
                    })}

                    <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-semibold text-white/84 backdrop-blur">
                      {photoEditorTab === 'hotspots'
                        ? 'clique na imagem para criar um ponto de leitura'
                        : selectedRoleMeta.label}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoEditorIdx(selectedPreviewIdx);
                      setPhotoEditorTab('overview');
                      setHotspotSelectedIdx(null);
                    }}
                    className={classNames(
                      'rounded-2xl border px-4 py-2 text-xs font-semibold',
                      photoEditorIdx === selectedPreviewIdx && photoEditorTab === 'overview'
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
                    )}
                    disabled={disabled}
                  >
                    Leitura viva
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoEditorIdx(selectedPreviewIdx);
                      setPhotoEditorTab('hotspots');
                      setHotspotSelectedIdx(
                        selectedPreviewHotspots.length ? 0 : null,
                      );
                    }}
                    className={classNames(
                      'rounded-2xl border px-4 py-2 text-xs font-semibold',
                      photoEditorIdx === selectedPreviewIdx && photoEditorTab === 'hotspots'
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
                    )}
                    disabled={disabled}
                  >
                    Pontos de leitura
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFiles(removeAt(files, selectedPreviewIdx));
                      if (setInsights) {
                        setInsights(
                          removeAt(normalizeInsightsForLen(files.length, ins), selectedPreviewIdx),
                        );
                      }

                      setSelectedPreviewIdx((prev) =>
                        Math.max(0, Math.min(prev, files.length - 2)),
                      );

                      if (photoEditorIdx === selectedPreviewIdx) {
                        setPhotoEditorIdx(null);
                        setPhotoEditorTab('overview');
                        setHotspotSelectedIdx(null);
                      } else if (
                        photoEditorIdx !== null &&
                        photoEditorIdx > selectedPreviewIdx
                      ) {
                        setPhotoEditorIdx(photoEditorIdx - 1);
                      }
                    }}
                    className="rounded-2xl border border-white/15 bg-black/35 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-black/50"
                    disabled={disabled}
                  >
                    Remover foto
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {setInsights && photoEditorIdx !== null && previews[photoEditorIdx] ? (
          <div className="mt-5 rounded-3xl border border-white/15 bg-black/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">
                  Direção visual da foto
                </div>
                <div className="mt-1 text-xs text-white/65">
                  Defina o papel da imagem, a leitura viva da peça e os pontos que reduzem dúvida.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPhotoEditorIdx(null);
                  setPhotoEditorTab('overview');
                  setHotspotSelectedIdx(null);
                }}
                className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
              >
                Fechar editor
              </button>
            </div>

            {photoEditorIdx !== null ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Função da foto</span>
                    <select
                      value={normalizePhotoRole(ins[photoEditorIdx]?.role, photoEditorIdx)}
                      onChange={(e) => {
                        const nextRole = e.target.value as PhotoRole;
                        updateInsightAt(photoEditorIdx, (prev) => ({
                          ...prev,
                          role: nextRole,
                        }));
                      }}
                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm font-semibold text-white/88 outline-none focus:border-white/30"
                    >
                      <option value="cover">Capa</option>
                      <option value="detail">Detalhe</option>
                      <option value="material">Material</option>
                      <option value="context">Contexto</option>
                      <option value="structure">Estrutura</option>
                      <option value="finish">Acabamento</option>
                    </select>
                  </label>

                  <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white/72">
                    {
                      photoRoleMeta(
                        normalizePhotoRole(ins[photoEditorIdx]?.role, photoEditorIdx),
                      ).hint
                    }
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPhotoEditorTab('overview')}
                className={classNames(
                  'rounded-2xl border px-4 py-2 text-xs font-semibold',
                  photoEditorTab === 'overview'
                    ? 'border-white/30 bg-white/10 text-white'
                    : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
                )}
              >
                Leitura viva
              </button>

              <button
                type="button"
                onClick={() => setPhotoEditorTab('hotspots')}
                className={classNames(
                  'rounded-2xl border px-4 py-2 text-xs font-semibold',
                  photoEditorTab === 'hotspots'
                    ? 'border-white/30 bg-white/10 text-white'
                    : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
                )}
              >
                Pontos de leitura
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                {photoEditorTab === 'overview' ? (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/56">
                      leitura viva da peça
                    </div>

                    <div className="mt-3 grid gap-3">
                      {[0, 1, 2].map((lineIdx) => {
                        const ov = normalizeOverview3(ins[photoEditorIdx]?.overview);
                        const val = ov[lineIdx] ?? '';

                        return (
                          <label key={`overview-editor-${photoEditorIdx}-${lineIdx}`} className="grid gap-2">
                            <span className="text-xs font-semibold text-white/65">
                              {lineIdx === 0
                                ? 'O que esta foto prova'
                                : lineIdx === 1
                                  ? 'O que esta foto transmite'
                                  : 'O que esta foto reduz de dúvida'}
                            </span>
                            <input
                              value={val}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateInsightAt(photoEditorIdx, (prev) => {
                                  const nextOv = normalizeOverview3(prev.overview);
                                  nextOv[lineIdx] = v;
                                  return { ...prev, overview: nextOv };
                                });
                              }}
                              maxLength={42}
                              placeholder={
                                lineIdx === 0
                                  ? 'Ex.: Estrutura firme e bem resolvida'
                                  : lineIdx === 1
                                    ? 'Ex.: Toque premium e presença elegante'
                                    : 'Ex.: Ajuda a entender material e acabamento'
                              }
                              className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                              disabled={disabled}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/56">
                      pontos de leitura desta foto
                    </div>

                    {editingHotspots.length === 0 ? (
                      <div className="mt-3 text-sm text-white/65">
                        Ainda não há pontos nesta foto.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {editingHotspots.map((hs, pointIdx) => (
                          <button
                            key={`list-${pointIdx}-${hs.x}-${hs.y}`}
                            type="button"
                            onClick={() => setHotspotSelectedIdx(pointIdx)}
                            className={classNames(
                              'w-full rounded-2xl border px-3 py-3 text-left',
                              hotspotSelectedIdx === pointIdx
                                ? 'border-white/35 bg-white/[0.06]'
                                : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-white/88">
                                {hs.title || `Ponto ${pointIdx + 1}`}
                              </div>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/60">
                                {hotspotKindMeta(normalizeHotspotKind(hs.kind)).label}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-white/56">
                              X {Math.round(hs.x)}% • Y {Math.round(hs.y)}%
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedHotspot ? (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white/88">
                            Editar ponto {hotspotSelectedIdx! + 1}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (photoEditorIdx === null || hotspotSelectedIdx === null) return;

                              updateInsightAt(photoEditorIdx, (prev) => ({
                                ...prev,
                                hotspots: normalizeHotspots(prev.hotspots).filter(
                                  (_, i) => i !== hotspotSelectedIdx,
                                ),
                              }));

                              const nextLen = editingHotspots.length - 1;
                              setHotspotSelectedIdx(nextLen > 0 ? 0 : null);
                            }}
                            className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-400/15"
                          >
                            Remover ponto
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3">
                          <label className="grid gap-2">
                            <span className="text-xs font-semibold text-white/65">Tipo do ponto</span>
                            <select
                              value={normalizeHotspotKind(selectedHotspot.kind)}
                              onChange={(e) => {
                                if (photoEditorIdx === null || hotspotSelectedIdx === null) return;

                                updateInsightAt(photoEditorIdx, (prev) => {
                                  const nextHotspots = normalizeHotspots(prev.hotspots);
                                  nextHotspots[hotspotSelectedIdx] = {
                                    ...nextHotspots[hotspotSelectedIdx]!,
                                    kind: normalizeHotspotKind(e.target.value),
                                  };
                                  return { ...prev, hotspots: nextHotspots };
                                });
                              }}
                              className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                            >
                              <option value="material">Material</option>
                              <option value="finish">Acabamento</option>
                              <option value="structure">Estrutura</option>
                              <option value="comfort">Conforto</option>
                              <option value="measure">Proporção</option>
                              <option value="difference">Diferencial</option>
                            </select>
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-semibold text-white/65">Título</span>
                            <input
                              value={selectedHotspot.title}
                              onChange={(e) => {
                                if (photoEditorIdx === null || hotspotSelectedIdx === null) return;

                                updateInsightAt(photoEditorIdx, (prev) => {
                                  const nextHotspots = normalizeHotspots(prev.hotspots);
                                  nextHotspots[hotspotSelectedIdx] = {
                                    ...nextHotspots[hotspotSelectedIdx]!,
                                    title: e.target.value,
                                  };
                                  return { ...prev, hotspots: nextHotspots };
                                });
                              }}
                              placeholder="Ex.: Braço"
                              className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-semibold text-white/65">Descrição</span>
                            <textarea
                              value={selectedHotspot.description}
                              onChange={(e) => {
                                if (photoEditorIdx === null || hotspotSelectedIdx === null) return;

                                updateInsightAt(photoEditorIdx, (prev) => {
                                  const nextHotspots = normalizeHotspots(prev.hotspots);
                                  nextHotspots[hotspotSelectedIdx] = {
                                    ...nextHotspots[hotspotSelectedIdx]!,
                                    description: e.target.value,
                                  };
                                  return { ...prev, hotspots: nextHotspots };
                                });
                              }}
                              placeholder="Ex.: MDF laminado, acabamento nogueira."
                              rows={4}
                              className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                            />
                          </label>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="grid gap-2">
                              <span className="text-xs font-semibold text-white/65">Posição X</span>
                              <input
                                value={selectedHotspot.x}
                                onChange={(e) => {
                                  if (photoEditorIdx === null || hotspotSelectedIdx === null) return;

                                  updateInsightAt(photoEditorIdx, (prev) => {
                                    const nextHotspots = normalizeHotspots(prev.hotspots);
                                    nextHotspots[hotspotSelectedIdx] = {
                                      ...nextHotspots[hotspotSelectedIdx]!,
                                      x: clampPct(Number(e.target.value)),
                                    };
                                    return { ...prev, hotspots: nextHotspots };
                                  });
                                }}
                                inputMode="decimal"
                                className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-xs font-semibold text-white/65">Posição Y</span>
                              <input
                                value={selectedHotspot.y}
                                onChange={(e) => {
                                  if (photoEditorIdx === null || hotspotSelectedIdx === null) return;

                                  updateInsightAt(photoEditorIdx, (prev) => {
                                    const nextHotspots = normalizeHotspots(prev.hotspots);
                                    nextHotspots[hotspotSelectedIdx] = {
                                      ...nextHotspots[hotspotSelectedIdx]!,
                                      y: clampPct(Number(e.target.value)),
                                    };
                                    return { ...prev, hotspots: nextHotspots };
                                  });
                                }}
                                inputMode="decimal"
                                className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
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
      ? 'Físico'
      : cat.kind === 'DIGITAL'
        ? 'Digital'
        : 'Serviço';

  const invLabel =
    cat.inventoryMode === 'INFINITE' ? 'Infinito' : 'Limitado';

  const hasOptions = cat.options.some(
    (opt) => String(opt?.name ?? '').trim() && (opt?.values ?? []).length > 0,
  );

  const hasVariants = cat.variants.length > 0;

  const activeOptionGroups = cat.options
    .map((opt, idx) => ({
      idx,
      name: String(opt?.name ?? '').trim(),
      values: (opt?.values ?? []).map((v) => String(v ?? '').trim()).filter(Boolean),
    }))
    .filter((opt) => opt.name || opt.values.length);

  const hasRenderableStructure = activeOptionGroups.some(
    (group) => group.name && group.values.length > 0,
  );

  const canBuildVariants =
    cat.kind === 'PHYSICAL' &&
    activeOptionGroups.length > 0 &&
    activeOptionGroups.every((group) => group.name && group.values.length > 0);

  const usesVariantStock =
    cat.kind === 'PHYSICAL' &&
    cat.inventoryMode === 'LIMITED' &&
    hasVariants;

  const catalogModeText =
    cat.kind === 'PHYSICAL'
      ? cat.inventoryMode === 'LIMITED'
        ? hasVariants
          ? 'A peça opera com estoque por combinação.'
          : 'A peça opera com estoque controlado.'
        : 'A peça opera sem limite de estoque no MVP.'
      : 'A peça opera sem estoque físico no MVP.';

  return (
    <div className="grid gap-5">
      <div className="rounded-[28px] border border-white/12 bg-black/28 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white/90">
              Modelo comercial da peça
            </div>
            <div className="mt-1 text-sm leading-6 text-white/64">
              Defina como essa peça existe no catálogo: natureza, inventário e preparação.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip text={kindLabel.toUpperCase()} />
            <Chip text={`ESTOQUE ${invLabel.toUpperCase()}`} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
          {catalogModeText}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm font-semibold text-white/88 outline-none focus:border-white/30"
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
                setCat((p) => ({
                  ...p,
                  inventoryMode: e.target.value as InventoryMode,
                }))
              }
              className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm font-semibold text-white/88 outline-none focus:border-white/30"
              disabled={disabled || cat.kind !== 'PHYSICAL'}
              title={
                cat.kind !== 'PHYSICAL'
                  ? 'Digital/serviço: infinito no MVP'
                  : undefined
              }
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
              className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
              placeholder="Ex.: 2"
              inputMode="numeric"
              disabled={disabled}
            />
          </label>
        </div>

        {cat.inventoryMode === 'LIMITED' && cat.kind === 'PHYSICAL' ? (
          <div className="mt-4">
            {usesVariantStock ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Estoque por combinação ativo.
                <div className="mt-1 text-xs text-emerald-100/80">
                  O estoque geral sai de cena quando existem escolhas reais da peça.
                </div>
              </div>
            ) : (
              <label className="grid gap-2">
                <span className="text-xs font-semibold text-white/65">Estoque base</span>
                <input
                  value={cat.stockTotal}
                  onChange={(e) =>
                    setCat((p) => ({ ...p, stockTotal: e.target.value }))
                  }
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                  placeholder="Ex.: 12"
                  inputMode="numeric"
                  disabled={disabled}
                />
                <div className="text-[11px] text-white/50">
                  Use isso apenas quando a peça não tiver combinações.
                </div>
              </label>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-white/12 bg-black/28 p-5">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Escolhas reais do cliente
          </div>
          <div className="mt-1 text-sm leading-6 text-white/64">
            Estruture propriedades como cor, tamanho e voltagem. Quando necessário,
            isso vira combinação operacional da peça.
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCat((p) => ({
                ...p,
                options: [...p.options, { name: '', values: [] }],
              }))
            }
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 disabled:opacity-60"
            disabled={disabled || cat.kind !== 'PHYSICAL'}
            title={
              cat.kind !== 'PHYSICAL'
                ? 'Variações fazem mais sentido para produto físico'
                : undefined
            }
          >
            + Adicionar propriedade
          </button>

          {cat.options.length ? (
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
              className={classNames(
                'rounded-2xl px-4 py-2 text-xs font-semibold disabled:opacity-60',
                canBuildVariants
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'border border-white/10 bg-black/30 text-white/45',
              )}
              disabled={disabled || !canBuildVariants}
              title={
                !canBuildVariants
                  ? 'Preencha nome e valores de cada propriedade antes de montar combinações.'
                  : undefined
              }
            >
              {hasVariants ? 'Atualizar combinações' : 'Montar combinações'}
            </button>
          ) : null}

          {cat.options.length && !canBuildVariants ? (
            <span className="text-[11px] text-white/48">
              Complete nome e valores para liberar as combinações.
            </span>
          ) : null}
        </div>

        {!cat.options.length ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm text-white/64">
            Sem variações por enquanto. Adicione propriedades como{' '}
            <span className="font-semibold text-white/84">Cor</span>,{' '}
            <span className="font-semibold text-white/84">Tamanho</span> ou{' '}
            <span className="font-semibold text-white/84">Voltagem</span>.
          </div>
        ) : (
          <>
            {hasRenderableStructure ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  Estrutura ativa
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {activeOptionGroups
                    .filter((group) => group.name && group.values.length > 0)
                    .map((group) => (
                      <div
                        key={`active-opt-${group.idx}`}
                        className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80"
                      >
                        <span className="font-semibold text-white/90">{group.name}</span>
                        <span className="text-white/55">
                          {' '}• {group.values.length} valor(es)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              {cat.options.map((opt, idx) => {
                const values = (opt.values ?? []).filter(Boolean);

                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/10 bg-black/35 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="grid gap-3">
                          <label className="grid gap-2">
                            <span className="text-xs font-semibold text-white/65">
                              Propriedade
                            </span>
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
                              className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2.5 text-sm text-white/90 outline-none focus:border-white/30"
                              placeholder="Ex.: Cor"
                              disabled={disabled}
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-semibold text-white/65">
                              Valores
                            </span>
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
                              className="rounded-2xl border border-white/15 bg-black/80 px-4 py-2.5 text-sm text-white/90 outline-none focus:border-white/30"
                              placeholder="Ex.: Preto, Marrom, Off-white"
                              disabled={disabled}
                            />
                          </label>
                        </div>

                        {values.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {values.map((value, valueIdx) => (
                              <span
                                key={`${idx}-${valueIdx}-${value}`}
                                className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/82"
                              >
                                {value}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-[11px] text-white/48">
                            Adicione os valores separados por vírgula.
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCat((p) => {
                            const next = p.options.filter((_, i) => i !== idx);
                            return { ...p, options: next, variants: [] };
                          });
                        }}
                        className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-black/55 disabled:opacity-60"
                        disabled={disabled}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {canBuildVariants && !cat.variants.length ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                Estrutura pronta para virar combinação operacional.
                <div className="mt-1 text-xs text-emerald-100/80">
                  Agora você já pode montar as combinações reais da peça.
                </div>
              </div>
            ) : null}

            {cat.variants.length ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/88">
                      Combinações operacionais
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Cada combinação representa uma escolha real que a peça suporta.
                    </div>
                  </div>

                  <Chip text={`${cat.variants.length} combinação(ões)`} />
                </div>

                <div className="mt-4 grid gap-3">
                  {cat.variants.map((v, i) => {
                    const pairs = parseVariantKey(v.key);

                    return (
                      <div
                        key={v.key}
                        className="rounded-2xl border border-white/10 bg-black/40 p-4"
                      >
                        <div className="flex flex-wrap gap-2">
                          {pairs.length ? (
                            pairs.map((pair, pairIdx) => (
                              <span
                                key={`${v.key}-${pairIdx}-${pair.name}-${pair.value}`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85"
                              >
                                <span className="text-white/55">{pair.name}</span>
                                <span className="font-semibold text-white">
                                  {pair.value}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs font-semibold text-white/85">
                              {v.key}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3">
                          <label className="grid gap-2">
                            <span className="text-xs font-semibold text-white/65">
                              SKU da combinação
                            </span>
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
                              className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                              placeholder="Ex.: COSTELA-BRACO-PRATA"
                              disabled={disabled}
                            />
                          </label>

                          {cat.inventoryMode === 'LIMITED' && cat.kind === 'PHYSICAL' ? (
                            <label className="grid gap-2">
                              <span className="text-xs font-semibold text-white/65">
                                Estoque da combinação
                              </span>
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
                                className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                                placeholder="Ex.: 5"
                                inputMode="numeric"
                                disabled={disabled}
                              />
                            </label>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-[11px] text-white/55">
                  Regra Marto: quando existem combinações em inventário limitado,
                  o estoque deixa de ser geral e passa a valer por combinação.
                </div>
              </div>
            ) : hasOptions ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-white/65">
                Estrutura pronta. Agora clique em{' '}
                <span className="font-semibold text-white/85">
                  Montar combinações
                </span>{' '}
                para gerar a camada operacional da peça.
              </div>
            ) : null}
          </>
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

function parseVariantKey(key: string) {
  return String(key ?? '')
    .split('|')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => {
      const eq = piece.indexOf('=');
      if (eq <= 0) return null;

      const name = piece.slice(0, eq).trim();
      const value = piece.slice(eq + 1).trim();

      if (!name || !value) return null;
      return { name, value };
    })
    .filter(Boolean) as Array<{ name: string; value: string }>;
}

function buildOptionsFromVariants(variants: VariantRow[] = []) {
  const map = new Map<string, Set<string>>();

  for (const variant of variants) {
    for (const pair of parseVariantKey(variant.key)) {
      if (!map.has(pair.name)) map.set(pair.name, new Set());
      map.get(pair.name)!.add(pair.value);
    }
  }

  return Array.from(map.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((item) => String(item ?? '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeColorName(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function optionLooksLikeColor(name: string) {
  const n = normalizeColorName(name);
  return (
    n === 'cor' ||
    n === 'cores' ||
    n === 'color' ||
    n === 'colors' ||
    n === 'tonalidade'
  );
}

function colorSwatchStyle(value: string): React.CSSProperties {
  const n = normalizeColorName(value);

  const palette: Record<string, React.CSSProperties> = {
    preto: { background: '#111111', borderColor: 'rgba(255,255,255,0.18)' },
    branco: { background: '#f8fafc', borderColor: 'rgba(255,255,255,0.28)' },
    'off white': { background: '#f3efe5', borderColor: 'rgba(255,255,255,0.22)' },
    offwhite: { background: '#f3efe5', borderColor: 'rgba(255,255,255,0.22)' },
    bege: { background: '#d6c2a1', borderColor: 'rgba(255,255,255,0.18)' },
    creme: { background: '#efe3c2', borderColor: 'rgba(255,255,255,0.18)' },
    marfim: { background: '#f5efdd', borderColor: 'rgba(255,255,255,0.18)' },
    nude: { background: '#c8a07a', borderColor: 'rgba(255,255,255,0.18)' },
    prata: {
      background:
        'linear-gradient(135deg, #f3f4f6 0%, #d7dce2 30%, #8e97a4 62%, #eef2f7 100%)',
      borderColor: 'rgba(255,255,255,0.22)',
    },
    cinza: { background: '#9ca3af', borderColor: 'rgba(255,255,255,0.18)' },
    grafite: { background: '#4b5563', borderColor: 'rgba(255,255,255,0.18)' },
    chumbo: { background: '#374151', borderColor: 'rgba(255,255,255,0.18)' },
    dourado: {
      background:
        'linear-gradient(135deg, #fef3c7 0%, #f59e0b 35%, #b45309 70%, #fde68a 100%)',
      borderColor: 'rgba(255,255,255,0.2)',
    },
    ouro: {
      background:
        'linear-gradient(135deg, #fef3c7 0%, #f59e0b 35%, #b45309 70%, #fde68a 100%)',
      borderColor: 'rgba(255,255,255,0.2)',
    },
    marrom: { background: '#6f4e37', borderColor: 'rgba(255,255,255,0.18)' },
    cafe: { background: '#6f4e37', borderColor: 'rgba(255,255,255,0.18)' },
    castanho: { background: '#7c5a43', borderColor: 'rgba(255,255,255,0.18)' },
    caramelo: { background: '#b8793b', borderColor: 'rgba(255,255,255,0.18)' },
    vermelho: { background: '#dc2626', borderColor: 'rgba(255,255,255,0.18)' },
    vinho: { background: '#7f1d1d', borderColor: 'rgba(255,255,255,0.18)' },
    bordo: { background: '#7f1d1d', borderColor: 'rgba(255,255,255,0.18)' },
    azul: { background: '#2563eb', borderColor: 'rgba(255,255,255,0.18)' },
    'azul marinho': { background: '#1e3a8a', borderColor: 'rgba(255,255,255,0.18)' },
    verde: { background: '#16a34a', borderColor: 'rgba(255,255,255,0.18)' },
    oliva: { background: '#556b2f', borderColor: 'rgba(255,255,255,0.18)' },
    amarelo: { background: '#facc15', borderColor: 'rgba(255,255,255,0.18)' },
    laranja: { background: '#f97316', borderColor: 'rgba(255,255,255,0.18)' },
    rosa: { background: '#ec4899', borderColor: 'rgba(255,255,255,0.18)' },
    roxo: { background: '#7c3aed', borderColor: 'rgba(255,255,255,0.18)' },
    lilas: { background: '#a78bfa', borderColor: 'rgba(255,255,255,0.18)' },
    transparente: {
      background:
        'linear-gradient(45deg, #111 25%, #222 25%, #222 50%, #111 50%, #111 75%, #222 75%, #222 100%)',
      backgroundSize: '10px 10px',
      borderColor: 'rgba(255,255,255,0.2)',
    },
    multicolor: {
      background:
        'linear-gradient(90deg, #ef4444 0%, #f59e0b 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #a855f7 100%)',
      borderColor: 'rgba(255,255,255,0.2)',
    },
  };

  return (
    palette[n] ?? {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08))',
      borderColor: 'rgba(255,255,255,0.18)',
    }
  );
}

function variationCountLabel(count: number) {
  return `${count} ${count === 1 ? 'VARIAÇÃO' : 'VARIAÇÕES'}`;
}

function normalizeLiveReadingLine(value: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const isAllCaps =
    raw === raw.toUpperCase() && /[A-ZÀ-Ý]/.test(raw);

  if (!isAllCaps) return raw;

  return raw
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function colorPresenceStyle(value: string): React.CSSProperties {
  const n = normalizeColorName(value);

  if (n === 'prata') {
    return {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(215,220,226,0.18) 30%, rgba(142,151,164,0.22) 62%, rgba(255,255,255,0.12) 100%)',
      borderColor: 'rgba(255,255,255,0.16)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    };
  }

  if (n === 'dourado' || n === 'ouro') {
    return {
      background:
        'linear-gradient(135deg, rgba(254,243,199,0.18) 0%, rgba(245,158,11,0.16) 35%, rgba(180,83,9,0.18) 70%, rgba(253,230,138,0.12) 100%)',
      borderColor: 'rgba(255,255,255,0.14)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    };
  }

  return {
    background: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
  };
}

function firstNonEmptyOverview(insights?: ImageInsight[] | null) {
  const list = Array.isArray(insights) ? insights : [];

  for (const item of list) {
    const lines = normalizeOverview3(item?.overview)
      .map((line) => String(line ?? '').trim())
      .filter(Boolean);

    if (lines.length) return lines;
  }

  return [] as string[];
}

function buildCardCatalogLens(cat?: Partial<CatalogSpec> | null) {
  const normalized = normalizeCatalogSpec(cat ?? null);

  const optionGroups = normalized.options
    .map((opt) => ({
      name: String(opt?.name ?? '').trim(),
      values: (opt?.values ?? [])
        .map((v) => String(v ?? '').trim())
        .filter(Boolean),
    }))
    .filter((opt) => opt.name && opt.values.length)
    .slice(0, 3);

  const combinations = normalized.variants
    .slice(0, 3)
    .map((variant) =>
      parseVariantKey(variant.key)
        .map((pair) => `${pair.name}: ${pair.value}`)
        .join(' • '),
    )
    .filter(Boolean);

  return {
    optionGroups,
    combinations,
    totalCombinations: normalized.variants.length,
  };
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
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  const createHasDraft =
    !!title.trim() ||
    !!description.trim() ||
    !!price.trim() ||
    files.length > 0 ||
    productServices.length > 0 ||
    hasAnyTech(spec) ||
    !!idn.handle.trim() ||
    !!dna.skuRoot.trim() ||
    !!dna.collection.trim() ||
    !!dna.version.trim() ||
    cat.options.length > 0 ||
    cat.variants.length > 0 ||
    !!cat.prepDays.trim() ||
    !!cat.stockTotal.trim();

  const createStructureScore = [
    {
      label: 'Base',
      done: !!title.trim() && !!price.trim(),
    },
    {
      label: 'Fotos',
      done: files.length > 0,
    },
    {
      label: 'Catálogo',
      done:
        cat.options.length > 0 ||
        cat.variants.length > 0 ||
        !!cat.prepDays.trim() ||
        !!cat.stockTotal.trim(),
    },
    {
      label: 'Ficha',
      done: hasAnyTech(spec),
    },
  ];

  const createReadinessCount = createStructureScore.filter((item) => item.done).length;

  const createLauncherStatus = !createHasDraft
    ? 'CRIADOR RECOLHIDO'
    : createReadinessCount >= 4
      ? 'PRONTO PARA REVISÃO'
      : `RASCUNHO • ${stepLabel(newStep).toUpperCase()}`;

  const createDraftState = !createHasDraft
    ? 'RASCUNHO VAZIO'
    : createReadinessCount >= 4
      ? 'PRONTO PARA REVISÃO'
      : createReadinessCount === 0
        ? 'INICIANDO'
        : `EM CONSTRUÇÃO • ${stepLabel(newStep).toUpperCase()}`;

  const createDraftTone: 'neutral' | 'good' | 'warn' =
    !createHasDraft
      ? 'neutral'
      : createReadinessCount >= 4
        ? 'good'
        : 'warn';

  const createStepStatus = {
    BASIC: !!title.trim() && !!price.trim(),
    PHOTOS: files.length > 0,
    CATALOG:
      !!cat.prepDays.trim() ||
      !!cat.stockTotal.trim() ||
      cat.options.length > 0 ||
      cat.variants.length > 0,
    TECH: hasAnyTech(spec),
    REVIEW: false,
  };

  const createStepProgressCount = stepOrder.filter((step) => {
    if (step === 'REVIEW') return false;
    return createStepStatus[step as keyof typeof createStepStatus];
  }).length;

  const createStepProgressTotal = Math.max(stepOrder.length - 1, 1);

  const createStepProgressPct = Math.round(
    (createStepProgressCount / createStepProgressTotal) * 100,
  );

  function resetCreateDraft() {
    setNewStep('BASIC');
    setTitle('');
    setDescription('');
    setPrice('');
    setProductServices([]);
    setFiles([]);
    setImageInsights([]);
    setUploadProgress('');
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
  }

  function openCreateSheet() {
    setCreateSheetOpen(true);
  }

  function closeCreateSheet() {
    if (saving || uploading) return;
    setCreateSheetOpen(false);
  }

  function discardCreateDraft() {
    if (saving || uploading) return;
    resetCreateDraft();
    setCreateSheetOpen(false);
  }

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
  const [ePhotoEditorIdx, setEPhotoEditorIdx] = useState<number | null>(null);
  const [ePhotoEditorTab, setEPhotoEditorTab] = useState<
    'overview' | 'hotspots'
  >('overview');
  const [eHotspotSelectedIdx, setEHotspotSelectedIdx] = useState<number | null>(
    null,
  );
  const [eUploading, setEUploading] = useState(false);
  const [eUploadProgress, setEUploadProgress] = useState('');

  // ✅ NOVO: controle de imagens atuais (remover na edição)
  const [eKeepImages, setEKeepImages] = useState<string[]>([]);
  const [eKeepCaptions, setEKeepCaptions] = useState<string[]>([]);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const eCurrentEditingHotspots =
    ePhotoEditorIdx !== null
      ? normalizeHotspots(eKeepInsights[ePhotoEditorIdx]?.hotspots)
      : [];

  const eCurrentSelectedHotspot =
    ePhotoEditorIdx !== null && eHotspotSelectedIdx !== null
      ? eCurrentEditingHotspots[eHotspotSelectedIdx] ?? null
      : null;

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

  const editHasDraft =
    !!eTitle.trim() ||
    !!eDesc.trim() ||
    !!ePrice.trim() ||
    eKeepImages.length > 0 ||
    eFiles.length > 0 ||
    eProductServices.length > 0 ||
    hasAnyTech(eSpec) ||
    !!eIdn.handle.trim() ||
    !!eDna.skuRoot.trim() ||
    !!eDna.collection.trim() ||
    !!eDna.version.trim() ||
    eCat.options.length > 0 ||
    eCat.variants.length > 0 ||
    !!eCat.prepDays.trim() ||
    !!eCat.stockTotal.trim();

  const editDraftState = !editHasDraft
    ? 'RASCUNHO VAZIO'
    : `EM EDIÇÃO • ${editLabel(editStep).toUpperCase()}`;

  const editDraftTone: 'neutral' | 'good' | 'warn' = !editHasDraft ? 'neutral' : 'warn';

  const editStepStatus = {
    BASIC: !!eTitle.trim() && !!ePrice.trim(),
    PHOTOS: eKeepImages.length + eFiles.length > 0,
    CATALOG:
      !!eCat.prepDays.trim() ||
      !!eCat.stockTotal.trim() ||
      eCat.options.length > 0 ||
      eCat.variants.length > 0,
    TECH: hasAnyTech(eSpec),
    REVIEW: false,
  };

  const editStepProgressCount = editOrder.filter((step) => {
    if (step === 'REVIEW') return false;
    return editStepStatus[step as keyof typeof editStepStatus];
  }).length;

  const editStepProgressTotal = Math.max(editOrder.length - 1, 1);

  const editStepProgressPct = Math.round(
    (editStepProgressCount / editStepProgressTotal) * 100,
  );

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

      await loadProducts();
      resetCreateDraft();
      setCreateSheetOpen(false);
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

    // combina meta + bloco antigo do catálogo para não perder propriedades
    const extractedTech = metaTech ?? extractTechBlock(p.description ?? '');
    const descCat = extractCatalogBlock(p.description ?? '');

    const mergedVariants =
      Array.isArray(metaCat?.variants) && metaCat.variants.length
        ? metaCat.variants
        : Array.isArray(descCat.variants) && descCat.variants.length
          ? descCat.variants
          : [];

    const mergedCatSource: Partial<CatalogSpec> = {
      ...(descCat ?? {}),
      ...(metaCat ?? {}),
      variants: mergedVariants,
      options: normalizeCatalogOptions(
        [
          ...(Array.isArray(descCat.options) ? descCat.options : []),
          ...(Array.isArray(metaCat?.options) ? metaCat.options : []),
        ],
        mergedVariants,
      ),
    };

    const productKind =
      p.productType === 'PHYSICAL' ||
      p.productType === 'DIGITAL' ||
      p.productType === 'SERVICE'
        ? p.productType
        : mergedCatSource.kind === 'PHYSICAL' ||
            mergedCatSource.kind === 'DIGITAL' ||
            mergedCatSource.kind === 'SERVICE'
          ? mergedCatSource.kind
          : 'PHYSICAL';

    setESpec({
      weightKg:
        formatOptionalWeightKgFromGrams(p.weightGrams) ||
        String(extractedTech.weightKg ?? ''),
      lengthCm:
        typeof p.lengthCm === 'number' && p.lengthCm > 0
          ? String(p.lengthCm)
          : String(extractedTech.lengthCm ?? ''),
      widthCm:
        typeof p.widthCm === 'number' && p.widthCm > 0
          ? String(p.widthCm)
          : String(extractedTech.widthCm ?? ''),
      heightCm:
        typeof p.heightCm === 'number' && p.heightCm > 0
          ? String(p.heightCm)
          : String(extractedTech.heightCm ?? ''),
      sku: String(extractedTech.sku ?? ''),
      barcode: String(extractedTech.barcode ?? ''),
      brand: String(extractedTech.brand ?? ''),
      tags: String(extractedTech.tags ?? ''),
    });

    setECat(normalizeCatalogSpec(mergedCatSource, productKind));

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
    setEPhotoEditorIdx((p.images ?? []).length ? 0 : null);
    setEPhotoEditorTab('overview');
    setEHotspotSelectedIdx(null);
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
    setEPhotoEditorIdx(null);
    setEPhotoEditorTab('overview');
    setEHotspotSelectedIdx(null);
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

    const keepInsights = normalizeInsightsForLen(baseImgs.length, eKeepInsights);
    const newInsights = normalizeInsightsForLen(eFiles.length, eInsights);
    const insightsToSend = normalizeInsightsForLen(
      imagesToSend?.length ?? 0,
      [...keepInsights, ...newInsights],
    );
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

  const pendingCount = Math.max(0, stats.total - stats.ready);
  const missingPhotoCount = Math.max(0, stats.total - stats.withImg);
  const missingTechCount = Math.max(0, stats.total - stats.withTech);
  const missingCatalogCount = Math.max(0, stats.total - stats.withCatalog);
  const readinessPct =
    stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;

  const focusTitle =
    missingPhotoCount > 0
      ? 'Completar fotos de capa'
      : missingCatalogCount > 0
        ? 'Estruturar catálogo ativo'
        : missingTechCount > 0
          ? 'Fechar ficha técnica'
          : pendingCount > 0
            ? 'Empurrar itens para pronto (MVP)'
            : 'Catálogo saudável';

  const focusHint =
    missingPhotoCount > 0
      ? `${missingPhotoCount} item(ns) ainda precisam de foto para ganhar confiança visual.`
      : missingCatalogCount > 0
        ? `${missingCatalogCount} item(ns) ainda estão sem catálogo completo.`
        : missingTechCount > 0
          ? `${missingTechCount} item(ns) ainda podem ganhar ficha técnica para reduzir dúvida.`
          : pendingCount > 0
            ? `${pendingCount} item(ns) já têm base e pedem acabamento final para virar reputação.`
            : 'Agora o foco pode migrar para refino de vitrine, serviço e performance.';

  const createWizardBody = (
    <div className="mt-4 grid gap-4">
      {newStep === 'BASIC' ? (
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                Nome
              </div>
              <div className="mt-2 text-sm font-semibold text-white/90">
                {title.trim() || 'Ainda não definido'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                Preço
              </div>
              <div className="mt-2 text-sm font-semibold text-white/90">
                {price.trim() ? `R$ ${price.trim()}` : 'Ainda não definido'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                Serviços
              </div>
              <div className="mt-2 text-sm font-semibold text-white/90">
                {productServices.length} ligado(s)
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                Handle
              </div>
              <div className="mt-2 text-sm font-semibold text-white/90">
                {slugifyMarto(idn.handle || title) || 'Ainda não definido'}
              </div>
            </div>
          </div>

          <FormSection
            eyebrow="Essência da peça"
            title="Base comercial do produto"
            description="Defina o que o cliente entende rápido: nome forte, descrição que reduz dúvida e preço claro."
          >
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/84">Nome do produto</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Mesa Lua 1,60m"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                  disabled={saving || uploading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/84">Descrição</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Foque no que evita dúvidas: material, medidas, acabamento, uso, sensação da peça..."
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                  disabled={saving || uploading}
                />
              </label>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/84">Preço (R$)</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex.: 1299,90"
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                    disabled={saving || uploading}
                  />
                </label>

                <SoftHint title="Marto dica">
                  Um bom nome + uma descrição sem dúvida + um preço claro já
                  colocam a peça em posição mais forte antes mesmo das fotos e
                  do catálogo.
                </SoftHint>
              </div>
            </div>
          </FormSection>

          <FormSection
            eyebrow="Ecossistema ligado"
            title="Serviços associados ao produto"
            description="Selecione os serviços que podem entrar no ciclo real da compra, entrega, instalação e suporte."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {PRODUCT_SERVICE_OPTIONS.map((option) => {
                const selected = productServices.includes(option.key);

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setProductServices((prev) =>
                        prev.includes(option.key)
                          ? prev.filter((item) => item !== option.key)
                          : [...prev, option.key],
                      );
                    }}
                    className={classNames(
                      'rounded-2xl border px-4 py-4 text-left transition',
                      selected
                        ? 'border-emerald-400/20 bg-emerald-400/10'
                        : 'border-white/12 bg-black/35 hover:bg-black/50',
                    )}
                    disabled={saving || uploading}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white/88">{option.label}</div>
                      <Chip
                        text={selected ? 'Ligado' : 'Opcional'}
                        tone={selected ? 'good' : 'neutral'}
                      />
                    </div>

                    <div className="mt-2 text-xs leading-5 text-white/58">
                      {option.key === 'assembly'
                        ? 'Para peças que pedem montagem no destino.'
                        : option.key === 'installation'
                          ? 'Quando a entrega evolui para instalação real.'
                          : option.key === 'maintenance'
                            ? 'Suporte e manutenção pós-compra.'
                            : option.key === 'delivery'
                              ? 'Entrega como parte do ciclo operacional.'
                              : 'Serviço técnico ligado à decisão de compra.'}
                    </div>
                  </button>
                );
              })}
            </div>
          </FormSection>

          <FormSection
            eyebrow="Identidade pública"
            title="Handle e rastreio da peça"
            description="Curto, estável e legível. Essa identidade ajuda a peça a ganhar memória dentro do ecossistema."
          >
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/84">Handle público</span>
                <input
                  value={idn.handle}
                  onChange={(e) => setIdn({ handle: e.target.value })}
                  placeholder="Ex.: mesa-lua-160"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                  disabled={saving || uploading}
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  Prévia
                </div>
                <div className="mt-2 text-sm font-semibold text-white/90">
                  /p/{slugifyMarto(idn.handle || title) || 'sua-peca'}
                </div>
                <div className="mt-2 text-xs leading-5 text-white/58">
                  O Marto normaliza o handle para ficar estável e legível.
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            eyebrow="DNA operacional"
            title="Rastreio interno da peça"
            description="Use esse bloco para organizar SKU raiz, coleção e versão operacional."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/84">SKU raiz</span>
                <input
                  value={dna.skuRoot}
                  onChange={(e) => setDna((p) => ({ ...p, skuRoot: e.target.value }))}
                  placeholder="Ex.: MESA-LUA"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                  disabled={saving || uploading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/84">Coleção / linha</span>
                <input
                  value={dna.collection}
                  onChange={(e) => setDna((p) => ({ ...p, collection: e.target.value }))}
                  placeholder="Ex.: Linha Lua"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                  disabled={saving || uploading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/84">Versão</span>
                <input
                  value={dna.version}
                  onChange={(e) => setDna((p) => ({ ...p, version: e.target.value }))}
                  placeholder="Ex.: v1 / 2026-A"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                  disabled={saving || uploading}
                />
              </label>
            </div>
          </FormSection>
        </div>
      ) : null}

      {newStep === 'PHOTOS' ? (
        <div className="grid gap-5">
          <FormSection
            eyebrow="Imagem viva"
            title="Fotos e leitura visual"
            description="A capa vende confiança. As demais fotos aprofundam material, textura, detalhe e contexto de uso."
          >
            <div className="grid gap-4">
              <FilesDropzone
                label="Fotos do produto"
                hint="Recomendado: 1024px+. Formatos: WEBP/PNG/JPEG/GIF. A 1ª vira capa."
                files={files}
                setFiles={(next) => {
                  setFiles(next);
                  setImageInsights(normalizeInsightsForLen(next.length, imageInsights));
                }}
                insights={imageInsights}
                setInsights={setImageInsights}
                disabled={saving || uploading}
                maxFiles={10}
              />

              <div className="grid gap-3">
                <SoftHint title="Ordem Marto">
                  Comece com uma foto clara e frontal. Depois mostre textura,
                  detalhe, canto, composição e contexto de uso.
                </SoftHint>

                <SoftHint title="Leitura viva">
                  Use a visão rápida para transformar a foto em compreensão: o
                  que a peça transmite, resolve ou destaca.
                </SoftHint>

                <SoftHint title="Pontos relevantes">
                  Marque poucos pontos, apenas os que realmente ajudam o cliente
                  a entender a peça sem fricção.
                </SoftHint>
              </div>
            </div>
          </FormSection>
        </div>
      ) : null}

      {newStep === 'CATALOG' ? (
        <div className="grid gap-5">
          <FormSection
            eyebrow="Operação comercial"
            title="Catálogo ativo e disponibilidade"
            description="Defina o modelo comercial da peça e as escolhas reais do cliente, sem duplicar resumo e sem poluir a leitura."
          >
            <CatalogEditor
              cat={cat}
              setCat={(updater) => setCat((prev) => updater(prev))}
              disabled={saving || uploading}
            />
          </FormSection>
        </div>
      ) : null}

      {newStep === 'TECH' ? (
        <div className="grid gap-5">
          <FormSection
            eyebrow="Dado limpo"
            title="Ficha técnica e base logística"
            description="Isso aumenta confiança, ajuda no frete e transforma a peça em dado operacional mais confiável."
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-white/62">
                Preencha o que realmente ajuda o cliente e a operação.
              </div>

              {hasAnyTech(spec) ? (
                <Chip text="FICHA EM CONSTRUÇÃO" tone="good" />
              ) : (
                <Chip text="AINDA OPCIONAL" tone="neutral" />
              )}
            </div>

            <div className="grid gap-5">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="mb-4 text-sm font-semibold text-white/88">
                  Estrutura física
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Peso (kg)</span>
                    <input
                      value={spec.weightKg}
                      onChange={(e) => setSpec((p) => ({ ...p, weightKg: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 12,5"
                      disabled={saving || uploading}
                      inputMode="decimal"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Comprimento (cm)</span>
                    <input
                      value={spec.lengthCm}
                      onChange={(e) => setSpec((p) => ({ ...p, lengthCm: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
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
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
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
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 75"
                      disabled={saving || uploading}
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="mb-4 text-sm font-semibold text-white/88">
                  Rastreio comercial
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">SKU (interno)</span>
                    <input
                      value={spec.sku}
                      onChange={(e) => setSpec((p) => ({ ...p, sku: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: MESA-LUA-160"
                      disabled={saving || uploading}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Código de barras</span>
                    <input
                      value={spec.barcode}
                      onChange={(e) => setSpec((p) => ({ ...p, barcode: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: 7891234567890"
                      disabled={saving || uploading}
                      inputMode="numeric"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">Marca</span>
                    <input
                      value={spec.brand}
                      onChange={(e) => setSpec((p) => ({ ...p, brand: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: Marto Studio"
                      disabled={saving || uploading}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold text-white/65">
                      Tags (separe por vírgula)
                    </span>
                    <input
                      value={spec.tags}
                      onChange={(e) => setSpec((p) => ({ ...p, tags: e.target.value }))}
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/50 focus:border-white/30"
                      placeholder="Ex.: mesa, jantar, madeira, 6 lugares"
                      disabled={saving || uploading}
                    />
                  </label>
                </div>
              </div>

              <SoftHint title="Marto nota">
                Por enquanto, a ficha técnica ainda é salva dentro da descrição
                no padrão Marto. A base está pronta para migrar isso depois para
                campos reais no banco.
              </SoftHint>
            </div>
          </FormSection>
        </div>
      ) : null}

      {newStep === 'REVIEW' ? (
        <>
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
            const completedCount = items.filter((it) => it.done).length;

            const reviewStateLabel =
              s.score >= 85
                ? 'PEÇA FORTE'
                : s.score >= 60
                  ? 'BOA BASE'
                  : 'EM LAPIDAÇÃO';

            const reviewStateTone: 'neutral' | 'good' | 'warn' =
              s.score >= 85 ? 'good' : s.score >= 60 ? 'warn' : 'neutral';

            const kindLabel =
              cat.kind === 'PHYSICAL'
                ? 'Físico'
                : cat.kind === 'DIGITAL'
                  ? 'Digital'
                  : 'Serviço';

            const inventoryLabel =
              cat.inventoryMode === 'LIMITED' ? 'Limitado' : 'Infinito';

            return (
              <div className="grid gap-5">
                <FormSection
                  eyebrow="Pronto para nascer"
                  title="Revisão final da peça"
                  description="Aqui o Marto fecha a leitura operacional antes de publicar a nova peça no catálogo."
                >
                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white/90">
                            Maturidade da peça
                          </div>
                          <div className="mt-1 text-xs text-white/60">
                            Quanto mais completo, menos atrito, mais clareza e
                            mais confiança.
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Chip text={reviewStateLabel} tone={reviewStateTone} />
                          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
                            {s.score}/100
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-white/70"
                          style={{ width: `${s.score}%` }}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            Checklist
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white/92">
                            {completedCount}/{items.length}
                          </div>
                          <div className="mt-1 text-xs text-white/58">
                            Critérios já cumpridos
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            Estrutura
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white/92">
                            {kindLabel} • {inventoryLabel}
                          </div>
                          <div className="mt-1 text-xs text-white/58">
                            Modelo comercial atual da peça
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
                      <div className="text-sm font-semibold text-white/90">
                        Checklist operacional
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        O Marto usa esta leitura para entender o quanto a peça
                        já está pronta para nascer no catálogo.
                      </div>

                      <div className="mt-4 grid gap-3">
                        {items.map((it) => (
                          <div
                            key={it.id}
                            className="rounded-2xl border border-white/10 bg-black/35 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white/88">
                                  {it.label}
                                </div>
                                {it.hint ? (
                                  <div className="mt-1 text-xs leading-6 text-white/58">
                                    {it.hint}
                                  </div>
                                ) : null}
                              </div>

                              <Chip
                                text={it.done ? 'OK' : 'PENDENTE'}
                                tone={it.done ? 'good' : 'warn'}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Nome
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white/90">
                          {title || '—'}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Preço
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white/90">
                          {price || '—'}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Fotos
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white/90">
                          {files.length} foto(s)
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Escolhas
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white/90">
                          {cat.variants.length} combinação(ões)
                        </div>
                      </div>
                    </div>

                    {s.recs.length ? (
                      <SoftHint title="Próximos passos Marto">
                        <div className="grid gap-2">
                          {s.recs.map((r, idx) => (
                            <div key={idx} className="text-sm text-white/72">
                              • <span className="font-semibold text-white/86">{r.label}</span>
                              {r.hint ? (
                                <span className="text-white/56"> — {r.hint}</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </SoftHint>
                    ) : null}
                  </div>
                </FormSection>

                <FormSection
                  eyebrow="Confirmação"
                  title="Publicar a nova peça no catálogo"
                  description="Quando tudo estiver coerente, finalize a criação e deixe o item entrar no sistema."
                >
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/68">
                      O Marto vai criar o produto com base comercial, imagens,
                      catálogo, identidade e ficha do jeito que você estruturou
                      no painel.
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/62">
                      A ação final de criação fica fixa no rodapé do painel para
                      você revisar tudo sem perder o comando de vista.
                    </div>
                  </div>
                </FormSection>
              </div>
            );
          })()}
        </>
      ) : null}
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <MartoBackground />

      <div className="mx-auto max-w-[1480px] p-6">
        {/* HERO + ESTRUTURA */}
        <div className="mb-6 grid gap-6">
          <div className="rounded-[32px] border border-white/15 bg-neutral-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-white/92">
                      Central de Produtos
                    </h1>
                    <Chip text="Merchant OS" />
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/72">
                    No Marto, produto não é anúncio solto. É ativo operacional do ecossistema:
                    vitrine, serviço, pós-compra, reputação e dado. Aqui você prepara o catálogo
                    para vender com mais clareza e menos atrito.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openCreateSheet}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Criar produto
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('produtos-cadastrados');
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/82 hover:bg-black/55"
                  >
                    Ver catálogo
                  </button>

                  <Link
                    href="/dash/merchant"
                    className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/82 hover:bg-black/55"
                  >
                    Voltar ao dashboard
                  </Link>
                </div>
              </div>

              {msg ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/82">
                  {msg}
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                <SurfaceMetric
                  label="Catálogo total"
                  value={stats.total}
                  hint="Itens registrados no lojista"
                />

                <SurfaceMetric
                  label="Prontos (MVP)"
                  value={stats.ready}
                  hint={`${readinessPct}% do catálogo já cruzou o mínimo`}
                  tone={stats.ready > 0 ? 'good' : 'neutral'}
                />

                <SurfaceMetric
                  label="Ativos"
                  value={stats.active}
                  hint="Itens já ligados na vitrine"
                  tone={stats.active > 0 ? 'good' : 'neutral'}
                />

                <SurfaceMetric
                  label="Em lapidação"
                  value={pendingCount}
                  hint="Itens que ainda pedem acabamento"
                  tone={pendingCount > 0 ? 'warn' : 'good'}
                />
              </div>
            </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-6">
              {/* NOVO PRODUTO */}
              <div
                id="novo-produto"
                className={classNames(
                  'relative mb-6 overflow-hidden rounded-[32px] border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition',
                  createSheetOpen ? 'opacity-55 saturate-50' : 'opacity-100',
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_28%)]" />

                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        Launcher Marto
                      </div>

                      <Chip
                        text={createLauncherStatus}
                        tone={!createHasDraft ? 'neutral' : createReadinessCount >= 3 ? 'good' : 'warn'}
                      />

                      {createSheetOpen ? <Chip text="CRIADOR ABERTO" tone="warn" /> : null}
                    </div>

                    <div className="mt-3 text-2xl font-semibold tracking-tight text-white/92">
                      {createHasDraft
                        ? 'Continue a construção da peça comercial'
                        : 'Inicie uma nova peça comercial'}
                    </div>

                    <div className="mt-2 max-w-3xl text-sm leading-6 text-white/68">
                      No Marto, criar produto não é só cadastrar. É estruturar uma peça viva:
                      vitrine, disponibilidade, serviço, reputação e operação. O criador fica
                      recolhido para manter a central limpa e abrir só quando você realmente entra
                      em modo de construção.
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={openCreateSheet}
                        className="rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                      >
                        {createHasDraft ? 'Abrir criador' : 'Criar produto'}
                      </button>

                      {createHasDraft ? (
                        <button
                          type="button"
                          onClick={discardCreateDraft}
                          disabled={saving || uploading}
                          className="rounded-2xl border border-white/15 bg-black/35 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-black/50 disabled:opacity-60"
                        >
                          Descartar rascunho
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {createStructureScore.map((item) => (
                        <div
                          key={item.label}
                          className={classNames(
                            'rounded-2xl border px-4 py-3',
                            item.done
                              ? 'border-emerald-400/20 bg-emerald-400/10'
                              : 'border-white/10 bg-black/30',
                          )}
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            {item.label}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white/90">
                            {item.done ? 'OK' : 'Pendente'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                        Rascunho atual
                      </div>

                      <div className="mt-2 text-base font-semibold text-white/90">
                        {title.trim() || 'Ainda não iniciado'}
                      </div>

                      <div className="mt-2 text-sm leading-6 text-white/62">
                        {createHasDraft
                          ? 'Existe uma construção em andamento no criador lateral. Retome do ponto em que parou.'
                          : 'Sem rascunho ativo. Abra o criador quando quiser iniciar uma nova peça.'}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Fotos
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white/90">{files.length}</div>
                        <div className="mt-1 text-xs text-white/58">Imagens já ligadas ao rascunho</div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Escolhas
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white/90">{cat.variants.length}</div>
                        <div className="mt-1 text-xs text-white/58">Combinações catalogadas no rascunho</div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Etapa
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white/90">
                          {createHasDraft ? stepLabel(newStep) : 'Pronto para iniciar'}
                        </div>
                        <div className="mt-1 text-xs text-white/58">
                          Fluxo guiado sem esticar a central
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {false ? (
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
              ) : null}

            <aside className="grid h-fit gap-6 xl:sticky xl:top-6">
              <div className="rounded-[28px] border border-white/15 bg-neutral-950/78 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/90">Radar do catálogo</div>
                    <div className="mt-1 text-xs text-white/60">
                      Leitura rápida do quanto o catálogo já ganhou densidade Marto.
                    </div>
                  </div>

                  <Chip
                    text={`${readinessPct}% pronto`}
                    tone={readinessPct >= 70 ? 'good' : readinessPct > 0 ? 'warn' : 'neutral'}
                  />
                </div>

                <div className="mt-4 grid gap-3">
                  <SurfaceRail
                    label="Com foto"
                    value={stats.withImg}
                    total={stats.total}
                    tone={stats.withImg === stats.total ? 'good' : 'warn'}
                  />

                  <SurfaceRail
                    label="Com ficha"
                    value={stats.withTech}
                    total={stats.total}
                    tone={stats.withTech === stats.total ? 'good' : 'neutral'}
                  />

                  <SurfaceRail
                    label="Com catálogo"
                    value={stats.withCatalog}
                    total={stats.total}
                    tone={stats.withCatalog === stats.total ? 'good' : 'neutral'}
                  />

                  <SurfaceRail
                    label="Prontos (MVP)"
                    value={stats.ready}
                    total={stats.total}
                    tone={stats.ready > 0 ? 'good' : 'neutral'}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/15 bg-neutral-950/78 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="text-sm font-semibold text-white/90">Próximo foco Marto</div>
                <div className="mt-2 text-sm leading-6 text-white/68">{focusHint}</div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    Operação sugerida
                  </div>
                  <div className="mt-2 text-base font-semibold text-white/90">{focusTitle}</div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* LISTA */}
        <div
          id="produtos-cadastrados"
          className="rounded-[28px] border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
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

                const metaCat =
                  (p.meta?.catalog ?? null) as Partial<CatalogSpec> | null;
                const descCat = extractCatalogBlock(p.description ?? '');

                const visualVariants =
                  Array.isArray(metaCat?.variants) && metaCat.variants.length
                    ? metaCat.variants
                    : Array.isArray(descCat.variants) && descCat.variants.length
                      ? descCat.variants
                      : [];

                const visualOptions = (() => {
                  const metaOptions = Array.isArray(metaCat?.options) ? metaCat.options : [];
                  const hasMetaOptions = metaOptions.some(
                    (o) => String(o?.name ?? '').trim() && (o?.values ?? []).length,
                  );

                  return hasMetaOptions
                    ? metaOptions
                    : buildOptionsFromVariants(visualVariants);
                })();

                const colorOption = visualOptions.find((opt) =>
                  optionLooksLikeColor(String(opt?.name ?? '')),
                );

                const colorValues = uniqueStrings(
                  (colorOption?.values ?? []).map((item) => String(item ?? '').trim()),
                );

                const hasCatalog = p.meta?.catalog
                  ? true
                  : String(p.description ?? '').includes(CATALOG_MARKER_START);

                const photosCount = currentImages.length;
                const catSum = catalogSummary(metaCat);
                const insightOverview = firstNonEmptyOverview(p.imageInsights ?? []);
                const liveReadingLines = insightOverview
                  .map((line) => normalizeLiveReadingLine(line))
                  .filter(Boolean)
                  .slice(0, 3);
                const primaryColor = colorValues[0] ?? null;

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

                            {liveReadingLines.length ? (
                              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                                  Leitura viva da peça
                                </div>

                                <div className="grid gap-2">
                                  {liveReadingLines.map((line, idx) => (
                                    <div
                                      key={`${p.id}-overview-${idx}`}
                                      className={classNames(
                                        'rounded-2xl border px-3 py-2.5',
                                        idx === 0
                                          ? 'border-white/14 bg-white/[0.06]'
                                          : 'border-white/10 bg-black/40',
                                      )}
                                    >
                                      <div
                                        className={classNames(
                                          'text-xs font-semibold',
                                          idx === 0 ? 'text-white/92' : 'text-white/82',
                                        )}
                                      >
                                        {line}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

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
                                      <Chip text={variationCountLabel(catSum.variantsCount)} />
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

                                {colorValues.length ? (
                                  <div
                                    className="mt-3 rounded-2xl border p-3"
                                    style={primaryColor ? colorPresenceStyle(primaryColor) : undefined}
                                  >
                                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                                      Cor em destaque
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {colorValues.slice(0, 6).map((color, idx) => (
                                        <div
                                          key={`${p.id}-color-${idx}-${color}`}
                                          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs text-white/88"
                                        >
                                          <span className="relative flex h-5 w-5 items-center justify-center">
                                            <span
                                              className="absolute inset-0 rounded-full border"
                                              style={colorSwatchStyle(color)}
                                            />
                                            <span className="absolute inset-[3px] rounded-full bg-white/10" />
                                          </span>

                                          <span className="font-semibold text-white/92">
                                            {normalizeLiveReadingLine(color)}
                                          </span>
                                        </div>
                                      ))}

                                      {colorValues.length > 6 ? (
                                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/55">
                                          +{colorValues.length - 6}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
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
        open={createSheetOpen}
        title={title.trim() || 'Novo produto'}
        subtitle={
          createHasDraft
            ? 'Marto OS — continue a construção da peça comercial'
            : 'Marto OS — inicie a criação guiada sem esticar a central'
        }
        onClose={closeCreateSheet}
      >
        <div className="grid gap-5 pb-24">
          <div className="sticky top-0 z-20 rounded-[28px] border border-white/10 bg-neutral-950/90 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Marto OS
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="text-lg font-semibold tracking-tight text-white/92">
                    Criação guiada de produto
                  </div>

                  <Chip text={createDraftState} tone={createDraftTone} />
                  {uploadProgress ? <Chip text={`UPLOAD ${uploadProgress}`} /> : null}
                  {saving ? <Chip text="SALVANDO" tone="warn" /> : null}
                  {uploading ? <Chip text="ENVIANDO" tone="warn" /> : null}
                </div>

                <div className="mt-2 max-w-2xl text-sm leading-6 text-white/64">
                  Monte uma peça comercial viva do Marto: clareza de vitrine, disponibilidade,
                  serviço ligado e menos atrito no pós-compra.
                </div>
              </div>

              <button
                type="button"
                onClick={discardCreateDraft}
                disabled={saving || uploading}
                className="rounded-2xl border border-white/12 bg-black/35 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-black/50 disabled:opacity-60"
              >
                Descartar
              </button>
            </div>

            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/70"
                  style={{ width: `${createStepProgressPct}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/48">
                <span>
                  {createStepProgressCount}/{createStepProgressTotal} bases preenchidas
                </span>
                <span>{createStepProgressPct}%</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {stepOrder.map((s) => {
                const active = s === newStep;
                const done =
                  s !== 'REVIEW' &&
                  createStepStatus[s as keyof typeof createStepStatus];

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewStep(s)}
                    className={classNames(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      active
                        ? 'border-white/25 bg-white/10 text-white/92'
                        : done
                          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                          : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10',
                    )}
                  >
                    {stepLabel(s)}
                  </button>
                );
              })}
            </div>
          </div>

          {createWizardBody}

          <div className="sticky bottom-0 z-20 rounded-[28px] border border-white/10 bg-neutral-950/90 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/58">
                Etapa atual:{' '}
                <span className="font-semibold text-white/86">{stepLabel(newStep)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={newStep === 'BASIC' || saving || uploading}
                  className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-black/55 disabled:opacity-60"
                >
                  Voltar
                </button>

                {newStep === 'REVIEW' ? (
                  <button
                    type="button"
                    onClick={createProduct}
                    disabled={saving || uploading}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    {uploading
                      ? uploadProgress
                        ? `Enviando (${uploadProgress})…`
                        : 'Enviando…'
                      : saving
                        ? 'Salvando…'
                        : 'Criar produto'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={saving || uploading}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    Avançar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={sheetOpen && !!editingId}
        title={sheetProductTitle || 'Editar produto'}
        subtitle="Marto OS — edição profunda sem bagunçar a lista"
        onClose={() => cancelEdit()}
      >
        {editingId ? (
          <div className="grid gap-4">
            <div className="sticky top-0 z-20 rounded-[28px] border border-white/10 bg-neutral-950/90 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Marto OS
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold tracking-tight text-white/92">
                      Edição guiada de produto
                    </div>

                    <Chip text={editDraftState} tone={editDraftTone} />
                    {eUploadProgress ? <Chip text={`UPLOAD ${eUploadProgress}`} /> : null}
                    {eSaving ? <Chip text="SALVANDO" tone="warn" /> : null}
                    {eUploading ? <Chip text="ENVIANDO" tone="warn" /> : null}
                  </div>

                  <div className="mt-2 max-w-2xl text-sm leading-6 text-white/64">
                    Atualize a peça comercial sem perder a coerência do catálogo Marto.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={eSaving || eUploading}
                  className="rounded-2xl border border-white/12 bg-black/35 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-black/50 disabled:opacity-60"
                >
                  Fechar edição
                </button>
              </div>

              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white/70"
                    style={{ width: `${editStepProgressPct}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/48">
                  <span>
                    {editStepProgressCount}/{editStepProgressTotal} bases preenchidas
                  </span>
                  <span>{editStepProgressPct}%</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {editOrder.map((s) => {
                  const active = s === editStep;
                  const done =
                    s !== 'REVIEW' &&
                    editStepStatus[s as keyof typeof editStepStatus];

                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStep(s)}
                      className={classNames(
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'border-white/25 bg-white/10 text-white/92'
                          : done
                            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10',
                      )}
                    >
                      {editLabel(s)}
                    </button>
                  );
                })}
              </div>
            </div>

            {editStep === 'REVIEW' ? (
              <>
                {(() => {
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

                  const s = scoreFromChecklist(items);
                  const completedCount = items.filter((it) => it.done).length;

                  return (
                    <div className="grid gap-5">
                      <FormSection
                        eyebrow="Revisão final"
                        title="Conferir a peça antes de salvar"
                        description="Aqui o Marto fecha a leitura operacional antes de gravar a edição."
                      >
                        <div className="grid gap-4">
                          <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-white/90">
                                  Maturidade da peça
                                </div>
                                <div className="mt-1 text-xs text-white/60">
                                  Quanto mais completo, menos atrito e mais clareza.
                                </div>
                              </div>

                              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
                                {s.score}/100
                              </span>
                            </div>

                            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-white/70"
                                style={{ width: `${s.score}%` }}
                              />
                            </div>

                            <div className="mt-4 text-sm text-white/68">
                              {completedCount}/{items.length} critérios cumpridos.
                            </div>
                          </div>

                          <div className="grid gap-3">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="rounded-2xl border border-white/10 bg-black/35 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white/88">
                                      {it.label}
                                    </div>
                                    {it.hint ? (
                                      <div className="mt-1 text-xs leading-6 text-white/58">
                                        {it.hint}
                                      </div>
                                    ) : null}
                                  </div>

                                  <Chip
                                    text={it.done ? 'OK' : 'PENDENTE'}
                                    tone={it.done ? 'good' : 'warn'}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => void saveEdit()}
                            disabled={eSaving || eUploading}
                            className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                          >
                            {eUploading
                              ? eUploadProgress
                                ? `Enviando (${eUploadProgress})…`
                                : 'Enviando…'
                              : eSaving
                                ? 'Salvando…'
                                : 'Salvar alterações'}
                          </button>
                        </div>
                      </FormSection>
                    </div>
                  );
                })()}
              </>
            ) : null}

            {/* CAMPOS BÁSICOS */}
            {editStep === 'BASIC' ? (
              <div className="grid gap-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      Nome
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white/90">
                      {eTitle.trim() || 'Ainda não definido'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      Preço
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white/90">
                      {ePrice.trim() ? `R$ ${ePrice.trim()}` : 'Ainda não definido'}
                    </div>
                  </div>
                </div>

                <FormSection
                  eyebrow="Essência da peça"
                  title="Base comercial do produto"
                  description="Ajuste nome, descrição e preço sem quebrar a identidade comercial da peça."
                >
                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/84">Nome do produto</span>
                      <input
                        value={eTitle}
                        onChange={(e) => setETitle(e.target.value)}
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                        disabled={eSaving || eUploading}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/84">Descrição</span>
                      <textarea
                        value={eDesc}
                        onChange={(e) => setEDesc(e.target.value)}
                        rows={4}
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                        disabled={eSaving || eUploading}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/84">Preço (R$)</span>
                      <input
                        value={ePrice}
                        onChange={(e) => setEPrice(e.target.value)}
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                        disabled={eSaving || eUploading}
                        inputMode="decimal"
                      />
                    </label>
                  </div>
                </FormSection>

                <FormSection
                  eyebrow="Ecossistema ligado"
                  title="Serviços associados ao produto"
                  description="Ajuste os serviços que entram no ciclo real da peça."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PRODUCT_SERVICE_OPTIONS.map((option) => {
                      const selected = eProductServices.includes(option.key);

                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => toggleEditProductService(option.key)}
                          className={classNames(
                            'rounded-2xl border px-4 py-4 text-left transition',
                            selected
                              ? 'border-emerald-400/20 bg-emerald-400/10'
                              : 'border-white/12 bg-black/35 hover:bg-black/50',
                          )}
                          disabled={eSaving || eUploading}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-white/88">
                              {option.label}
                            </div>
                            <Chip
                              text={selected ? 'Ligado' : 'Opcional'}
                              tone={selected ? 'good' : 'neutral'}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </FormSection>

                <FormSection
                  eyebrow="Identidade pública"
                  title="Handle e rastreio da peça"
                  description="Mantenha a identidade pública estável e legível."
                >
                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/84">Handle público</span>
                      <input
                        value={eIdn.handle}
                        onChange={(e) => setEIdn({ handle: e.target.value })}
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                        disabled={eSaving || eUploading}
                      />
                    </label>

                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                        Prévia
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/90">
                        /p/{slugifyMarto(eIdn.handle || eTitle) || 'sua-peca'}
                      </div>
                    </div>
                  </div>
                </FormSection>

                <FormSection
                  eyebrow="DNA operacional"
                  title="Rastreio interno da peça"
                  description="Ajuste SKU raiz, coleção e versão operacional."
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/84">SKU raiz</span>
                      <input
                        value={eDna.skuRoot}
                        onChange={(e) => setEDna((p) => ({ ...p, skuRoot: e.target.value }))}
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                        disabled={eSaving || eUploading}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/84">Coleção / linha</span>
                      <input
                        value={eDna.collection}
                        onChange={(e) =>
                          setEDna((p) => ({ ...p, collection: e.target.value }))
                        }
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                        disabled={eSaving || eUploading}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/84">Versão</span>
                      <input
                        value={eDna.version}
                        onChange={(e) => setEDna((p) => ({ ...p, version: e.target.value }))}
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/92 outline-none focus:border-white/30"
                        disabled={eSaving || eUploading}
                      />
                    </label>
                  </div>
                </FormSection>
              </div>
            ) : null}

            {editStep === 'PHOTOS' ? (
              (() => {
                const eFocusedKeepIdx =
                  ePhotoEditorIdx !== null && eKeepImages[ePhotoEditorIdx]
                    ? ePhotoEditorIdx
                    : 0;
                const eFocusedKeepSrc = eKeepImages[eFocusedKeepIdx] ?? null;
                const eFocusedKeepRole = normalizePhotoRole(
                  eKeepInsights[eFocusedKeepIdx]?.role,
                  eFocusedKeepIdx,
                );
                const eFocusedKeepRoleMeta = photoRoleMeta(eFocusedKeepRole);
                const eFocusedKeepHotspots = normalizeHotspots(
                  eKeepInsights[eFocusedKeepIdx]?.hotspots,
                );
                const eFocusedSelectedHotspot =
                  eHotspotSelectedIdx !== null
                    ? eFocusedKeepHotspots[eHotspotSelectedIdx] ?? null
                    : null;

                return (
                  <div className="grid gap-5">
                    <FormSection
                      eyebrow="Imagem viva"
                      title="Fotos atuais e leitura visual"
                      description="Trabalhe a peça em foto grande: função da imagem, leitura viva e pontos de leitura."
                    >
                      {eKeepImages.length ? (
                        <div className="grid gap-4">
                          <div className="overflow-x-auto pb-1">
                            <div className="flex min-w-max gap-3">
                              {eKeepImages.map((src, idx) => {
                                const role = normalizePhotoRole(eKeepInsights[idx]?.role, idx);
                                const roleMeta = photoRoleMeta(role);
                                const hotspotsCount = normalizeHotspots(
                                  eKeepInsights[idx]?.hotspots,
                                ).length;
                                const active = idx === eFocusedKeepIdx;

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
                                      setEPhotoEditorIdx(dragOverIdx);
                                      setDragFromIdx(null);
                                      setDragOverIdx(null);
                                    }}
                                    className={classNames(
                                      'w-[96px] shrink-0 rounded-2xl border p-2 transition',
                                      active
                                        ? 'border-white/30 bg-white/[0.06]'
                                        : 'border-white/10 bg-black/35',
                                    )}
                                    style={{
                                      cursor: eSaving || eUploading ? 'default' : 'grab',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEPhotoEditorIdx(idx);
                                        setEPhotoEditorTab('overview');
                                        setEHotspotSelectedIdx(null);
                                      }}
                                      className="block w-full text-left"
                                    >
                                      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={toPublicImageUrl(src)}
                                          alt={`Foto ${idx + 1}`}
                                          className="h-20 w-full object-cover"
                                        />
                                        <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/82 backdrop-blur">
                                          {roleMeta.label}
                                        </div>
                                      </div>
                                      <div className="mt-2 text-[11px] font-semibold text-white/75">
                                        Foto {idx + 1}
                                      </div>
                                      <div className="mt-1 text-[10px] text-white/50">
                                        {hotspotsCount} ponto(s)
                                      </div>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {eFocusedKeepSrc ? (
                            <>
                              <div className="rounded-[28px] border border-white/12 bg-black/30 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-white/90">Foto em foco</div>
                                    <div className="mt-1 text-xs text-white/60">
                                      Trabalhe a leitura viva e os pontos direto em uma imagem maior.
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Chip text={eFocusedKeepRoleMeta.label.toUpperCase()} />
                                    <Chip text={`${eFocusedKeepHotspots.length} PONTO(S)`} />
                                  </div>
                                </div>

                                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/12 bg-black">
                                  <div
                                    className="relative"
                                    onClick={(e) => {
                                      if (ePhotoEditorTab !== 'hotspots') return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const x = clampPct(((e.clientX - rect.left) / rect.width) * 100);
                                      const y = clampPct(((e.clientY - rect.top) / rect.height) * 100);
                                      const nextPoint: HotspotDraft = {
                                        x,
                                        y,
                                        title: '',
                                        description: '',
                                        kind: 'difference',
                                      };

                                      const nextIndex = eFocusedKeepHotspots.length;
                                      setEKeepInsights((prev) => {
                                        const next = normalizeInsightsForLen(eKeepImages.length, prev);
                                        const cur = next[eFocusedKeepIdx] ?? {
                                          role: normalizePhotoRole(undefined, eFocusedKeepIdx),
                                          overview: ['', '', ''],
                                          hotspots: [],
                                        };
                                        next[eFocusedKeepIdx] = {
                                          ...cur,
                                          hotspots: [...normalizeHotspots(cur.hotspots), nextPoint],
                                        };
                                        return next;
                                      });
                                      setEPhotoEditorIdx(eFocusedKeepIdx);
                                      setEHotspotSelectedIdx(nextIndex);
                                    }}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={toPublicImageUrl(eFocusedKeepSrc)}
                                      alt={`Foto ${eFocusedKeepIdx + 1}`}
                                      className="max-h-[52vh] w-full object-contain"
                                    />
                                    {eFocusedKeepHotspots.map((hs, pointIdx) => {
                                      const active = eHotspotSelectedIdx === pointIdx;
                                      return (
                                        <span
                                          key={`${pointIdx}-${hs.x}-${hs.y}`}
                                          className="absolute -translate-x-1/2 -translate-y-1/2"
                                          style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                                        >
                                          <span
                                            className={classNames(
                                              'relative block h-6 w-6 rounded-full border',
                                              active
                                                ? 'border-white/80 bg-white/25'
                                                : 'border-white/55 bg-white/12',
                                            )}
                                          >
                                            <span className="absolute inset-[4px] rounded-full bg-white/95" />
                                          </span>
                                        </span>
                                      );
                                    })}
                                    <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-semibold text-white/84 backdrop-blur">
                                      {ePhotoEditorTab === 'hotspots'
                                        ? 'clique na imagem para criar um ponto de leitura'
                                        : eFocusedKeepRoleMeta.label}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                                  <div className="text-sm font-semibold text-white/90">
                                    Direção visual da foto
                                  </div>
                                  <div className="mt-1 text-xs text-white/60">
                                    Defina o papel da imagem e a leitura viva da peça.
                                  </div>

                                  <div className="mt-4 grid gap-3">
                                    <label className="grid gap-2">
                                      <span className="text-xs font-semibold text-white/65">Função da foto</span>
                                      <select
                                        value={eFocusedKeepRole}
                                        onChange={(e) => {
                                          const nextRole = e.target.value as PhotoRole;
                                          setEKeepInsights((prev) => {
                                            const next = normalizeInsightsForLen(eKeepImages.length, prev);
                                            const cur = next[eFocusedKeepIdx] ?? {
                                              role: normalizePhotoRole(undefined, eFocusedKeepIdx),
                                              overview: ['', '', ''],
                                              hotspots: [],
                                            };
                                            next[eFocusedKeepIdx] = { ...cur, role: nextRole };
                                            return next;
                                          });
                                        }}
                                        className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm font-semibold text-white/88 outline-none focus:border-white/30"
                                      >
                                        <option value="cover">Capa</option>
                                        <option value="detail">Detalhe</option>
                                        <option value="material">Material</option>
                                        <option value="context">Contexto</option>
                                        <option value="structure">Estrutura</option>
                                        <option value="finish">Acabamento</option>
                                      </select>
                                    </label>

                                    <label className="grid gap-2">
                                      <span className="text-xs font-semibold text-white/65">Legenda curta</span>
                                      <input
                                        value={eKeepCaptions[eFocusedKeepIdx] ?? ''}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setEKeepCaptions((prev) => {
                                            const next = [...prev];
                                            next[eFocusedKeepIdx] = v;
                                            return next;
                                          });
                                        }}
                                        className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                                        disabled={eSaving || eUploading}
                                      />
                                    </label>

                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEPhotoEditorTab('overview');
                                          setEHotspotSelectedIdx(null);
                                        }}
                                        className={classNames(
                                          'rounded-2xl border px-4 py-2 text-xs font-semibold',
                                          ePhotoEditorTab === 'overview'
                                            ? 'border-white/30 bg-white/10 text-white'
                                            : 'border-white/15 bg-white/5 text-white/80',
                                        )}
                                      >
                                        Leitura viva
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEPhotoEditorTab('hotspots');
                                          setEHotspotSelectedIdx(eFocusedKeepHotspots.length ? 0 : null);
                                        }}
                                        className={classNames(
                                          'rounded-2xl border px-4 py-2 text-xs font-semibold',
                                          ePhotoEditorTab === 'hotspots'
                                            ? 'border-white/30 bg-white/10 text-white'
                                            : 'border-white/15 bg-white/5 text-white/80',
                                        )}
                                      >
                                        Pontos de leitura
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEKeepImages((prev) => prev.filter((_, i) => i !== eFocusedKeepIdx));
                                          setEKeepCaptions((prev) => prev.filter((_, i) => i !== eFocusedKeepIdx));
                                          setEKeepInsights((prev) => prev.filter((_, i) => i !== eFocusedKeepIdx));
                                          setEPhotoEditorIdx(
                                            eKeepImages.length - 1 > 0 ? Math.max(0, eFocusedKeepIdx - 1) : null,
                                          );
                                          setEHotspotSelectedIdx(null);
                                        }}
                                        className="rounded-2xl border border-white/15 bg-black/35 px-4 py-2 text-xs font-semibold text-white/80"
                                        disabled={eSaving || eUploading}
                                      >
                                        Remover foto
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                                  {ePhotoEditorTab === 'overview' ? (
                                    <div className="grid gap-3">
                                      {[0, 1, 2].map((k) => (
                                        <label key={`keep-overview-${eFocusedKeepIdx}-${k}`} className="grid gap-2">
                                          <span className="text-xs font-semibold text-white/65">
                                            {k === 0
                                              ? 'O que esta foto prova'
                                              : k === 1
                                                ? 'O que esta foto transmite'
                                                : 'O que esta foto reduz de dúvida'}
                                          </span>
                                          <input
                                            value={eKeepInsights[eFocusedKeepIdx]?.overview?.[k] ?? ''}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setEKeepInsights((prev) => {
                                                const next = normalizeInsightsForLen(eKeepImages.length, prev);
                                                const cur = next[eFocusedKeepIdx] ?? {
                                                  role: normalizePhotoRole(undefined, eFocusedKeepIdx),
                                                  overview: ['', '', ''],
                                                  hotspots: [],
                                                };
                                                const ov = normalizeOverview3(cur.overview);
                                                ov[k] = v;
                                                next[eFocusedKeepIdx] = { ...cur, overview: ov };
                                                return next;
                                              });
                                            }}
                                            className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="grid gap-3">
                                      {eFocusedKeepHotspots.map((hs, pointIdx) => (
                                        <button
                                          key={`keep-list-${pointIdx}-${hs.x}-${hs.y}`}
                                          type="button"
                                          onClick={() => setEHotspotSelectedIdx(pointIdx)}
                                          className={classNames(
                                            'w-full rounded-2xl border px-3 py-3 text-left',
                                            eHotspotSelectedIdx === pointIdx
                                              ? 'border-white/35 bg-white/[0.06]'
                                              : 'border-white/10 bg-white/[0.03]',
                                          )}
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-white/88">
                                              {hs.title || `Ponto ${pointIdx + 1}`}
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/60">
                                              {hotspotKindMeta(normalizeHotspotKind(hs.kind)).label}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                      {eFocusedSelectedHotspot ? (
                                        <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/35 p-3">
                                          <select
                                            value={normalizeHotspotKind(eFocusedSelectedHotspot.kind)}
                                            onChange={(e) => {
                                              if (eHotspotSelectedIdx === null) return;
                                              setEKeepInsights((prev) => {
                                                const next = normalizeInsightsForLen(eKeepImages.length, prev);
                                                const cur = next[eFocusedKeepIdx] ?? {
                                                  role: normalizePhotoRole(undefined, eFocusedKeepIdx),
                                                  overview: ['', '', ''],
                                                  hotspots: [],
                                                };
                                                const hs = normalizeHotspots(cur.hotspots);
                                                hs[eHotspotSelectedIdx] = {
                                                  ...hs[eHotspotSelectedIdx]!,
                                                  kind: normalizeHotspotKind(e.target.value),
                                                };
                                                next[eFocusedKeepIdx] = { ...cur, hotspots: hs };
                                                return next;
                                              });
                                            }}
                                            className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90"
                                          >
                                            <option value="material">Material</option>
                                            <option value="finish">Acabamento</option>
                                            <option value="structure">Estrutura</option>
                                            <option value="comfort">Conforto</option>
                                            <option value="measure">Proporção</option>
                                            <option value="difference">Diferencial</option>
                                          </select>
                                          <input
                                            value={eFocusedSelectedHotspot.title}
                                            onChange={(e) => {
                                              if (eHotspotSelectedIdx === null) return;
                                              setEKeepInsights((prev) => {
                                                const next = normalizeInsightsForLen(eKeepImages.length, prev);
                                                const cur = next[eFocusedKeepIdx] ?? {
                                                  role: normalizePhotoRole(undefined, eFocusedKeepIdx),
                                                  overview: ['', '', ''],
                                                  hotspots: [],
                                                };
                                                const hs = normalizeHotspots(cur.hotspots);
                                                hs[eHotspotSelectedIdx] = {
                                                  ...hs[eHotspotSelectedIdx]!,
                                                  title: e.target.value,
                                                };
                                                next[eFocusedKeepIdx] = { ...cur, hotspots: hs };
                                                return next;
                                              });
                                            }}
                                            className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90"
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm text-white/64">
                          Nenhuma foto atual. Adicione novas imagens abaixo para construir a peça.
                        </div>
                      )}
                    </FormSection>

                    <FormSection
                      eyebrow="Novas imagens"
                      title="Adicionar fotos ao produto"
                      description="As novas fotos entram junto das atuais e também podem receber leitura viva."
                    >
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
                    </FormSection>
                  </div>
                );
              })()
            ) : null}

            {/* FOTOS ATUAIS */}
            {false ? (
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

                              <div className="mt-2 grid gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEPhotoEditorIdx(idx);
                                    setEPhotoEditorTab('overview');
                                    setEHotspotSelectedIdx(null);
                                  }}
                                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/15"
                                  disabled={eSaving || eUploading}
                                >
                                  Visão rápida
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEPhotoEditorIdx(idx);
                                    setEPhotoEditorTab('hotspots');
                                    const hs = normalizeHotspots(
                                      eKeepInsights[idx]?.hotspots,
                                    );
                                    setEHotspotSelectedIdx(hs.length ? 0 : null);
                                  }}
                                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/15"
                                  disabled={eSaving || eUploading}
                                >
                                  Pontos relevantes
                                </button>

                                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-white/60">
                                  {normalizeHotspots(eKeepInsights[idx]?.hotspots)
                                    .length}{' '}
                                  ponto(s) • foto {idx + 1}
                                </div>
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

                                  if (ePhotoEditorIdx === idx) {
                                    setEPhotoEditorIdx(null);
                                    setEPhotoEditorTab('overview');
                                    setEHotspotSelectedIdx(null);
                                  } else if (
                                    ePhotoEditorIdx !== null &&
                                    ePhotoEditorIdx > idx
                                  ) {
                                    setEPhotoEditorIdx(ePhotoEditorIdx - 1);
                                  }
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

                  {ePhotoEditorIdx !== null && eKeepImages[ePhotoEditorIdx!] ? (
                    <div className="mt-5 rounded-3xl border border-white/15 bg-black/35 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white/90">
                            Editor da foto atual selecionada
                          </div>
                          <div className="mt-1 text-xs text-white/65">
                            A miniatura seleciona a foto. A edição profunda
                            acontece aqui embaixo.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setEPhotoEditorIdx(null);
                            setEPhotoEditorTab('overview');
                            setEHotspotSelectedIdx(null);
                          }}
                          className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                        >
                          Fechar editor
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEPhotoEditorTab('overview')}
                          className={classNames(
                            'rounded-2xl border px-4 py-2 text-xs font-semibold',
                            ePhotoEditorTab === 'overview'
                              ? 'border-white/30 bg-white/10 text-white'
                              : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
                          )}
                        >
                          Visão rápida
                        </button>

                        <button
                          type="button"
                          onClick={() => setEPhotoEditorTab('hotspots')}
                          className={classNames(
                            'rounded-2xl border px-4 py-2 text-xs font-semibold',
                            ePhotoEditorTab === 'hotspots'
                              ? 'border-white/30 bg-white/10 text-white'
                              : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
                          )}
                        >
                          Pontos relevantes
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <div>
                          <div
                            className="relative overflow-hidden rounded-3xl border border-white/15 bg-black"
                            onClick={(e) => {
                              if (ePhotoEditorTab !== 'hotspots') return;

                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = clampPct(
                                ((e.clientX - rect.left) / rect.width) * 100,
                              );
                              const y = clampPct(
                                ((e.clientY - rect.top) / rect.height) * 100,
                              );

                              const nextPoint: HotspotDraft = {
                                x,
                                y,
                                title: '',
                                description: '',
                              };

                              const nextIndex = eCurrentEditingHotspots.length;

                              setEKeepInsights((prev) => {
                                const next = normalizeInsightsForLen(
                                  eKeepImages.length,
                                  prev,
                                );
                                const cur = next[ePhotoEditorIdx!] ?? {
                                  overview: ['', '', ''],
                                  hotspots: [],
                                };
                                next[ePhotoEditorIdx!] = {
                                  ...cur,
                                  hotspots: [
                                    ...normalizeHotspots(cur.hotspots),
                                    nextPoint,
                                  ],
                                };
                                return next;
                              });

                              setEHotspotSelectedIdx(nextIndex);
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={toPublicImageUrl(eKeepImages[ePhotoEditorIdx!])}
                              alt={`Foto atual ${ePhotoEditorIdx! + 1}`}
                              className="h-auto w-full object-cover"
                            />

                            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.14),rgba(0,0,0,0.03))]" />

                            {eCurrentEditingHotspots.map((hs, pointIdx) => {
                              const active = eHotspotSelectedIdx === pointIdx;

                              return (
                                <span
                                  key={`${pointIdx}-${hs.x}-${hs.y}`}
                                  className="absolute -translate-x-1/2 -translate-y-1/2"
                                  style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                                >
                                  <span
                                    className={classNames(
                                      'relative block h-5 w-5 rounded-full border',
                                      active
                                        ? 'border-white/80 bg-white/25'
                                        : 'border-white/55 bg-white/12',
                                    )}
                                  >
                                    <span className="absolute inset-[3px] rounded-full bg-white/95" />
                                  </span>
                                </span>
                              );
                            })}

                            <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white/82 backdrop-blur">
                              {ePhotoEditorTab === 'hotspots'
                                ? 'clique para adicionar ponto'
                                : 'foto atual selecionada'}
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-white/60">
                            {ePhotoEditorTab === 'hotspots'
                              ? 'Use poucos pontos e só em detalhes realmente relevantes.'
                              : 'Essas 3 linhas viram a leitura rápida da foto na página pública.'}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                          {ePhotoEditorTab === 'overview' ? (
                            <>
                              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/56">
                                visão rápida da foto
                              </div>

                              <div className="mt-3 grid gap-3">
                                {[0, 1, 2].map((k) => (
                                  <label
                                    key={`keep-overview-${ePhotoEditorIdx}-${k}`}
                                    className="grid gap-2"
                                  >
                                    <span className="text-xs font-semibold text-white/65">
                                      Linha {k + 1}
                                    </span>
                                    <input
                                      value={
                                        eKeepInsights[ePhotoEditorIdx!]
                                          ?.overview?.[k] ?? ''
                                      }
                                      onChange={(e) => {
                                        const v = e.target.value;

                                        setEKeepInsights((prev) => {
                                          const next = normalizeInsightsForLen(
                                            eKeepImages.length,
                                            prev,
                                          );
                                          const cur = next[ePhotoEditorIdx!] ?? {
                                            overview: ['', '', ''],
                                            hotspots: [],
                                          };
                                          const ov = normalizeOverview3(
                                            cur.overview,
                                          );
                                          ov[k] = v;
                                          next[ePhotoEditorIdx!] = {
                                            ...cur,
                                            overview: ov,
                                          };
                                          return next;
                                        });
                                      }}
                                      maxLength={60}
                                      placeholder={
                                        k === 0
                                          ? 'Linha 1'
                                          : k === 1
                                            ? 'Linha 2'
                                            : 'Linha 3'
                                      }
                                      className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                                      disabled={eSaving || eUploading}
                                    />
                                  </label>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/56">
                                pontos desta foto
                              </div>

                              {eCurrentEditingHotspots.length === 0 ? (
                                <div className="mt-3 text-sm text-white/65">
                                  Ainda não há pontos nesta foto.
                                </div>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  {eCurrentEditingHotspots.map((hs, pointIdx) => (
                                    <button
                                      key={`keep-list-${pointIdx}-${hs.x}-${hs.y}`}
                                      type="button"
                                      onClick={() =>
                                        setEHotspotSelectedIdx(pointIdx)
                                      }
                                      className={classNames(
                                        'w-full rounded-2xl border px-3 py-3 text-left',
                                        eHotspotSelectedIdx === pointIdx
                                          ? 'border-white/35 bg-white/[0.06]'
                                          : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                                      )}
                                    >
                                      <div className="text-sm font-semibold text-white/88">
                                        {hs.title || `Ponto ${pointIdx + 1}`}
                                      </div>
                                      <div className="mt-1 text-[11px] text-white/56">
                                        X {Math.round(hs.x)}% • Y{' '}
                                        {Math.round(hs.y)}%
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {eCurrentSelectedHotspot ? (
                                <div className="mt-4 border-t border-white/10 pt-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-white/88">
                                      Editar ponto {eHotspotSelectedIdx! + 1}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          ePhotoEditorIdx === null ||
                                          eHotspotSelectedIdx === null
                                        )
                                          return;

                                        setEKeepInsights((prev) => {
                                          const next = normalizeInsightsForLen(
                                            eKeepImages.length,
                                            prev,
                                          );
                                          const cur = next[ePhotoEditorIdx] ?? {
                                            overview: ['', '', ''],
                                            hotspots: [],
                                          };
                                          next[ePhotoEditorIdx] = {
                                            ...cur,
                                            hotspots: normalizeHotspots(
                                              cur.hotspots,
                                            ).filter(
                                              (_, i) =>
                                                i !== eHotspotSelectedIdx,
                                            ),
                                          };
                                          return next;
                                        });

                                        const nextLen =
                                          eCurrentEditingHotspots.length - 1;
                                        setEHotspotSelectedIdx(
                                          nextLen > 0 ? 0 : null,
                                        );
                                      }}
                                      className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-400/15"
                                    >
                                      Remover ponto
                                    </button>
                                  </div>

                                  <div className="mt-3 grid gap-3">
                                    <label className="grid gap-2">
                                      <span className="text-xs font-semibold text-white/65">
                                        Título
                                      </span>
                                      <input
                                        value={eCurrentSelectedHotspot!.title}
                                        onChange={(e) => {
                                          if (
                                            ePhotoEditorIdx === null ||
                                            eHotspotSelectedIdx === null
                                          )
                                            return;

                                          setEKeepInsights((prev) => {
                                            const next =
                                              normalizeInsightsForLen(
                                                eKeepImages.length,
                                                prev,
                                              );
                                            const cur =
                                              next[ePhotoEditorIdx] ?? {
                                                overview: ['', '', ''],
                                                hotspots: [],
                                              };
                                            const hs = normalizeHotspots(
                                              cur.hotspots,
                                            );
                                            hs[eHotspotSelectedIdx] = {
                                              ...hs[eHotspotSelectedIdx]!,
                                              title: e.target.value,
                                            };
                                            next[ePhotoEditorIdx] = {
                                              ...cur,
                                              hotspots: hs,
                                            };
                                            return next;
                                          });
                                        }}
                                        placeholder="Ex.: Braço"
                                        className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                                      />
                                    </label>

                                    <label className="grid gap-2">
                                      <span className="text-xs font-semibold text-white/65">
                                        Descrição
                                      </span>
                                      <textarea
                                        value={
                                          eCurrentSelectedHotspot!.description
                                        }
                                        onChange={(e) => {
                                          if (
                                            ePhotoEditorIdx === null ||
                                            eHotspotSelectedIdx === null
                                          )
                                            return;

                                          setEKeepInsights((prev) => {
                                            const next =
                                              normalizeInsightsForLen(
                                                eKeepImages.length,
                                                prev,
                                              );
                                            const cur =
                                              next[ePhotoEditorIdx] ?? {
                                                overview: ['', '', ''],
                                                hotspots: [],
                                              };
                                            const hs = normalizeHotspots(
                                              cur.hotspots,
                                            );
                                            hs[eHotspotSelectedIdx] = {
                                              ...hs[eHotspotSelectedIdx]!,
                                              description: e.target.value,
                                            };
                                            next[ePhotoEditorIdx] = {
                                              ...cur,
                                              hotspots: hs,
                                            };
                                            return next;
                                          });
                                        }}
                                        placeholder="Ex.: MDF laminado, acabamento nogueira."
                                        rows={4}
                                        className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                                      />
                                    </label>

                                    <div className="grid grid-cols-2 gap-3">
                                      <label className="grid gap-2">
                                        <span className="text-xs font-semibold text-white/65">
                                          Posição X
                                        </span>
                                        <input
                                          value={eCurrentSelectedHotspot!.x}
                                          onChange={(e) => {
                                            if (
                                              ePhotoEditorIdx === null ||
                                              eHotspotSelectedIdx === null
                                            )
                                              return;

                                            setEKeepInsights((prev) => {
                                              const next =
                                                normalizeInsightsForLen(
                                                  eKeepImages.length,
                                                  prev,
                                                );
                                              const cur =
                                                next[ePhotoEditorIdx] ?? {
                                                  overview: ['', '', ''],
                                                  hotspots: [],
                                                };
                                              const hs = normalizeHotspots(
                                                cur.hotspots,
                                              );
                                              hs[eHotspotSelectedIdx] = {
                                                ...hs[eHotspotSelectedIdx]!,
                                                x: clampPct(
                                                  Number(e.target.value),
                                                ),
                                              };
                                              next[ePhotoEditorIdx] = {
                                                ...cur,
                                                hotspots: hs,
                                              };
                                              return next;
                                            });
                                          }}
                                          inputMode="decimal"
                                          className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                                        />
                                      </label>

                                      <label className="grid gap-2">
                                        <span className="text-xs font-semibold text-white/65">
                                          Posição Y
                                        </span>
                                        <input
                                          value={eCurrentSelectedHotspot!.y}
                                          onChange={(e) => {
                                            if (
                                              ePhotoEditorIdx === null ||
                                              eHotspotSelectedIdx === null
                                            )
                                              return;

                                            setEKeepInsights((prev) => {
                                              const next =
                                                normalizeInsightsForLen(
                                                  eKeepImages.length,
                                                  prev,
                                                );
                                              const cur =
                                                next[ePhotoEditorIdx] ?? {
                                                  overview: ['', '', ''],
                                                  hotspots: [],
                                                };
                                              const hs = normalizeHotspots(
                                                cur.hotspots,
                                              );
                                              hs[eHotspotSelectedIdx] = {
                                                ...hs[eHotspotSelectedIdx]!,
                                                y: clampPct(
                                                  Number(e.target.value),
                                                ),
                                              };
                                              next[ePhotoEditorIdx] = {
                                                ...cur,
                                                hotspots: hs,
                                              };
                                              return next;
                                            });
                                          }}
                                          inputMode="decimal"
                                          className="rounded-2xl border border-white/15 bg-black/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
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
              <div className="grid gap-5">
                <FormSection
                  eyebrow="Operação comercial"
                  title="Catálogo ativo e disponibilidade"
                  description="Ajuste o modelo comercial da peça e as escolhas reais do cliente."
                >
                  <CatalogEditor
                    cat={eCat}
                    setCat={(updater) => setECat((prev) => updater(prev))}
                    disabled={eSaving || eUploading}
                  />
                </FormSection>
              </div>
            ) : null}

            {/* FICHA TÉCNICA (EDIÇÃO) */}
            {editStep === 'TECH' ? (
              <div className="grid gap-5">
                <FormSection
                  eyebrow="Dado limpo"
                  title="Ficha técnica e base logística"
                  description="Mantenha a peça confiável para frete, operação e entendimento comercial."
                >
                  <div className="grid gap-5">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="mb-4 text-sm font-semibold text-white/88">
                        Estrutura física
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">Peso (kg)</span>
                          <input
                            value={eSpec.weightKg}
                            onChange={(e) =>
                              setESpec((x) => ({ ...x, weightKg: e.target.value }))
                            }
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">
                            Comprimento (cm)
                          </span>
                          <input
                            value={eSpec.lengthCm}
                            onChange={(e) =>
                              setESpec((x) => ({ ...x, lengthCm: e.target.value }))
                            }
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">Largura (cm)</span>
                          <input
                            value={eSpec.widthCm}
                            onChange={(e) =>
                              setESpec((x) => ({ ...x, widthCm: e.target.value }))
                            }
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">Altura (cm)</span>
                          <input
                            value={eSpec.heightCm}
                            onChange={(e) =>
                              setESpec((x) => ({ ...x, heightCm: e.target.value }))
                            }
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="mb-4 text-sm font-semibold text-white/88">
                        Rastreio comercial
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">SKU (interno)</span>
                          <input
                            value={eSpec.sku}
                            onChange={(e) => setESpec((x) => ({ ...x, sku: e.target.value }))}
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">
                            Código de barras
                          </span>
                          <input
                            value={eSpec.barcode}
                            onChange={(e) =>
                              setESpec((x) => ({ ...x, barcode: e.target.value }))
                            }
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">Marca</span>
                          <input
                            value={eSpec.brand}
                            onChange={(e) =>
                              setESpec((x) => ({ ...x, brand: e.target.value }))
                            }
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs font-semibold text-white/65">Tags</span>
                          <input
                            value={eSpec.tags}
                            onChange={(e) => setESpec((x) => ({ ...x, tags: e.target.value }))}
                            className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white/90 outline-none focus:border-white/30"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </FormSection>

                <FormSection
                  eyebrow="Leitura logística"
                  title="Diagnóstico real do produto"
                  description="Use essa leitura para entender o que o backend já enxerga da peça."
                >
                  {editShippingLoading ? (
                    <p className="text-sm text-white/70">Analisando logística...</p>
                  ) : editShippingError ? (
                    <p className="text-sm text-rose-300">{editShippingError}</p>
                  ) : editShippingOptions ? (
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            Porte
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white/90">
                            {editShippingOptions.analysis.shippingSize}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            Modo principal
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white/90">
                            {editShippingOptions.suggestedPrimaryShippingMode ?? '—'}
                          </div>
                        </div>
                      </div>

                      <SoftHint title="Motivo da análise">
                        {editShippingOptions.analysis.reason}
                      </SoftHint>
                    </div>
                  ) : (
                    <p className="text-sm text-white/65">Sem leitura logística carregada.</p>
                  )}
                </FormSection>
              </div>
            ) : null}

            <div className="sticky bottom-0 z-20 rounded-[28px] border border-white/10 bg-neutral-950/90 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-white/58">
                  Etapa atual:{' '}
                  <span className="font-semibold text-white/86">{editLabel(editStep)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={editPrev}
                    disabled={editStep === 'BASIC' || eSaving || eUploading}
                    className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-black/55 disabled:opacity-60"
                  >
                    Voltar
                  </button>

                  {editStep === 'REVIEW' ? (
                    <button
                      type="button"
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
                          : 'Salvar alterações'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={editNext}
                      disabled={eSaving || eUploading}
                      className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                    >
                      Avançar
                    </button>
                  )}
                </div>
              </div>
            </div>
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
      </div>
    </main>
  );
}
