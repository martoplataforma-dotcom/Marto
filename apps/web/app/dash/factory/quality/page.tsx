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
  href,
  tag,
}: {
  title: string;
  desc: string;
  href?: string;
  tag?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-white/5">
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

      {href ? (
        <div className="mt-4 inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white">
          Abrir
        </div>
      ) : (
        <div className="mt-4 inline-flex items-center rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-medium text-white/70">
          Em breve
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function FactoryQualityPage() {
  const mock = useMemo(() => {
    return {
      highlights: [
        {
          title: 'Defeitos recorrentes',
          desc: 'Ranking por modelo, lote e etapa (tampo, ferragem, embalagem).',
          tag: 'Core',
        },
        {
          title: 'Causa raiz',
          desc: 'Agrupar sinais por “origem provável”: projeto, produção, transporte, instalação.',
          tag: 'Ação',
        },
        {
          title: 'Retrabalho & custo',
          desc: 'Quanto retrabalho está queimando margem (tempo + material + reputação).',
          tag: 'Métricas',
        },
      ],
      next: [
        'Endpoint: /factories/me/quality/summary (top defeitos, top modelos)',
        'Tabela: defeito → modelo → lote → região → % impacto',
        'Ação rápida: “abrir investigação” + anexar evidências',
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
              Defeitos & qualidade
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Menos reclamação. Mais causa raiz. Qualidade que vira reputação.
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
          {mock.highlights.map((h, i) => (
            <Card
              key={`${h.title}-${i}`}
              title={h.title}
              desc={h.desc}
              tag={h.tag}
            />
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-white">
              Em construção (do jeito certo)
            </h2>
            <p className="text-sm text-white/65">
              Aqui vai nascer o painel de qualidade do Marto: sinal → causa →
              ação.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Atalhos</div>
              <div className="mt-3 grid gap-2">
                <Link
                  href="/dash/factory/field"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                >
                  Instalação & campo
                </Link>
                <Link
                  href="/dash/factory/regions"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                >
                  Regiões & canal
                </Link>
                <Link
                  href="/dash/factory/orders"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                >
                  Pedidos
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/55">
                Quando o backend estiver pronto, esses atalhos viram drill-down
                automático do defeito → contexto.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
