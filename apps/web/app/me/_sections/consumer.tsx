// apps/web/app/me/_sections/consumer.tsx
'use client';

import Link from 'next/link';

type Props = {
  primaryHref: string;
  showReviewCta?: boolean;
  reviewPendenciesCount?: number | null;
};

function Card({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur hover:bg-white/10"
    >
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-1 text-sm text-white/65">{desc}</div>
      <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">
        {cta}
        <span className="text-white/60">→</span>
      </div>
    </Link>
  );
}

export function ConsumerSections({
  primaryHref,
  showReviewCta,
  reviewPendenciesCount,
}: Props) {
  return (
    <section className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white/90">
            Seu próximo passo
          </h2>
          <p className="mt-1 text-sm text-white/65">
            O Marto não te dá feed — te dá consequência: agir → rastrear →
            decidir melhor.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Consumidor
        </span>
      </div>

      {/* Ações principais do consumidor */}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Card
          title="Abrir meu rastro"
          desc="Timeline do que aconteceu: pedido + entrega + avaliação."
          href={primaryHref}
          cta="Abrir"
        />

        <Card
          title="Explorar com segurança"
          desc="Catálogo guiado por reputação (sem conteúdo vazio)."
          href="/catalog"
          cta="Explorar"
        />

        <div className="rounded-3xl border border-white/15 bg-black/40 p-6 backdrop-blur md:col-span-1">
          <div className="text-xs font-semibold text-white/65">
            Regra do Marto
          </div>
          <div className="mt-2 text-sm font-semibold text-white/85">
            Reputação é ativo.
          </div>
          <div className="mt-2 text-sm text-white/70">
            Só conta o que é ligado ao real: compra, entrega, serviço, avaliação
            útil.
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={primaryHref}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Abrir rastro →
        </Link>

        {showReviewCta ? (
          <Link
            href="/review"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Fechar ciclo
            {typeof reviewPendenciesCount === 'number' &&
            reviewPendenciesCount > 0
              ? ` (${reviewPendenciesCount})`
              : ''}{' '}
            →
          </Link>
        ) : (
          <Link
            href="/catalog"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Explorar catálogo →
          </Link>
        )}
      </div>
    </section>
  );
}
