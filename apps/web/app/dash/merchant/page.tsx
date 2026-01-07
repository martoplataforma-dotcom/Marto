'use client';

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
  createdAt?: string;
};

type ProductsResponse = {
  ok: boolean;
  items: ProductItem[];
};

// ✅ sem any
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
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-black">{value}</div>
    </div>
  );
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
        }),
      });

      if (!res?.ok) {
        setProductsMsg(res?.message ?? 'Não foi possível criar o produto.');
        return;
      }

      setPTitle('');
      setPPrice('');

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
    <main className="min-h-screen bg-white">
      <div className="w-full px-6 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-500">
            Lojista • Marto
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/dash/merchant#perfil-loja"
              className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Meu perfil
            </a>

            <a
              href="/profile"
              className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Configurações
            </a>

            <button
              onClick={() => {
                localStorage.removeItem('marto_access');
                window.location.href = '/login';
              }}
              className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-zinc-950 p-8 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                {showName}
                <span className="opacity-60">•</span>
                reputação vira venda
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

                <a
                  href="/demo/catalog"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Ver catálogo (demo)
                </a>

                <a
                  href="/review"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Ver avaliações (MVP)
                </a>

                <a
                  href="/choose-role"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Adicionar outro papel
                </a>
              </div>

              {msg ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90">
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

        <div className="mt-6 rounded-3xl border bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold">Status da loja</div>
              <div className="mt-1 text-sm text-zinc-600">
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

        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <a
            href="/review"
            className="rounded-3xl border bg-white p-7 transition hover:bg-zinc-50 lg:col-span-7"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Prioridade do Marto
            </div>
            <div className="mt-2 text-2xl font-bold">Reputação</div>
            <div className="mt-2 text-sm text-zinc-600">
              Avaliações e histórico real. Aqui é onde confiança vira venda.
            </div>

            <div className="mt-6 rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              Você está no início. Quando acontecerem as primeiras interações
              reais, sua reputação começa a se formar.
            </div>

            <div className="mt-6 text-xs font-semibold text-zinc-700">
              Abrir →
            </div>
          </a>

          <div className="grid gap-4 lg:col-span-5">
            <ActionCard
              title="Produtos"
              desc="No MVP, usamos catálogo demo. Depois vira catálogo real da sua loja."
              href="/demo/catalog"
            />
            <ActionCard
              title="Pedidos"
              desc="Simular fluxo de pedido e acompanhar status."
              href="/demo"
            />
          </div>
        </div>

        <div id="produtos" className="mt-6 rounded-3xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Produtos</div>
              <div className="mt-1 text-sm text-zinc-600">
                Comece simples: cadastre os primeiros itens e depois a gente
                evolui para gestão completa.
              </div>
            </div>

            {/* ✅ CONTADOR + LINK (caminho oficial) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border px-4 py-2 text-sm font-semibold text-zinc-700">
                {productsLoading ? 'Carregando…' : `${products.length} produto(s)`}
              </div>

              <a
                href="/dash/merchant/products"
                className="rounded-2xl border px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Gerenciar todos →
              </a>
            </div>
          </div>

          {productsMsg ? (
            <div className="mt-4 rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              {productsMsg}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-12">
            <label className="sm:col-span-6">
              <span className="text-sm font-semibold">Nome do produto</span>
              <input
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                placeholder="Ex: Cadeira Madeira"
                className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={productsLoading || pSaving}
              />
            </label>

            <label className="sm:col-span-4">
              <span className="text-sm font-semibold">Preço (R$)</span>
              <input
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                placeholder="Ex: 299.90"
                className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={productsLoading || pSaving}
                inputMode="decimal"
              />
            </label>

            <div className="sm:col-span-2 flex items-end">
              <button
                onClick={createProductQuick}
                disabled={productsLoading || pSaving}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pSaving ? 'Criando…' : 'Adicionar'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {productsLoading ? (
              <div className="rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                Buscando seus produtos…
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                Você ainda não tem produtos cadastrados.
              </div>
            ) : (
              products.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {p.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {p.active ? 'Ativo' : 'Inativo'} • R${' '}
                      {(p.priceCents / 100).toFixed(2)}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-zinc-600">
                    Ver detalhes → (em breve)
                  </div>
                </div>
              ))
            )}
          </div>

          {!productsLoading && products.length > 3 ? (
            <div className="mt-4 text-sm text-zinc-600">
              Mostrando 3 mais recentes. Gestão completa em breve.
            </div>
          ) : null}
        </div>

        <div id="perfil-loja" className="mt-6 rounded-3xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Perfil da loja</div>
              <div className="mt-1 text-sm text-zinc-600">
                Essas informações definem como sua loja aparece para clientes no
                Marto.
              </div>
            </div>

            <button
              onClick={onSave}
              disabled={loading || saving || !canSave}
              className="rounded-2xl bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Nome da loja</span>
              <input
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Loja Marto"
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={loading}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">CNPJ</span>
              <input
                value={formatCnpjDigits(docNumber)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
                  setDocNumber(digits);
                }}
                placeholder="00.000.000/0000-00"
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={loading}
                inputMode="numeric"
              />
              <span className="text-xs text-zinc-500">
                O Marto exige CNPJ para vender produtos e emitir nota fiscal.
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Cidade (opcional)</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Ubá"
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={loading}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                CEP (prefixo) — opcional
              </span>
              <input
                value={cepPrefix}
                onChange={(e) =>
                  setCepPrefix(e.target.value.replace(/\D/g, '').slice(0, 5))
                }
                placeholder="Ex: 36500"
                className="rounded-2xl border px-4 py-3 outline-none focus:border-black"
                disabled={loading}
                inputMode="numeric"
              />
              <span className="text-xs text-zinc-500">
                Se não souber, deixe em branco.
              </span>
            </label>
          </div>
        </div>
      </div>
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
    <a
      href={href}
      className="rounded-3xl border bg-white p-6 transition hover:bg-zinc-50"
    >
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-2 text-sm text-zinc-600">{desc}</div>
      <div className="mt-6 text-xs font-semibold text-zinc-700">Abrir →</div>
    </a>
  );
}
