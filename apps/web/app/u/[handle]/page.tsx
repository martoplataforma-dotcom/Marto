// apps/web/app/u/[handle]/page.tsx
'use client';

import Image, { type ImageLoader } from 'next/image';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';

type Props = {
  // ✅ Next pode entregar params como Promise em Client Components
  params: Promise<{ handle: string }>;
};

type Home =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type PublicEvent = {
  id?: string;
  title: string;
  meta: string;
  desc: string;
  verified: boolean;

  // ✅ futuro: backend pode mandar
  type?: 'PURCHASE' | 'SERVICE' | 'OTHER';
};

type PublicProviderSnapshot = {
  kind?: 'GENERIC' | 'TRANSPORTER' | null;
  city?: string | null;
  uf?: string | null;

  specialtiesLabel?: string | null;
  types?: { key: string; title: string }[];
  sla?: { pickupMinutes?: number; deliveryMinutes?: number; bias?: string };
  agendaSummary?: string | null;
  regionSummary?: string | null;
};

type PublicUserResponse = {
  ok: boolean;
  home?: Home;

  user: {
    handle: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    since: string;
  };

  provider?: PublicProviderSnapshot | null;

  stats: {
    verifiedCount: number;
    linksCount: number;
  };

  events: PublicEvent[];
};

function titleFromHandle(handle: string) {
  const h = String(handle || '').replace(/[^a-zA-Z0-9._-]/g, '').trim();
  const base = h || 'usuario';
  const nice = base
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return nice || 'Usuário';
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Erro ao carregar perfil';
}

// ✅ mesma regra do /me
function dashFromHome(home?: Home | null) {
  if (home === 'factory') return '/dash/factory';
  if (home === 'merchant') return '/dash/merchant';
  if (home === 'service_provider') return '/dash/provider/services';
  if (home === 'representative') return '/dash/representative';
  return '/dash/consumer';
}

function normalizeAvatarUrl(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s === 'null' || s === 'undefined') return '';
  return s;
}

/**
 * ✅ Badge do perfil público NÃO pode depender de `home` (histórico).
 * Regra:
 * 1) provider.kind === TRANSPORTER -> Transportadora
 * 2) provider.specialtiesLabel (ex: "Entregador") -> respeita
 * 3) fallback -> usa home
 */
function badgeFromPublic(data: PublicUserResponse | null) {
  const kind = data?.provider?.kind ?? null;
  const specialties = (data?.provider?.specialtiesLabel ?? '').trim();

  if (kind === 'TRANSPORTER') return 'Transportadora';

  if (specialties) {
    const s = specialties.toLowerCase();
    if (s.includes('entreg')) return 'Entregador';
    if (s.includes('transport')) return 'Transportadora';
    if (s.includes('prest')) return 'Prestador';
    return specialties;
  }

  const home = data?.home ?? null;
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

/** ✅ next/image “direto” (igual o que corrigiu no /me) */
const passthroughLoader: ImageLoader = ({ src }) => src;

function MartoImage({
  src,
  alt,
  size,
  className,
  priority,
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
  priority?: boolean;
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
      priority={priority}
    />
  );
}

function MartoAvatarPlaceholder({ alt, size }: { alt?: string; size: number }) {
  return (
    <MartoImage
      src="/marto-m.svg"
      alt={alt ?? 'Marto'}
      size={size}
      className="h-full w-full object-cover"
      priority
    />
  );
}

export default function PublicUserProfilePage({ params }: Props) {
  const resolved = use(params);
  const handle = String(resolved?.handle ?? '').trim().toLowerCase();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<PublicUserResponse | null>(null);

  const [avatarSrc, setAvatarSrc] = useState<string>('/marto-m.svg');

  // ✅ links dinâmicos (baseado no home do usuário logado, não do perfil público)
  const [myHome, setMyHome] = useState<Home | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  // ✅ Aba (UI) + filtro por type (quando backend mandar)
  const [tab, setTab] = useState<'all' | 'purchases' | 'services'>('all');

  // ✅ Bio expand/collapse
  const [bioExpanded, setBioExpanded] = useState(false);

  // ✅ copiar link
  const [copyMsg, setCopyMsg] = useState('');

  // ✅ events memoizado (evita [] novo a cada render + atende exhaustive-deps)
  const events = useMemo<PublicEvent[]>(() => {
    const list = data?.events;
    return Array.isArray(list) ? list : [];
  }, [data]);

  const visibleEvents = useMemo(() => {
    const list = events;

    // ✅ se ainda não existir type no backend, não filtra
    const hasType = list.some((e) => !!e.type);

    if (!hasType || tab === 'all') return list;

    if (tab === 'purchases') return list.filter((e) => e.type === 'PURCHASE');
    if (tab === 'services') return list.filter((e) => e.type === 'SERVICE');

    return list;
  }, [events, tab]);

  // ✅ contadores “sem mentir”
  const counters = useMemo(() => {
    const list = Array.isArray(events) ? events : [];
    const total = list.length;

    const hasType = list.some((e) => !!e.type);

    if (!hasType) {
      return {
        total,
        purchases: null as number | null,
        services: null as number | null,
      };
    }

    const purchases = list.filter((e) => e.type === 'PURCHASE').length;
    const services = list.filter((e) => e.type === 'SERVICE').length;

    return { total, purchases, services };
  }, [events]);
  const typeReady = counters.purchases !== null && counters.services !== null;

  useEffect(() => {
    try {
      const token = localStorage.getItem('marto_access');
      setIsAuthed(Boolean(String(token ?? '').trim()));

      const h = localStorage.getItem('marto_home') as Home | null;
      if (
        h === 'consumer' ||
        h === 'merchant' ||
        h === 'service_provider' ||
        h === 'representative' ||
        h === 'factory'
      ) {
        setMyHome(h);
      } else {
        setMyHome(null);
      }
    } catch {
      setIsAuthed(false);
      setMyHome(null);
    }
  }, []);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      setError('Handle inválido');
      setData(null);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError('');
        setData(null);

        const res = await fetch(
          `/api/public/users/${encodeURIComponent(handle)}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error('Usuário não encontrado');
        }

        const json = (await res.json()) as PublicUserResponse;
        setData(json);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [handle]);

  useEffect(() => {
    const next = normalizeAvatarUrl(data?.user?.avatarUrl) || '/marto-m.svg';
    setAvatarSrc(next);
  }, [data?.user?.avatarUrl]);

  // ✅ Se trocar de usuário, reseta UI local
  useEffect(() => {
    setBioExpanded(false);
    setCopyMsg('');
  }, [handle]);

  // ✅ helper: pega handle do perfil atual sem quebrar hooks
  const profileHandle = data?.user?.handle;

  async function copyPublicLink() {
    try {
      setCopyMsg('');
      const h = String(profileHandle ?? '').trim();
      if (!h) throw new Error('missing handle');

      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}/u/${h}`
          : `/u/${h}`;

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // fallback antigo
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }

      setCopyMsg('Link copiado.');
      window.setTimeout(() => setCopyMsg(''), 1500);
    } catch {
      setCopyMsg('Não foi possível copiar.');
      window.setTimeout(() => setCopyMsg(''), 1500);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Carregando perfil…
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Perfil não encontrado
      </main>
    );
  }

  const profile = data.user;
  const safeName = profile.name || titleFromHandle(profile.handle);

  const bioText = String(profile.bio ?? '').trim();
  const hasBio = Boolean(bioText);
  const bioLong = bioText.length > 180;
  const bioVisible =
    !hasBio
      ? '—'
      : bioExpanded || !bioLong
        ? bioText
        : `${bioText.slice(0, 180).trim()}…`;

  const publicBadge = badgeFromPublic(data);
  const avatar = normalizeAvatarUrl(avatarSrc);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      {/* Fundo (grid + glows) — igual /me */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="pointer-events-none absolute -top-52 left-1/2 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-sm backdrop-blur">
          {/* Header */}
          <div className="border-b border-white/10 px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/60 ring-1 ring-white/10">
                  <MartoImage
                    src="/marto-m.svg"
                    alt="Marto"
                    size={20}
                    className="h-5 w-5 object-contain"
                    priority
                  />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-white">Marto</div>
                  <div className="text-xs text-white/60">
                    Perfil público • consequência do histórico
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={isAuthed ? dashFromHome(myHome) : '/'}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Início
                </Link>

                {isAuthed ? (
                  <>
                    <Link
                      href={dashFromHome(myHome)}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Minha central
                    </Link>

                    <Link
                      href="/me"
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Minha conta
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Entrar
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* HERO */}
          <div className="relative overflow-hidden border-b border-white/10 bg-black/25 px-8 py-10 text-white">
            <div className="pointer-events-none absolute inset-0 opacity-20">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'radial-gradient(900px 500px at 50% -10%, rgba(255,255,255,0.12), transparent 55%)',
                }}
              />
            </div>

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {/* Identidade */}
              <div className="flex items-start gap-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/15">
                  {avatar ? (
                    <MartoImage
                      src={avatar}
                      alt={safeName}
                      size={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <MartoAvatarPlaceholder alt="Marto" size={64} />
                  )}
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                    {publicBadge}
                    <span className="opacity-60">•</span>
                    Porque reputação importa
                  </div>

                  <div className="mt-3 text-2xl font-bold tracking-tight">
                    {safeName}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <span>@{profile.handle}</span>

                    <button
                      type="button"
                      onClick={() => void copyPublicLink()}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                    >
                      Copiar link
                    </button>

                    {copyMsg ? (
                      <span className="text-xs text-white/60">{copyMsg}</span>
                    ) : null}
                  </div>

                  {/* ✅ BIO expandível */}
                  <div className="mt-3 max-w-xl">
                    <p className="text-sm leading-relaxed text-white/75">
                      {bioVisible}
                    </p>

                    {hasBio && bioLong ? (
                      <button
                        type="button"
                        onClick={() => setBioExpanded((v) => !v)}
                        className="mt-2 text-sm font-semibold text-white/80 hover:text-white"
                      >
                        {bioExpanded ? 'Ver menos' : 'Ver mais'}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                      histórico &gt; post
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                      verificação
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                      relações reais
                    </span>
                  </div>
                </div>
              </div>

              {/* Histórico no Marto (leve, sem KPI vazio) */}
              <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Histórico no Marto
                    </div>
                    <div className="mt-1 text-xs text-white/65">
                      Público só quando existe ação real.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                    Público
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                  {events.length > 0 ? (
                    <>
                      <div className="text-sm font-semibold text-white">
                        {events.length} registro
                        {events.length === 1 ? '' : 's'} público
                        {events.length === 1 ? '' : 's'}
                      </div>
                      <div className="mt-2 text-sm text-white/70">
                        Experiências registradas a partir do que aconteceu:
                        compra, entrega, serviço e avaliação.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-white">
                        Ainda sem registros públicos
                      </div>
                      <div className="mt-2 text-sm text-white/70">
                        No Marto, o perfil público é consequência — não um feed.
                      </div>
                    </>
                  )}
                </div>

                {/* Se for prestador/transportadora no futuro, o bloco de operação entra aqui.
                    Para consumidor, fica leve. */}
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="px-8 py-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">
                  Atividade pública
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Registros que podem ser compartilhados. Sem feed infinito.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab('all')}
                  className={[
                    'rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold',
                    tab === 'all'
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-white/80 hover:bg-white/10',
                  ].join(' ')}
                >
                  Tudo (público){' '}
                  <span className="ml-1 text-white/60">({counters.total})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('purchases')}
                  disabled={!typeReady}
                  title={
                    !typeReady
                      ? 'Em breve: eventos tipados (compra/serviço)'
                      : undefined
                  }
                  className={[
                    'rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold',
                    !typeReady ? 'cursor-not-allowed opacity-60' : '',
                    tab === 'purchases'
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-white/80 hover:bg-white/10',
                  ].join(' ')}
                >
                  Compras (público){' '}
                  <span className="ml-1 text-white/60">
                    ({counters.purchases === null ? '—' : counters.purchases})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('services')}
                  disabled={!typeReady}
                  title={
                    !typeReady
                      ? 'Em breve: eventos tipados (compra/serviço)'
                      : undefined
                  }
                  className={[
                    'rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold',
                    !typeReady ? 'cursor-not-allowed opacity-60' : '',
                    tab === 'services'
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-white/80 hover:bg-white/10',
                  ].join(' ')}
                >
                  Serviços (público){' '}
                  <span className="ml-1 text-white/60">
                    ({counters.services === null ? '—' : counters.services})
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {visibleEvents.map((ev, idx) => (
                <PublicEventCard key={ev.id ?? `${idx}`} ev={ev} />
              ))}

              {visibleEvents.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="text-sm font-semibold text-white">
                    Ainda sem registros públicos
                  </div>

                  <div className="mt-2 text-sm text-white/70">
                    No Marto, o perfil público é consequência do que aconteceu —
                    não um feed.
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                    Seus pedidos podem existir, mas só viram “registro público”
                    quando o Marto tiver os eventos verificados (compra, entrega,
                    avaliação, serviço).
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isAuthed ? (
                      <>
                        <Link
                          href="/dash/consumer/orders"
                          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                        >
                          Ver meus pedidos
                        </Link>

                        <Link
                          href="/me"
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Editar no meu perfil
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                        >
                          Criar minha conta Marto
                        </Link>

                        <Link
                          href="/login"
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Entrar
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 text-white/80">
              <div className="text-sm font-semibold text-white">
                O que vem depois
              </div>
              <div className="mt-2 text-sm text-white/70">
                Quando o Marto estiver com dados reais, este perfil vai mostrar:
                experiências vinculadas, marcações verificadas e vínculos com
                lojas/prestadores — sem virar rede social genérica.
              </div>
            </div>

            {/* ✅ CTA no final — só quando NÃO está logado */}
            {!isAuthed ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Quer construir reputação de verdade?
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      Crie sua conta no Marto e transforme ações reais em
                      histórico.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/login"
                      className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
                    >
                      Criar minha conta Marto
                    </Link>

                    <Link
                      href="/login"
                      className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Entrar
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function PublicEventCard({ ev }: { ev: PublicEvent }) {
  const badge = ev.verified ? 'verificado' : 'em construção';

  const isAuthed =
    typeof window !== 'undefined' && !!localStorage.getItem('marto_access');

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">{ev.title}</div>
          <div className="mt-1 text-xs text-white/55">{ev.meta}</div>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            ev.verified
              ? 'bg-emerald-500/15 text-emerald-200'
              : 'bg-white/10 text-white/70'
          }`}
        >
          {badge}
        </div>
      </div>

      <div className="mt-3 text-sm leading-relaxed text-white/70">{ev.desc}</div>

      <div className="mt-5 flex flex-wrap gap-2">
        {ev.verified ? (
          <>
            {ev.id ? (
              isAuthed ? (
                <Link
                  href={`/dash/consumer/orders/${ev.id}`}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Ver detalhes
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Entrar para ver detalhes
                </Link>
              )
            ) : (
              <button
                type="button"
                disabled
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 opacity-70"
                title="Sem referência"
              >
                Ver detalhes
              </button>
            )}

            <button
              type="button"
              disabled
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 opacity-70"
              title="Em breve"
            >
              Abrir experiência
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 opacity-70"
            title="Em breve"
          >
            Em construção
          </button>
        )}
      </div>
    </div>
  );
}
