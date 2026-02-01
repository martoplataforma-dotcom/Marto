// apps/web/app/dash/merchant/profile/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

// ✅ API pode vir como http://localhost:3001/api
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
// ✅ assets NÃO podem usar /api (uploads ficam em /uploads)
const ASSETS_URL = API_URL.replace(/\/api\/?$/, '');

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function formatCnpjDigits(digits: string) {
  const d = String(digits ?? '')
    .replace(/\D/g, '')
    .slice(0, 14);

  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      '$1.$2.$3/$4-$5',
    );
}

function moneyFromCentsBRL(cents: number) {
  const n = Number(cents ?? 0) / 100;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function isRemoteHttp(src: string) {
  return /^https?:\/\//i.test(src);
}

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

function statusLabel(status?: string | null) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'Ativa';
  if (s === 'REVIEW') return 'Em análise';
  if (s === 'BLOCKED') return 'Bloqueada';
  return '—';
}

function initialsFromName(name?: string | null) {
  const s = String(name ?? '').trim();
  if (!s) return 'M';
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'M';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return (a + b).toUpperCase();
}

// ✅ PASSO 2 — normalização e validação do handle (MVP local)
function normalizeHandle(input: string) {
  // remove espaços + @ + acentos, mantém [a-z0-9._-]
  const raw = String(input ?? '').trim().replace(/^@+/, '');
  const noSpaces = raw.replace(/\s+/g, '');
  const lower = noSpaces.toLowerCase();

  // remove acentos (NFD) e caracteres inválidos
  const deAccented = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = deAccented.replace(/[^a-z0-9._-]/g, '');

  // evita começo/fim com separador
  const trimmed = cleaned.replace(/^[._-]+/, '').replace(/[._-]+$/, '');

  // colapsa repetição exagerada (--- / ___ / ..)
  const collapsed = trimmed
    .replace(/\.{2,}/g, '.')
    .replace(/_{2,}/g, '_')
    .replace(/-{2,}/g, '-');

  return collapsed;
}

function validateHandle(handle: string) {
  const h = String(handle ?? '');

  if (!h) return { ok: true, msg: '' }; // handle opcional no MVP
  if (h.length < 3) return { ok: false, msg: 'Mínimo 3 caracteres.' };
  if (h.length > 24) return { ok: false, msg: 'Máximo 24 caracteres.' };

  // começa com letra/número, permitido [a-z0-9._-]
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(h)) {
    return { ok: false, msg: 'Use apenas a-z, 0-9, ponto, _ e hífen.' };
  }

  // evita “..” ou “__” ou “--” já colapsamos, mas garante:
  if (/[._-]{2,}/.test(h)) {
    return { ok: false, msg: 'Evite separadores repetidos.' };
  }

  // evita parecer arquivo escondido / só pontuação
  if (/^[._-]+$/.test(h)) return { ok: false, msg: 'Handle inválido.' };

  return { ok: true, msg: '' };
}

function SectionTitle({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
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

type Merchant = {
  id?: string;
  tradeName?: string | null;
  legalName?: string | null;
  document?: string | null;
  city?: string | null;
  cepPrefix?: string | null;
  status?: string | null;

  // ✅ NOVO
  handle?: string | null;

  logoUrl?: string | null;
  coverUrl?: string | null;
};

type ProductItem = {
  id: string;
  title: string;
  priceCents: number;
  active: boolean;
  images?: string[] | null;
  createdAt?: string;
};

type ProductsResponse = {
  ok: boolean;
  items: ProductItem[];
};

export default function MerchantProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [data, setData] = useState<Merchant | null>(null);

  const [tradeName, setTradeName] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [handle, setHandle] = useState(''); // ✅ NOVO
  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [brandingUploading, setBrandingUploading] = useState(false);

  // ✅ Produtos (para checklist + preview)
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const normalizedHandle = useMemo(() => normalizeHandle(handle), [handle]);
  const handleValidation = useMemo(
    () => validateHandle(normalizedHandle),
    [normalizedHandle],
  );

  const canSave = useMemo(() => {
    if (!tradeName.trim()) return false;
    if (!/^\d{14}$/.test(docNumber)) return false;
    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) return false;
    if (!handleValidation.ok) return false;
    return true;
  }, [tradeName, docNumber, cepPrefix, handleValidation.ok]);

  useEffect(() => {
    (async () => {
      setMsg('');
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
        setHandle(m.handle ?? ''); // ✅ NOVO
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
        } catch {
          setProducts([]);
        } finally {
          setProductsLoading(false);
        }
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar o perfil da loja.');
        setData(null);
        setProducts([]);
        setProductsLoading(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSave() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token. Faça login novamente.');
      return;
    }

    if (!/^\d{14}$/.test(docNumber)) {
      setMsg('CNPJ inválido. Informe 14 números (somente dígitos).');
      return;
    }

    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) {
      setMsg('CEP (prefixo) deve ter 5 números (ex: 36500).');
      return;
    }

    if (!handleValidation.ok) {
      setMsg(handleValidation.msg || 'Handle inválido.');
      return;
    }

    setSaving(true);
    try {
      const updated = await fetchJSON<Merchant>('/merchants/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradeName: tradeName.trim() || null,
          document: docNumber.trim() || null,
          handle: normalizedHandle || null, // ✅ salva normalizado
          city: city.trim() || null,
          cepPrefix: cepPrefix.trim() || null,
          logoUrl: logoUrl ?? null,
          coverUrl: coverUrl ?? null,
        }),
      });

      setData(updated);
      setHandle(updated.handle ?? normalizedHandle); // ✅ mantém normalizado
      setLogoUrl(updated.logoUrl ?? logoUrl ?? null);
      setCoverUrl(updated.coverUrl ?? coverUrl ?? null);
      setMsg('Perfil salvo com sucesso.');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File): Promise<string | null> {
    setMsg('');
    setBrandingUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      // ✅ usa rewrite do Next: /api -> http://localhost:3001/api
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

      return rel;
    } catch {
      setMsg('Erro ao enviar imagem.');
      return null;
    } finally {
      setBrandingUploading(false);
    }
  }

  async function uploadAndApply(kind: 'logo' | 'cover') {
    const f = kind === 'logo' ? logoFile : coverFile;
    if (!f) return;

    const rel = await uploadFile(f);
    if (!rel) return;

    if (kind === 'logo') setLogoUrl(rel);
    else setCoverUrl(rel);

    setMsg('Imagem enviada. Clique em “Salvar” para gravar no perfil.');
  }

  const showName = tradeName.trim() || data?.tradeName || 'Minha Loja';

  const coverAbs = assetUrl(coverUrl);
  const logoAbs = assetUrl(logoUrl);

  // ✅ usa o handle digitado (normalizado) para preview imediato
  const previewHandle = normalizedHandle || (data?.handle ?? '');
  const publicShopHref = previewHandle
    ? `/@${previewHandle}`
    : data?.id
      ? `/shop/merchant/${data.id}`
      : '/catalog';

  const publicLinkLabel = previewHandle ? `/@${previewHandle}` : '/@seu-handle';

  const previewProducts = useMemo(() => {
    const active = products.filter((p) => p.active);

    const sorted = [...active].sort((a, b) => {
      const da = a.createdAt ? Date.parse(a.createdAt) : 0;
      const db = b.createdAt ? Date.parse(b.createdAt) : 0;
      return db - da;
    });

    return sorted.slice(0, 3);
  }, [products]);

  const profileProgress = useMemo(() => {
    const hasName = Boolean(tradeName.trim());
    const hasCnpj = /^\d{14}$/.test(docNumber);
    const hasRegion =
      Boolean(city.trim()) || (cepPrefix ? /^\d{5}$/.test(cepPrefix) : false);

    const hasHandle = Boolean(previewHandle);
    const hasLogo = Boolean(assetUrl(logoUrl));
    const hasCover = Boolean(assetUrl(coverUrl));

    const hasProductWithPhoto = products.some((p) => {
      const rel = p.images?.[0] ?? null;
      return Boolean(assetUrl(rel));
    });

    const steps = [
      { ok: hasName, title: 'Nome da loja', desc: 'É como você aparece pro cliente.' },
      { ok: hasCnpj, title: 'CNPJ válido', desc: 'Base pra vender com confiança e NF.' },
      { ok: hasHandle, title: '@handle público', desc: 'Link curto e memorável da sua vitrine.' },
      { ok: hasRegion, title: 'Região', desc: 'Cidade e/ou CEP ajudam a entregar melhor.' },
      { ok: hasLogo, title: 'Logo', desc: 'Deixa sua loja “profissional” no primeiro contato.' },
      { ok: hasCover, title: 'Capa', desc: 'Faz a vitrine parecer grande e confiável.' },
      { ok: hasProductWithPhoto, title: 'Produto com foto', desc: 'Foto real aumenta conversão e reputação.' },
    ];

    const total = steps.length;
    const done = steps.filter((s) => s.ok).length;
    const pct = Math.round((done / total) * 100);

    return { steps, done, total, pct };
  }, [tradeName, docNumber, city, cepPrefix, logoUrl, coverUrl, products, previewHandle]);

  async function copyPublicLink() {
    try {
      const path = previewHandle ? `/@${previewHandle}` : '/@seu-handle';
      // não invento domínio — usa o origin atual
      const full = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
      await navigator.clipboard.writeText(full);
      setMsg('Link público copiado ✅');
    } catch {
      setMsg('Não consegui copiar. Selecione e copie manualmente.');
    }
  }

  function openPreview() {
    if (typeof window === 'undefined') return;
    window.open(publicShopHref, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        {/* Topbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white/80">
            Lojista • Meu perfil
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dash/merchant"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Voltar ao painel
            </Link>

            <button
              type="button"
              onClick={openPreview}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              title="Abre a vitrine em nova aba (preview)"
            >
              Abrir vitrine →
            </button>

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

        {/* Card principal */}
        <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-2xl font-bold tracking-tight text-white/95">
                Perfil da loja
              </div>
              <div className="mt-1 text-sm text-white/75">
                Identidade visual + dados. Isso aparece na vitrine pública.
              </div>
            </div>

            <button
              onClick={onSave}
              disabled={loading || saving || !canSave}
              className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          {msg ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {msg}
            </div>
          ) : null}

          {/* Identidade visual */}
          <div className="mt-6 grid gap-4 lg:grid-cols-12">
            {/* Capa */}
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 lg:col-span-7">
              <SectionTitle
                title="Identidade • Capa"
                desc="Imagem horizontal para o topo da vitrine (recomendado: 1600×600)."
              />

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black">
                <div className="relative aspect-[16/6] w-full">
                  {coverAbs ? (
                    <Image
                      src={coverAbs}
                      unoptimized={isRemoteHttp(coverAbs)}
                      alt="Capa da loja"
                      fill
                      className="object-cover"
                      sizes="100vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/70">
                      Sem capa
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-[10px] text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
                  disabled={loading || brandingUploading}
                />

                <button
                  type="button"
                  onClick={() => uploadAndApply('cover')}
                  disabled={loading || brandingUploading || !coverFile}
                  className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {brandingUploading ? 'Enviando…' : 'Enviar capa'}
                </button>
              </div>
            </div>

            {/* Logo */}
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 lg:col-span-5">
              <SectionTitle
                title="Identidade • Logo"
                desc="Avatar da loja (recomendado: PNG quadrado 512×512)."
              />

              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white/20 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                  {logoAbs ? (
                    <Image
                      src={logoAbs}
                      unoptimized={isRemoteHttp(logoAbs)}
                      alt="Logo da loja"
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="text-xl font-black tracking-tight text-white/90">
                        {initialsFromName(showName)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                    className="w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-[10px] text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
                    disabled={loading || brandingUploading}
                  />

                  <button
                    type="button"
                    onClick={() => uploadAndApply('logo')}
                    disabled={loading || brandingUploading || !logoFile}
                    className="mt-3 rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {brandingUploading ? 'Enviando…' : 'Enviar logo'}
                  </button>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/70">
                Dica: logo limpo (fundo transparente) passa confiança instantânea.
              </div>
            </div>
          </div>

          {/* Dados */}
          <div className="mt-6 rounded-3xl border border-white/15 bg-white/5 p-5">
            <SectionTitle
              title="Dados da loja"
              desc="Esses dados aparecem no perfil público e ajudam entrega + confiança."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/85">
                  Nome da loja
                </span>
                <input
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Ex: Loja Marto"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                  disabled={loading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/85">CNPJ</span>
                <input
                  value={formatCnpjDigits(docNumber)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
                    setDocNumber(digits);
                  }}
                  placeholder="00.000.000/0000-00"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                  disabled={loading}
                  inputMode="numeric"
                />
                <span className="text-xs text-white/70">
                  O Marto exige CNPJ para vender produtos e emitir nota fiscal.
                </span>
              </label>

              {/* ✅ NOVO: handle */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/85">
                  @handle público
                </span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="ex: store5"
                  className={`rounded-2xl border bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:ring-2 ${
                    handleValidation.ok
                      ? 'border-white/15 focus:border-white/25 focus:ring-white/10'
                      : 'border-rose-500/60 focus:border-rose-500/80 focus:ring-rose-500/15'
                  }`}
                  disabled={loading}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-white/70">
                    Link público:{' '}
                    <span className="font-semibold text-white/85">
                      {publicLinkLabel}
                    </span>
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyPublicLink}
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                      title="Copiar link"
                    >
                      Copiar
                    </button>

                    <button
                      type="button"
                      onClick={openPreview}
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                      title="Abrir preview"
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {!handleValidation.ok ? (
                  <span className="text-xs font-semibold text-rose-300/90">
                    {handleValidation.msg}
                  </span>
                ) : normalizedHandle && normalizedHandle !== handle ? (
                  <span className="text-xs text-white/70">
                    Vamos salvar como:{' '}
                    <span className="font-semibold text-white/85">
                      {normalizedHandle}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-white/70">
                    Dica: curto, memorável, sem acento. (ex: <b>lojamarto</b>)
                  </span>
                )}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/85">
                  Cidade (opcional)
                </span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Ubá"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                  disabled={loading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/85">
                  CEP (prefixo) — opcional
                </span>
                <input
                  value={cepPrefix}
                  onChange={(e) =>
                    setCepPrefix(e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  placeholder="Ex: 36500"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                  disabled={loading}
                  inputMode="numeric"
                />
                <span className="text-xs text-white/70">
                  Se não souber, deixe em branco.
                </span>
              </label>
            </div>
          </div>

          {/* Preview + Checklist */}
          <div className="mt-6 grid gap-4 lg:grid-cols-12">
            {/* Preview */}
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 lg:col-span-7">
              <SectionTitle
                title="Como o cliente vê sua loja"
                desc="Prévia rápida do que aparece na vitrine pública."
                right={
                  <Link
                    href={publicShopHref}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                  >
                    Abrir vitrine →
                  </Link>
                }
              />

              <div className="mt-4 overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75">
                <div className="relative h-28 w-full">
                  {coverAbs ? (
                    <Image
                      src={coverAbs}
                      unoptimized={isRemoteHttp(coverAbs)}
                      alt="Capa (prévia)"
                      fill
                      className="object-cover"
                      sizes="100vw"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_20%_10%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(900px_320px_at_80%_0%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.75))]" />
                      <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
                    </>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent" />
                </div>

                <div className="-mt-8 flex items-end gap-3 p-5">
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                    {logoAbs ? (
                      <Image
                        src={logoAbs}
                        unoptimized={isRemoteHttp(logoAbs)}
                        alt="Logo (prévia)"
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-sm font-black text-white/90">
                        {initialsFromName(showName)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-base font-bold text-white/95">
                      {showName}
                    </div>
                    <div className="mt-0.5 text-xs text-white/75">
                      {city?.trim() ? city.trim() : '—'} • CEP{' '}
                      {cepPrefix?.trim() ? cepPrefix.trim() : '—'} • Status:{' '}
                      {statusLabel(data?.status)}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-white/70">
                      Link: {publicLinkLabel}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/15 p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                    Destaques
                  </div>

                  <div className="mt-3 grid gap-2">
                    {productsLoading ? (
                      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
                        Carregando produtos…
                      </div>
                    ) : previewProducts.length === 0 ? (
                      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
                        Nenhum produto ativo ainda. Cadastre pelo menos 1 com foto.
                      </div>
                    ) : (
                      previewProducts.map((p) => {
                        const img = assetUrl(p.images?.[0] ?? null);

                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/15 bg-black">
                                {img ? (
                                  <Image
                                    src={img}
                                    unoptimized={isRemoteHttp(img)}
                                    alt={p.title}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-white/70">
                                    Sem foto
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white/90">
                                  {p.title}
                                </div>
                                <div className="mt-0.5 text-xs text-white/75">
                                  R$ {moneyFromCentsBRL(p.priceCents)}
                                </div>
                              </div>
                            </div>

                            <div className="text-[11px] font-semibold text-white/70">
                              Ver →
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 text-sm text-white/70">
                    Dica:{' '}
                    <span className="font-semibold text-white/85">
                      logo + capa + foto real
                    </span>{' '}
                    aumentam confiança logo no primeiro contato.
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 lg:col-span-5">
              <SectionTitle
                title="Checklist de crescimento"
                desc="O que deixa sua loja “pronta” pra vender melhor."
                right={
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/85">
                    {profileProgress.done}/{profileProgress.total}
                  </div>
                }
              />

              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full border border-white/15 bg-black/40">
                  <div
                    className="h-full bg-white"
                    style={{ width: `${profileProgress.pct}%` }}
                    aria-label={`Progresso do perfil: ${profileProgress.pct}%`}
                  />
                </div>
                <div className="mt-2 text-xs text-white/70">
                  {profileProgress.pct}% completo • quanto mais completo, mais
                  confiança e melhor ranqueamento (MVP).
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {profileProgress.steps.map((s) => (
                  <ProgressRow key={s.title} ok={s.ok} title={s.title} desc={s.desc} />
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/80">
                No Marto, reputação vira ativo: o básico bem feito hoje vira
                vantagem amanhã.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
