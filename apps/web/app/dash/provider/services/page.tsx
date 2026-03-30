'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

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

const SPECIALTY_LABELS: Record<string, string> = {
  assembly: 'Montagem',
  installation: 'Instalação',
  maintenance: 'Manutenção',
  delivery: 'Entregador',
  technical_visit: 'Visita técnica',
  electrical: 'Elétrica',
  hydraulic: 'Hidráulica',
  carpentry: 'Marcenaria',
  upholstery: 'Estofaria',
};

const SPECIALTY_OPTIONS = [
  {
    key: 'assembly',
    label: 'Montagem',
    desc: 'Execução por etapa, acabamento e validação final.',
    signal: 'O Marto passa a ler tempo, execução e qualidade entregue.',
  },
  {
    key: 'installation',
    label: 'Instalação',
    desc: 'Fixação, ajuste e validação técnica no local.',
    signal: 'O Marto cruza instalação, retrabalho e satisfação final.',
  },
  {
    key: 'maintenance',
    label: 'Manutenção',
    desc: 'Correção, ajuste fino e continuidade de uso.',
    signal: 'O Marto passa a medir resolução, retorno e consistência.',
  },
  {
    key: 'technical_visit',
    label: 'Visita técnica',
    desc: 'Diagnóstico, leitura de cenário e direcionamento técnico.',
    signal: 'O Marto valoriza clareza, precisão e leitura profissional.',
  },
  {
    key: 'electrical',
    label: 'Elétrica',
    desc: 'Atendimento técnico com foco em rede, instalação e segurança.',
    signal: 'O Marto organiza encaixe, confiança e histórico técnico.',
  },
  {
    key: 'hydraulic',
    label: 'Hidráulica',
    desc: 'Atuação em vazão, ajuste, instalação e correção.',
    signal: 'O Marto mede execução limpa, retorno e estabilidade.',
  },
  {
    key: 'carpentry',
    label: 'Marcenaria',
    desc: 'Ajuste, montagem fina e leitura de acabamento.',
    signal: 'O Marto passa a ler detalhe, precisão e qualidade final.',
  },
  {
    key: 'upholstery',
    label: 'Estofaria',
    desc: 'Reforma, ajuste e cuidado com conforto e acabamento.',
    signal: 'O Marto valoriza capricho, percepção visual e entrega final.',
  },
  {
    key: 'delivery',
    label: 'Entregador',
    desc: 'Coleta, rota, janela operacional e promessa logística.',
    signal: 'O Marto ativa agenda, região, tipos de entrega e SLA.',
  },
] as const;

function getPrimarySpecialtyLabel(specialties: string[]): string {
  if (!specialties.length) return 'Ainda não definida';
  return SPECIALTY_LABELS[specialties[0]] ?? specialties[0];
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

type ServiceProviderSummary = {
  specialties?: string[] | null;
};

type MeIdentityResponse = {
  handle?: string | null;
  profile?: {
    handle?: string | null;
  } | null;
};

type ProviderIncomingRequest = {
  id: string;
  orderId: string;
  providerId?: string | null;
  serviceType: string;
  linkedProductId?: string | null;
  title: string;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  order: {
    id: string;
    createdAt: string;
  };
  linkedProduct?: {
    id: string;
    title?: string | null;
  } | null;
};

type ProviderIncomingRequestsResponse = {
  ok: true;
  provider: {
    id: string;
    city?: string | null;
    kind?: string | null;
    specialties: string[];
  } | null;
  requests: ProviderIncomingRequest[];
};

function normalizeSpecialties(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function msgFromError(error: unknown): string {
  const e = error as ApiError;
  if (e?.message) return e.message;
  return error instanceof Error ? error.message : 'Falha ao carregar provider.';
}

// ====== storage: prontidão (agenda/region/types/sla) ======

function subscribeAnyStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: StorageEvent) => {
    if (e.key === null) return callback();
    if (Object.values(KEYS).includes(e.key)) callback();
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

function formatRequestMoment(value?: string | null): string {
  if (!value) return 'Sem atualização registrada';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem atualização registrada';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getRequestStatusMeta(status: string): {
  label: string;
  hint: string;
  className: string;
} {
  switch (status) {
    case 'REQUESTED':
      return {
        label: 'Aguardando sua decisão',
        hint: 'Responder rápido aumenta sua força operacional no ecossistema.',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      };

    case 'ASSIGNED':
      return {
        label: 'Assumido',
        hint: 'Esse atendimento já está com você. O próximo passo é iniciar a execução.',
        className: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
      };

    case 'IN_PROGRESS':
      return {
        label: 'Em execução',
        hint: 'A qualidade dessa execução vira reputação, recorrência e prioridade.',
        className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
      };

    case 'COMPLETED':
      return {
        label: 'Concluído',
        hint: 'Execução finalizada. O próximo valor vem da reputação gerada.',
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
      };

    case 'CANCELLED':
      return {
        label: 'Cancelado',
        hint: 'Essa solicitação saiu da sua fila operacional.',
        className: 'border-red-500/30 bg-red-500/10 text-red-200',
      };

    default:
      return {
        label: status,
        hint: 'Status operacional em atualização.',
        className: 'border-white/10 bg-white/5 text-white/70',
      };
  }
}

function compactText(value?: string | null, max = 140): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}…`;
}

export default function ProviderServicesPage() {
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [accountHandle, setAccountHandle] = useState('');
  const [providerLoading, setProviderLoading] = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<ProviderIncomingRequest[]>(
    [],
  );
  const [incomingRequestsLoading, setIncomingRequestsLoading] = useState(true);
  const [incomingRequestsError, setIncomingRequestsError] = useState<string | null>(
    null,
  );
  const [incomingRequestActionKey, setIncomingRequestActionKey] = useState<
    string | null
  >(null);
  const [incomingRequestActionError, setIncomingRequestActionError] = useState<
    string | null
  >(null);

  useEffect(() => {
    let alive = true;

    async function loadProvider() {
      try {
        setProviderLoading(true);

        const [sp, me] = await Promise.all([
          fetchJSON<ServiceProviderSummary | null>('/service-providers/me'),
          fetchJSON<MeIdentityResponse>('/me'),
        ]);

        if (!alive) return;
        setSpecialties(normalizeSpecialties(sp?.specialties));
        setAccountHandle(String(me?.profile?.handle ?? me?.handle ?? '').trim());
      } catch {
        if (!alive) return;
        setSpecialties([]);
        setAccountHandle('');
      } finally {
        if (alive) setProviderLoading(false);
      }
    }

    void loadProvider();

    return () => {
      alive = false;
    };
  }, []);

  async function handleIncomingRequestAction(
    requestId: string,
    action: 'accept' | 'reject' | 'start' | 'finish',
  ) {
    try {
      setIncomingRequestActionError(null);
      setIncomingRequestActionKey(`${requestId}:${action}`);

      const updated = await fetchJSON<{
        id: string;
        status: string;
        updatedAt: string;
        completedAt?: string | null;
      }>(`/service-requests/${encodeURIComponent(requestId)}/${action}`, {
        method: 'POST',
      });

      setIncomingRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: updated.status,
                updatedAt: updated.updatedAt,
                completedAt: updated.completedAt ?? null,
              }
            : request,
        ),
      );
    } catch (error) {
      setIncomingRequestActionError(msgFromError(error));
    } finally {
      setIncomingRequestActionKey(null);
    }
  }

  useEffect(() => {
    let alive = true;

    async function loadIncomingRequests() {
      try {
        setIncomingRequestsLoading(true);
        setIncomingRequestsError(null);

        const res =
          await fetchJSON<ProviderIncomingRequestsResponse>('/service-requests/me');

        if (!alive) return;
        setIncomingRequests(Array.isArray(res?.requests) ? res.requests : []);
      } catch (error) {
        if (!alive) return;
        setIncomingRequestsError(msgFromError(error));
        setIncomingRequests([]);
      } finally {
        if (alive) setIncomingRequestsLoading(false);
      }
    }

    void loadIncomingRequests();

    return () => {
      alive = false;
    };
  }, []);

  const isDelivery = useMemo(() => specialties.includes('delivery'), [specialties]);
  const primarySpecialty = specialties[0] ?? '';
  const primarySpecialtyLabel = useMemo(
    () => getPrimarySpecialtyLabel(specialties),
    [specialties],
  );
  const hasPrimarySpecialty = specialties.length > 0;
  const publicProfileHref = accountHandle ? `/u/${accountHandle}` : '';
  const isActivationMode = !providerLoading && !hasPrimarySpecialty;
  const operationEntryMeta = useMemo(() => {
    if (!hasPrimarySpecialty) {
      return {
        cta: 'Escolher especialidade',
        heroHint:
          'Antes de configurar agenda, região e promessa operacional, defina sua base profissional no Marto.',
        configTitle: 'Base profissional',
        configDesc:
          'Escolha a especialidade principal que representa sua operação para o Marto começar a te posicionar corretamente.',
        configCta: 'Escolher',
      };
    }

    if (isDelivery) {
      return {
        cta: 'Refinar operação logística',
        heroHint:
          'Sua base logística já foi lida. Agora refine região, tipos de entrega, SLA e consistência operacional.',
        configTitle: 'Base logística',
        configDesc:
          'Entrega é a base principal da sua operação. Revise sua estrutura sempre que quiser ajustar posicionamento e leitura do Marto.',
        configCta: 'Refinar',
      };
    }

    switch (primarySpecialty) {
      case 'assembly':
        return {
          cta: 'Refinar operação de montagem',
          heroHint:
            'Sua base de montagem já foi lida. Agora o foco é dar nitidez à agenda, região e execução.',
          configTitle: 'Base de montagem',
          configDesc:
            'Ajuste sua base profissional para o Marto te posicionar melhor em missões de montagem, execução e acabamento.',
          configCta: 'Refinar',
        };

      case 'installation':
        return {
          cta: 'Refinar operação de instalação',
          heroHint:
            'Sua base de instalação já foi lida. Agora o foco é conectar posicionamento técnico com agenda e SLA.',
          configTitle: 'Base de instalação',
          configDesc:
            'Ajuste sua base profissional para o Marto te posicionar melhor em instalações, validações e execução técnica.',
          configCta: 'Refinar',
        };

      case 'technical_visit':
        return {
          cta: 'Refinar operação técnica',
          heroHint:
            'Sua base técnica já foi lida. Agora o foco é transformar leitura profissional em encaixe operacional.',
          configTitle: 'Base técnica',
          configDesc:
            'Ajuste sua base profissional para o Marto te posicionar melhor em visitas técnicas, diagnóstico e direcionamento.',
          configCta: 'Refinar',
        };

      default:
        return {
          cta: `Refinar operação de ${primarySpecialtyLabel.toLowerCase()}`,
          heroHint:
            'Sua base profissional já foi lida. Agora o foco é transformar essa leitura em operação cada vez mais nítida.',
          configTitle: `Base de ${primarySpecialtyLabel.toLowerCase()}`,
          configDesc:
            'Revise sua base profissional para manter a leitura do Marto coerente com sua atuação principal.',
          configCta: 'Refinar',
      };
    }
  }, [hasPrimarySpecialty, isDelivery, primarySpecialty, primarySpecialtyLabel]);

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

  const operationReadiness = useMemo(() => {
    if (isDelivery) {
      return {
        items: [
          { ok: readiness.agendaOk, label: 'Agenda' },
          { ok: readiness.regionOk, label: 'Região' },
          { ok: readiness.typesOk, label: 'Tipos de entrega' },
          { ok: readiness.slaOk, label: 'SLA' },
        ],
        done: [readiness.agendaOk, readiness.regionOk, readiness.typesOk, readiness.slaOk]
          .filter(Boolean).length,
        total: 4,
      };
    }

    return {
      items: [
        { ok: readiness.agendaOk, label: 'Agenda' },
        { ok: readiness.regionOk, label: 'Região' },
        { ok: readiness.slaOk, label: 'SLA' },
      ],
      done: [readiness.agendaOk, readiness.regionOk, readiness.slaOk].filter(Boolean).length,
      total: 3,
    };
  }, [isDelivery, readiness]);

  const operationHeroMeta = useMemo(() => {
    const ready = operationReadiness.done === operationReadiness.total;

    if (isActivationMode) {
      return {
        heroTitle: 'Escolha sua base profissional no Marto',
        heroDesc:
          'Sua especialidade principal define como o Marto vai te posicionar, quais missões combinam com você, como sua reputação cresce e que sinais passam a construir sua autoridade no ecossistema.',
        focusEmptyTitle: 'Sua jornada começa pela base profissional',
        focusEmptyDesc:
          'Antes de agenda, região, SLA e fila, o Marto precisa entender quem você é profissionalmente dentro do ecossistema.',
        trustValue: 'Em ativação',
        trustDesc:
          'O Marto ainda não deve te tratar como operação recorrente enquanto sua base principal não estiver definida.',
        nextTitle: 'Operação guiada por especialidade',
        nextDesc:
          'Sua central muda de estado e passa a organizar operação, encaixe e evolução conforme a base escolhida.',
      };
    }

    if (isDelivery) {
      return {
        heroTitle: ready
          ? 'Sua operação logística está pronta para ganhar ritmo'
          : 'Estruture sua operação logística no Marto',
        heroDesc: ready
          ? 'Agenda, região, tipos de entrega e SLA já formam uma base que o Marto consegue distribuir com mais confiança.'
          : 'Sua base logística ainda precisa ficar nítida. O Marto lê agenda, região, tipos e SLA para transformar disponibilidade em distribuição real.',
        focusEmptyTitle: ready
          ? 'Sua rota já pode começar a ganhar ritmo'
          : 'Sua operação logística ainda está ganhando forma',
        focusEmptyDesc: ready
          ? 'Com a base completa, o Marto começa a distribuir melhor entregas, janelas e promessas reais.'
          : 'Quando a base logística fica sólida, o Marto começa a te encaixar com mais precisão nas rotas.',
        trustValue: ready
          ? 'Alta'
          : operationReadiness.done >= Math.max(1, operationReadiness.total - 1)
            ? 'Em subida'
            : 'Inicial',
        trustDesc:
          'O Marto cruza prontidão logística, resposta e consistência para decidir quanta confiança operacional pode depositar na sua base.',
        nextTitle: ready ? 'Ganhar ritmo de rota' : 'Fechar sua base logística',
        nextDesc: ready
          ? 'Agora o valor vem de resposta rápida, execução limpa e confiabilidade em rota, janela e SLA.'
          : 'Agenda, região, tipos de entrega e SLA bem definidos fazem o Marto te encaixar com muito mais precisão.',
      };
    }

    switch (primarySpecialty) {
      case 'assembly':
        return {
          heroTitle: ready
            ? 'Sua operação de montagem está pronta para ganhar ritmo'
            : 'Estruture sua operação de montagem no Marto',
          heroDesc: ready
            ? 'Agenda, região e SLA já dão uma base para o Marto te encaixar em missões de montagem com mais confiança.'
            : 'Sua base de montagem ainda precisa ficar nítida. O Marto lê agenda, região e SLA para transformar disponibilidade em execução real.',
          focusEmptyTitle: ready
            ? 'Sua base de montagem já pode ganhar ritmo'
            : 'Sua operação de montagem ainda está ganhando forma',
          focusEmptyDesc: ready
            ? 'Com a base montada, o Marto começa a te posicionar melhor em montagem, execução e acabamento.'
            : 'Quando sua base de montagem fica sólida, o Marto começa a te encaixar com mais precisão em missões de execução.',
          trustValue: ready
            ? 'Alta'
            : operationReadiness.done >= Math.max(1, operationReadiness.total - 1)
              ? 'Em subida'
              : 'Inicial',
          trustDesc:
            'O Marto cruza prontidão, resposta e consistência de execução para decidir quanta confiança operacional pode depositar na sua base de montagem.',
          nextTitle: ready ? 'Ganhar ritmo de execução' : 'Fechar sua base de montagem',
          nextDesc: ready
            ? 'Agora o valor vem de resposta rápida, execução limpa, acabamento e reputação acumulada.'
            : 'Agenda, região e SLA bem definidos fazem o Marto te encaixar melhor em missões de montagem.',
        };

      case 'installation':
        return {
          heroTitle: ready
            ? 'Sua operação de instalação está pronta para ganhar ritmo'
            : 'Estruture sua operação de instalação no Marto',
          heroDesc: ready
            ? 'Agenda, região e SLA já dão uma base para o Marto te encaixar em instalações com mais confiança.'
            : 'Sua base de instalação ainda precisa ficar nítida. O Marto lê agenda, região e SLA para transformar disponibilidade em execução técnica real.',
          focusEmptyTitle: ready
            ? 'Sua base de instalação já pode ganhar ritmo'
            : 'Sua operação de instalação ainda está ganhando forma',
          focusEmptyDesc: ready
            ? 'Com a base consolidada, o Marto começa a te posicionar melhor em validações, ajustes e instalação.'
            : 'Quando sua base de instalação fica sólida, o Marto começa a te encaixar com mais precisão em missões técnicas.',
          trustValue: ready
            ? 'Alta'
            : operationReadiness.done >= Math.max(1, operationReadiness.total - 1)
              ? 'Em subida'
              : 'Inicial',
          trustDesc:
            'O Marto cruza prontidão, resposta e consistência técnica para decidir quanta confiança operacional pode depositar na sua base de instalação.',
          nextTitle: ready ? 'Ganhar ritmo técnico' : 'Fechar sua base de instalação',
          nextDesc: ready
            ? 'Agora o valor vem de resposta rápida, ajuste limpo, validação no local e reputação acumulada.'
            : 'Agenda, região e SLA bem definidos fazem o Marto te encaixar melhor em instalações e validações técnicas.',
        };

      case 'technical_visit':
        return {
          heroTitle: ready
            ? 'Sua operação de visita técnica está pronta para ganhar ritmo'
            : 'Estruture sua operação de visita técnica no Marto',
          heroDesc: ready
            ? 'Agenda, região e SLA já dão uma base para o Marto te encaixar em visitas técnicas com mais confiança.'
            : 'Sua base técnica ainda precisa ficar nítida. O Marto lê agenda, região e SLA para transformar disponibilidade em diagnóstico e direcionamento real.',
          focusEmptyTitle: ready
            ? 'Sua base técnica já pode ganhar ritmo'
            : 'Sua operação técnica ainda está ganhando forma',
          focusEmptyDesc: ready
            ? 'Com a base consolidada, o Marto começa a te posicionar melhor em leitura profissional, visita e direcionamento.'
            : 'Quando sua base técnica fica sólida, o Marto começa a te encaixar com mais precisão em visitas e diagnósticos.',
          trustValue: ready
            ? 'Alta'
            : operationReadiness.done >= Math.max(1, operationReadiness.total - 1)
              ? 'Em subida'
              : 'Inicial',
          trustDesc:
            'O Marto cruza prontidão, resposta e consistência técnica para decidir quanta confiança operacional pode depositar na sua base de visita técnica.',
          nextTitle: ready ? 'Ganhar ritmo de diagnóstico' : 'Fechar sua base técnica',
          nextDesc: ready
            ? 'Agora o valor vem de resposta rápida, leitura clara, direcionamento e reputação acumulada.'
            : 'Agenda, região e SLA bem definidos fazem o Marto te encaixar melhor em visitas e diagnósticos.',
        };

      default:
        return {
          heroTitle: ready
            ? `Sua operação de ${primarySpecialtyLabel.toLowerCase()} está pronta para ganhar ritmo`
            : `Estruture sua operação de ${primarySpecialtyLabel.toLowerCase()} no Marto`,
          heroDesc: ready
            ? `Agenda, região e SLA já dão uma base para o Marto te encaixar em missões de ${primarySpecialtyLabel.toLowerCase()} com mais confiança.`
            : `Sua base de ${primarySpecialtyLabel.toLowerCase()} ainda precisa ficar nítida. O Marto lê agenda, região e SLA para transformar disponibilidade em operação real.`,
          focusEmptyTitle: ready
            ? `Sua base de ${primarySpecialtyLabel.toLowerCase()} já pode ganhar ritmo`
            : `Sua operação de ${primarySpecialtyLabel.toLowerCase()} ainda está ganhando forma`,
          focusEmptyDesc: ready
            ? `Com a base consolidada, o Marto começa a te posicionar melhor em ${primarySpecialtyLabel.toLowerCase()} e execução recorrente.`
            : `Quando sua base de ${primarySpecialtyLabel.toLowerCase()} fica sólida, o Marto começa a te encaixar com mais precisão.`,
          trustValue: ready
            ? 'Alta'
            : operationReadiness.done >= Math.max(1, operationReadiness.total - 1)
              ? 'Em subida'
              : 'Inicial',
          trustDesc: `O Marto cruza prontidão, resposta e consistência para decidir quanta confiança operacional pode depositar na sua base de ${primarySpecialtyLabel.toLowerCase()}.`,
          nextTitle: ready
            ? 'Ganhar ritmo de execução'
            : `Fechar sua base de ${primarySpecialtyLabel.toLowerCase()}`,
          nextDesc: ready
            ? 'Agora o valor vem de resposta rápida, execução limpa e reputação acumulada.'
            : `Agenda, região e SLA bem definidos fazem o Marto te encaixar melhor em missões de ${primarySpecialtyLabel.toLowerCase()}.`,
        };
    }
  }, [
    isActivationMode,
    isDelivery,
    operationReadiness.done,
    operationReadiness.total,
    primarySpecialty,
    primarySpecialtyLabel,
  ]);
  const operationGainMeta = useMemo(() => {
    if (isActivationMode) {
      return {
        eyebrow: 'Primeiro ganho',
        title: 'Sua base profissional abre a porta do crescimento no Marto',
        desc:
          'Antes de ganhar ritmo, prioridade e reputação, o Marto precisa entender qual é a sua base profissional dentro do ecossistema.',
        items: [
          {
            title: 'Posicionamento',
            desc: 'Sua especialidade principal define como o Marto te lê e em quais missões você começa a aparecer.',
          },
          {
            title: 'Leitura operacional',
            desc: 'Agenda, região, SLA e sinais futuros só ganham valor real quando sua base profissional está definida.',
          },
          {
            title: 'Evolução',
            desc: 'Depois da escolha, sua operação começa a acumular reputação, consistência e prioridade de forma coerente.',
          },
        ],
        footer:
          'Primeiro o Marto entende quem você é. Depois ele começa a te dar ritmo, confiança e crescimento.',
      };
    }

    if (isDelivery) {
      return {
        eyebrow: 'Como você cresce',
        title: 'No Marto, logística cresce com confiança operacional',
        desc:
          'Sua evolução vem de rota bem lida, prazo cumprido, execução consistente e confiança acumulada em entrega real.',
        items: [
          {
            title: 'Confiabilidade em rota',
            desc: 'Pontualidade, janela respeitada e consistência logística fazem o Marto confiar mais na sua base.',
          },
          {
            title: 'Prioridade nas próximas entregas',
            desc: 'Quem sustenta boa execução e resposta rápida tende a ganhar mais força na distribuição.',
          },
          {
            title: 'Dados que viram valor',
            desc: 'Cada operação gera leitura real de rota, região, tempo e recorrência dentro do ecossistema.',
          },
        ],
        footer:
          'No Marto, entrega limpa não vira só conclusão. Vira confiança, prioridade e histórico operacional.',
      };
    }

    switch (primarySpecialty) {
      case 'assembly':
        return {
          eyebrow: 'Como você cresce',
          title: 'No Marto, montagem cresce com execução e acabamento',
          desc:
            'Sua evolução vem de execução consistente, acabamento limpo, confirmação real e reputação acumulada a cada missão.',
          items: [
            {
              title: 'Reputação por execução',
              desc: 'Montagem bem concluída, confirmação e consistência aumentam sua força operacional no ecossistema.',
            },
            {
              title: 'Prioridade em novas missões',
              desc: 'Quem executa bem tende a receber mais espaço nas próximas missões de montagem.',
            },
            {
              title: 'Dados que constroem autoridade',
              desc: 'Cada serviço gera leitura real de tempo, região, recorrência e qualidade entregue.',
            },
          ],
          footer:
            'No Marto, montar bem não vira só serviço concluído. Vira autoridade operacional.',
        };

      case 'installation':
        return {
          eyebrow: 'Como você cresce',
          title: 'No Marto, instalação cresce com precisão e validação',
          desc:
            'Sua evolução vem de ajuste técnico, validação no local, execução limpa e confiança acumulada em campo.',
          items: [
            {
              title: 'Reputação técnica',
              desc: 'Instalação bem executada e validada aumenta sua leitura de confiabilidade dentro do ecossistema.',
            },
            {
              title: 'Prioridade por consistência',
              desc: 'Quem entrega instalação limpa, resposta rápida e precisão tende a ganhar mais prioridade.',
            },
            {
              title: 'Dados reais de campo',
              desc: 'Cada instalação gera sinais de tempo, região, padrão técnico e recorrência operacional.',
            },
          ],
          footer:
            'No Marto, instalar bem não vira só entrega final. Vira confiança técnica acumulada.',
        };

      case 'technical_visit':
        return {
          eyebrow: 'Como você cresce',
          title: 'No Marto, visita técnica cresce com leitura profissional',
          desc:
            'Sua evolução vem de diagnóstico claro, direcionamento consistente, comunicação limpa e confiança técnica real.',
          items: [
            {
              title: 'Reputação por clareza',
              desc: 'Leitura precisa, postura profissional e boa orientação aumentam sua força dentro do ecossistema.',
            },
            {
              title: 'Prioridade em novos diagnósticos',
              desc: 'Quem gera boa leitura técnica tende a ganhar mais espaço em novas visitas e análises.',
            },
            {
              title: 'Dados que fortalecem sua base',
              desc: 'Cada visita gera sinais reais de região, recorrência, tipo de problema e padrão operacional.',
            },
          ],
          footer:
            'No Marto, diagnosticar bem não vira só visita concluída. Vira confiança profissional.',
        };

      default:
        return {
          eyebrow: 'Como você cresce',
          title: `No Marto, ${primarySpecialtyLabel.toLowerCase()} cresce com consistência real`,
          desc:
            'Sua evolução vem de resposta boa, execução consistente, confiança acumulada e sinais reais gerados em cada operação.',
          items: [
            {
              title: 'Reputação operacional',
              desc: 'Execução limpa, confirmação e consistência fazem o Marto confiar mais na sua base.',
            },
            {
              title: 'Prioridade nas próximas missões',
              desc: 'Quem sustenta boa operação tende a ganhar mais espaço nas próximas oportunidades.',
            },
            {
              title: 'Dados que viram valor',
              desc: 'Cada operação gera leitura real de tempo, região, recorrência e padrão de execução.',
            },
          ],
          footer:
            'No Marto, operação bem feita não vira só conclusão. Vira histórico, prioridade e crescimento.',
        };
    }
  }, [isActivationMode, isDelivery, primarySpecialty, primarySpecialtyLabel]);

  const requestStats = useMemo(() => {
    const requested = incomingRequests.filter(
      (request) => request.status === 'REQUESTED',
    ).length;

    const assigned = incomingRequests.filter(
      (request) => request.status === 'ASSIGNED',
    ).length;

    const inProgress = incomingRequests.filter(
      (request) => request.status === 'IN_PROGRESS',
    ).length;

    const completed = incomingRequests.filter(
      (request) => request.status === 'COMPLETED',
    ).length;

    const priorityRequest =
      incomingRequests.find((request) => request.status === 'IN_PROGRESS') ??
      incomingRequests.find((request) => request.status === 'ASSIGNED') ??
      incomingRequests.find((request) => request.status === 'REQUESTED') ??
      null;

    return {
      requested,
      assigned,
      inProgress,
      completed,
      pending: requested + assigned + inProgress,
      priorityRequest,
    };
  }, [incomingRequests]);

  const title = providerLoading
    ? 'Central do Prestador'
    : isDelivery
      ? 'Central de Entregas'
      : 'Central de Serviços';

  const orderedIncomingRequests = useMemo(() => {
    const rank: Record<string, number> = {
      IN_PROGRESS: 0,
      ASSIGNED: 1,
      REQUESTED: 2,
      COMPLETED: 3,
      CANCELLED: 4,
    };

    return [...incomingRequests].sort((a, b) => {
      const rankA = rank[a.status] ?? 99;
      const rankB = rank[b.status] ?? 99;

      if (rankA !== rankB) return rankA - rankB;

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [incomingRequests]);

  const previewIncomingRequests = useMemo(
    () => orderedIncomingRequests.slice(0, 3),
    [orderedIncomingRequests],
  );

  const hiddenIncomingRequestsCount = Math.max(
    0,
    orderedIncomingRequests.length - previewIncomingRequests.length,
  );

  const focusRequest = useMemo(
    () => previewIncomingRequests[0] ?? requestStats.priorityRequest ?? null,
    [previewIncomingRequests, requestStats.priorityRequest],
  );

  const readinessPercent = useMemo(() => {
    if (!operationReadiness.total) return 0;
    return Math.round((operationReadiness.done / operationReadiness.total) * 100);
  }, [operationReadiness.done, operationReadiness.total]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
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
      <div className="pointer-events-none absolute top-[18rem] left-0 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] right-0 h-[26rem] w-[26rem] translate-x-1/2 rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl overflow-x-hidden px-6 py-10">
        <section className="mb-6 grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="overflow-hidden rounded-[2.2rem] border border-white/15 bg-neutral-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="relative p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-x-8 top-0 h-32 rounded-full bg-white/8 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 top-24 h-52 w-52 rounded-full bg-white/5 blur-3xl" />

              <div className="relative">
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      {isActivationMode ? 'Provider • Ativação Marto' : 'Provider • Pulso Marto'}
                    </span>

                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                      {providerLoading
                        ? 'Lendo sua operação'
                        : isActivationMode
                          ? 'Base profissional pendente'
                          : operationReadiness.done === operationReadiness.total
                            ? 'Pronto para encaixe'
                            : 'Estruturando operação'}
                    </span>
                  </div>

                  <div className="mt-5 max-w-3xl">
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {providerLoading ? title : operationHeroMeta.heroTitle}
                    </h1>

                    <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-[15px]">
                      {providerLoading ? 'O Marto está lendo sua base operacional.' : operationHeroMeta.heroDesc}
                    </p>
                  </div>

                  {isActivationMode ? (
                    <>
                      <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                            Base profissional
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">Pendente</div>
                          <div className="mt-1 text-xs leading-5 text-white/60">
                            Antes de operar, escolha a especialidade principal que vai estruturar sua jornada.
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                            Como o Marto te lê
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">Missão + reputação</div>
                          <div className="mt-1 text-xs leading-5 text-white/60">
                            A especialidade organiza encaixe, checklist futuro, confiança operacional e evolução.
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                            Próximo marco
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">Definir especialidade</div>
                          <div className="mt-1 text-xs leading-5 text-white/60">
                            Depois disso, sua central passa a operar no modo normal do prestador.
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          href="/dash/provider/profile"
                          className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
                        >
                          Escolher especialidade
                        </Link>

                        <a
                          href="#provider-specialties"
                          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Ver especialidades
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                            Especialidade lida
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {primarySpecialtyLabel}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-white/60">
                            {hasPrimarySpecialty
                              ? 'Essa é a base principal que o Marto está usando para te posicionar, organizar sua operação e construir sua reputação.'
                              : 'Sem base definida, o Marto ainda não consegue te posicionar com precisão no ecossistema.'}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                            Prontidão atual
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {operationReadiness.done}/{operationReadiness.total} • {readinessPercent}%
                          </div>
                          <div className="mt-1 text-xs leading-5 text-white/60">
                            Quanto da sua base operacional já está legível para o ecossistema.
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                            Pressão agora
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {incomingRequestsLoading ? '—' : String(requestStats.pending)}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-white/60">
                            {requestStats.inProgress > 0
                              ? `${requestStats.inProgress} em execução agora.`
                              : requestStats.requested > 0
                                ? `${requestStats.requested} pedindo resposta.`
                                : 'Nenhum atendimento pressionando neste momento.'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          href="/dash/provider/profile"
                          className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
                        >
                          {operationEntryMeta.cta}
                        </Link>

                        <Link
                          href="/dash/provider/services/agenda"
                          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Abrir agenda
                        </Link>

                        {publicProfileHref ? (
                          <Link
                            href={publicProfileHref}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            Perfil público
                          </Link>
                        ) : null}

                        <a
                          href="#provider-requests"
                          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Ver encaixes
                        </a>
                      </div>

                      <p className="mt-3 max-w-2xl text-xs leading-6 text-white/58">
                        {operationEntryMeta.heroHint}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-white/8 bg-white/[0.03] px-6 py-4 sm:px-7">
              {isActivationMode ? (
                <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Ativação Marto
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      Sua jornada começa pela base profissional
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      Antes de agenda, região, SLA e fila, o Marto precisa entender quem você é
                      profissionalmente dentro do ecossistema.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip>Especialidade principal</Chip>
                      <Chip>Posicionamento</Chip>
                      <Chip>Leitura operacional</Chip>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Leitura inicial
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">Em ativação</div>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      O Marto ainda não deve te tratar como operação recorrente enquanto sua base principal
                      não estiver definida.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Depois da escolha
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      Operação guiada por especialidade
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      Sua central muda de estado e passa a organizar operação, encaixe e evolução conforme
                      a base escolhida.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        Atendimento em foco
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {focusRequest ? focusRequest.title : operationHeroMeta.focusEmptyTitle}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/68">
                        {focusRequest?.notes ? focusRequest.notes : operationHeroMeta.focusEmptyDesc}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Chip>Especialidade: {primarySpecialtyLabel}</Chip>
                        <Chip>Prontidão: {operationReadiness.done}/{operationReadiness.total}</Chip>
                        {focusRequest ? <Chip>Pedido {focusRequest.orderId.slice(0, 8)}</Chip> : null}
                    </div>
                  </div>

                    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        Leitura de confiança
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {operationHeroMeta.trustValue}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/68">
                        {operationHeroMeta.trustDesc}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        Próximo salto
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {operationHeroMeta.nextTitle}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/68">
                        {operationHeroMeta.nextDesc}
                      </p>
                    </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-white/15 bg-neutral-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Sinais da operação
              </div>

              <div className="mt-4 space-y-3">
                {operationReadiness.items.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div
                        className={[
                          'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          item.ok
                            ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                            : 'border border-white/10 bg-white/5 text-white/60',
                        ].join(' ')}
                      >
                        {item.ok ? 'Lido' : 'Pendente'}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-white transition-all"
                        style={{ width: item.ok ? '100%' : '32%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-neutral-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Agora no ecossistema
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="text-xs text-white/55">Pedem resposta</div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {incomingRequestsLoading ? '—' : requestStats.requested}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="text-xs text-white/55">Em andamento</div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {incomingRequestsLoading ? '—' : requestStats.assigned + requestStats.inProgress}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="text-xs text-white/55">Concluídos no ciclo</div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {incomingRequestsLoading ? '—' : requestStats.completed}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isActivationMode ? (
          <section
            id="provider-specialties"
            className="mb-6 rounded-[2rem] border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  Escolha sua base profissional
                </div>

                <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Qual especialidade principal representa melhor sua operação?
                </div>

                <p className="mt-2 text-sm leading-6 text-white/72">
                  Essa escolha não é só visual. Ela define como o Marto vai te posicionar,
                  quais sinais operacionais passam a importar e como sua reputação começa a ser construída.
                </p>
              </div>

              <Link
                href="/dash/provider/profile"
                className="inline-flex w-fit items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Abrir seleção no perfil
              </Link>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {SPECIALTY_OPTIONS.map((option) => (
                <div
                  key={option.key}
                  className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 shadow-sm backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{option.label}</div>
                      <p className="mt-2 text-sm leading-6 text-white/68">{option.desc}</p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                      Base
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/70">
                    {option.signal}
                  </div>

                  <Link
                    href="/dash/provider/profile"
                    className="mt-4 inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Definir como principal
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section
          id="provider-requests"
          className="mb-6 rounded-[2rem] border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Operação em foco
              </div>

              <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Em foco agora
              </div>

              <p className="mt-2 text-sm leading-6 text-white/72">
                A central destaca primeiro o que pede resposta e execução agora. O restante
                da fila continua existindo, mas sem transformar sua home em uma listagem
                infinita.
              </p>
            </div>

            <div className="lg:min-w-[320px]">
              <div className="mb-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                {incomingRequestsLoading
                  ? 'Carregando…'
                  : `${previewIncomingRequests.length} em foco agora • ${incomingRequests.length} no total`}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                    Na fila
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {incomingRequestsLoading ? '—' : String(requestStats.pending)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                    Em execução
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {incomingRequestsLoading ? '—' : String(requestStats.inProgress)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                    Total carregado
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {incomingRequestsLoading ? '—' : String(incomingRequests.length)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                    Resumo da fila
                  </div>
                  <div className="mt-2 text-sm text-white/72">
                    {incomingRequestsLoading
                      ? 'Carregando visão geral...'
                      : `${incomingRequests.length} solicitações carregadas nesta central.`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                    Pedem resposta
                  </div>
                  <div className="mt-2 text-sm text-white/72">
                    {incomingRequestsLoading
                      ? 'Carregando...'
                      : `${requestStats.requested} aguardando sua decisão.`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                    Em andamento
                  </div>
                  <div className="mt-2 text-sm text-white/72">
                    {incomingRequestsLoading
                      ? 'Carregando...'
                      : `${requestStats.assigned + requestStats.inProgress} já entraram em execução.`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {incomingRequestsError ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {incomingRequestsError}
            </div>
          ) : null}

          {incomingRequestActionError ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {incomingRequestActionError}
            </div>
          ) : null}

          {incomingRequestsLoading ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              Carregando solicitações...
            </div>
          ) : incomingRequests.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Sua fila está limpa</div>
              <p className="mt-1 text-sm leading-6 text-white/65">
                Nenhuma solicitação chegou para você ainda. Conforme sua base operacional
                fica mais sólida, o Marto consegue te colocar em rotas e missões com mais
                confiança.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {previewIncomingRequests.map((request) => {
                const statusMeta = getRequestStatusMeta(request.status);

                const isAcceptLoading =
                  incomingRequestActionKey === `${request.id}:accept`;
                const isRejectLoading =
                  incomingRequestActionKey === `${request.id}:reject`;
                const isStartLoading =
                  incomingRequestActionKey === `${request.id}:start`;
                const isFinishLoading =
                  incomingRequestActionKey === `${request.id}:finish`;

                return (
                  <div
                    key={request.id}
                    className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[0.045] shadow-sm backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="border-b border-white/8 bg-white/[0.03] px-5 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-white">
                              {request.title}
                            </div>

                            <span
                              className={[
                                'rounded-full border px-3 py-1 text-[11px] font-semibold',
                                statusMeta.className,
                              ].join(' ')}
                            >
                              {statusMeta.label}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Chip>Pedido {request.orderId.slice(0, 8)}</Chip>
                            <Chip>
                              {SPECIALTY_LABELS[request.serviceType] ?? request.serviceType}
                            </Chip>
                            <Chip>
                              Atualizado em {formatRequestMoment(request.updatedAt)}
                            </Chip>
                            {request.completedAt ? (
                              <Chip>
                                Finalizado em {formatRequestMoment(request.completedAt)}
                              </Chip>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-white/65 lg:max-w-xs">
                          {statusMeta.hint}
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4">
                      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                        <div className="min-w-0">
                          {request.linkedProduct?.title ? (
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                                Produto vinculado
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {request.linkedProduct.title}
                              </div>
                            </div>
                          ) : null}

                          <div
                            className={[
                              'rounded-2xl border border-white/10 bg-white/5 px-4 py-3',
                              request.linkedProduct?.title ? 'mt-3' : '',
                            ].join(' ')}
                          >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                              Contexto operacional
                            </div>

                            <p className="mt-2 text-sm leading-6 text-white/72">
                              {compactText(request.notes)
                                ? compactText(request.notes)
                                : compactText(
                                    'Essa solicitação já foi conectada ao seu perfil operacional. Sua resposta e sua execução fortalecem sua reputação dentro do Marto.',
                                  )}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                            Próximo passo
                          </div>

                          <div className="mt-2 text-sm font-semibold text-white">
                            {request.status === 'REQUESTED'
                                ? 'Decidir agora'
                                : request.status === 'ASSIGNED'
                                  ? 'Iniciar atendimento'
                                  : request.status === 'IN_PROGRESS'
                                    ? 'Concluir atendimento'
                                    : request.status === 'COMPLETED'
                                      ? 'Atendimento concluído'
                                      : request.status === 'CANCELLED'
                                        ? 'Sem ação necessária'
                                        : 'Acompanhar atendimento'}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-white/65">
                            {request.status === 'REQUESTED'
                              ? 'Responder rápido ajuda o Marto a confiar mais na sua disponibilidade real.'
                              : request.status === 'ASSIGNED'
                                ? 'Quando você inicia, o ecossistema entende que sua promessa operacional está de pé.'
                                : request.status === 'IN_PROGRESS'
                                  ? 'Concluir com clareza fecha o ciclo e prepara reputação, avaliação e próximos encaixes.'
                                  : request.status === 'COMPLETED'
                                    ? 'Esse atendimento já entregou valor. O próximo ganho vem da sua consistência operacional.'
                                    : request.status === 'CANCELLED'
                                      ? 'Essa solicitação saiu da fila e não exige nova intervenção.'
                                      : 'Acompanhe a evolução desse atendimento na sua central.'}
                          </p>

                          {request.status === 'REQUESTED' ? (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleIncomingRequestAction(request.id, 'accept')
                                }
                                disabled={isAcceptLoading || isRejectLoading}
                                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                              >
                                {isAcceptLoading ? 'Aceitando...' : 'Aceitar solicitação'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleIncomingRequestAction(request.id, 'reject')
                                }
                                disabled={isAcceptLoading || isRejectLoading}
                                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                              >
                                {isRejectLoading ? 'Recusando...' : 'Recusar'}
                              </button>
                            </div>
                          ) : null}

                          {request.status === 'ASSIGNED' ? (
                            <div className="mt-4">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleIncomingRequestAction(request.id, 'start')
                                }
                                disabled={isStartLoading}
                                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                              >
                                {isStartLoading ? 'Iniciando...' : 'Iniciar atendimento'}
                              </button>
                            </div>
                          ) : null}

                          {request.status === 'IN_PROGRESS' ? (
                            <div className="mt-4">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleIncomingRequestAction(request.id, 'finish')
                                }
                                disabled={isFinishLoading}
                                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                              >
                                {isFinishLoading ? 'Concluindo...' : 'Concluir atendimento'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!incomingRequestsLoading && hiddenIncomingRequestsCount > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                  Resumo da fila
                </div>
                <div className="mt-2 text-sm text-white/70">
                  +{hiddenIncomingRequestsCount} solicitações fora do foco inicial.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                  Pedem resposta
                </div>
                <div className="mt-2 text-sm text-white/70">
                  A central mostra primeiro o que pede resposta e execução agora.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                  Em andamento
                </div>
                <div className="mt-2 text-sm text-white/70">
                  O restante continua disponível sem alongar a home.
                </div>
              </div>
            </div>
          ) : null}
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
                {operationReadiness.items.map((item) => (
                  <Pill key={item.label} ok={item.ok} label={item.label} />
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center shadow-sm backdrop-blur">
              <div className="text-xs text-white/55">Pronto</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {operationReadiness.done}/{operationReadiness.total}
              </div>
              <div className="mt-1 text-xs text-white/55">
                {operationReadiness.done === operationReadiness.total
                  ? 'Operação ativa'
                  : 'Falta ajustar'}
              </div>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-white transition-all"
              style={{
                width: `${(operationReadiness.done / operationReadiness.total) * 100}%`,
              }}
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

            {isDelivery ? (
              <Link
                href="/dash/provider/services/types"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Abrir Tipos de entrega →
              </Link>
            ) : null}

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
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Configurar sua operação</div>
              <p className="mt-1 text-xs text-white/55">{operationEntryMeta.heroHint}</p>
            </div>

            <div className="text-xs text-white/55">
              {hasPrimarySpecialty ? 'Base lida • lapidação contínua' : 'Primeiro passo • definir base'}
            </div>
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

            {isDelivery ? (
              <Link href="/dash/provider/services/types" className="block">
                <ActionCard
                  title="Tipos de entrega"
                  desc="Expressa, agendada, retirada na loja… defina o que você aceita operar."
                  cta={readiness.typesOk ? 'OK' : 'Configurar'}
                />
              </Link>
            ) : (
              <Link href="/dash/provider/profile" className="block">
                <ActionCard
                  title={operationEntryMeta.configTitle}
                  desc={operationEntryMeta.configDesc}
                  cta={operationEntryMeta.configCta}
                />
              </Link>
            )}

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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                {operationGainMeta.eyebrow}
              </div>

              <div className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {operationGainMeta.title}
              </div>

              <p className="mt-2 text-sm leading-6 text-white/68">
                {operationGainMeta.desc}
              </p>
            </div>

            <Link
              href="/dash/provider/profile"
              className="inline-flex w-fit items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Refinar base →
            </Link>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {operationGainMeta.items.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-white/68">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/70">
            {operationGainMeta.footer}
          </div>
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
