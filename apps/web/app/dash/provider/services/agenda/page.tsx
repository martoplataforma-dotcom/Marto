'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'marto_provider_agenda_v1';
const LOCAL_EVENT = 'marto_storage';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type TimeWindow = {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

type DayAvailability = {
  enabled: boolean;
  windows: TimeWindow[];
};

type AgendaState = Record<DayKey, DayAvailability>;

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Segunda', short: 'Seg' },
  { key: 'tue', label: 'Terça', short: 'Ter' },
  { key: 'wed', label: 'Quarta', short: 'Qua' },
  { key: 'thu', label: 'Quinta', short: 'Qui' },
  { key: 'fri', label: 'Sexta', short: 'Sex' },
  { key: 'sat', label: 'Sábado', short: 'Sáb' },
  { key: 'sun', label: 'Domingo', short: 'Dom' },
];

function defaultAgenda(): AgendaState {
  const empty: DayAvailability = { enabled: false, windows: [] };
  return {
    mon: { ...empty },
    tue: { ...empty },
    wed: { ...empty },
    thu: { ...empty },
    fri: { ...empty },
    sat: { ...empty },
    sun: { ...empty },
  };
}

function subscribeAgenda(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) callback();
  };

  const onLocal = () => callback();

  window.addEventListener('storage', onStorage);
  window.addEventListener(LOCAL_EVENT, onLocal);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(LOCAL_EVENT, onLocal);
  };
}

function getRawAgenda(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * ✅ Parse robusto (sem any) a partir de uma string raw (JSON).
 * Não acessa window/localStorage aqui.
 */
function parseAgendaRaw(raw: string): AgendaState {
  if (!raw) return defaultAgenda();

  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return defaultAgenda();

    const obj = v as Record<string, unknown>;
    const base = defaultAgenda();

    for (const d of DAYS) {
      const dayRaw = obj[d.key];
      if (!dayRaw || typeof dayRaw !== 'object') continue;

      const dayObj = dayRaw as Record<string, unknown>;
      const enabled = Boolean(dayObj.enabled);

      const windowsRaw = dayObj.windows;
      const windows: TimeWindow[] = Array.isArray(windowsRaw)
        ? windowsRaw
            .map((w: unknown) => {
              const wObj =
                w && typeof w === 'object'
                  ? (w as Record<string, unknown>)
                  : null;

              return {
                start: String(wObj?.start ?? ''),
                end: String(wObj?.end ?? ''),
              };
            })
            .filter((w: TimeWindow) => w.start && w.end)
        : [];

      base[d.key] = { enabled, windows };
    }

    return base;
  } catch {
    return defaultAgenda();
  }
}

function writeAgenda(next: AgendaState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // ✅ atualiza na mesma aba
    window.dispatchEvent(new Event(LOCAL_EVENT));
  } catch {
    // sem toast aqui (mantém simples)
  }
}

function timeToMinutes(t: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function validateDay(day: DayAvailability): string | null {
  if (!day.enabled) return null;
  if (!day.windows.length) return 'Ative o dia e adicione pelo menos 1 janela.';

  const ws = [...day.windows]
    .map((w) => ({
      ...w,
      s: timeToMinutes(w.start),
      e: timeToMinutes(w.end),
    }))
    .sort((a, b) => (a.s ?? 0) - (b.s ?? 0));

  for (const w of ws) {
    if (w.s === null || w.e === null) return 'Horário inválido (use HH:MM).';
    if (w.e <= w.s) return 'A janela precisa ter fim maior que o início.';
  }

  for (let i = 1; i < ws.length; i++) {
    const prev = ws[i - 1];
    const cur = ws[i];
    if ((cur.s ?? 0) < (prev.e ?? 0)) return 'Janelas sobrepostas. Ajuste os horários.';
  }

  return null;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
      {children}
    </span>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
      {children}
    </section>
  );
}

export default function ProviderAgendaPage() {
  // ✅ estado vem do storage (sem useEffect + setState)
  const raw = useSyncExternalStore(subscribeAgenda, getRawAgenda, () => '');
  const agenda = useMemo(() => parseAgendaRaw(raw), [raw]);

  const [activeDay, setActiveDay] = useState<DayKey>('mon');
  const [toast, setToast] = useState<string | null>(null);

  const day = agenda[activeDay];

  const enabledCount = useMemo(() => {
    return DAYS.reduce((acc, d) => acc + (agenda[d.key].enabled ? 1 : 0), 0);
  }, [agenda]);

  function setDay(next: DayAvailability) {
    writeAgenda({ ...agenda, [activeDay]: next });
  }

  function toggleEnabled() {
    setDay({
      ...day,
      enabled: !day.enabled,
      windows:
        !day.enabled && day.windows.length === 0
          ? [{ start: '09:00', end: '18:00' }]
          : day.windows,
    });
  }

  function addWindow() {
    const last = day.windows[day.windows.length - 1];
    const start = last?.end && /^\d{2}:\d{2}$/.test(last.end) ? last.end : '09:00';

    const endMin = timeToMinutes(start);
    const end =
      endMin !== null
        ? `${String(Math.min(23, Math.floor((endMin + 60) / 60))).padStart(2, '0')}:${String(
            (endMin + 60) % 60,
          ).padStart(2, '0')}`
        : '10:00';

    setDay({
      ...day,
      enabled: true,
      windows: [...day.windows, { start, end }],
    });
  }

  function updateWindow(i: number, patch: Partial<TimeWindow>) {
    const next = day.windows.map((w, idx) => (idx === i ? { ...w, ...patch } : w));
    setDay({ ...day, windows: next });
  }

  function removeWindow(i: number) {
    const next = day.windows.filter((_, idx) => idx !== i);
    setDay({ ...day, windows: next });
  }

  function copyToAll() {
    const template: DayAvailability = {
      enabled: day.enabled,
      windows: day.windows.map((w) => ({ ...w })),
    };

    const out: AgendaState = { ...agenda };
    for (const d of DAYS) {
      out[d.key] = {
        enabled: template.enabled,
        windows: template.windows.map((w) => ({ ...w })),
      };
    }

    writeAgenda(out);

    setToast('Aplicado para todos os dias.');
    window.setTimeout(() => setToast(null), 1800);
  }

  function save() {
    // valida tudo (mesmo sendo autosave)
    for (const d of DAYS) {
      const err = validateDay(agenda[d.key]);
      if (err) {
        setActiveDay(d.key);
        setToast(`${d.label}: ${err}`);
        window.setTimeout(() => setToast(null), 2600);
        return;
      }
    }

    setToast('Agenda salva.');
    window.setTimeout(() => setToast(null), 1600);
  }

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
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
              Provider • Operação
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Agenda
            </h1>

            <p className="mt-2 text-sm text-white/65">
              Defina suas <span className="font-semibold text-white">janelas de operação</span>.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>Dias ativos: {enabledCount}/7</Badge>
              <Badge>Salva localmente</Badge>
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

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* LATERAL */}
          <GlassCard>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Dias</div>
              <button
                type="button"
                onClick={copyToAll}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                Copiar p/ todos
              </button>
            </div>

            <div className="grid gap-2">
              {DAYS.map((d) => {
                const a = agenda[d.key];
                const active = d.key === activeDay;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setActiveDay(d.key)}
                    className={[
                      'flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition',
                      active
                        ? 'border-white/25 bg-white/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10',
                    ].join(' ')}
                  >
                    <span className="font-semibold text-white">
                      {d.short}{' '}
                      <span className="font-normal text-white/55">{d.label}</span>
                    </span>
                    <span className="text-xs text-white/65">
                      {a.enabled ? `${a.windows.length} janela(s)` : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* CONTEÚDO */}
          <GlassCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  {DAYS.find((d) => d.key === activeDay)?.label}
                </div>
                <p className="mt-1 text-sm text-white/65">
                  Ative o dia e defina as janelas.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleEnabled}
                  className={[
                    'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                    day.enabled
                      ? 'border-white bg-white text-black hover:opacity-90'
                      : 'border-white/15 bg-white/5 text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {day.enabled ? 'Ativo' : 'Desativado'}
                </button>

                <button
                  type="button"
                  onClick={addWindow}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  + Janela
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {day.enabled && day.windows.length ? (
                day.windows.map((w, i) => (
                  <div
                    key={`${w.start}-${w.end}-${i}`}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-semibold text-white/70">
                          Início
                        </label>
                        <input
                          type="time"
                          value={w.start}
                          onChange={(e) => updateWindow(i, { start: e.target.value })}
                          className="rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                        />

                        <label className="ml-0 sm:ml-3 text-xs font-semibold text-white/70">
                          Fim
                        </label>
                        <input
                          type="time"
                          value={w.end}
                          onChange={(e) => updateWindow(i, { end: e.target.value })}
                          className="rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeWindow(i)}
                        className="w-fit rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
                  <div className="text-sm font-semibold text-white">
                    {day.enabled ? 'Sem janelas ainda' : 'Dia desativado'}
                  </div>
                  <p className="mt-1 text-sm text-white/65">
                    {day.enabled ? 'Adicione uma janela.' : 'Ative este dia.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-white">Toque Marto</div>
              <p className="mt-1 text-sm text-white/65">
                Precisão vira pontualidade. Pontualidade vira reputação.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
