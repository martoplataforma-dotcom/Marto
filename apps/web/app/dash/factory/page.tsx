'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';
import { LogoutButton } from '../../../src/components/LogoutButton';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type FactoryMeResponse = {
  ok: boolean;
  factory: {
    id: string;
    userId: string;
    tradeName: string;
    legalName: string | null;
    document: string;
    city: string | null;
    state: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type SaveResponse =
  | { ok: true; factory: unknown }
  | { ok: false; message?: string };

type FactorySignalKind = 'QUALIDADE' | 'CAMPO' | 'CANAL';

type FactorySignal = {
  kind: FactorySignalKind;
  title: string;
  meta: string;
};

type FactoryOrdersSummary = {
  ok: boolean;
  counts: Record<string, number>;
  needsActionCount: number;
  needsAction?: Array<{
    id: string;
    status: string;
    createdAt: string;
    city?: string | null;
    state?: string | null;
  }>;
};

type FactoryCatalogSummary = {
  ok?: boolean;
  total?: number;
  activeCount?: number;
  inactiveCount?: number;
};

type FactoryTopProductsResponse = {
  ok: boolean;
  items: Array<{
    productId: string;
    title?: string | null;
    active?: boolean | null;
    unitsSold?: number | null;
  }>;
};

function onlyDigits(v: string) {
  return String(v ?? '').replace(/\D/g, '');
}

function formatCnpjDigits(digits: string) {
  const d = String(digits ?? '').replace(/\D/g, '').slice(0, 14);

  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      '$1.$2.$3/$4-$5',
    );
}

function toUF(v: string) {
  return String(v ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function statusLabel(status?: string | null) {
  const s = String(status ?? '').trim().toUpperCase();
  if (!s) return '—';
  if (s === 'ACTIVE') return 'Ativo';
  if (s === 'PENDING') return 'Em validação';
  if (s === 'SUSPENDED') return 'Suspenso';
  return s;
}

function statusTone(status?: string | null) {
  const s = String(status ?? '').trim().toUpperCase();
  if (s === 'ACTIVE')
    return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
  if (s === 'PENDING')
    return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
  if (s === 'SUSPENDED')
    return 'border-rose-400/20 bg-rose-500/10 text-rose-100';
  return 'border-white/15 bg-white/5 text-white/80';
}

export default function FactoryDash() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [showInfo, setShowInfo] = useState(false);

  const [factoryStatus, setFactoryStatus] = useState<string>('');
  const [factoryId, setFactoryId] = useState<string>('');

  const [form, setForm] = useState({
    tradeName: '',
    legalName: '',
    document: '',
    city: '',
    state: '',
  });

  // ✅ summary (backend)
  const [ordersSummary, setOrdersSummary] = useState<FactoryOrdersSummary | null>(
    null,
  );

  // ✅ summary do catálogo (backend / MVP)
  const [catalogSummary, setCatalogSummary] =
    useState<FactoryCatalogSummary | null>(null);

  // ✅ top produtos (backend / MVP)
  const [topProducts, setTopProducts] =
    useState<FactoryTopProductsResponse | null>(null);

  // ✅ REFS + foco programático (Completar perfil)
  const tradeRef = useRef<HTMLInputElement | null>(null);
  const legalRef = useRef<HTMLInputElement | null>(null);
  const cnpjRef = useRef<HTMLInputElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const ufRef = useRef<HTMLInputElement | null>(null);

  type FocusKey = 'tradeName' | 'legalName' | 'document' | 'city' | 'state';
  const [focusKey, setFocusKey] = useState<FocusKey | null>(null);

  const profileChecks = useMemo(() => {
    const missing: Array<{ key: FocusKey; label: string; hint: string }> = [];

    const trade = String(form.tradeName ?? '').trim();
    const docDigits = onlyDigits(String(form.document ?? ''));
    const city = String(form.city ?? '').trim();
    const uf = toUF(form.state ?? '');

    if (!trade)
      missing.push({
        key: 'tradeName',
        label: 'Nome fantasia',
        hint: 'Ajuda sua fábrica a aparecer e ser lembrada no catálogo.',
      });

    if (docDigits.length !== 14)
      missing.push({
        key: 'document',
        label: 'CNPJ',
        hint: 'Base institucional para confiança e validação do ecossistema.',
      });

    if (!city)
      missing.push({
        key: 'city',
        label: 'Cidade',
        hint: 'Melhora recomendações locais, rotas e distribuição.',
      });

    if (uf.length !== 2)
      missing.push({
        key: 'state',
        label: 'UF',
        hint: 'Usado para regionalização e métricas por canal.',
      });

    const total = 4;
    const done = total - missing.length;
    const score = Math.round((done / total) * 100);

    return { missing, total, done, score };
  }, [form.city, form.document, form.state, form.tradeName]);

  // ✅ quando abrir o “Editar”, foca no campo certo (primeiro faltante)
  useEffect(() => {
    if (!showInfo) return;
    if (!focusKey) return;

    const map: Record<FocusKey, React.RefObject<HTMLInputElement | null>> = {
      tradeName: tradeRef,
      legalName: legalRef,
      document: cnpjRef,
      city: cityRef,
      state: ufRef,
    };

    const ref = map[focusKey];
    const el = ref?.current;

    if (el) {
      setTimeout(() => {
        el.focus();
        try {
          el.select?.();
        } catch {}
      }, 30);
    }

    setFocusKey(null);
  }, [showInfo, focusKey]);

  // ✅ carrega "me" da fábrica
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMsg('');

        const token = getToken();
        if (!token) {
          setMsg('Sem token. Faça login primeiro.');
          return;
        }

        const data = await fetchJSON<FactoryMeResponse>(`/factories/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const f = data?.factory ?? null;

        if (f) {
          setFactoryStatus(f.status ?? '');
          setFactoryId(f.id ?? '');
          setForm({
            tradeName: f.tradeName ?? '',
            legalName: f.legalName ?? '',
            document: formatCnpjDigits(f.document ?? ''),
            city: f.city ?? '',
            state: f.state ?? '',
          });
        } else {
          setMsg('Nenhuma fábrica vinculada ao seu usuário.');
        }
      } catch (e) {
        const a = e as ApiError;
        setMsg(`${a.status} - ${a.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ carrega summary de pedidos (não quebra a home)
  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        if (!token) return;

        const res = await fetchJSON<FactoryOrdersSummary>(
          '/factories/me/orders/summary',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setOrdersSummary(res);
      } catch {
        // não quebrar a home por isso
      }
    })();
  }, []);

  // ✅ carrega summary do catálogo (não quebra a home)
  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        if (!token) return;

        const res = await fetchJSON<FactoryCatalogSummary>(
          '/factories/me/catalog/summary',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setCatalogSummary(res);
      } catch {
        // não quebrar a home por isso
      }
    })();
  }, []);

  // ✅ carrega top produtos (não quebra a home)
  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        if (!token) return;

        const res = await fetchJSON<FactoryTopProductsResponse>(
          '/factories/me/top-products',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        setTopProducts(res);
      } catch {
        // não quebrar a home por isso
      }
    })();
  }, []);

  // ✅ score operacional (MVP)
  const opsScore = useMemo(() => {
    const counts = (ordersSummary?.counts ?? {}) as Record<string, number>;
    const n = (k: string) => Number(counts?.[k] ?? 0);

    const returnReq = n('RETURN_REQUESTED');
    const readyPickup = n('READY_FOR_PICKUP');
    const confirmed = n('CONFIRMED_BY_SELLER');
    const needs = Number(ordersSummary?.needsActionCount ?? 0);

    let score = 100;
    score -= returnReq * 18;
    score -= readyPickup * 8;
    score -= confirmed * 6;
    score -= needs * 5;

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    let label: 'Excelente' | 'Atenção' | 'Crítico' = 'Excelente';
    if (score < 75) label = 'Atenção';
    if (score < 45) label = 'Crítico';

    return { score, label, returnReq, readyPickup, confirmed, needs };
  }, [ordersSummary]);

  async function onSave() {
    try {
      setSaving(true);
      setMsg('');

      const token = getToken();
      if (!token) {
        setMsg('Sem token. Faça login primeiro.');
        return;
      }

      const payload = {
        tradeName: String(form.tradeName ?? '').trim(),
        legalName: String(form.legalName ?? '').trim() || null,
        // ✅ manda só dígitos pro backend
        document: onlyDigits(String(form.document ?? '')).slice(0, 14),
        city: String(form.city ?? '').trim() || null,
        state: toUF(form.state ?? '') || null,
      };

      if (!payload.tradeName) {
        setMsg('Preencha o Nome fantasia.');
        return;
      }

      if ((payload.document ?? '').length !== 14) {
        setMsg('CNPJ inválido (precisa ter 14 dígitos).');
        return;
      }

      const res = await fetchJSON<SaveResponse>(`/factories/me`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res || res.ok !== true) {
        setMsg(res?.message ?? 'Falha ao salvar.');
        return;
      }

      setMsg('✅ Salvo com sucesso!');
      setShowInfo(false);
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setSaving(false);
    }
  }

  // ✅ handlers de teclado no form
  function onKeyDownForm(e: ReactKeyboardEvent) {
    // Esc fecha
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowInfo(false);
      return;
    }

    // Ctrl+Enter salva (Win/Linux) | Cmd+Enter (Mac)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave();
      return;
    }
  }

  const headerTitle = useMemo(() => {
    const n = String(form.tradeName ?? '').trim();
    return n ? n : 'Sua fábrica';
  }, [form.tradeName]);

  // ===== MOCKS (até o backend existir) =====
  const mock = useMemo(() => {
    return {
      topSellers: {
        label: 'Mesa Lua • Cadeira Atlas',
        value: 'Top 2',
        delta: '+12%',
      },
      mostProblems: {
        label: 'Rachadura no tampo (lote 24A)',
        value: 'Alta',
        delta: '+3 pts',
      },
      reworkRate: {
        label: 'Retrabalho por instalação',
        value: '2,8%',
        delta: '-0,6%',
      },
      satisfaction: {
        label: 'Pós-serviço (compra → montagem)',
        value: '4,6/5',
        delta: '+0,2',
      },
      signals: [
        {
          kind: 'QUALIDADE',
          title: 'Aumento de reclamações: rachadura no tampo (lote 24A)',
          meta: 'Impacto: retrabalho • risco: reputação',
        },
        {
          kind: 'CAMPO',
          title: 'Instalação com atraso em SP — falta de peça em 3 ordens',
          meta: 'Impacto: SLA • ação: revisar embalagem / estoque',
        },
        {
          kind: 'CANAL',
          title: 'Demanda subiu no RJ — oportunidade de representante local',
          meta: 'Impacto: vendas • ação: abrir região',
        },
      ] satisfies FactorySignal[],
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      {/* ===== FUNDO MARTO (GRID + GLOWS) ===== */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      {/* ===== CONTEÚDO ===== */}
      <div className="relative z-10 mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold">
                Dashboard • Fabricante
              </h1>

              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
                  statusTone(factoryStatus),
                )}
                title="Status da fábrica no ecossistema"
              >
                {statusLabel(factoryStatus)}
              </span>
            </div>

            <p className="mt-2 text-sm text-white/65">
              Painel industrial: clareza, causa raiz e ações — sem ruído.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                Identidade:{' '}
                <span className="ml-1 font-semibold text-white">
                  {headerTitle}
                </span>
              </div>

              {factoryId ? (
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                  ID:{' '}
                  <span className="ml-1 font-mono text-white/80">
                    {factoryId.slice(0, 8)}…
                  </span>
                </div>
              ) : null}

              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                Perfil:{' '}
                <span className="ml-1 font-semibold text-white">
                  {profileChecks.score}%
                </span>
              </div>
            </div>
          </div>

          {/* ✅ HEADER NAV (corrigido Marto) */}
          <nav className="flex flex-wrap items-center gap-2">
            {/* Identidade do usuário (Conta + Perfil público) */}
            <Link
              href="/me"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              title="Sua identidade no Marto: foto, @handle, bio, sessão"
            >
              Identidade
            </Link>

            {/* Operação da fábrica */}
            <Link
              href="/dash/factory/overview"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              title="Score, sinais e pendências operacionais"
            >
              Visão geral
            </Link>

            <LogoutButton
              redirectTo="/login"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            />
          </nav>
        </header>

        {msg ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            {msg}
          </div>
        ) : null}

        {/* ===== INSIGHTS RÁPIDOS (MVP VISUAL) ===== */}
        <section className="mb-6 grid gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Visão geral (rápida)
                </h2>
                <p className="mt-1 text-sm text-white/65">
                  O que importa agora: sinal, tendência e ação.
                </p>
              </div>

              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                MVP • dados virão do backend
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <KpiCard
                title="Produtos mais vendidos"
                value={mock.topSellers.value}
                hint={mock.topSellers.label}
                delta={mock.topSellers.delta}
              />

              <KpiCard
                title="Mais problemas"
                value={mock.mostProblems.value}
                hint={mock.mostProblems.label}
                delta={mock.mostProblems.delta}
              />

              <KpiCard
                title="Taxa de retrabalho"
                value={mock.reworkRate.value}
                hint={mock.reworkRate.label}
                delta={mock.reworkRate.delta}
              />

              <KpiCard
                title="Satisfação geral"
                value={mock.satisfaction.value}
                hint={mock.satisfaction.label}
                delta={mock.satisfaction.delta}
              />
            </div>
          </div>

          {/* ===== AÇÕES RECOMENDADAS (ONBOARDING) ===== */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-4">
            <h2 className="text-base font-semibold text-white">
              Ações recomendadas
            </h2>
            <p className="mt-1 text-sm text-white/65">
              Menos achismo. Mais precisão operacional.
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-white/60">Completude do perfil</div>
                <div className="text-xs font-semibold text-white">
                  {profileChecks.score}%
                </div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-white/70"
                  style={{ width: `${profileChecks.score}%` }}
                />
              </div>

              {profileChecks.missing.length ? (
                <div className="mt-4 grid gap-2">
                  {profileChecks.missing.slice(0, 3).map((m, index) => (
                    <div
                      key={`${m.key}-${index}`}
                      className="rounded-xl border border-white/10 bg-black/30 p-3"
                    >
                      <div className="text-xs font-semibold text-white">
                        Falta: {m.label}
                      </div>
                      <div className="mt-1 text-xs text-white/60">{m.hint}</div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const first = profileChecks.missing[0]?.key ?? 'tradeName';
                      setFocusKey(first);
                      setShowInfo(true);
                    }}
                    className="mt-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
                  >
                    Completar perfil
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                  ✅ Perfil institucional completo. Pronto para operar e medir.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Alertas críticos</div>
              <div className="mt-2 text-sm text-white/70">
                Sem alertas no momento.
              </div>
              <div className="mt-1 text-xs text-white/55">
                (Em breve: “modelo X com falha na etapa Y”, “pico de retrabalho”.)
              </div>
            </div>
          </div>
        </section>

        {/* ===== ÚLTIMOS SINAIS ===== */}
        <section className="mb-6">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-white">Últimos sinais</h2>
            <p className="mt-1 text-sm text-white/65">
              Leitura rápida do ecossistema (qualidade • campo • canal).
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="grid gap-3">
              {mock.signals.map((s, i) => (
                <div
                  key={`${s.kind}-${i}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/70">
                      {s.kind}
                    </span>
                    <span className="text-[11px] text-white/55">agora</span>
                  </div>

                  <div className="mt-2 text-sm font-semibold text-white">
                    {s.title}
                  </div>
                  <div className="mt-1 text-xs text-white/60">{s.meta}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/dash/factory/overview"
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
                    >
                      Ver contexto
                    </Link>
                    <Link
                      href="/dash/factory/quality"
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
                    >
                      Abrir qualidade
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-white/55">
              Em breve: sinais reais do backend (pedidos, posts verificados,
              instalação).
            </div>
          </div>
        </section>

        {/* ===== HUB DAS ÁREAS DA FÁBRICA (6) ===== */}
        <section className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Áreas do painel industrial
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Estrutura clara para engenharia, qualidade e canal.
              </p>
            </div>

            <span className="text-xs text-white/55">
              Base do MVP: Visão geral → causa → ação
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CardLink
              title="Visão geral"
              desc="Resumo executivo: onde agir agora."
              href="/dash/factory/overview"
              tag="MVP"
            />
            <CardLink
              title="Produtos & modelos"
              desc="Volume, instalação, etapas críticas e impacto na avaliação."
              href="/dash/factory/catalog"
              tag="Core"
            />
            <CardLink
              title="Instalação & campo"
              desc="Tempo real, checklist e evidências visuais."
              href="/dash/factory/field"
              tag="Dados reais"
            />
            <CardLink
              title="Defeitos & qualidade"
              desc="Defeitos recorrentes, retrabalho e causa raiz."
              href="/dash/factory/quality"
              tag="Ação"
            />
            <CardLink
              title="Regiões & canal"
              desc="Mapa de demanda, performance por praça e canal."
              href="/dash/factory/regions"
              tag="Mercado"
            />
            <CardLink
              title="Relatórios & insights"
              desc="Relatórios mensais e comparativos (B2B)."
              href="/dash/factory/reports"
              tag="Insights"
            />
          </div>
        </section>

        {/* ===== ATALHOS OPERACIONAIS ===== */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10">
            {/* ✅ TÍTULO + BADGE */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">Catálogo</h2>

              {Number(catalogSummary?.total ?? 0) > 0 ? (
                <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[11px] font-medium text-white/80">
                  {Number(catalogSummary?.activeCount ?? 0)} ativo(s)
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
                  vazio
                </span>
              )}
            </div>

            {/* ✅ TEXTO “AGORA” */}
            <p className="mt-1 text-sm text-white/65">
              Controle o que está “vendável” agora: ativos, inativos e qualidade
              do anúncio.
            </p>

            {/* ✅ 2 CTAs */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dash/factory/catalog"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Gerenciar catálogo
              </Link>

              {Number(catalogSummary?.inactiveCount ?? 0) > 0 ? (
                <Link
                  href="/dash/factory/catalog"
                  className="inline-flex items-center rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  Revisar {Number(catalogSummary?.inactiveCount ?? 0)} inativo(s)
                </Link>
              ) : null}
            </div>

            {/* ✅ mini-linha de indicadores */}
            <div className="mt-3 text-xs text-white/55">
              {Number(catalogSummary?.total ?? 0) > 0 ? (
                <>
                  Ativos: {Number(catalogSummary?.activeCount ?? 0)} • Inativos:{' '}
                  {Number(catalogSummary?.inactiveCount ?? 0)}
                </>
              ) : (
                <>Sem produtos ainda. Comece pelo primeiro item do catálogo.</>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10">
            {/* ✅ TÍTULO + BADGE */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">Pedidos</h2>

              {Number(ordersSummary?.needsActionCount ?? 0) > 0 ? (
                <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[11px] font-medium text-white/80">
                  {Number(ordersSummary?.needsActionCount ?? 0)} ação(ões)
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
                  ok
                </span>
              )}
            </div>

            {/* ✅ TEXTO “AGORA” */}
            <p className="mt-1 text-sm text-white/65">
              Acompanhe o fluxo e resolva pendências antes de virarem reclamação.
            </p>

            {/* ✅ 2 CTAs */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dash/factory/overview"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Ver ações
              </Link>

              <Link
                href="/dash/factory/orders"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Ver pedidos
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10">
            <h2 className="text-base font-semibold text-white">
              Representantes
            </h2>
            <p className="mt-1 text-sm text-white/65">
              Gerencie sua rede comercial, convites e regiões.
            </p>
            <div className="mt-4">
              <Link
                href="/dash/factory/representatives"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Gerenciar representantes
              </Link>
            </div>
          </div>
        </section>

        {/* ===== SAÚDE DO ECOSSISTEMA (SCORE) ===== */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Saúde do ecossistema
              </h2>
              <p className="mt-1 text-xs text-white/55">
                Score operacional (MVP) baseado em pedidos e ações pendentes.
              </p>
            </div>

            <Link
              href="/dash/factory/overview"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              Abrir visão geral
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-white/60">Score</div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {opsScore.score}
                  </div>
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

              <div className="mt-3 text-xs text-white/55">
                {ordersSummary ? 'Atualizado do backend.' : 'Carregando sinais…'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
              <div className="text-xs text-white/60">Pontos de atenção</div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">
                    Devoluções
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    RETURN_REQUESTED: {opsScore.returnReq}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">Acúmulo</div>
                  <div className="mt-1 text-xs text-white/60">
                    READY_FOR_PICKUP: {opsScore.readyPickup}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">Travas</div>
                  <div className="mt-1 text-xs text-white/60">
                    CONFIRMED_BY_SELLER: {opsScore.confirmed}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-white">
                    Ações pendentes
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    needsAction: {opsScore.needs}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-white/55">
                Em breve: score com instalação + qualidade por modelo/lote.
              </div>
            </div>
          </div>
        </section>

        {/* ===== TOP PRODUTOS ===== */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Top produtos</h2>
              <p className="mt-1 text-xs text-white/55">
                Ranking por unidades vendidas (MVP).
              </p>
            </div>

            <Link
              href="/dash/factory/catalog"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              Abrir catálogo
            </Link>
          </div>

          <div className="mt-4 grid gap-2">
            {(topProducts?.items ?? []).length ? (
              topProducts!.items.map((p, idx) => (
                <div
                  key={`${p.productId}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/70">
                        #{idx + 1}
                      </span>

                      <div className="truncate text-sm font-semibold text-white">
                        {p.title ?? 'Produto'}
                      </div>

                      {p.active ? (
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/60">
                          ativo
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                          inativo
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-white/55">
                      productId: {String(p.productId).slice(0, 8)}…
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs text-white/60">Unidades</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {Number(p.unitsSold ?? 0)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                Sem dados ainda. Quando houver pedidos com itens, o ranking
                aparece aqui.
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-white/55">
            Em breve: filtro por período + lucro estimado + sinais por modelo.
          </div>
        </section>

        <p className="mb-4 text-sm text-white/65">
          Esses dados identificam sua fábrica dentro do Marto e alimentam
          catálogos, canal, qualidade e relatórios.
        </p>

        {/* ===== DADOS INSTITUCIONAIS (EDITÁVEL) ===== */}
        <section className="rounded-2xl border border-white/10 bg-neutral-950/60 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Informações institucionais
              </h2>
              <p className="text-xs text-white/55">
                Base de confiança e validação no ecossistema.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowInfo((v) => {
                    const next = !v;
                    if (next) setFocusKey('tradeName'); // foco padrão ao abrir
                    return next;
                  });
                }}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
              >
                {showInfo ? 'Fechar' : 'Editar'}
              </button>

              <button
                onClick={onSave}
                disabled={loading || saving || !showInfo}
                className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-60"
                title={!showInfo ? 'Abra em Editar para salvar' : undefined}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>

          {showInfo ? (
            <div onKeyDown={onKeyDownForm}>
              <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">
                    Nome fantasia
                  </span>
                  <input
                    ref={tradeRef}
                    value={form.tradeName}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, tradeName: e.target.value }))
                    }
                    placeholder="Ex.: Fábrica Aurora"
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">
                    Razão social
                  </span>
                  <input
                    ref={legalRef}
                    value={form.legalName}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, legalName: e.target.value }))
                    }
                    placeholder="Opcional"
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">CNPJ</span>
                  <input
                    ref={cnpjRef}
                    value={form.document}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        document: formatCnpjDigits(e.target.value),
                      }))
                    }
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">
                    Cidade
                  </span>
                  <input
                    ref={cityRef}
                    value={form.city}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, city: e.target.value }))
                    }
                    placeholder="Ex.: Ubá"
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">UF</span>
                  <input
                    ref={ufRef}
                    value={form.state}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, state: toUF(e.target.value) }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onSave();
                      }
                    }}
                    maxLength={2}
                    placeholder="MG"
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>
              </div>

              <div className="px-4 pb-4 text-xs text-white/55">
                Dica: o CNPJ será enviado para o backend apenas com dígitos.
              </div>
            </div>
          ) : (
            <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">Nome fantasia</div>
                <div className="mt-1 text-sm text-white">
                  {String(form.tradeName ?? '').trim() || '—'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">Razão social</div>
                <div className="mt-1 text-sm text-white">
                  {String(form.legalName ?? '').trim() || '—'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">CNPJ</div>
                <div className="mt-1 text-sm text-white">
                  {String(form.document ?? '').trim() || '—'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">Local</div>
                <div className="mt-1 text-sm text-white">
                  {[String(form.city ?? '').trim(), toUF(form.state ?? '')]
                    .filter(Boolean)
                    .join(' • ') || '—'}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CardLink({
  title,
  desc,
  href,
  tag,
}: {
  title: string;
  desc: string;
  href: string;
  tag?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-white/5"
    >
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

      <div className="mt-4 inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white group-hover:bg-white/10">
        Abrir
      </div>
    </Link>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
