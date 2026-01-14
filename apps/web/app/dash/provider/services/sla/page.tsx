'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'marto_provider_sla_v1';
const LOCAL_EVENT = 'marto_storage';

// ✅ controla 1ª renderização no client (pra bater com SSR)
let didHydrateClient = false;

type SlaState = {
  pickupMinutes: number; // tempo para iniciar (coleta / saída)
  deliveryMinutes: number; // tempo médio para concluir (entrega/atendimento)
  priority: 'balanced' | 'fast' | 'quality'; // como você quer operar
  notes: string; // regras simples (ex.: só agendado)
};

function clampInt(n: number, min: number, max: number) {
  const x = Math.trunc(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}

function onlyDigits(v: string) {
  return String(v ?? '').replace(/\D/g, '');
}

function defaultSla(): SlaState {
  return {
    pickupMinutes: 60,
    deliveryMinutes: 180,
    priority: 'balanced',
    notes: '',
  };
}

function parseSlaRaw(raw: string): SlaState {
  if (!raw) return defaultSla();

  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return defaultSla();

    const obj = v as Record<string, unknown>;

    const pickupMinutes = clampInt(Number(obj.pickupMinutes ?? 60), 15, 24 * 60);
    const deliveryMinutes = clampInt(
      Number(obj.deliveryMinutes ?? 180),
      30,
      7 * 24 * 60,
    );

    const p = String(obj.priority ?? 'balanced');
    const priority: SlaState['priority'] =
      p === 'fast' || p === 'quality' || p === 'balanced' ? p : 'balanced';

    const notes = String(obj.notes ?? '').slice(0, 220);

    return { pickupMinutes, deliveryMinutes, priority, notes };
  } catch {
    return defaultSla();
  }
}

function validateSla(s: SlaState): string | null {
  if (!Number.isFinite(s.pickupMinutes) || s.pickupMinutes < 15) {
    return 'Tempo de coleta/saída inválido (mínimo 15 min).';
  }
  if (!Number.isFinite(s.deliveryMinutes) || s.deliveryMinutes < 30) {
    return 'Tempo de entrega/atendimento inválido (mínimo 30 min).';
  }
  if (s.deliveryMinutes < s.pickupMinutes) {
    return 'O tempo total não pode ser menor que o tempo de coleta/saída.';
  }
  return null;
}

function minutesToHuman(mins: number) {
  const m = clampInt(mins, 0, 999999);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? `${h}h ${mm}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  const parts = [`${d}d`];
  if (hh) parts.push(`${hh}h`);
  if (mm) parts.push(`${mm}min`);
  return parts.join(' ');
}

function subscribeStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) callback();
  };
  const onLocal = () => callback();

  window.addEventListener('storage', onStorage);
  window.addEventListener(LOCAL_EVENT, onLocal);

  // ✅ depois do mount, “libera” leitura real e força 1 re-render
  if (!didHydrateClient) {
    didHydrateClient = true;
    queueMicrotask(() => callback());
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(LOCAL_EVENT, onLocal);
  };
}

function getSnapshotRaw(): string {
  // ✅ SSR: sempre vazio
  if (typeof window === 'undefined') return '';

  // ✅ 1º render do client (hidratação): vazio (igual SSR) => sem mismatch
  if (!didHydrateClient) return '';

  // ✅ depois do mount: lê de verdade
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeSla(next: SlaState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pickupMinutes: clampInt(next.pickupMinutes, 15, 24 * 60),
        deliveryMinutes: clampInt(next.deliveryMinutes, 30, 7 * 24 * 60),
        priority: next.priority,
        notes: next.notes.trim(),
      }),
    );
    // ✅ atualiza na mesma aba
    window.dispatchEvent(new Event(LOCAL_EVENT));
  } catch {
    // silencioso
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
      {children}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-white">{label}</div>
      {hint ? <p className="mt-1 text-sm text-white/65">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ChoiceCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-3xl border p-5 text-left transition',
        active
          ? 'border-white/20 bg-white/10'
          : 'border-white/10 bg-white/5 hover:bg-white/10',
      ].join(' ')}
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm text-white/65">{desc}</p>
      <div className="mt-3">
        <span
          className={[
            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
            active
              ? 'border-white/15 bg-white text-black'
              : 'border-white/10 bg-black/20 text-white/70',
          ].join(' ')}
        >
          {active ? 'Selecionado' : 'Selecionar'}
        </span>
      </div>
    </button>
  );
}

const INPUT_DARK =
  'w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30';

export default function ProviderSlaPage() {
  // ✅ estado vem do storage sem useEffect e sem mismatch
  const raw = useSyncExternalStore(subscribeStorage, getSnapshotRaw, () => '');
  const sla = useMemo(() => parseSlaRaw(raw), [raw]);

  const [toast, setToast] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = clampInt(sla.deliveryMinutes, 30, 7 * 24 * 60);
    const pickup = clampInt(sla.pickupMinutes, 15, 24 * 60);

    const bias =
      sla.priority === 'fast'
        ? 'Velocidade'
        : sla.priority === 'quality'
          ? 'Confiabilidade'
          : 'Equilíbrio';

    return {
      pickup,
      total,
      bias,
      ok: !validateSla(sla),
    };
  }, [sla]);

  function save() {
    const err = validateSla(sla);
    if (err) {
      setToast(err);
      window.setTimeout(() => setToast(null), 2400);
      return;
    }

    writeSla(sla);
    setToast('SLA salvo.');
    window.setTimeout(() => setToast(null), 1600);
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-white">
      {/* grid */}
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
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
              Provider • Operação
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              SLA
            </h1>

            <p className="mt-2 text-sm text-white/65">
              Defina seus prazos reais. O Marto usa o seu SLA para{' '}
              <span className="font-semibold text-white">
                prometer com confiança
              </span>{' '}
              — reputação nasce de promessas cumpridas.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>Salvo localmente</Badge>
              <Badge>Coleta/saída: {minutesToHuman(summary.pickup)}</Badge>
              <Badge>Total: {minutesToHuman(summary.total)}</Badge>
              <Badge>Operação: {summary.bias}</Badge>
              <Badge>{summary.ok ? 'OK' : 'Ajustar'}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dash/provider/services"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              ← Voltar para Central
            </Link>

            <button
              type="button"
              onClick={save}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Salvar
            </button>
          </div>
        </header>

        {toast ? (
          <div className="mb-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/85 shadow-sm backdrop-blur">
            {toast}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Tempo para iniciar (coleta / saída)"
            hint="Em quanto tempo você consegue começar após aceitar uma chamada."
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="range"
                  min={15}
                  max={240}
                  value={clampInt(sla.pickupMinutes, 15, 240)}
                  onChange={(e) =>
                    writeSla({
                      ...sla,
                      pickupMinutes: clampInt(Number(e.target.value), 15, 240),
                    })
                  }
                  className="w-full"
                />

                <input
                  value={String(sla.pickupMinutes)}
                  onChange={(e) =>
                    writeSla({
                      ...sla,
                      pickupMinutes: clampInt(
                        Number(onlyDigits(e.target.value) || 0),
                        15,
                        24 * 60,
                      ),
                    })
                  }
                  inputMode="numeric"
                  className={['sm:w-32', INPUT_DARK].join(' ')}
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                <span className="font-semibold text-white">Dica:</span> seja
                honesto. SLA real aumenta conclusão e protege sua reputação.
              </div>
            </div>
          </Field>

          <Field
            label="Tempo total médio (entrega / atendimento)"
            hint="Do aceite até finalizar. Use o que você realmente consegue cumprir."
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="range"
                  min={30}
                  max={1440}
                  value={clampInt(sla.deliveryMinutes, 30, 1440)}
                  onChange={(e) =>
                    writeSla({
                      ...sla,
                      deliveryMinutes: clampInt(
                        Number(e.target.value),
                        30,
                        1440,
                      ),
                    })
                  }
                  className="w-full"
                />

                <input
                  value={String(sla.deliveryMinutes)}
                  onChange={(e) =>
                    writeSla({
                      ...sla,
                      deliveryMinutes: clampInt(
                        Number(onlyDigits(e.target.value) || 0),
                        30,
                        7 * 24 * 60,
                      ),
                    })
                  }
                  inputMode="numeric"
                  className={['sm:w-32', INPUT_DARK].join(' ')}
                />
              </div>

              <div className="text-xs text-white/55">
                Mostrando como:{' '}
                <span className="font-semibold text-white">
                  {minutesToHuman(sla.deliveryMinutes)}
                </span>
              </div>

              {sla.deliveryMinutes < sla.pickupMinutes ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/85 shadow-sm backdrop-blur">
                  O total precisa ser maior que o tempo de coleta/saída.
                </div>
              ) : null}
            </div>
          </Field>

          <Field
            label="Estilo de operação"
            hint="Isso guia o match do Marto quando houver escolhas parecidas."
          >
            <div className="grid gap-2">
              <ChoiceCard
                active={sla.priority === 'fast'}
                title="Velocidade"
                desc="Priorizo rapidez e aceito chamadas mais urgentes."
                onClick={() => writeSla({ ...sla, priority: 'fast' })}
              />
              <ChoiceCard
                active={sla.priority === 'balanced'}
                title="Equilíbrio"
                desc="Estabilidade + boas conclusões. Melhor custo-benefício."
                onClick={() => writeSla({ ...sla, priority: 'balanced' })}
              />
              <ChoiceCard
                active={sla.priority === 'quality'}
                title="Confiabilidade"
                desc="Priorizo previsibilidade e taxa de sucesso alta."
                onClick={() => writeSla({ ...sla, priority: 'quality' })}
              />
            </div>
          </Field>

          <Field
            label="Regras rápidas (opcional)"
            hint='Ex.: "só agendado", "não rodo à noite", "entrega no centro".'
          >
            <textarea
              value={sla.notes}
              onChange={(e) => writeSla({ ...sla, notes: e.target.value })}
              placeholder="Escreva uma regra simples da sua operação…"
              className={['min-h-[140px]', INPUT_DARK].join(' ')}
              maxLength={220}
            />
            <div className="mt-2 text-xs text-white/55">
              {sla.notes.length}/220
            </div>
          </Field>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <div className="text-sm font-semibold text-white">Toque Marto</div>
          <p className="mt-2 text-sm text-white/65">
            SLA não é só prazo. É{' '}
            <span className="font-semibold text-white">promessa</span>. Promessa
            cumprida vira reputação. Reputação vira prioridade nas próximas
            rotas.
          </p>

          <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
            <span className="font-semibold text-white">Resumo atual:</span>{' '}
            iniciar em {minutesToHuman(sla.pickupMinutes)} • concluir em{' '}
            {minutesToHuman(sla.deliveryMinutes)} • operação{' '}
            <span className="font-semibold text-white">{summary.bias}</span>.
          </div>
        </section>
      </div>
    </main>
  );
}
