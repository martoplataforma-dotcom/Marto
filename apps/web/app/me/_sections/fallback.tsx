'use client';

import Link from 'next/link';

type Home =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type MeResponse = {
  home?: Home;
  profile?: { handle?: string | null };
};

function homeLabel(home?: Home) {
  return home === 'factory'
    ? 'Fabricante'
    : home === 'merchant'
      ? 'Negócio'
      : home === 'service_provider'
        ? 'Prestador'
        : home === 'representative'
          ? 'Representante'
          : home === 'consumer'
            ? 'Consumidor'
            : 'Conta';
}

export function FallbackSections({
  me,
  primaryHref,
}: {
  me: MeResponse;
  primaryHref: string;
}) {
  // ✅ evita "unused" e ainda dá contexto visual
  const role = homeLabel(me?.home);

  return (
    <section className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white/90">Seu Marto</div>
          <div className="mt-1 text-sm text-white/65">
            Este módulo ainda não foi lapidado para o seu papel.
          </div>
        </div>

        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {role} • MVP
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={primaryHref}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Ir para meu próximo passo →
        </Link>

        <Link
          href="/catalog"
          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
        >
          Explorar catálogo
        </Link>
      </div>

      <div className="mt-5 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm text-white/70 backdrop-blur">
        No Marto, o que vale é histórico: execução, entrega, avaliação, recorrência.
      </div>
    </section>
  );
}
