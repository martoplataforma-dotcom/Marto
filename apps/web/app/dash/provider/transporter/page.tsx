'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

type Transporter = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  city: string | null;
  state: string | null;
  serviceArea: unknown | null;
  serviceProviderId: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceProviderKind = 'GENERIC' | 'TRANSPORTER';

type ServiceProviderMe = {
  id?: string;
  cpf: string;
  city?: string | null;
  cepPrefix?: string | null;
  status: string;
  kind?: ServiceProviderKind;
  transporter?: Transporter | null;
};

type ServiceArea = {
  cities?: string[];
  radiusKm?: number;
};

function asServiceArea(value: unknown): ServiceArea | null {
  if (!value || typeof value !== 'object') return null;
  return value as ServiceArea;
}

/**
 * ✅ Visual Marto (dark + grid + glows + canvas glass)
 * (somente visual — organização da página mantida)
 */
function MartoShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
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
          {children}
        </div>
      </div>
    </main>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}

function Card({
  title,
  desc,
  badge,
  children,
}: {
  title: string;
  desc?: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-base font-semibold text-white">{title}</div>
        {badge ? <Pill>{badge}</Pill> : null}
      </div>
      {desc ? <p className="text-sm text-white/60">{desc}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function QuickAction({
  title,
  desc,
  href,
  disabled,
}: {
  title: string;
  desc: string;
  href: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 opacity-70">
        <div className="text-base font-semibold text-white">{title}</div>
        <p className="mt-2 text-sm text-white/60">{desc}</p>
        <div className="mt-4 text-sm font-semibold text-white/80">Em breve →</div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group block rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-md"
    >
      <div className="text-base font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-white/60">{desc}</p>
      <div className="mt-4 text-sm font-semibold text-white/90">
        Abrir{' '}
        <span className="inline-block transition group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}

const MARTO_BUTTON =
  'rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10';

export default function TransporterDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [me, setMe] = useState<ServiceProviderMe | null>(null);

  const transporter = me?.transporter ?? null;

  const headline = useMemo(() => {
    return transporter?.name ? transporter.name : 'Central de Operação';
  }, [transporter?.name]);

  const areaText = useMemo(() => {
    const a = asServiceArea(transporter?.serviceArea ?? null);
    if (!a) return 'Área não definida (recomendado configurar)';

    const cities = Array.isArray(a.cities) ? a.cities.filter(Boolean) : [];
    const radius = typeof a.radiusKm === 'number' ? a.radiusKm : null;

    const parts: string[] = [];
    if (cities.length)
      parts.push(
        cities.slice(0, 3).join(', ') + (cities.length > 3 ? '…' : ''),
      );
    if (radius) parts.push(`${radius} km`);
    return parts.join(' • ') || 'Área definida';
  }, [transporter?.serviceArea]);

  async function load() {
    try {
      setLoading(true);
      setMsg('');

      const sp = await fetchJSON<ServiceProviderMe | null>(
        '/service-providers/me',
      );
      setMe(sp);

      if (sp && sp.kind !== 'TRANSPORTER') {
        setMsg(
          'Seu perfil não está como transportadora. Ative no painel do prestador.',
        );
      }
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function switchToGeneric() {
    if (!me) return;

    const cpf = String(me.cpf ?? '').trim();
    if (!cpf) {
      setMsg('Para mudar o tipo, complete seu CPF no perfil.');
      return;
    }

    try {
      setSwitching(true);
      setMsg('');

      await fetchJSON('/service-providers/me', {
        method: 'PUT',
        body: JSON.stringify({
          cpf,
          city: me.city ?? undefined,
          cepPrefix: me.cepPrefix ?? undefined,
          kind: 'GENERIC',
        }),
      });

      router.push('/dash/provider');
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setSwitching(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <MartoShell>
      {/* mantém a organização original: header -> msg -> loading/empty -> sections */}
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Pill>Transportadora</Pill>
              <Pill>Status: {me?.status ?? '—'}</Pill>
              <Pill>Tipo: {transporter?.type ?? '—'}</Pill>
            </div>

            <h1 className="text-2xl font-semibold text-white">{headline}</h1>

            <p className="mt-2 text-sm text-white/60">
              Central de Operação no Marto — visão rápida do dia e próximos
              passos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className={`${MARTO_BUTTON} disabled:opacity-50`}
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>

            <button
              type="button"
              onClick={() => void switchToGeneric()}
              disabled={loading || switching}
              className={`${MARTO_BUTTON} disabled:opacity-50`}
            >
              {switching ? 'Mudando…' : 'Voltar para Prestador'}
            </button>

            <Link href="/dash/provider/profile" className={MARTO_BUTTON}>
              Configurações
            </Link>
          </div>
        </header>

        {msg ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {msg}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-white/60">Carregando…</p>
        ) : !me ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Não encontrei seu perfil. Complete seu cadastro em{' '}
            <Link href="/dash/provider/profile" className="font-semibold underline">
              Meu perfil
            </Link>
            .
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Card title="Entregas hoje" desc="Painel rápido do dia (mock)." badge="Em breve">
                <div className="grid gap-2 text-sm text-white/70">
                  <div className="flex items-center justify-between">
                    <span>Em rota</span>
                    <span className="font-semibold text-white">—</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Entregues</span>
                    <span className="font-semibold text-white">—</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pendentes</span>
                    <span className="font-semibold text-white">—</span>
                  </div>
                </div>
              </Card>

              <Card title="SLA & Ocorrências" desc="Alertas e eventos críticos (mock)." badge="Em breve">
                <p className="text-sm text-white/70">
                  Quando tivermos eventos de entrega, o Marto destaca atrasos, tentativas e exceções aqui.
                </p>
              </Card>

              <Card
                title="Área atendida"
                desc="Onde você opera hoje."
                badge={transporter?.serviceArea ? 'Definida' : 'Pendente'}
              >
                <div className="text-sm text-white/70">{areaText}</div>
                <div className="mt-3">
                  <Link
                    href="/dash/provider/profile"
                    className="text-sm font-semibold text-white/90 underline"
                  >
                    Configurar área →
                  </Link>
                </div>
              </Card>
            </section>

            <section className="mt-6">
              <div className="mb-3 text-sm font-semibold text-white">
                Ações rápidas
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <QuickAction
                  title="Criar rota"
                  desc="Monte rota, sequência e paradas. Depois a gente pluga otimização."
                  href="#"
                  disabled
                />

                <QuickAction
                  title="Ver entregas"
                  desc="Lista de entregas atribuídas, status, ocorrências e comprovantes."
                  href="#"
                  disabled
                />

                <QuickAction
                  title="Prova de entrega"
                  desc="Foto/assinatura e timeline. Transparência total pro cliente."
                  href="#"
                  disabled
                />

                <QuickAction
                  title="Configurações"
                  desc="Nome, cidade/UF, área atendida e preferências."
                  href="/dash/provider/profile"
                />
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-2 text-sm font-semibold text-white">Base</div>
              <div className="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                <div>
                  <span className="text-white/50">Cidade:</span>{' '}
                  <span className="font-semibold text-white">{me.city ?? '—'}</span>
                </div>
                <div>
                  <span className="text-white/50">CEP Prefixo:</span>{' '}
                  <span className="font-semibold text-white">{me.cepPrefix ?? '—'}</span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </MartoShell>
  );
}
