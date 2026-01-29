'use client';

import Link from 'next/link';
import { useMemo } from 'react';

function MartoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-neutral-950" />
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="absolute -top-48 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
    </div>
  );
}

function Card({
  title,
  desc,
  tag,
}: {
  title: string;
  desc: string;
  tag?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white">
            {title}
          </div>
          <div className="mt-1 text-sm text-white/65">{desc}</div>
        </div>
        {tag ? (
          <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70">
            {tag}
          </span>
        ) : null}
      </div>

      <div className="mt-4 inline-flex items-center rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-medium text-white/70">
        Em breve
      </div>
    </div>
  );
}

export default function FactoryReportsPage() {
  const mock = useMemo(() => {
    return {
      blocks: [
        {
          title: 'Relatório mensal',
          desc: 'Comparativo mês a mês: demanda, satisfação, retrabalho, defeitos.',
          tag: 'B2B',
        },
        {
          title: 'Top oportunidades',
          desc: 'Praças quentes, mix ideal, canal e ações recomendadas.',
          tag: 'Ação',
        },
        {
          title: 'Saúde do ecossistema',
          desc: 'Qualidade + campo + canal em um score operacional.',
          tag: 'Score',
        },
      ],
      next: [
        'Endpoint: /factories/me/reports/monthly (mês atual + anterior)',
        'Export: PDF/CSV (futuro)',
        'Assinatura: insights premium para fábricas',
      ],
    };
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <MartoBackground />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">
              Relatórios & insights
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Onde o Marto vira vantagem competitiva: dados que viram decisão.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                Página casca • MVP
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                Próximo: ligar no backend
              </span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/dash/factory/overview"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Visão geral
            </Link>
            <Link
              href="/factory"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Painel
            </Link>
            <Link
              href="/dash/factory/catalog"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Catálogo
            </Link>
          </nav>
        </header>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          {mock.blocks.map((b, i) => (
            <Card
              key={`${b.title}-${i}`}
              title={b.title}
              desc={b.desc}
              tag={b.tag}
            />
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <h2 className="text-base font-semibold text-white">
            Em construção (do jeito certo)
          </h2>
          <p className="mt-1 text-sm text-white/65">
            Relatórios aqui não são “gráfico bonito”. São decisão prática.
          </p>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Próximos blocos</div>
            <ul className="mt-2 grid gap-2 text-sm text-white/75">
              {mock.next.map((t, idx) => (
                <li
                  key={`${idx}`}
                  className="rounded-xl border border-white/10 bg-black/30 p-3"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
