'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

type FactoryKpiItem = {
  value: string;
  hint?: string | null;
  delta?: string | null;
};

type FactoryKpis = {
  topSellers?: FactoryKpiItem | null;
  mostProblems?: FactoryKpiItem | null;
  reworkRate?: FactoryKpiItem | null;
  satisfaction?: FactoryKpiItem | null;
};

type FactorySignal = {
  kind: string;
  title: string;
  meta: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string | null;
  secondaryLabel?: string | null;
};

type FactoryOverviewSummary = {
  ok?: boolean;
  kpis?: FactoryKpis | null;
  signals?: FactorySignal[] | null;
};

type OrdersActionItem = {
  id: string;
  status: string;
  createdAt?: string | null;
  city?: string | null;
  state?: string | null;
};

type OrdersSummary = {
  ok?: boolean;
  counts?: Record<string, number> | null;
  needsActionCount?: number | null;
  needsAction?: OrdersActionItem[] | null;
};

type ComputedSignal = {
  kind: 'QUALIDADE' | 'CAMPO' | 'CANAL';
  title: string;
  meta: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

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

function KpiCard({
  title,
  value,
  hint,
  delta,
}: {
  title: string;
  value: string;
  hint?: string;
  delta?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-white/60">{title}</div>
        {delta ? (
          <span className="shrink-0 rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/70">
            {delta}
          </span>
        ) : null}
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>

      {hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </div>
  );
}

function SignalCard({
  kind,
  title,
  meta,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  kind: string;
  title: string;
  meta: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/70">
          {kind}
        </span>
        <span className="text-[11px] text-white/55">agora</span>
      </div>

      <div className="mt-2 text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs text-white/60">{meta}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={primaryHref}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
        >
          {primaryLabel}
        </Link>

        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function FactoryOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<FactoryOverviewSummary | null>(null);

  const [ordersSummary, setOrdersSummary] = useState<OrdersSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetchJSON<FactoryOverviewSummary>(
          '/factories/me/overview/summary',
          { method: 'GET' },
        );

        setData(res);
      } catch (e) {
        const a = e as ApiError;
        setError(`${a.status} - ${a.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJSON<OrdersSummary>('/factories/me/orders/summary', {
          method: 'GET',
        });
        setOrdersSummary(res);
      } catch {
        // não quebra o overview se falhar
      }
    })();
  }, []);

  // ✅ sinais “vivos” (derivados dos status)
  const computedSignals = useMemo<ComputedSignal[]>(() => {
    const counts = (ordersSummary?.counts ?? {}) as Record<string, number>;

    const n = (k: string) => Number(counts?.[k] ?? 0);

    const signals: ComputedSignal[] = [];

    const returnReq = n('RETURN_REQUESTED');
    const readyPickup = n('READY_FOR_PICKUP');
    const confirmed = n('CONFIRMED_BY_SELLER');
    const delivered = n('DELIVERED');
    const completed = n('COMPLETED');

    // QUALIDADE: devolução/retorno
    if (returnReq > 0) {
      signals.push({
        kind: 'QUALIDADE',
        title: `Devolução em andamento: ${returnReq} pedido(s)`,
        meta: 'Sinal de qualidade/pós-venda. Investigue causa e evidência.',
        primaryHref: '/dash/factory/quality',
        primaryLabel: 'Abrir qualidade',
        secondaryHref: '/dash/factory/orders',
        secondaryLabel: 'Ver pedidos',
      });
    }

    // CAMPO: acúmulo em coleta/retirada/expedição
    if (readyPickup > 0) {
      signals.push({
        kind: 'CAMPO',
        title: `Acúmulo para retirada: ${readyPickup} pedido(s)`,
        meta: 'Sinal operacional. Pode virar atraso e reclamação.',
        primaryHref: '/dash/factory/field',
        primaryLabel: 'Abrir campo',
        secondaryHref: '/dash/factory/orders',
        secondaryLabel: 'Ver pedidos',
      });
    }

    // CAMPO: confirmação pendente do seller (processo travando)
    if (confirmed > 0) {
      signals.push({
        kind: 'CAMPO',
        title: `Aguardando confirmação do seller: ${confirmed} pedido(s)`,
        meta: 'Sinal de fluxo travado. Padronize aprovação e SLA interno.',
        primaryHref: '/dash/factory/field',
        primaryLabel: 'Abrir campo',
        secondaryHref: '/dash/factory/orders',
        secondaryLabel: 'Ver pedidos',
      });
    }

    // CANAL: entrega/conclusão como “sinal de demanda e reputação”
    if (completed > 0) {
      signals.push({
        kind: 'CANAL',
        title: `Concluídos: ${completed} pedido(s)`,
        meta: 'Sinal de demanda + reputação. Hora de escalar praça e canal.',
        primaryHref: '/dash/factory/regions',
        primaryLabel: 'Abrir regiões',
        secondaryHref: '/dash/factory/reports',
        secondaryLabel: 'Ver relatórios',
      });
    } else if (delivered > 0) {
      signals.push({
        kind: 'CANAL',
        title: `Entregues recentemente: ${delivered} pedido(s)`,
        meta: 'Sinal bom. Próximo passo: pós-serviço e prova social.',
        primaryHref: '/dash/factory/reports',
        primaryLabel: 'Ver relatórios',
        secondaryHref: '/dash/factory/orders',
        secondaryLabel: 'Ver pedidos',
      });
    }

    // no máximo 3 (pra ficar “cirúrgico”)
    return signals.slice(0, 3);
  }, [ordersSummary]);

  const opsScore = useMemo(() => {
    const counts = (ordersSummary?.counts ?? {}) as Record<string, number>;
    const n = (k: string) => Number(counts?.[k] ?? 0);

    const returnReq = n('RETURN_REQUESTED'); // qualidade/pós-venda
    const readyPickup = n('READY_FOR_PICKUP'); // operação travando
    const confirmed = n('CONFIRMED_BY_SELLER'); // fluxo travado
    const needs = Number(ordersSummary?.needsActionCount ?? 0);

    // base
    let score = 100;

    // penalidades (MVP) — simples e previsível
    score -= returnReq * 18; // devolução pesa bastante
    score -= readyPickup * 8; // acúmulo pesa médio
    score -= confirmed * 6; // travas leves/médias
    score -= needs * 5; // “ação” geral

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    let label: 'Excelente' | 'Atenção' | 'Crítico' = 'Excelente';
    let hint = 'Operação saudável. Hora de escalar com segurança.';

    if (score < 75) {
      label = 'Atenção';
      hint = 'Tem acúmulo/travas. Ajuste processo antes de escalar.';
    }
    if (score < 45) {
      label = 'Crítico';
      hint = 'Qualidade/fluxo viraram risco. Priorize correção imediata.';
    }

    return {
      score,
      label,
      hint,
      breakdown: { returnReq, readyPickup, confirmed, needs },
    };
  }, [ordersSummary]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <MartoBackground />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">
              Visão geral • Fabricante
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Sinal → causa → ação. Um painel que fala a língua da indústria.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                MVP • mock local
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                Próximo: ligar no backend
              </span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/dash/factory"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Voltar ao painel
            </Link>

            <Link
              href="/dash/factory/catalog"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Catálogo
            </Link>

            <Link
              href="/dash/factory/orders"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Pedidos
            </Link>
          </nav>
        </header>

        {/* Loading/Erro */}
        {error ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-5 text-sm text-white/70">
            Carregando visão geral…
          </div>
        ) : null}

        {/* KPIs */}
        <section className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Produtos mais vendidos"
            value={data?.kpis?.topSellers?.value ?? '—'}
            hint={data?.kpis?.topSellers?.hint ?? undefined}
            delta={data?.kpis?.topSellers?.delta ?? undefined}
          />
          <KpiCard
            title="Mais problemas"
            value={data?.kpis?.mostProblems?.value ?? '—'}
            hint={data?.kpis?.mostProblems?.hint ?? undefined}
            delta={data?.kpis?.mostProblems?.delta ?? undefined}
          />
          <KpiCard
            title="Taxa de retrabalho"
            value={data?.kpis?.reworkRate?.value ?? '—'}
            hint={data?.kpis?.reworkRate?.hint ?? undefined}
            delta={data?.kpis?.reworkRate?.delta ?? undefined}
          />
          <KpiCard
            title="Satisfação geral"
            value={data?.kpis?.satisfaction?.value ?? '—'}
            hint={data?.kpis?.satisfaction?.hint ?? undefined}
            delta={data?.kpis?.satisfaction?.delta ?? undefined}
          />
        </section>

        {/* Pedidos (por status) */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Pedidos (por status)
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Primeiro dado vivo do fabricante (MVP).
              </p>
            </div>

            <Link
              href="/dash/factory/orders"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              Ver pedidos
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(ordersSummary?.counts ?? {})
              .slice(0, 8)
              .map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-xs text-white/60">{k}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {Number(v ?? 0)}
                  </div>
                </div>
              ))}
          </div>

          {ordersSummary?.needsAction?.length ? (
            <div className="mt-4">
              <div className="text-xs text-white/60">Precisa de ação</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {ordersSummary.needsAction.map((o: OrdersActionItem, i: number) => (
                  <div
                    key={`${o.id}-${i}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-white">
                        {o.status}
                      </div>
                      <div className="text-[11px] text-white/55">
                        {o.state ?? '—'}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {o.city ?? '—'} • {String(o.id).slice(0, 8)}…
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-xs text-white/55">
              Sem ações pendentes agora.
            </div>
          )}
        </section>

        {/* Saúde do ecossistema */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Saúde do ecossistema
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Score operacional (MVP) baseado em ações pendentes e fricção do
                fluxo.
              </p>
            </div>

            <Link
              href="/dash/factory/reports"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              Abrir relatórios
            </Link>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Score</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-4xl font-semibold text-white">
                  {opsScore.score}
                </div>
                <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/70">
                  {opsScore.label}
                </span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
                <div
                  className="h-full bg-white/70"
                  style={{ width: `${opsScore.score}%` }}
                />
              </div>

              <div className="mt-3 text-sm text-white/70">{opsScore.hint}</div>
              <div className="mt-2 text-xs text-white/55">
                Quanto mais perto de 100, mais pronto pra escalar.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
              <div className="text-xs text-white/60">O que está puxando o score</div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">Devoluções</div>
                  <div className="mt-1 text-xs text-white/60">
                    RETURN_REQUESTED: {opsScore.breakdown.returnReq}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">Acúmulo</div>
                  <div className="mt-1 text-xs text-white/60">
                    READY_FOR_PICKUP: {opsScore.breakdown.readyPickup}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">Travas</div>
                  <div className="mt-1 text-xs text-white/60">
                    CONFIRMED_BY_SELLER: {opsScore.breakdown.confirmed}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">
                    Ações pendentes
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    needsAction: {opsScore.breakdown.needs}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-white/55">
                Em breve: o score incorpora instalação (SLA) + qualidade por
                modelo/lote + reputação (posts verificados).
              </div>
            </div>
          </div>
        </section>

        {/* Sinais */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Últimos sinais</h2>
              <p className="mt-1 text-sm text-white/65">
                O ecossistema falando com você: qualidade, campo e canal.
              </p>
            </div>

            <Link
              href="/factory"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              Abrir ações recomendadas
            </Link>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {computedSignals.length ? (
              computedSignals.map((s, index) => (
                <SignalCard
                  key={`${s.kind}-${index}`}
                  kind={s.kind}
                  title={s.title}
                  meta={s.meta}
                  primaryHref={s.primaryHref}
                  primaryLabel={s.primaryLabel}
                  secondaryHref={s.secondaryHref}
                  secondaryLabel={s.secondaryLabel}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-3">
                <div className="text-sm font-semibold text-white">
                  Sem sinais críticos agora
                </div>
                <div className="mt-1 text-sm text-white/65">
                  Quando houver acúmulo, devolução ou travas de fluxo, os sinais
                  aparecem aqui automaticamente.
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-white/55">
            Sinais gerados automaticamente a partir dos status de pedidos (MVP).
          </div>
        </section>

        {/* Ações rápidas */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dash/factory/quality"
            className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
          >
            <div className="text-base font-semibold text-white">
              Defeitos & qualidade
            </div>
            <div className="mt-1 text-sm text-white/65">
              Causa raiz, retrabalho e impacto na reputação.
            </div>
            <div className="mt-4 inline-flex rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white">
              Abrir
            </div>
          </Link>

          <Link
            href="/dash/factory/field"
            className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
          >
            <div className="text-base font-semibold text-white">
              Instalação & campo
            </div>
            <div className="mt-1 text-sm text-white/65">
              Evidência, checklist e SLA por região.
            </div>
            <div className="mt-4 inline-flex rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white">
              Abrir
            </div>
          </Link>

          <Link
            href="/dash/factory/regions"
            className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
          >
            <div className="text-base font-semibold text-white">
              Regiões & canal
            </div>
            <div className="mt-1 text-sm text-white/65">
              Demanda, praça, oportunidade e expansão.
            </div>
            <div className="mt-4 inline-flex rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white">
              Abrir
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
