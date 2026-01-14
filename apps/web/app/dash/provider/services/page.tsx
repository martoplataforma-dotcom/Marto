'use client';

import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'marto_provider_service_specialties_v1';

// ✅ KEYS + helpers (Prontidão)
const KEYS = {
  agenda: 'marto_provider_agenda_v1',
  region: 'marto_provider_region_v1',
  types: 'marto_provider_delivery_types_v1',
  sla: 'marto_provider_sla_v1',
};

function isAgendaReady(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return Object.values(obj).some((d) => {
    if (!d || typeof d !== 'object') return false;
    const day = d as Record<string, unknown>;
    const enabled = Boolean(day.enabled);
    const windows = day.windows;
    return enabled && Array.isArray(windows) && windows.length > 0;
  });
}

function isRegionReady(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  const city = String(obj.city ?? '').trim();
  const uf = String(obj.state ?? '').trim();
  const cepDigits = String(obj.baseCep ?? '').replace(/\D/g, '');
  return !!city && uf.length === 2 && cepDigits.length === 8;
}

function isSlaReady(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  const pickup = Number(obj.pickupMinutes);
  const total = Number(obj.deliveryMinutes);
  return Number.isFinite(pickup) && Number.isFinite(total) && total >= pickup;
}

function isTypesReady(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={[
        'rounded-full border px-3 py-1 text-xs font-semibold',
        ok
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-white/10 bg-white/5 text-white/70',
      ].join(' ')}
    >
      {ok ? '✓' : '•'} {label}
    </span>
  );
}

// ====== storage: specialties (modo entrega/serviço) ======

function subscribeStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) callback();
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

function getRawSpecialties(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function parseSpecialties(raw: string): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ====== storage: prontidão (agenda/region/types/sla) ======

function subscribeAnyStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: StorageEvent) => {
    if (e.key === null) return callback();
    if (Object.values(KEYS).includes(e.key) || e.key === STORAGE_KEY) callback();
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

function getRawKey(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function parseJSON(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

// ===== UI components (Marto dark) =====

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  cta,
  disabled,
}: {
  title: string;
  desc: string;
  cta: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur hover:bg-white/10 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <p className="mt-1 text-sm text-white/65">{desc}</p>
        </div>

        <span
          className={[
            'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
            disabled
              ? 'border-white/10 bg-white/5 text-white/55'
              : 'border-white/15 bg-white text-black',
          ].join(' ')}
        >
          {cta}
        </span>
      </div>
    </div>
  );
}

export default function ProviderServicesPage() {
  // ✅ snapshot STÁVEL: string do localStorage (specialties)
  const raw = useSyncExternalStore(subscribeStorage, getRawSpecialties, () => '');

  // ✅ parse só quando o raw mudar
  const specialties = useMemo(() => parseSpecialties(raw), [raw]);

  const isDelivery = useMemo(() => specialties.includes('delivery'), [specialties]);

  // ✅ snapshots reais para prontidão
  const agendaRaw = useSyncExternalStore(
    subscribeAnyStorage,
    () => getRawKey(KEYS.agenda),
    () => '',
  );

  const regionRaw = useSyncExternalStore(
    subscribeAnyStorage,
    () => getRawKey(KEYS.region),
    () => '',
  );

  const typesRaw = useSyncExternalStore(
    subscribeAnyStorage,
    () => getRawKey(KEYS.types),
    () => '',
  );

  const slaRaw = useSyncExternalStore(
    subscribeAnyStorage,
    () => getRawKey(KEYS.sla),
    () => '',
  );

  const readiness = useMemo(() => {
    const agenda = parseJSON(agendaRaw);
    const region = parseJSON(regionRaw);
    const types = parseJSON(typesRaw);
    const sla = parseJSON(slaRaw);

    const agendaOk = isAgendaReady(agenda);
    const regionOk = isRegionReady(region);
    const typesOk = isTypesReady(types);
    const slaOk = isSlaReady(sla);

    const done = [agendaOk, regionOk, typesOk, slaOk].filter(Boolean).length;

    return { agendaOk, regionOk, typesOk, slaOk, done, total: 4 };
  }, [agendaRaw, regionRaw, typesRaw, slaRaw]);

  const title = isDelivery ? 'Central de Entregas' : 'Central de Serviços';
  const subtitle = isDelivery
    ? 'Você é o último metro do Marto. Cada entrega vira confiança, reputação e dados.'
    : 'Você é a execução do Marto no mundo real. Cada serviço vira confiança, reputação e dados.';

  return (
    <main className="relative min-h-screen bg-zinc-950 text-white">
      {/* fundo com grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      {/* glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[56rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
              Provider • Operação
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>

            <p className="mt-2 text-sm text-white/65">{subtitle}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Chip>Status: Ativo (Beta)</Chip>
              <Chip>Base: definir cidade/CEP</Chip>
              <Chip>Raio: definir</Chip>
              <Chip>Especialidade: {isDelivery ? 'Entregador' : 'Prestador'}</Chip>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/me"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Ver perfil público
            </Link>

            <Link
              href="/dash/provider/profile"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Configurações
            </Link>
          </div>
        </header>

        {/* HOJE */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">
                {isDelivery ? 'Hoje' : 'Hoje (operação)'}
              </div>
              <p className="mt-1 text-sm text-white/65">
                {isDelivery
                  ? 'Seu painel vai mostrar entregas do dia, janelas e SLA. Por enquanto, ajuste sua base e preferências.'
                  : 'Seu painel vai mostrar atendimentos do dia, janelas e SLA. Por enquanto, ajuste sua base e preferências.'}
              </p>
            </div>

            <Link
              href="/dash/provider/profile"
              className="inline-flex w-fit items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Completar perfil →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Janelas abertas" value="—" />
            <Stat label="Em andamento" value="—" />
            <Stat label="SLA médio" value="—" />
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
            <div className="text-sm font-semibold text-white">Regra Marto</div>
            <p className="mt-1 text-sm text-white/65">
              No Marto, <span className="font-semibold text-white">pontualidade</span> e{' '}
              <span className="font-semibold text-white">confirmação</span> viram reputação.
              Quem tem reputação recebe{' '}
              <span className="font-semibold text-white">rotas melhores primeiro</span>.
            </p>
          </div>
        </section>

        {/* PRONTIDÃO */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Prontidão da operação</div>
              <p className="mt-1 text-sm text-white/65">
                Complete os pilares para o Marto te chamar com promessas reais.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill ok={readiness.agendaOk} label="Agenda" />
                <Pill ok={readiness.regionOk} label="Região" />
                <Pill ok={readiness.typesOk} label="Tipos" />
                <Pill ok={readiness.slaOk} label="SLA" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center shadow-sm backdrop-blur">
              <div className="text-xs text-white/55">Pronto</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {readiness.done}/{readiness.total}
              </div>
              <div className="mt-1 text-xs text-white/55">
                {readiness.done === readiness.total ? 'Operação ativa' : 'Falta ajustar'}
              </div>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${(readiness.done / readiness.total) * 100}%` }}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/dash/provider/services/agenda"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Abrir Agenda →
            </Link>
            <Link
              href="/dash/provider/services/region"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Abrir Região →
            </Link>
            <Link
              href="/dash/provider/services/types"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Abrir Tipos →
            </Link>
            <Link
              href="/dash/provider/services/sla"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Abrir SLA →
            </Link>
          </div>
        </section>

        {/* CONFIGURAR OPERAÇÃO */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Configurar sua operação</div>
            <div className="text-xs text-white/55">MVP • UI pronta, lógica evolui depois</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/dash/provider/services/agenda" className="block">
              <ActionCard
                title={isDelivery ? 'Agenda de coleta & entrega' : 'Agenda de atendimento'}
                desc={
                  isDelivery
                    ? 'Defina quando você roda. O Marto encaixa entregas dentro das suas janelas.'
                    : 'Defina quando você atende. O Marto encaixa pedidos dentro das suas janelas.'
                }
                cta={readiness.agendaOk ? 'OK' : 'Configurar'}
              />
            </Link>

            <Link href="/dash/provider/services/region" className="block">
              <ActionCard
                title={isDelivery ? 'Região de entrega' : 'Região de atendimento'}
                desc="Seu mapa de atuação. Mais precisão = melhor match com pedidos."
                cta={readiness.regionOk ? 'OK' : 'Configurar'}
              />
            </Link>

            <Link href="/dash/provider/services/types" className="block">
              <ActionCard
                title={isDelivery ? 'Tipos de entrega' : 'Categorias'}
                desc={
                  isDelivery
                    ? 'Expressa, agendada, retirada na loja… (defina o que você aceita operar).'
                    : 'Montagem, instalação, manutenção… (defina o que você aceita operar).'
                }
                cta={readiness.typesOk ? 'OK' : 'Configurar'}
              />
            </Link>

            <Link href="/dash/provider/services/sla" className="block">
              <ActionCard
                title={isDelivery ? 'Prazos (SLA)' : 'SLA'}
                desc="O Marto promete ao cliente com base no seu prazo real."
                cta={readiness.slaOk ? 'OK' : 'Configurar'}
              />
            </Link>
          </div>
        </section>

        {/* COMO VOCÊ GANHA */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <div className="text-sm font-semibold text-white">Como você ganha no Marto</div>
          <ul className="mt-3 grid gap-2 text-sm text-white/70">
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="font-semibold text-white">Reputação</span> sobe com pontualidade e confirmação.
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Quem tem reputação recebe <span className="font-semibold text-white">prioridade</span> nas próximas rotas.
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Cada operação gera <span className="font-semibold text-white">dados reais</span> (tempo, região, recorrência).
            </li>
          </ul>
        </section>

        {/* PERFIL */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Seu perfil (o que o cliente vê)</div>
              <p className="mt-1 text-sm text-white/65">
                Base alinhada + transparência = mais confiança e mais chamadas.
              </p>
            </div>

            <Link
              href="/dash/provider/profile"
              className="inline-flex w-fit items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Abrir perfil →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Base (cidade/CEP)</div>
              <p className="mt-1 text-sm text-white/65">Defina de onde você sai para rodar.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Identificação</div>
              <p className="mt-1 text-sm text-white/65">Documento e dados básicos para confiança.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Foto/Avatar</div>
              <p className="mt-1 text-sm text-white/65">Humaniza e aumenta conversão.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Contato</div>
              <p className="mt-1 text-sm text-white/65">Canal dentro do Marto (sem sair do ecossistema).</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
