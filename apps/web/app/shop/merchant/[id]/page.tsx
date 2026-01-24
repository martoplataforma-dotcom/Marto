// apps/web/app/shop/merchant/[id]/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';
import { resolveAsset } from '../../../../src/lib/urls';

type PublicMerchant = {
  id: string;
  tradeName?: string | null;
  city?: string | null;
  cepPrefix?: string | null;
  status?: string | null;

  // (FUTURO) quando você criar no backend
  logoUrl?: string | null;
  coverUrl?: string | null;
};

type ProductItem = {
  id: string;
  title: string;
  priceCents: number;
  active: boolean;
  images?: string[] | null;
};

function isRemoteHttp(src: string) {
  return /^https?:\/\//i.test(src);
}

function moneyFromCentsBRL(cents: number) {
  const n = Number(cents ?? 0) / 100;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function statusLabel(status?: string | null) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'Ativa';
  if (s === 'REVIEW') return 'Em análise';
  if (s === 'BLOCKED') return 'Bloqueada';
  return '—';
}

function initials(name: string) {
  const s = String(name ?? '').trim();
  if (!s) return 'M';
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? '').toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
  const out = `${a}${b}`.slice(0, 2);
  return out || 'M';
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

function SectionTitle({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: ReactNode;
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

function Pillar({
  title,
  desc,
  status,
}: {
  title: string;
  desc: string;
  status: 'MVP' | 'Em breve';
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-semibold text-white/80">
          {status}
        </span>
      </div>
      <div className="mt-1 text-xs text-white/75">{desc}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
      {children}
    </span>
  );
}

function PlaceholderCover() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_20%_10%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(900px_320px_at_80%_0%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.75))]" />
      <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
    </>
  );
}

export default function MerchantPublicPage() {
  const params = useParams<{ id: string }>();
  const merchantId = String(params?.id ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [m, setM] = useState<PublicMerchant | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrMsg('');

      if (!merchantId) {
        setErrMsg('Loja inválida.');
        setLoading(false);
        return;
      }

      try {
        const merchant = await fetchJSON<PublicMerchant>(`/shops/${merchantId}`, {
          method: 'GET',
        });

        const items = await fetchJSON<{ ok: boolean; items: ProductItem[] }>(
          `/shops/${merchantId}/products`,
          { method: 'GET' },
        );

        setM(merchant);
        setProducts(Array.isArray(items?.items) ? items.items : []);
      } catch (e: unknown) {
        const a = e as ApiError;
        setErrMsg(a?.message ?? 'Não foi possível carregar a loja.');
        setM(null);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [merchantId]);

  const showName = m?.tradeName || (loading ? 'Carregando…' : 'Loja');
  const showCity = m?.city || '—';
  const showCep = m?.cepPrefix || '—';

  const visibleProducts = useMemo(
    () => products.filter((p) => p.active).slice(0, 24),
    [products],
  );

  const reputationBand = useMemo(() => {
    if (loading) return '—';

    const withPhoto = visibleProducts.filter((p) => {
      const img = resolveAsset(p.images?.[0] ?? null);
      return Boolean(img);
    }).length;

    if (visibleProducts.length === 0) return 'Iniciando';
    if (withPhoto >= 3) return 'Boa (MVP)';
    if (withPhoto >= 1) return 'Atenção (MVP)';
    return 'Em construção';
  }, [loading, visibleProducts]);

  const coverUrl = resolveAsset(m?.coverUrl ?? null);
  const logoUrl = resolveAsset(m?.logoUrl ?? null);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        {/* Top */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white/80">Marto • Loja</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/catalog"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Voltar ao catálogo
            </Link>
          </div>
        </div>

        {/* HERO com banner + avatar */}
        <div className="overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="relative h-40 w-full">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt="Capa da loja"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1200px"
                priority
                unoptimized={isRemoteHttp(coverUrl)}
              />
            ) : (
              <PlaceholderCover />
            )}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
          </div>

          <div className="p-6 sm:p-8">
            <div className="-mt-14 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white/20 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt="Logo da loja"
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized={isRemoteHttp(logoUrl)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="text-xl font-black tracking-tight text-white/90">
                        {initials(showName)}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{showName}</Badge>
                    <Badge>
                      <span className="text-white/65">Faixa:</span>{' '}
                      <span className="text-white/90">{reputationBand}</span>
                    </Badge>
                    <Badge>
                      <span className="text-white/65">Prova real</span>{' '}
                      <span className="text-white/90">MVP</span>
                    </Badge>
                  </div>

                  <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                    {showName}
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
                    Loja pública no Marto. Aqui reputação nasce da experiência real —
                    não de promessa.
                  </p>

                  {errMsg ? (
                    <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                      {errMsg}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#produtos"
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Ver produtos
                </a>

                <a
                  href="#reputacao"
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Como a reputação funciona
                </a>
              </div>
            </div>

            <div className="mt-6 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Chip label="Status" value={statusLabel(m?.status)} />
              <Chip label="Cidade" value={String(showCity)} />
              <Chip label="CEP (prefixo)" value={String(showCep)} />
              <Chip
                label="Produtos ativos"
                value={loading ? '…' : String(visibleProducts.length)}
              />
            </div>
          </div>
        </div>

        {/* Reputação */}
        <div
          id="reputacao"
          className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <SectionTitle
            title="Reputação (prova real)"
            desc="A reputação da loja nasce da experiência real. No MVP, esta área vira seu painel público de confiança."
            right={
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                MVP
              </span>
            }
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Pillar
              title="📦 Qualidade do produto"
              desc="Compatibilidade com descrição, defeitos e recorrência."
              status="MVP"
            />
            <Pillar
              title="🚚 Logística e entrega"
              desc="Prazo prometido vs real, ocorrências, integridade."
              status="MVP"
            />
            <Pillar
              title="🤝 Atendimento"
              desc="Tempo de resposta, clareza e postura."
              status="MVP"
            />
            <Pillar
              title="⭐ Avaliação do cliente"
              desc="Notas e comentários ao longo do tempo (não um caso)."
              status="MVP"
            />
            <Pillar
              title="⚖️ Conduta no ecossistema"
              desc="Disputas, transparência e regras (fraude pesa muito)."
              status="Em breve"
            />
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white/90">
                O que o Marto faz diferente?
              </div>
              <div className="mt-1 text-xs text-white/75">
                Aqui reputação pesa mais que preço. O cliente vê sinais de risco e
                confiança de forma clara.
              </div>
              <div className="mt-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80">
                Em breve: faixa pública baseada em avaliações, prazos e pós-venda.
              </div>
            </div>
          </div>
        </div>

        {/* Produtos */}
        <div
          id="produtos"
          className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <SectionTitle
            title="Produtos"
            desc="Itens ativos desta loja."
            right={
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                {loading ? '…' : `${visibleProducts.length} item(ns)`}
              </span>
            }
          />

          <div className="mt-5">
            {loading ? (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                Carregando…
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                Esta loja ainda não tem produtos ativos.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((p) => {
                  const img = resolveAsset(p.images?.[0] ?? null);

                  return (
                    <Link
                      key={p.id}
                      href={`/shop/${p.id}`}
                      className="group overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-neutral-950/80"
                    >
                      <div className="relative aspect-[16/11] w-full overflow-hidden rounded-t-3xl bg-black">
                        {img ? (
                          <Image
                            src={img}
                            alt={p.title}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            unoptimized={isRemoteHttp(img)}
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="text-xs font-semibold text-white/70">
                              Sem foto
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="truncate text-sm font-semibold text-white/90">
                          {p.title}
                        </div>
                        <div className="mt-1 text-xs text-white/75">
                          R$ {moneyFromCentsBRL(p.priceCents)}
                        </div>

                        <div className="mt-4 text-xs font-semibold text-white/70 group-hover:text-white/85">
                          Ver detalhes →
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 text-sm text-white/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="font-semibold text-white/85">Sobre esta loja</div>
          <div className="mt-2">
            Local: {String(showCity)} • CEP {String(showCep)}. Status:{' '}
            {statusLabel(m?.status)}.
          </div>
          <div className="mt-2">
            No MVP, algumas métricas públicas ainda estão “em construção”. O objetivo é
            transformar experiência real em confiança verificável.
          </div>
        </div>
      </div>
    </main>
  );
}
