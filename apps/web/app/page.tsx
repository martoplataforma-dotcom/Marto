'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type MeResponse = {
  roles?: unknown;
  needsRoleChoice?: boolean;
  home?: 'consumer' | 'merchant' | 'service_provider' | 'representative';
};

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        setChecking(false);
        return;
      }

      try {
        const res = await fetch('http://localhost:3001/api/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setChecking(false);
          return;
        }

        const me = (await res.json()) as MeResponse;

        const needsRoleChoice = me.needsRoleChoice === true || !me.home;

        if (needsRoleChoice) {
          router.replace('/choose-role');
          return;
        }

        if (me.home === 'merchant') {
          router.replace('/dash/merchant');
        } else if (me.home === 'service_provider') {
          router.replace('/dash/provider');
        } else if (me.home === 'representative') {
          router.replace('/dash/representative');
        } else {
          router.replace('/dash/consumer');
        }
      } catch {
        setChecking(false);
      }
    })();
  }, [router]);

  const year = useMemo(() => new Date().getFullYear(), []);

  if (checking) {
    return (
      <main className="min-h-[calc(100vh-0px)] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-center justify-between">
            <div className="h-10 w-28 animate-pulse rounded-xl bg-zinc-100" />
            <div className="flex gap-2">
              <div className="h-10 w-24 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-10 w-28 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="h-10 w-3/4 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-5 w-2/3 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-5 w-1/2 animate-pulse rounded-xl bg-zinc-100" />

              <div className="mt-6 flex gap-2">
                <div className="h-11 w-40 animate-pulse rounded-xl bg-zinc-100" />
                <div className="h-11 w-28 animate-pulse rounded-xl bg-zinc-100" />
              </div>
            </div>

            <div className="rounded-3xl border bg-zinc-50 p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-28 animate-pulse rounded-2xl bg-white" />
                <div className="h-28 animate-pulse rounded-2xl bg-white" />
                <div className="h-28 animate-pulse rounded-2xl bg-white" />
                <div className="h-28 animate-pulse rounded-2xl bg-white" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      {/* Topbar */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black">
              <Image
                src="/marto-m.svg"
                alt="Marto"
                width={20}
                height={20}
                priority
              />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold">Marto</div>
              <div className="text-xs text-zinc-600">
                Compra + serviço + experiência real, num fluxo só.
              </div>
            </div>
          </div>

          <nav>
            <Link
              href="/register"
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Criar histórico
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[56rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
                Fluxo real. Histórico real.
              </div>

              <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl">
                Marto
              </h1>

              <p className="mt-3 text-2xl font-semibold text-white/90">
                Porque reputação importa.
              </p>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
                Compra e serviço não viram conversa.
                <br />
                Viram <span className="font-semibold text-white/90">histórico</span>.
              </p>

              <p className="mt-3 text-sm text-white/60">
                Para quem prefere histórico a promessa.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="rounded-2xl bg-white px-7 py-4 text-sm font-semibold text-black hover:opacity-90"
                >
                  Criar meu histórico
                </Link>

                <Link
                  href="/login"
                  className="rounded-2xl border border-white/20 px-7 py-4 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Entrar
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Avaliação nasce do que aconteceu
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Reputação que permanece
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Relação direta
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Rastro de reputação</div>
                  <div className="mt-1 text-xs text-white/65">
                    O social do Marto é consequência do que aconteceu.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                  fluxo ativo (MVP)
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <TrailCard
                  title="Compra registrada"
                  meta="Consumidor • agora"
                  desc="Uma ação real cria o histórico."
                />
                <TrailCard
                  title="Serviço concluído"
                  meta="Prestador • hoje"
                  desc="Entrega e resultado ficam registrados."
                />
                <TrailCard
                  title="Avaliação vinculada"
                  meta="Experiência • 5★"
                  desc="Reputação nasce do ocorrido."
                />
                <TrailCard
                  title="Relação construída"
                  meta="Retorno • recorrência"
                  desc="Confiança gera retorno. Não anúncio."
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/70">
                  “Sem feed. Sem barulho. Só histórico.”
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <div>© {year} Marto</div>
          <div className="flex flex-wrap gap-3">
            <span>Fluxo</span>
            <span>•</span>
            <span>Confiança</span>
            <span>•</span>
            <span>Histórico</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function TrailCard({
  title,
  meta,
  desc,
}: {
  title: string;
  meta: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-[11px] text-white/55">{meta}</div>
      </div>
      <div className="mt-1 text-xs text-white/70">{desc}</div>
    </div>
  );
}
