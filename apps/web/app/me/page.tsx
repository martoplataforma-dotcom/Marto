// apps/web/app/me/page.tsx
'use client';

import Link from 'next/link';
import Image, { type ImageLoader } from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';

import { ConsumerSections } from './_sections/consumer';
import { MerchantSections } from './_sections/merchant';
import { ProviderSections } from './_sections/provider';
import { FactorySections } from './_sections/factory';
import { RepresentativeSections } from './_sections/representative';
import { FallbackSections } from './_sections/fallback';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type Home =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type MeResponse = {
  email?: string;
  home?: Home;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string;
  };
  profile?: {
    handle?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    updatedAt?: string | null;
  };
};

function displayNameFromEmail(email?: string) {
  const base = String(email ?? '').split('@')[0] || 'Usuário';
  return base
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function dashFromHome(home?: Home | string) {
  if (home === 'factory') return '/dash/factory';
  if (home === 'merchant') return '/dash/merchant';
  if (home === 'service_provider') return '/dash/provider/services';
  if (home === 'representative') return '/dash/representative';
  return '/dash/consumer';
}

function sanitizeHandle(v: string) {
  return String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 24);
}

function normalizeAvatarUrl(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s === 'null' || s === 'undefined') return '';
  return s;
}

const passthroughLoader: ImageLoader = ({ src }) => src;

function MartoImage({
  src,
  alt,
  size,
  className,
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    <Image
      loader={passthroughLoader}
      unoptimized
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="text-xs font-semibold text-white/65">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white/90">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-white/60">{hint}</div> : null}
    </div>
  );
}

function homeLabel(home?: Home) {
  return home === 'factory'
    ? 'Fabricante'
    : home === 'merchant'
      ? 'Negócio'
      : home === 'service_provider'
        ? 'Prestador'
        : home === 'representative'
          ? 'Representante'
          : 'Consumidor';
}

function primaryActionByHome(home?: Home) {
  if (home === 'consumer') {
    return {
      href: '/dash/consumer/orders',
      title: 'Minhas compras',
      desc: 'Seu rastro real: pedidos, entregas, devoluções.',
    };
  }

  if (home === 'factory') {
    return {
      href: '/dash/factory/overview',
      title: 'Visão geral',
      desc: 'Score, sinais e pendências operacionais.',
    };
  }

  if (home === 'merchant') {
    return {
      href: '/dash/merchant',
      title: 'Pedidos (lojista)',
      desc: 'Ações e fluxo de pedidos do seu negócio.',
    };
  }

  if (home === 'service_provider') {
    return {
      href: '/dash/provider/services',
      title: 'Meus serviços',
      desc: 'Agenda, execução e reputação por entregas reais.',
    };
  }

  if (home === 'representative') {
    return {
      href: '/dash/representative',
      title: 'Meu território',
      desc: 'Carteira, oportunidades e resultado por execução.',
    };
  }

  return {
    href: dashFromHome(home),
    title: 'Meu painel',
    desc: 'Continue seu fluxo no Marto.',
  };
}

type SectionProps = {
  me: MeResponse;
  primaryHref: string;
  reviewPendenciesCount: number | null;
};

function SectionsByHome({
  me,
  primaryHref,
  reviewPendenciesCount,
}: SectionProps) {
  const home = me.home;

  // ✅ registry central (sem ifs espalhados)
  switch (home) {
    case 'consumer':
      return (
        <ConsumerSections
          primaryHref={primaryHref}
          showReviewCta={Boolean(reviewPendenciesCount && reviewPendenciesCount > 0)}
          reviewPendenciesCount={reviewPendenciesCount}
        />
      );
    case 'merchant':
      return <MerchantSections me={me} primaryHref={primaryHref} />;
    case 'service_provider':
      return <ProviderSections me={me} primaryHref={primaryHref} />;
    case 'factory':
      return <FactorySections me={me} primaryHref={primaryHref} />;
    case 'representative':
      return <RepresentativeSections me={me} primaryHref={primaryHref} />;
    default:
      return <FallbackSections me={me} primaryHref={primaryHref} />;
  }
}

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [reviewPendenciesCount, setReviewPendenciesCount] = useState<
    number | null
  >(null);

  useEffect(() => {
    (async () => {
      setMsg('');
      const token = getToken();
      if (!token) {
        setMsg('Sem token. Entre novamente.');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchJSON<MeResponse>('/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setMe(data);

        if (data?.home === 'consumer') {
          // MVP: reaproveita a mesma lógica do dash/consumer sem “operar” aqui
          try {
            const ordersRes = await fetchJSON<
              unknown[] | { orders?: unknown[]; items?: unknown[] }
            >('/orders/me', {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            });

            const list = Array.isArray(ordersRes)
              ? ordersRes
              : Array.isArray(ordersRes.orders)
                ? ordersRes.orders
                : Array.isArray(ordersRes.items)
                  ? ordersRes.items
                  : [];

            const getOrderId = (o: unknown): string | null => {
              if (!o || typeof o !== 'object') return null;
              const r = o as Record<string, unknown>;
              const id = r.id;
              return typeof id === 'string' && id.trim() ? id.trim() : null;
            };

            const shipmentResults = await Promise.all(
              list.map(async (o): Promise<unknown | null> => {
                const orderId = getOrderId(o);
                if (!orderId) return null;

                try {
                  return await fetchJSON<unknown>(
                    `/logistics/shipments/by-order/${orderId}`,
                    {
                      method: 'GET',
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                } catch {
                  return null;
                }
              }),
            );

            const shipments = shipmentResults
              .map((r) => {
                if (!r || typeof r !== 'object') return null;
                const rr = r as Record<string, unknown>;
                return rr.shipment ? rr.shipment : r;
              })
              .filter(Boolean) as unknown[];

            const pending = shipments.filter((s) => {
              if (!s || typeof s !== 'object') return false;
              const sr = s as Record<string, unknown>;
              const st = String(sr.status ?? '').toUpperCase();
              if (st !== 'DELIVERED') return false;
              return !sr.review && !sr.reviewedAt;
            }).length;

            setReviewPendenciesCount(pending);
          } catch {
            setReviewPendenciesCount(null);
          }
        } else {
          setReviewPendenciesCount(null);
        }
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar sua conta.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const email = String(me?.email ?? '').trim();
  const backendDisplayName = String(me?.profile?.displayName ?? '').trim();
  const name = backendDisplayName || displayNameFromEmail(email);

  const bio = String(me?.profile?.bio ?? '').trim();
  const avatar = normalizeAvatarUrl(me?.profile?.avatarUrl);

  const badge = homeLabel(me?.home);
  const cycleBadge =
    me?.home === 'consumer'
      ? reviewPendenciesCount === null
        ? { text: 'Ciclo: checando…', tone: 'neutral' as const }
        : reviewPendenciesCount > 0
          ? {
              text: `Ciclo: ${reviewPendenciesCount} pendência(s)`,
              tone: 'emerald' as const,
            }
          : { text: 'Ciclo: em dia', tone: 'neutral' as const }
      : null;

  const effectiveHandle = sanitizeHandle(String(me?.profile?.handle ?? ''));
  const hasPublicProfile = Boolean(effectiveHandle);
  const needsPublicProfile = !hasPublicProfile;

  const primaryAction = useMemo(
    () => primaryActionByHome(me?.home),
    [me?.home],
  );

  const stats = useMemo(() => {
    // MVP: núcleo “economia” é preview até conectar pontos/cashback de verdade
    return {
      level: 'Bronze',
      points: '0',
      missions: '0/0',
      cashback: 'R$ 0,00',
      repLabel: 'Reputação (prévia)',
      repValue: '—',
      repCount: 0,
    };
  }, []);

  async function onInviteFriends() {
    try {
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:3000';

      const code =
        effectiveHandle ||
        (me?.user?.id ? `u_${me.user.id.slice(0, 6)}` : 'marto');

      const link = `${base}/signup?ref=${encodeURIComponent(code)}`;

      await navigator.clipboard.writeText(link);
      setMsg('Link de convite copiado! Envie no WhatsApp/Instagram.');
    } catch {
      setMsg('Não consegui copiar automaticamente. Seu navegador bloqueou a cópia.');
    }
  }

  const publicHref = hasPublicProfile
    ? `/u/${encodeURIComponent(effectiveHandle)}`
    : '/profile';

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Fundo Marto (padrão) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-neutral-950" />
        <div className="absolute -top-48 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl p-6">
        {/* Núcleo fixo (Identidade + Presença + Ações) */}
        <div className="rounded-[2rem] border border-white/15 bg-neutral-950/75 p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
                {avatar ? (
                  <MartoImage
                    src={avatar}
                    alt="Foto do perfil"
                    size={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <MartoImage
                    src="/marto-m.svg"
                    alt="Marto"
                    size={64}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{badge}</Pill>
                  {cycleBadge ? (
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                        cycleBadge.tone === 'emerald'
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/15 bg-white/10 text-white/80'
                      }`}
                    >
                      {cycleBadge.text}
                    </span>
                  ) : null}
                  <Pill>Social por consequência</Pill>
                  <Pill>Porque reputação importa</Pill>
                </div>

                <h1 className="mt-3 truncate text-3xl font-bold tracking-tight text-white/90">
                  {loading ? 'Carregando…' : name}
                </h1>

                <div className="mt-1 text-sm text-white/65">{email}</div>

                <div className="mt-4 text-sm text-white/80">
                  {bio
                    ? bio
                    : 'Adicione uma bio curta. No Marto, sua história é feita de ações reais.'}
                </div>

                {!hasPublicProfile ? (
                  <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80 ring-1 ring-white/10">
                    <span className="font-semibold">Perfil público desativado:</span>{' '}
                    crie seu <span className="font-semibold">@handle</span> para liberar
                    seu link único <span className="font-semibold">/u/seu-handle</span>.
                    Sem feed — só histórico real.
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-white/70">
                    Seu link:{' '}
                    <span className="font-semibold text-white/85">
                      /u/{effectiveHandle}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {needsPublicProfile ? (
                <Link
                  href="/profile#pub"
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                  title="Ative seu @handle para criar seu link público"
                >
                  Ativar perfil público
                </Link>
              ) : (
                <Link
                  href={dashFromHome(me?.home)}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                >
                  Ir para meu painel
                </Link>
              )}

              {needsPublicProfile ? (
                <Link
                  href={dashFromHome(me?.home)}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Ir para meu painel
                </Link>
              ) : (
                <Link
                  href={publicHref}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  title="Abrir seu perfil público"
                >
                  Ver perfil público
                </Link>
              )}

              <Link
                href="/profile"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Configurações
              </Link>

              <Link
                href="/notifications"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Notificações
              </Link>

              <button
                type="button"
                onClick={() => void onInviteFriends()}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Convidar amigos
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem('marto_access');
                  window.location.href = '/login';
                }}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Sair
              </button>
            </div>
          </div>

          {msg ? (
            <div className="mt-6 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80 ring-1 ring-white/10">
              {msg}
            </div>
          ) : null}
        </div>

        {/* Placar (núcleo economia) */}
        <div className="mt-6 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <StatCard label="Pontos" value={stats.points} hint="Progresso real (preview)" />
          </div>
          <div className="md:col-span-2">
            <StatCard label="Missões" value={stats.missions} hint="Rumo ao próximo nível" />
          </div>
          <div className="md:col-span-2">
            <StatCard label="Cashback" value={stats.cashback} hint="Conforme regras do Marto" />
          </div>
        </div>

        {/* Próximo passo (fixo) */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Link
            href={dashFromHome(me?.home)}
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur hover:bg-white/10"
          >
            <div className="text-sm font-semibold text-white/90">Meu painel</div>
            <div className="mt-1 text-sm text-white/65">
              Operação do seu papel fica no /dash.
            </div>
          </Link>

          <Link
            href={primaryAction.href}
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur hover:bg-white/10"
          >
            <div className="text-sm font-semibold text-white/90">
              {primaryAction.title}
            </div>
            <div className="mt-1 text-sm text-white/65">{primaryAction.desc}</div>
          </Link>

          <Link
            href="/catalog"
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur hover:bg-white/10"
          >
            <div className="text-sm font-semibold text-white/90">Explorar catálogo</div>
            <div className="mt-1 text-sm text-white/65">
              Próxima experiência começa com ação real.
            </div>
          </Link>
        </div>

        {/* Camada B (por papel) */}
        <div className="mt-6">
          {me ? (
            <SectionsByHome
              me={me}
              primaryHref={primaryAction.href}
              reviewPendenciesCount={reviewPendenciesCount}
            />
          ) : (
            <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-sm font-semibold text-white/85">
                {loading ? 'Carregando…' : 'Sem dados'}
              </div>
              <div className="mt-2 text-sm text-white/65">
                {loading
                  ? 'Lendo seu núcleo de conta.'
                  : 'Não foi possível montar seu /me.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
