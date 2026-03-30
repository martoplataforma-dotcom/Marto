'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type MeResponse = {
  roles?: unknown;
  needsRoleChoice?: boolean;
  activeRole?:
    | 'CONSUMER'
    | 'MERCHANT'
    | 'SERVICE_PROVIDER'
    | 'REPRESENTATIVE'
    | 'FACTORY'
    | 'CARRIER';
  home?:
    | 'consumer'
    | 'merchant'
    | 'service_provider'
    | 'representative'
    | 'factory';
};

function homeFromActiveRole(
  activeRole?: MeResponse['activeRole'] | null,
): MeResponse['home'] {
  switch (activeRole) {
    case 'MERCHANT':
      return 'merchant';
    case 'SERVICE_PROVIDER':
      return 'service_provider';
    case 'REPRESENTATIVE':
      return 'representative';
    case 'FACTORY':
      return 'factory';
    default:
      return 'consumer';
  }
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function MartoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-neutral-950" />
      <div className="absolute -top-48 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.10),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.06),transparent_40%)]" />
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80">
      {children}
    </span>
  );
}

function Rule({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-white/70">{desc}</div>
    </div>
  );
}

function ProofRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-xs text-white/65">{label}</div>
      <div className="text-xs font-semibold text-white/85">{value}</div>
    </div>
  );
}

function VerifiedPostCard() {
  return (
    <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Marto Social — post verificado
          </div>
          <div className="mt-1 text-xs text-white/65">
            Aqui o post nasce do que aconteceu.
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
          verificado
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Pill>produto marcado</Pill>
        <Pill>loja marcada</Pill>
        <Pill>serviço marcado</Pill>
      </div>

      {/* “mídias reais” (placeholder) */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="aspect-[4/3] rounded-2xl border border-white/10 bg-black/40" />
        <div className="aspect-[4/3] rounded-2xl border border-white/10 bg-black/40" />
      </div>

      {/* texto do post (exemplo do arquivo) */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-xs text-white/75">
          “Comprei esse guarda-roupa na Loja X.
          <br />
          Montagem concluída — ficou perfeito. Recomendo.”
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
            antes/depois
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
            avaliação vinculada
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
            pontos ganhos
          </span>
        </div>
      </div>

      {/* prova / vínculo (o “não dá pra mentir”) */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold text-white/85">
          Prova do registro
        </div>

        <div className="mt-3 grid gap-2">
          <ProofRow label="Vínculo" value="pedido + serviço" />
          <ProofRow label="Evidências" value="fotos + notas + checklist" />
          <ProofRow label="Consequência" value="reputação atualizada" />
        </div>
      </div>

      {/* botões (sem prometer feature — só vibe de ecossistema) */}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold text-white/85 hover:bg-white/15"
        >
          Ver produto
        </button>
        <button
          type="button"
          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold text-white/85 hover:bg-white/15"
        >
          Ver serviço
        </button>
        <button
          type="button"
          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold text-white/85 hover:bg-white/15"
        >
          Ver histórico
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-xs text-white/70">
          Sem vínculo + sem evidência, não aparece no feed principal.
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const year = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        setChecking(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setChecking(false);
          return;
        }

        const me = (await res.json()) as MeResponse;
        const resolvedHome = me.activeRole
          ? homeFromActiveRole(me.activeRole)
          : me.home;
        const needsRoleChoice = me.needsRoleChoice === true || !resolvedHome;

        if (needsRoleChoice) {
          router.replace('/choose-role');
          return;
        }

        if (resolvedHome === 'factory') router.replace('/dash/factory');
        else if (resolvedHome === 'merchant') router.replace('/dash/merchant');
        else if (resolvedHome === 'service_provider')
          router.replace('/dash/provider/services');
        else if (resolvedHome === 'representative')
          router.replace('/dash/representative');
        else router.replace('/dash/consumer');
      } catch {
        setChecking(false);
      }
    })();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white">
        <MartoBackground />
        <div className="mx-auto max-w-6xl p-6">
          <div className="flex items-center justify-between py-2">
            <div className="h-10 w-40 animate-pulse rounded-2xl bg-white/10" />
            <div className="flex gap-2">
              <div className="h-10 w-24 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-10 w-28 animate-pulse rounded-2xl bg-white/10" />
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-5 w-2/3 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-5 w-1/2 animate-pulse rounded-2xl bg-white/10" />
              <div className="mt-6 flex gap-2">
                <div className="h-11 w-40 animate-pulse rounded-2xl bg-white/10" />
                <div className="h-11 w-28 animate-pulse rounded-2xl bg-white/10" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-28 animate-pulse rounded-2xl bg-black/30" />
                <div className="h-28 animate-pulse rounded-2xl bg-black/30" />
                <div className="h-28 animate-pulse rounded-2xl bg-black/30" />
                <div className="h-28 animate-pulse rounded-2xl bg-black/30" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <MartoBackground />

      {/* Topbar (Marto style) */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
              <Image
                src="/marto-m.svg"
                alt="Marto"
                width={20}
                height={20}
                priority
              />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold text-white/90">Marto</div>
              <div className="text-xs text-white/65">
                Social útil. Autêntico. Conectado ao comércio real.
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Criar histórico
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl p-6">
        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
              Aqui não dá pra mentir.
            </div>

            <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
              Marto Social
            </h1>

            <p className="mt-4 text-2xl font-semibold text-white/90">
              O social do mundo real.
            </p>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
              O Marto só permite posts conectados a algo REAL: produto, loja e
              experiência (compra/serviço). Sem conteúdo vazio. Sem vaidade.
              Aqui, utilidade vira destaque.
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
                className="rounded-2xl border border-white/15 bg-white/10 px-7 py-4 text-sm font-semibold text-white hover:bg-white/15"
              >
                Entrar
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/65">
              <Pill>produto + loja marcados</Pill>
              <Pill>experiência real</Pill>
              <Pill>evidência</Pill>
              <Pill>pontos por utilidade</Pill>
            </div>

            <div className="mt-8 grid gap-3">
              <Rule
                title="Regra 1 — Post precisa ser real"
                desc="Sem produto/loja/experiência marcada, não entra no feed principal."
              />
              <Rule
                title="Regra 2 — O Marto não premia vaidade"
                desc="O algoritmo favorece antes/depois, avaliação, conteúdo técnico e útil."
              />
              <Rule
                title="Regra 3 — Reputação é consequência"
                desc="A reputação nasce do ocorrido (vínculo + evidência), não de opinião solta."
              />
            </div>
          </div>

          {/* O “PÁ” visual do Marto */}
          <VerifiedPostCard />
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl p-6 pb-12">
        <div className="mt-12 border-t border-white/10 pt-8 text-xs text-white/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              © {year} Marto •{' '}
              <span className="text-white/75">social produtivo</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <span>Registro</span>
              <span>•</span>
              <span>Evidência</span>
              <span>•</span>
              <span>Reputação</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
