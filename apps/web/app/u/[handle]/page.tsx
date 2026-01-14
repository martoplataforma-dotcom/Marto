'use client';

import Image from 'next/image';
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
};

type PublicProviderSnapshot = {
  // opcional (quando o backend passar)
  kind?: 'GENERIC' | 'TRANSPORTER' | null;
  city?: string | null;
  uf?: string | null;

  // resumo público (MVP)
  specialtiesLabel?: string | null; // "Entregador" | "Prestador"
  types?: { key: string; title: string }[]; // ex: express, agendada
  sla?: { pickupMinutes?: number; deliveryMinutes?: number; bias?: string };
  agendaSummary?: string | null; // ex: "Seg–Sex 09:00–18:00"
  regionSummary?: string | null; // ex: "Ubá/MG • raio 15 km"
};

type PublicUserResponse = {
  ok: boolean;

  // ✅ novo: home do usuário (pra montar o perfil por tipo)
  home?: Home;

  user: {
    handle: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    since: string;
  };

  // ✅ opcional: dados públicos do prestador (quando backend mandar)
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

function formatSince(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.getFullYear().toString();
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

export default function PublicUserProfilePage({ params }: Props) {
  const resolved = use(params);
  const handle = String(resolved?.handle ?? '').trim().toLowerCase();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<PublicUserResponse | null>(null);

  const [avatarSrc, setAvatarSrc] = useState<string>('/marto-m.svg');

  // ✅ links dinâmicos (baseado no home do usuário logado, não do perfil público)
  const [myHome, setMyHome] = useState<Home | null>(null);

  useEffect(() => {
    try {
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
      setMyHome(null);
    }
  }, []);

  const headerLinks = useMemo(() => {
    return {
      actions: dashFromHome(myHome),
      // agora que você alinhou: configurações do prestador é /dash/provider/profile,
      // mas “Minha conta” continua sendo /me (perfil do dono logado)
      settings: '/me',
    } as const;
  }, [myHome]);

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

        // ✅ IMPORTANTÍSSIMO: usa a rewrite do Next (/api -> backend)
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
    const next = data?.user?.avatarUrl || '/marto-m.svg';
    setAvatarSrc(next);
  }, [data?.user?.avatarUrl]);

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
  const events = data.events ?? [];
  const safeName = profile.name || titleFromHandle(profile.handle);

  const publicBadge = badgeFromPublic(data);


  // ✅ heurística “entregador vs prestador” (se backend não mandar)
  const providerLabel =
    data?.provider?.specialtiesLabel ??
    (data?.provider?.kind === 'TRANSPORTER' ? 'Transportadora' : 'Prestador');

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
                  <Image
                    src="/marto-m.svg"
                    alt="Marto"
                    width={20}
                    height={20}
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
                  href="/"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Início
                </Link>

                <Link
                  href={headerLinks.actions}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Minha central
                </Link>

                <Link
                  href={headerLinks.settings}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Minha conta
                </Link>
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
                <div className="relative h-16 w-16 overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/15">
                  <Image
                    src={avatarSrc}
                    alt={safeName}
                    fill
                    sizes="64px"
                    className="object-cover"
                    onError={() => setAvatarSrc('/marto-m.svg')}
                  />
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
                  <div className="mt-1 text-sm text-white/70">
                    @{profile.handle}
                  </div>

                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
                    {profile.bio ?? '—'}
                  </p>

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

              {/* Resumo */}
              <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Resumo público</div>
                    <div className="mt-1 text-xs text-white/65">
                      O que aparece aqui vem de ações no ecossistema.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                    MVP
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Stat label="Registros" value={String(data.stats.verifiedCount)} />
                  <Stat label="Desde" value={formatSince(profile.since)} />
                  <Stat label="Estado" value="Ativo" />
                </div>

                {/* ✅ extra: se backend mandar provider, mostra “Operação” (mesmo que home esteja consumer) */}
                {data.provider ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                    <div className="text-sm font-semibold text-white">
                      Operação ({providerLabel})
                    </div>
                    <div className="mt-2 text-sm text-white/70">
                      {data.provider?.regionSummary ??
                        (data.provider?.city || data.provider?.uf
                          ? `${data.provider?.city ?? '—'}/${data.provider?.uf ?? '—'}`
                          : 'Dados de operação serão exibidos quando o prestador ativar o perfil público.')}
                    </div>

                    {data.provider?.agendaSummary ? (
                      <div className="mt-2 text-xs text-white/60">
                        Agenda:{' '}
                        <span className="text-white/80">
                          {data.provider.agendaSummary}
                        </span>
                      </div>
                    ) : null}

                    {data.provider?.sla?.pickupMinutes ||
                    data.provider?.sla?.deliveryMinutes ? (
                      <div className="mt-2 text-xs text-white/60">
                        SLA:{' '}
                        <span className="text-white/80">
                          iniciar {String(data.provider?.sla?.pickupMinutes ?? '—')} min • concluir{' '}
                          {String(data.provider?.sla?.deliveryMinutes ?? '—')} min
                        </span>
                      </div>
                    ) : null}

                    {Array.isArray(data.provider?.types) &&
                    data.provider!.types!.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {data.provider!.types!.slice(0, 6).map((t) => (
                          <span
                            key={t.key}
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75"
                          >
                            {t.title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                    “O social do Marto é consequência do que aconteceu.”
                  </div>
                )}
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
                <button className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                  Tudo
                </button>
                <button className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                  Compras
                </button>
                <button className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                  Serviços
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {events.map((ev, idx) => (
                <PublicEventCard key={ev.id ?? `${idx}`} ev={ev} />
              ))}

              {events.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                  Ainda sem eventos públicos.
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
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold text-white/65">{label}</div>
      <div className="mt-2 truncate text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function PublicEventCard({ ev }: { ev: PublicEvent }) {
  const badge = ev.verified ? 'verificado' : 'em construção';

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
        <button className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
          Ver detalhes
        </button>
        <button className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
          Abrir experiência
        </button>
      </div>
    </div>
  );
}
