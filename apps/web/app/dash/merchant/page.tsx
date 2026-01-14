'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function formatCnpjDigits(digits: string) {
  const d = String(digits ?? '')
    .replace(/\D/g, '')
    .slice(0, 14);

  // 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      '$1.$2.$3/$4-$5',
    );
}

type Merchant = {
  tradeName?: string | null;
  legalName?: string | null;
  document?: string | null;
  city?: string | null;
  cepPrefix?: string | null;
  status?: string | null;
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

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-black">{value}</div>
    </div>
  );
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

export default function MerchantDash() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const canSave = useMemo(() => {
    if (!tradeName.trim()) return false;
    if (!/^\d{14}$/.test(docNumber)) return false;
    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) return false;
    return true;
  }, [tradeName, docNumber, cepPrefix]);

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

    setSaving(true);
    try {
      await fetchJSON('/merchants/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradeName: tradeName.trim() || null,
          document: docNumber.trim() || null,
          city: city.trim() || null,
          cepPrefix: cepPrefix.trim() || null,
        }),
      });

      setMsg('Loja salva com sucesso.');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  // ✅ faz upload e devolve pathname "/uploads/arquivo.ext"
  async function uploadProductImage(file: File): Promise<string | null> {
    setProductsMsg('');
    setPUploading(true);

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

      const res = await fetchJSON<CreateProductResponse>(
        '/merchants/me/products',
        {
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
        },
      );

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

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      {/* fundo Marto (radial gradients) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        {/* Topbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white/80">
            Lojista • Marto
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/dash/merchant#perfil-loja"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Meu perfil
            </a>

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

        {/* Hero */}
        <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                {showName}
                <span className="text-white/65">•</span>
                <span className="text-white/75">reputação vira venda</span>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Painel do Lojista
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
                No Marto, cada experiência registrada vira confiança — e
                confiança vira conversão.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    document.getElementById('perfil-loja')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Editar perfil da loja
                </button>

                <Link
                  href="/dash/merchant/orders"
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Ver vendas
                </Link>

                <a
                  href="/review"
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Ver avaliações (MVP)
                </a>

                <a
                  href="/choose-role"
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Adicionar outro papel
                </a>
              </div>

              {msg ? (
                <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  {msg}
                </div>
              ) : null}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[520px]">
              <Chip label="Tipo" value="Lojista" />
              <Chip label="Status" value={statusLabel(data?.status)} />
              <Chip label="Cidade" value={String(showCity)} />
              <Chip label="CEP (prefixo)" value={String(showCep)} />
            </div>
          </div>
        </div>

        {/* Status da loja */}
        <div className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold text-white/90">
                Status da loja
              </div>
              <div className="mt-1 text-sm text-white/75">
                No MVP, alguns módulos são demo. O foco agora é preparar o
                perfil e registrar as primeiras experiências.
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[760px] lg:grid-cols-4">
              <StatusChip label="Perfil" value="✅ Básico" />
              <StatusChip label="Produtos" value="🧪 Demo" />
              <StatusChip label="Pedidos" value="🧪 Simulação" />
              <StatusChip label="Reputação" value="⏳ Iniciando" />
            </div>
          </div>
        </div>

        {/* Prioridade + Ações */}
        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <a
            href="/review"
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-neutral-950/80 lg:col-span-7"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Prioridade do Marto
            </div>
            <div className="mt-2 text-2xl font-bold text-white/95">
              Reputação
            </div>
            <div className="mt-2 text-sm text-white/75">
              Avaliações e histórico real. Aqui é onde confiança vira venda.
            </div>

            <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
              Você está no início. Quando acontecerem as primeiras interações
              reais, sua reputação começa a se formar.
            </div>

            <div className="mt-6 text-xs font-semibold text-white/80">
              Abrir →
            </div>
          </a>

          <div className="grid gap-4 lg:col-span-5">
            <ActionCard
              title="Produtos"
              desc="No MVP, você já cadastra itens e evolui para gestão completa."
              href="/dash/merchant/products"
            />
            <ActionCard
              title="Vendas"
              desc="Acompanhe pedidos recebidos, timeline e ações do lojista."
              href="/dash/merchant/orders"
            />
          </div>
        </div>

        {/* Produtos */}
        <div
          id="produtos"
          className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white/90">Produtos</div>
              <div className="mt-1 text-sm text-white/75">
                Comece simples: cadastre os primeiros itens e depois a gente
                evolui para gestão completa.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                {productsLoading
                  ? 'Carregando…'
                  : `${products.length} produto(s)`}
              </div>

              <a
                href="/dash/merchant/products"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Gerenciar todos →
              </a>
            </div>
          </div>

          {productsMsg ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {productsMsg}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-12">
            <label className="sm:col-span-5">
              <span className="text-sm font-semibold text-white/85">
                Nome do produto
              </span>
              <input
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                placeholder="Ex: Cadeira Madeira"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                disabled={productsLoading || pSaving || pUploading}
              />
            </label>

            <label className="sm:col-span-3">
              <span className="text-sm font-semibold text-white/85">
                Preço (R$)
              </span>
              <input
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                placeholder="Ex: 299.90"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/65 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                disabled={productsLoading || pSaving || pUploading}
                inputMode="decimal"
              />
            </label>

            {/* Foto */}
            <label className="sm:col-span-3">
              <span className="text-sm font-semibold text-white/85">
                Foto (opcional)
              </span>
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

          <div className="mt-5 grid gap-3">
            {productsLoading ? (
              <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                Buscando seus produtos…
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                Você ainda não tem produtos cadastrados.
              </div>
            ) : (
              products.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-start gap-3">
                        {Array.isArray(p.images) && p.images.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxSrc(
                                `http://localhost:3001${p.images![0]}`,
                              );
                              setLightboxAlt(p.title);
                              setLightboxOpen(true);
                            }}
                            className="shrink-0"
                            title="Ampliar imagem"
                          >
                            <Image
                              src={`http://localhost:3001${p.images[0]}`}
                              unoptimized
                              alt={p.title}
                              width={56}
                              height={56}
                              className="h-14 w-14 rounded-xl border border-white/15 object-cover hover:opacity-90"
                            />
                          </button>
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                            <span className="text-[10px] font-semibold text-white/70">
                              Sem foto
                            </span>
                          </div>
                        )}

                        <div>
                          <div className="text-sm font-semibold text-white/90">
                            {p.title}
                          </div>

                          <div className="mt-1 text-xs text-white/75">
                            {p.active ? 'Ativo' : 'Inativo'} • R${' '}
                            {(p.priceCents / 100).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-white/75">
                      Ver detalhes → (em breve)
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {!productsLoading && products.length > 3 ? (
            <div className="mt-4 text-sm text-white/75">
              Mostrando 3 mais recentes. Gestão completa em breve.
            </div>
          ) : null}
        </div>

        {/* Perfil da loja */}
        <div
          id="perfil-loja"
          className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white/90">
                Perfil da loja
              </div>
              <div className="mt-1 text-sm text-white/75">
                Essas informações definem como sua loja aparece para clientes no
                Marto.
              </div>
            </div>

            <button
              onClick={onSave}
              disabled={loading || saving || !canSave}
              className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
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
                  unoptimized
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
