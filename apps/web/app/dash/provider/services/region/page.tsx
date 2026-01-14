'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'marto_provider_region_v1';
const LOCAL_EVENT = 'marto_storage';

// ✅ controla 1ª renderização no client (pra bater com SSR)
let didHydrateClient = false;

type RegionState = {
  city: string;
  state: string; // UF
  baseCep: string;
  radiusKm: number; // 1..300
  notes: string;
};

function defaultRegion(): RegionState {
  return {
    city: '',
    state: '',
    baseCep: '',
    radiusKm: 15,
    notes: '',
  };
}

function onlyDigits(v: string) {
  return String(v ?? '').replace(/\D/g, '');
}

function formatCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function clampInt(n: number, min: number, max: number) {
  const x = Math.trunc(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}

function parseRegionRaw(raw: string): RegionState {
  if (!raw) return defaultRegion();

  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return defaultRegion();

    const obj = v as Record<string, unknown>;
    const city = String(obj.city ?? '').slice(0, 80);
    const state = String(obj.state ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const baseCep = formatCep(String(obj.baseCep ?? ''));
    const radiusKm = clampInt(Number(obj.radiusKm ?? 15), 1, 300);
    const notes = String(obj.notes ?? '').slice(0, 200);

    return { city, state, baseCep, radiusKm, notes };
  } catch {
    return defaultRegion();
  }
}

function validateRegion(s: RegionState): string | null {
  const city = s.city.trim();
  const uf = s.state.trim().toUpperCase();

  if (!city) return 'Informe sua cidade-base.';
  if (uf.length !== 2) return 'Informe o UF (2 letras).';

  const cepDigits = onlyDigits(s.baseCep);
  if (cepDigits.length !== 8) return 'Informe o CEP base (8 dígitos).';

  if (!Number.isFinite(s.radiusKm) || s.radiusKm < 1 || s.radiusKm > 300) {
    return 'Raio inválido (1 a 300 km).';
  }

  return null;
}

function subscribeStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) callback();
  };

  const onLocal = () => callback();

  window.addEventListener('storage', onStorage);
  window.addEventListener(LOCAL_EVENT, onLocal);

  // ✅ depois que montou, “libera” a leitura do localStorage e força um re-render
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

function writeRegion(next: RegionState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...next,
        city: next.city.trim(),
        state: next.state.trim().toUpperCase(),
        baseCep: formatCep(next.baseCep),
        radiusKm: clampInt(next.radiusKm, 1, 300),
        notes: next.notes.trim(),
      }),
    );
    // ✅ atualiza na mesma aba
    window.dispatchEvent(new Event(LOCAL_EVENT));
  } catch {
    // sem toast aqui
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
      {children}
    </span>
  );
}

function GlassCard({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-white">{label}</div>
      {hint ? <p className="mt-1 text-sm text-white/65">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const INPUT =
  'w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30';

const MINI_INPUT =
  'rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30';

export default function ProviderRegionPage() {
  // ✅ estado vem do storage sem useEffect e sem mismatch
  const raw = useSyncExternalStore(subscribeStorage, getSnapshotRaw, () => '');
  const region = useMemo(() => parseRegionRaw(raw), [raw]);

  const [toast, setToast] = useState<string | null>(null);

  const completeness = useMemo(() => {
    let score = 0;
    if (region.city.trim()) score++;
    if (region.state.trim().length === 2) score++;
    if (onlyDigits(region.baseCep).length === 8) score++;
    if (Number.isFinite(region.radiusKm) && region.radiusKm >= 1) score++;
    return { score, total: 4 };
  }, [region]);

  function save() {
    const err = validateRegion(region);
    if (err) {
      setToast(err);
      window.setTimeout(() => setToast(null), 2400);
      return;
    }

    writeRegion(region);
    setToast('Região salva.');
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
              Região
            </h1>

            <p className="mt-2 text-sm text-white/65">
              Defina sua <span className="font-semibold text-white">base</span> e
              até onde você cobre. O Marto usa isso para fazer match com pedidos —
              precisão vira pontualidade, pontualidade vira reputação.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>Salva localmente</Badge>
              <Badge>
                Completo: {completeness.score}/{completeness.total}
              </Badge>
              <Badge>Raio: {region.radiusKm} km</Badge>
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
          <GlassCard
            label="Base (Cidade/UF)"
            hint="De onde você sai para rodar. Isso define sua referência para o raio."
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <input
                value={region.city}
                onChange={(e) => writeRegion({ ...region, city: e.target.value })}
                placeholder="Ex.: Ubá"
                className={INPUT}
                maxLength={80}
                autoComplete="address-level2"
              />
              <input
                value={region.state}
                onChange={(e) =>
                  writeRegion({
                    ...region,
                    state: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z]/g, '')
                      .slice(0, 2),
                  })
                }
                placeholder="UF"
                className={MINI_INPUT}
                maxLength={2}
                autoComplete="address-level1"
              />
            </div>
          </GlassCard>

          <GlassCard
            label="CEP base"
            hint="Usamos o CEP para melhorar o match e (no futuro) otimizar rotas."
          >
            <input
              value={region.baseCep}
              onChange={(e) =>
                writeRegion({ ...region, baseCep: formatCep(e.target.value) })
              }
              placeholder="00000-000"
              inputMode="numeric"
              className={INPUT}
              maxLength={9}
              autoComplete="postal-code"
            />
            <p className="mt-2 text-xs text-white/55">
              Dica: mantenha a base alinhada com onde você realmente começa a rota.
            </p>
          </GlassCard>

          <GlassCard
            label="Raio de cobertura"
            hint="Até onde você entrega/atende a partir da base (em km)."
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="range"
                  min={1}
                  max={150}
                  value={clampInt(region.radiusKm, 1, 150)}
                  onChange={(e) =>
                    writeRegion({
                      ...region,
                      radiusKm: clampInt(Number(e.target.value), 1, 150),
                    })
                  }
                  className="w-full accent-white"
                />
                <input
                  value={String(region.radiusKm)}
                  onChange={(e) =>
                    writeRegion({
                      ...region,
                      radiusKm: clampInt(
                        Number(onlyDigits(e.target.value) || 0),
                        1,
                        300,
                      ),
                    })
                  }
                  inputMode="numeric"
                  className="w-24 rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/75 shadow-sm backdrop-blur">
                <span className="font-semibold text-white">Marto:</span> raio bem
                definido evita chamadas “fora do mapa” e melhora sua taxa de
                aceitação.
              </div>
            </div>
          </GlassCard>

          <GlassCard
            label="Observações"
            hint='Opcional. Ex.: “somente bairro X”, “não rodo à noite”, “entrega agendada apenas”.'
          >
            <textarea
              value={region.notes}
              onChange={(e) => writeRegion({ ...region, notes: e.target.value })}
              placeholder="Escreva uma regra simples da sua operação…"
              className="min-h-[120px] w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
              maxLength={200}
            />
            <div className="mt-2 text-xs text-white/55">
              {region.notes.length}/200
            </div>
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
