// apps/web/app/u/[handle]/page.tsx
'use client';

import Image, { type ImageLoader } from 'next/image';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

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
  specialties?: string[] | null;

  specialtiesLabel?: string | null;
  types?: { key: string; title: string }[];
  sla?: { pickupMinutes?: number; deliveryMinutes?: number; bias?: string };
  agendaSummary?: string | null;
  regionSummary?: string | null;

  reputation?: {
    averageRating?: number | null;
    reviewCount?: number | null;
  } | null;
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

type MeHomeResponse = {
  home?: Home | null;
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

function normalizePublicText(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (s === 'null' || s === 'undefined') return '';
  return s;
}

function badgeFromPublic(data: PublicUserResponse | null) {
  const home = data?.home ?? null;
  const kind = data?.provider?.kind ?? null;
  const specialties = (data?.provider?.specialtiesLabel ?? '').trim();

  if (home === 'merchant') return 'Negócio';
  if (home === 'factory') return 'Fabricante';
  if (home === 'representative') return 'Representante';
  if (home === 'consumer') return 'Consumidor';

  if (home === 'service_provider') {
    if (kind === 'TRANSPORTER') return 'Transportadora';

    if (specialties) {
      const s = specialties.toLowerCase();
      if (s.includes('entreg')) return 'Entregador';
      if (s.includes('transport')) return 'Transportadora';
      if (s.includes('prest')) return 'Prestador';
      return specialties;
    }

    return 'Prestador';
  }

  return 'Usuário Marto';
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
    let alive = true;

    (async () => {
      try {
        const token = localStorage.getItem('marto_access');
        const authed = Boolean(String(token ?? '').trim());

        if (!alive) return;
        setIsAuthed(authed);

        if (!authed) {
          setMyHome(null);
          return;
        }

        const me = await fetchJSON<MeHomeResponse>('/me', { method: 'GET' });
        if (!alive) return;
        setMyHome(me.home ?? null);
      } catch (e: unknown) {
        const err = e as ApiError;
        if (!alive) return;

        if (err?.status === 401) {
          localStorage.removeItem('marto_access');
        }

        setIsAuthed(false);
        setMyHome(null);
      }
    })();

    return () => {
      alive = false;
    };
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

  const profile = data?.user;
  const safeName = normalizePublicText(profile?.name) || titleFromHandle(profile?.handle ?? '');

  const bioText = normalizePublicText(profile?.bio);
  const hasBio = Boolean(bioText);
  const bioLong = bioText.length > 180;
  const bioVisible =
    !hasBio
      ? 'Esse perfil ainda está estruturando sua apresentação pública no Marto.'
      : bioExpanded || !bioLong
        ? bioText
        : `${bioText.slice(0, 180).trim()}…`;

  const publicBadge = badgeFromPublic(data);
  const avatar = normalizeAvatarUrl(avatarSrc);
  const provider = data?.provider ?? null;
  const home = data?.home ?? null;
  const isMerchantProfile = home === 'merchant';
  const isProviderProfile = home === 'service_provider';
  const providerRating = provider?.reputation?.averageRating ?? null;
  const providerReviewCount = provider?.reputation?.reviewCount ?? 0;

  const providerOperationLine = !provider
    ? 'Operação profissional em evolução no ecossistema.'
    : provider.kind === 'TRANSPORTER'
      ? provider.regionSummary?.trim()
        ? `Atuação logística: ${provider.regionSummary.trim()}`
        : 'Atuação logística em evolução dentro do Marto.'
      : provider.agendaSummary?.trim()
        ? `Agenda: ${provider.agendaSummary.trim()}`
        : provider.regionSummary?.trim()
          ? `Área atendida: ${provider.regionSummary.trim()}`
          : 'Atendimento profissional em evolução dentro do Marto.';

  const providerPublicMeta = useMemo(() => {
    const specialty = provider?.specialties?.[0] ?? '';
    const specialtyLabel =
      specialty === 'assembly'
        ? 'Montagem'
        : specialty === 'installation'
          ? 'Instalação'
          : specialty === 'technical_visit'
            ? 'Visita técnica'
            : specialty === 'delivery'
              ? 'Entregas'
              : specialty === 'maintenance'
                ? 'Manutenção'
                : specialty === 'electrical'
                  ? 'Elétrica'
                  : specialty === 'hydraulic'
                    ? 'Hidráulica'
                    : specialty === 'carpentry'
                      ? 'Marcenaria'
                    : specialty === 'upholstery'
                      ? 'Estofaria'
                      : 'Prestação de serviço';

    const cityText = normalizePublicText(provider?.city);
    const ufText = normalizePublicText(provider?.uf);
    const areaText =
      cityText && ufText ? `${cityText} / ${ufText}` : cityText || 'Base territorial em estruturação';

    const kind = provider?.kind ?? 'GENERIC';

    if (kind === 'TRANSPORTER' || specialty === 'delivery') {
      return {
        badge: 'Logística Marto',
        title: 'Entrega logística no Marto',
        desc:
          'Este perfil reúne identidade pública, base logística, território de atuação e reputação construída por entregas reais dentro do ecossistema.',
        baseLabel: 'Entrega logística',
        areaLabel: areaText,
        trustLabel: 'Histórico logístico em formação',
        promise:
          'No Marto, prazo respeitado, ocorrência registrada e entrega comprovada viram reputação pública e prioridade operacional.',
      };
    }

    return {
      badge: 'Prestador Marto',
      title: specialty ? `${specialtyLabel} no Marto` : 'Prestador no Marto',
      desc: specialty
        ? `Este perfil reúne identidade pública, base profissional de ${specialtyLabel.toLowerCase()}, território de atuação e reputação construída por histórico real.`
        : 'Este perfil reúne identidade pública, base profissional, território de atuação e reputação construída por histórico real.',
      baseLabel: specialtyLabel,
      areaLabel: areaText,
      trustLabel: specialty ? 'Histórico profissional em formação' : 'Base profissional inicial',
      promise:
      'No Marto, execução limpa, checklist, confirmação e avaliação real viram reputação pública e crescimento profissional.',
    };
  }, [provider]);
  const providerSpecialtySignals = useMemo(() => {
    const specialty = provider?.specialties?.[0] ?? '';
    const kind = provider?.kind ?? 'GENERIC';

    if (kind === 'TRANSPORTER' || specialty === 'delivery') {
      return {
        eyebrow: 'Leitura logística',
        operationLabel: 'Promessa operacional',
        operationDesc:
          'Rota, prazo, confirmação e ocorrência registrada começam a formar reputação logística pública no Marto.',
        executionLabel: 'Execução em campo',
        executionDesc:
          'A confiança cresce quando a entrega é concluída com registro limpo, previsibilidade e consistência real.',
        trustDesc:
          'No Marto, a reputação logística nasce de janela cumprida, prova de execução e histórico verificável.',
        growthLine:
          'Essa base cresce com entregas reais, recorrência e disciplina operacional.',
      };
    }

    switch (specialty) {
      case 'carpentry':
        return {
          eyebrow: 'Leitura profissional',
          operationLabel: 'Execução e acabamento',
          operationDesc:
            'Marcenaria no Marto cresce com ajuste fino, acabamento, montagem limpa e percepção real de qualidade.',
          executionLabel: 'Confiança em campo',
          executionDesc:
            'A reputação aparece quando a execução mostra cuidado, consistência e resultado percebido no ambiente real.',
          trustDesc:
            'No Marto, marcenaria bem executada não vira só entrega. Vira histórico profissional visível.',
          growthLine:
            'Essa base cresce com serviços concluídos, avaliações e sinais reais de qualidade.',
        };

      case 'assembly':
        return {
          eyebrow: 'Leitura profissional',
          operationLabel: 'Montagem real',
          operationDesc:
            'Montagem no Marto cresce com etapa concluída, estabilidade, acabamento e confirmação limpa do serviço.',
          executionLabel: 'Consistência operacional',
          executionDesc:
            'Quanto mais a operação sustenta montagem limpa e previsível, mais força pública ela ganha.',
          trustDesc:
            'No Marto, montar bem vira reputação quando a execução começa a gerar histórico verificável.',
          growthLine:
            'Essa base cresce com execução recorrente, confirmação e reputação acumulada.',
        };

      case 'installation':
        return {
          eyebrow: 'Leitura técnica',
          operationLabel: 'Precisão e validação',
          operationDesc:
            'Instalação no Marto cresce com ajuste técnico, validação no local e resultado final consistente.',
          executionLabel: 'Confiabilidade técnica',
          executionDesc:
            'A reputação aumenta quando a instalação é concluída com clareza, precisão e confirmação real.',
          trustDesc:
            'No Marto, instalação bem feita vira confiança pública quando a técnica começa a aparecer no histórico.',
          growthLine:
            'Essa base cresce com validação, recorrência e leitura técnica real.',
        };

      case 'technical_visit':
        return {
          eyebrow: 'Leitura técnica',
          operationLabel: 'Diagnóstico e direção',
          operationDesc:
            'Visita técnica no Marto cresce com leitura clara, direcionamento correto e postura profissional verificável.',
          executionLabel: 'Autoridade profissional',
          executionDesc:
            'A confiança aparece quando o diagnóstico deixa rastro de clareza, precisão e utilidade real.',
          trustDesc:
            'No Marto, visita técnica bem feita vira reputação quando a leitura profissional se torna histórica.',
          growthLine:
            'Essa base cresce com diagnósticos consistentes, vínculo real e recorrência de confiança.',
        };

      case 'maintenance':
        return {
          eyebrow: 'Leitura profissional',
          operationLabel: 'Correção e estabilidade',
          operationDesc:
            'Manutenção no Marto cresce com resolução consistente, retorno reduzido e percepção real de estabilidade.',
          executionLabel: 'Confiabilidade operacional',
          executionDesc:
            'A reputação evolui quando a operação mostra correção limpa, constância e bom fechamento do serviço.',
          trustDesc:
            'No Marto, manutenção bem resolvida vira reputação quando o histórico começa a mostrar consistência real.',
          growthLine:
            'Essa base cresce com resolução, repetição saudável e confiança pública.',
        };

      default:
        return {
          eyebrow: 'Leitura profissional',
          operationLabel: 'Base operacional',
          operationDesc:
            'Esse papel cresce no Marto quando execução, confirmação e histórico começam a formar uma leitura pública coerente.',
          executionLabel: 'Confiança em evolução',
          executionDesc:
            'A reputação aparece quando a operação deixa de ser promessa e começa a gerar histórico verificável.',
          trustDesc:
            'No Marto, a base profissional cresce quando o trabalho real começa a ser percebido publicamente.',
          growthLine:
            'Essa base cresce com execução, consistência e histórico real.',
        };
    }
  }, [provider]);
  const heroPrimaryBadge = isProviderProfile
    ? `Prestador • ${providerPublicMeta.baseLabel}`
    : publicBadge;

  const heroSecondaryBadge = isProviderProfile
    ? 'Base profissional pública'
    : 'Porque reputação importa';

  const heroRoleLine = isProviderProfile
    ? 'Prestador ativo no ecossistema Marto'
    : 'Identidade pública do ecossistema Marto';

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Carregando perfil…
      </main>
    );
  }

  if (error || !data || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Perfil não encontrado
      </main>
    );
  }

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

              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              {/* Identidade */}
                <div className="flex items-start gap-5">
                  <div className="grid h-18 w-18 place-items-center overflow-hidden rounded-[1.75rem] bg-white/10 ring-1 ring-white/15 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                    {avatar ? (
                      <MartoImage
                        src={avatar}
                        alt={safeName}
                        size={72}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <MartoAvatarPlaceholder alt="Marto" size={72} />
                    )}
                  </div>

                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100 shadow-[0_8px_24px_rgba(16,185,129,0.12)]">
                        {heroPrimaryBadge}
                      </span>

                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/65">
                        {heroSecondaryBadge}
                      </span>
                    </div>

                    <div className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {safeName}
                    </div>

                    <div className="mt-2 text-sm font-medium text-white/62">
                      {heroRoleLine}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/78">
                        @{profile.handle}
                      </span>

                      <button
                        type="button"
                        onClick={() => void copyPublicLink()}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                      >
                        Copiar link
                      </button>

                    {copyMsg ? (
                      <span className="text-xs text-white/60">{copyMsg}</span>
                    ) : null}
                  </div>

                  {/* ✅ BIO expandível */}
                    <div className="mt-4 max-w-xl">
                      <p className="text-[15px] leading-7 text-white/75">
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

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/70">
                      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                        identidade pública universal
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                      reputação baseada em histórico
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                      blocos por papel no ecossistema
                    </span>
                  </div>

                  {isMerchantProfile ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/55">Perfil</div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          Loja no ecossistema Marto
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/55">Atividade pública</div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          Compras, avaliações e relações reais
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/55">Confiança</div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          Histórico visível conforme ações verificadas
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Histórico no Marto (leve, sem KPI vazio) */}
              <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-5 ring-1 ring-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
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
                  {isProviderProfile ? (
                    <>
                      <div className="text-sm font-semibold text-white">
                        Histórico profissional público
                      </div>
                      <div className="mt-2 text-sm text-white/70">
                        No Marto, reputação profissional não nasce de autopromoção.
                        Ela cresce quando serviço concluído, checklist, avaliação e vínculo real
                        começam a gerar histórico verificável.
                      </div>
                    </>
                  ) : events.length > 0 ? (
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

                {/* Blocos operacionais entram por papel.
                    Lojista não herda cards de prestador.
                    Consumidor continua leve. */}
              </div>
            </div>

            {isProviderProfile ? (
              <div className="relative mt-10 overflow-hidden rounded-[2.25rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/14 via-white/[0.05] to-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_26px_90px_rgba(0,0,0,0.34)]">
                <div className="pointer-events-none absolute inset-0 opacity-55">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        'radial-gradient(980px 380px at 8% 0%, rgba(16,185,129,0.18), transparent 46%), radial-gradient(740px 320px at 100% 0%, rgba(255,255,255,0.09), transparent 36%)',
                    }}
                  />
                </div>

                <div className="relative grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="p-7 sm:p-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        {providerPublicMeta.badge}
                      </span>

                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
                        Perfil público profissional
                      </span>
                    </div>

                    <h3 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-[2.15rem]">
                      {providerPublicMeta.title}
                    </h3>

                    <div className="mt-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">
                        {providerSpecialtySignals.eyebrow}
                      </div>

                      <p className="mt-2 max-w-3xl text-[15px] leading-7 text-white/74">
                        {providerPublicMeta.desc}
                      </p>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.5rem] border border-white/10 bg-black/28 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                          Base profissional
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {providerPublicMeta.baseLabel}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-white/60">
                          {providerSpecialtySignals.operationDesc}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-black/28 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                          Base territorial
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {providerPublicMeta.areaLabel}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-white/60">
                          Essa base territorial ajuda o Marto a ligar execução real com presença profissional pública.
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-black/28 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                          Confiança Marto
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {providerPublicMeta.trustLabel}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-white/60">
                          {providerSpecialtySignals.trustDesc}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/32 px-5 py-4 text-sm leading-6 text-white/70">
                      <span className="font-semibold text-white">{providerPublicMeta.promise}</span>{' '}
                      {providerSpecialtySignals.growthLine}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href="/dash/provider/profile"
                        className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                      >
                        Refinar base profissional
                      </Link>

                      <Link
                        href="/me"
                        className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        Editar identidade pública
                      </Link>
                    </div>
                  </div>

                  <div className="border-t border-white/8 bg-black/28 p-7 lg:border-l lg:border-t-0 sm:p-8">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                      Leitura profissional pública
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/55">Avaliações verificadas</div>
                        <div className="mt-1 text-3xl font-semibold text-white">
                          {providerReviewCount}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/55">Nota média</div>
                        <div className="mt-1 text-3xl font-semibold text-white">
                          {providerReviewCount > 0 ? (providerRating ?? '—') : '—'}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/55">{providerSpecialtySignals.operationLabel}</div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {providerOperationLine}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-white/60">
                          {providerSpecialtySignals.executionDesc}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/55">{providerSpecialtySignals.executionLabel}</div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {providerReviewCount > 0
                            ? 'Seu histórico profissional já começou a ganhar densidade pública.'
                            : providerSpecialtySignals.growthLine}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
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
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
                  <div className="border-b border-white/10 px-6 py-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                          {isProviderProfile ? 'Pipeline profissional público' : 'Registro público'}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {isProviderProfile ? 'Ainda sem histórico profissional público suficiente' : 'Ainda sem registros públicos'}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-white/70">
                          {isProviderProfile
                            ? 'No Marto, esse espaço cresce com serviços concluídos, checklist, avaliação e consistência real.'
                            : 'No Marto, o perfil público é consequência do que aconteceu, não um feed vazio.'}
                        </div>
                      </div>

                      <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/65">
                        {isProviderProfile ? 'Base em formação' : 'Aguardando eventos verificados'}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="px-6 py-6">
                      <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                        {isProviderProfile
                          ? 'Quando sua operação começar a gerar execuções verificadas, o perfil público passa a mostrar densidade profissional de verdade.'
                          : 'Seus pedidos podem existir, mas só viram “registro público” quando o Marto tiver os eventos verificados (compra, entrega, avaliação, serviço).'}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                          {isProviderProfile ? 'Serviços concluídos' : 'Compras verificadas'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                          {isProviderProfile ? 'Checklist e avaliação' : 'Entrega e avaliação'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                          {isProviderProfile ? 'Consistência operacional' : 'Histórico real do Marto'}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/10 bg-black/20 px-6 py-6 lg:border-l lg:border-t-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                        Próximo movimento
                      </div>
                      <div className="mt-2 text-sm leading-6 text-white/70">
                        {isProviderProfile
                          ? 'Fortaleça sua base profissional, comece a operar e deixe o histórico público nascer de execução verificável.'
                          : 'Complete sua jornada no ecossistema para transformar ações reais em leitura pública.'}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                    {isAuthed ? (
                      <>
                        <Link
                          href={dashFromHome(myHome)}
                          className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
                        >
                          Ir para minha central
                        </Link>

                        <Link
                          href={isProviderProfile ? '/dash/provider/profile' : '/me'}
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          {isProviderProfile ? 'Refinar base profissional' : 'Editar no meu perfil'}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
                        >
                          Criar minha conta Marto
                        </Link>

                        <Link
                          href="/login"
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Entrar
                        </Link>
                      </>
                    )}
                      </div>
                    </div>
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
