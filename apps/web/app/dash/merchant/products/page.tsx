'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  images?: string[] | null;
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

// ✅ NOVO: chip pequeno
function MiniChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
      {text}
    </span>
  );
}

export default function MerchantProductsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);

  // form novo produto
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // ✅ Foto (upload)
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eSaving, setESaving] = useState(false);

  // ✅ foto (edição)
  const [eFile, setEFile] = useState<File | null>(null);
  const [eUploading, setEUploading] = useState(false);

  // ✅ lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');

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

  async function uploadImageIfAny(): Promise<string[] | null> {
    if (!file) return null;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

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

      return [rel];
    } catch {
      setMsg('Erro ao enviar imagem.');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function uploadEditImageIfAny(): Promise<string[] | null> {
    if (!eFile) return null;

    setEUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', eFile);

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

      return [rel];
    } catch {
      setMsg('Erro ao enviar foto (edição).');
      return null;
    } finally {
      setEUploading(false);
    }
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
      const images = await uploadImageIfAny();
      if (file && !images) return;

      const res = await fetchJSON<CreateProductResponse>('/merchants/me/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priceCents,
          images: images ?? null,
        }),
      });

      if (!res.ok) {
        setMsg(res.message || 'Erro ao criar produto.');
        return;
      }

      setTitle('');
      setDescription('');
      setPrice('');
      setFile(null);

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
      const res = await fetchJSON<UpdateProductResponse>(
        `/merchants/me/products/${id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ active: nextActive }),
        },
      );

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

  function startEdit(p: ProductItem) {
    setMsg('');
    setEditingId(p.id);
    setETitle(p.title ?? '');
    setEDesc(p.description ?? '');
    setEPrice((p.priceCents / 100).toFixed(2).replace('.', ','));
    setEFile(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setETitle('');
    setEDesc('');
    setEPrice('');
    setEFile(null);
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

    const newImages = await uploadEditImageIfAny();
    if (eFile && !newImages) return;

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
            description: eDesc.trim() || null,
            priceCents,
            images: newImages ?? undefined,
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
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Erro ao salvar.');
    } finally {
      setESaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Gerencie os anúncios da sua loja no Marto.
            </p>
          </div>

          <Link
            href="/dash/merchant"
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {/* MENSAGEM */}
        {msg ? (
          <div className="mb-4 rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {msg}
          </div>
        ) : null}

        {/* NOVO PRODUTO */}
        <div className="mb-6 rounded-3xl border bg-white p-6">
          <div className="text-lg font-semibold">Novo anúncio</div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Nome do produto</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={saving || uploading}
              />
            </label>

            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Descrição</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                rows={3}
                disabled={saving || uploading}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Preço (R$)</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={saving || uploading}
                inputMode="decimal"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Foto (opcional)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                }}
                className="rounded-2xl border px-4 py-[10px] text-sm outline-none"
                disabled={saving || uploading}
              />
              {file ? (
                <span className="text-xs text-zinc-500">Selecionada: {file.name}</span>
              ) : null}
            </label>

            <div className="flex items-end sm:col-span-2">
              <button
                onClick={createProduct}
                disabled={saving || uploading}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {uploading ? 'Enviando imagem…' : saving ? 'Salvando…' : 'Criar produto'}
              </button>
            </div>
          </div>
        </div>

        {/* LISTA */}
        <div className="rounded-3xl border bg-white p-6">
          <div className="text-lg font-semibold">
            Produtos cadastrados ({products.length})
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              <div className="text-sm text-zinc-600">Carregando…</div>
            ) : products.length === 0 ? (
              <div className="text-sm text-zinc-600">Nenhum produto cadastrado ainda.</div>
            ) : (
              products.map((p) => {
                const hasImg = Array.isArray(p.images) && p.images.length > 0;
                const first = hasImg ? String(p.images?.[0] ?? '') : '';
                const imgUrl = hasImg ? toPublicImageUrl(first) : '';

                return (
                  <div key={p.id} className="rounded-2xl border px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          {/* ✅ THUMB + LIGHTBOX */}
                          {hasImg ? (
                            <button
                              type="button"
                              onClick={() => {
                                setLightboxSrc(imgUrl);
                                setLightboxAlt(p.title);
                                setLightboxOpen(true);
                              }}
                              className="shrink-0"
                              title="Ampliar imagem"
                            >
                              <Image
                                src={imgUrl}
                                alt={p.title}
                                width={48}
                                height={48}
                                unoptimized
                                className="h-12 w-12 rounded-xl border object-cover hover:opacity-90"
                              />
                            </button>
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200 bg-zinc-900/5 flex items-center justify-center">
                              <span className="text-[10px] font-semibold text-zinc-500">
                                Sem foto
                              </span>
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="font-semibold">{p.title}</div>
                            <div className="text-xs text-zinc-600">
                              R${' '}
                              {(p.priceCents / 100).toFixed(2).replace('.', ',')} •{' '}
                              {p.active ? 'Ativo' : 'Inativo'}
                              <span className="ml-2">
                                {hasImg ? (
                                  <MiniChip text="COM FOTO" />
                                ) : (
                                  <MiniChip text="SEM FOTO" />
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {editingId === p.id ? (
                          <div className="mt-3 grid gap-3">
                            <label className="grid gap-2">
                              <span className="text-xs font-semibold text-zinc-600">
                                Título
                              </span>
                              <input
                                value={eTitle}
                                onChange={(e) => setETitle(e.target.value)}
                                className="rounded-2xl border px-4 py-2 text-sm outline-none focus:border-black"
                                disabled={eSaving || eUploading}
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-xs font-semibold text-zinc-600">
                                Descrição
                              </span>
                              <textarea
                                value={eDesc}
                                onChange={(e) => setEDesc(e.target.value)}
                                className="rounded-2xl border px-4 py-2 text-sm outline-none focus:border-black"
                                rows={3}
                                disabled={eSaving || eUploading}
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-xs font-semibold text-zinc-600">
                                Preço (R$)
                              </span>
                              <input
                                value={ePrice}
                                onChange={(e) => setEPrice(e.target.value)}
                                className="rounded-2xl border px-4 py-2 text-sm outline-none focus:border-black"
                                disabled={eSaving || eUploading}
                                inputMode="decimal"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-xs font-semibold text-zinc-600">
                                Foto (opcional)
                              </span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  setEFile(f);
                                }}
                                className="rounded-2xl border px-4 py-[10px] text-sm outline-none"
                                disabled={eSaving || eUploading}
                              />
                              {eFile ? (
                                <span className="text-xs text-zinc-500">
                                  Selecionada: {eFile.name}
                                </span>
                              ) : null}
                            </label>

                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={eSaving || eUploading}
                                className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {eUploading ? 'Enviando…' : eSaving ? 'Salvando…' : 'Salvar'}
                              </button>

                              <button
                                onClick={cancelEdit}
                                disabled={eSaving || eUploading}
                                className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-60"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(p.id, !p.active)}
                          className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-zinc-50"
                        >
                          {p.active ? 'Desativar' : 'Ativar'}
                        </button>

                        <button
                          onClick={() => startEdit(p)}
                          className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-zinc-50"
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

      {/* ✅ LIGHTBOX */}
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
              className="absolute right-2 top-2 rounded-xl bg-black/60 px-3 py-2 text-xs font-semibold text-white hover:bg-black/70"
              aria-label="Fechar"
            >
              ✕
            </button>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
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
                <div className="border-t border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white/90">
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
