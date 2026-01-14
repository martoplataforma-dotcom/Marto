// apps/web/app/dash/provider/profile/page.tsx
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

type Address = {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  uf?: string | null;
};

type ServiceProvider = {
  cpf: string; // ⚠️ legado
  city?: string | null;
  cepPrefix?: string | null;
  status: string;
  kind?: ServiceProviderKind;
  transporter?: Transporter | null;

  document?: string | null;
  documentType?: 'CPF' | 'CNPJ' | null;
  cep?: string | null;
  address?: Address | null;
};

type ServiceArea = {
  cities?: string[];
  radiusKm?: number;
};

function asServiceArea(value: unknown): ServiceArea | null {
  if (!value || typeof value !== 'object') return null;
  return value as ServiceArea;
}

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

function onlyDigits(s: string) {
  return String(s ?? '').replace(/\D/g, '');
}

function formatCnpj(raw: string) {
  const d = onlyDigits(raw).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      '$1.$2.$3/$4-$5',
    );
}

function formatCpf(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

function formatCep(raw: string) {
  const d = onlyDigits(raw).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

function getDocumentDigits(sp: ServiceProvider | null): string {
  const fromNew = onlyDigits(sp?.document ?? '');
  const fromLegacy = onlyDigits(sp?.cpf ?? '');
  return fromNew || fromLegacy;
}

function getCepDigits(sp: ServiceProvider | null): string {
  const fromNew = onlyDigits(sp?.cep ?? '');
  const fromLegacy = onlyDigits(sp?.cepPrefix ?? '');
  return fromNew || fromLegacy;
}

function getAddress(sp: ServiceProvider | null): Address | null {
  const a = sp?.address ?? null;
  if (!a || typeof a !== 'object') return null;
  return a;
}

type MsgState =
  | { kind: 'none' }
  | { kind: 'error'; text: string }
  | { kind: 'ok'; text: string }
  | { kind: 'info'; text: string };

function msgFromError(e: unknown): string {
  const a = e as ApiError;
  if (a?.status) return `${a.status} - ${a.message}`;
  return e instanceof Error ? e.message : String(e ?? 'Erro');
}

// ✅ sanitize do @handle
function sanitizeHandle(raw: string) {
  return String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 24);
}

export default function ProviderProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<MsgState>({ kind: 'none' });
  const [data, setData] = useState<ServiceProvider | null>(null);

  const [document, setDocument] = useState('');
  const [cep, setCep] = useState('');

  // ✅ handle
  const [handle, setHandle] = useState('');
  const [handleSaving, setHandleSaving] = useState(false);

  const [street, setStreet] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');

  const [tName, setTName] = useState('');
  const [tState, setTState] = useState('');
  const [areaCitiesText, setAreaCitiesText] = useState('');
  const [areaRadiusKm, setAreaRadiusKm] = useState<number>(60);

  const kind: ServiceProviderKind = useMemo(() => {
    if (data?.kind === 'TRANSPORTER') return 'TRANSPORTER';
    return 'GENERIC';
  }, [data?.kind]);

  const docLabel = kind === 'TRANSPORTER' ? 'CNPJ' : 'CPF';

  // ✅ regra certa do Marto:
  // - provider normal volta pro painel de trabalho: /dash/provider/services
  // - transporter volta pro painel transporter
  const backHref =
    kind === 'TRANSPORTER'
      ? '/dash/provider/transporter'
      : '/dash/provider/services';

  function handleLogout() {
    localStorage.removeItem('marto_access');
    router.push('/login');
  }

  async function load() {
    try {
      setLoading(true);
      setMsg({ kind: 'none' });

      const sp = await fetchJSON<ServiceProvider | null>('/service-providers/me');
      setData(sp);

      // ✅ carregar handle do /me (não bloqueia a tela se falhar)
      try {
        const me = await fetchJSON<{ profile?: { handle?: string | null } }>(
          '/me',
          { method: 'GET' },
        );
        setHandle(String(me?.profile?.handle ?? ''));
      } catch {
        /* não bloqueia */
      }

      setDocument(getDocumentDigits(sp));
      setCep(getCepDigits(sp));

      const addr = getAddress(sp);
      if (addr) {
        setStreet(addr.street ?? '');
        setDistrict(addr.district ?? '');
        setCity(addr.city ?? (sp?.city ?? ''));
        setUf(addr.uf ?? '');
        setNumber(addr.number ?? '');
        setComplement(addr.complement ?? '');
      } else {
        setStreet('');
        setDistrict('');
        setCity(sp?.city ?? '');
        setUf('');
        setNumber('');
        setComplement('');
      }

      const t = sp?.transporter ?? null;
      setTName(t?.name ?? '');
      setTState(t?.state ?? '');

      const a = asServiceArea(t?.serviceArea ?? null);
      const cities = Array.isArray(a?.cities) ? a.cities.filter(Boolean) : [];
      setAreaCitiesText(cities.join(', '));

      const r = typeof a?.radiusKm === 'number' ? a.radiusKm : 60;
      setAreaRadiusKm(r);
    } catch (e) {
      setMsg({ kind: 'error', text: msgFromError(e) });
    } finally {
      setLoading(false);
    }
  }

  async function lookupCep(rawCep: string) {
    const digits = onlyDigits(rawCep).slice(0, 8);
    if (digits.length !== 8) return;

    try {
      setMsg({ kind: 'info', text: 'Buscando CEP…' });

      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = (await res.json()) as ViaCepResponse;

      if (json?.erro) {
        setMsg({ kind: 'error', text: 'CEP não encontrado.' });
        return;
      }

      setStreet(json.logradouro ?? '');
      setDistrict(json.bairro ?? '');
      setCity(json.localidade ?? city);
      setUf(json.uf ?? '');

      setMsg({ kind: 'none' });
    } catch {
      setMsg({
        kind: 'error',
        text: 'Falha ao buscar CEP. Verifique sua internet e tente de novo.',
      });
    }
  }

  async function saveHandle() {
    try {
      setHandleSaving(true);
      setMsg({ kind: 'none' });

      const next = sanitizeHandle(handle);
      if (!next) {
        setMsg({ kind: 'error', text: 'Handle obrigatório.' });
        return;
      }

      await fetchJSON('/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ handle: next }),
      });

      setHandle(next);
      setMsg({ kind: 'ok', text: '✅ Handle salvo' });
    } catch (e) {
      setMsg({ kind: 'error', text: msgFromError(e) });
    } finally {
      setHandleSaving(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setMsg({ kind: 'none' });

      const docDigits = onlyDigits(document);
      const cepDigits = onlyDigits(cep).slice(0, 8);

      if (!docDigits) {
        setMsg({ kind: 'error', text: `${docLabel} obrigatório.` });
        return;
      }

      const documentType = kind === 'TRANSPORTER' ? 'CNPJ' : 'CPF';

      const payload: {
        document: string;
        documentType: 'CPF' | 'CNPJ';
        cep?: string;
        address: {
          street?: string;
          number?: string;
          complement?: string;
          district?: string;
          city?: string;
          uf?: string;
        };
        city?: string;
        kind: ServiceProviderKind;
      } = {
        document: docDigits,
        documentType,
        cep: cepDigits.length === 8 ? cepDigits : undefined,
        address: {
          street: street.trim() || undefined,
          number: number.trim() || undefined,
          complement: complement.trim() || undefined,
          district: district.trim() || undefined,
          city: city.trim() || undefined,
          uf: uf.trim() || undefined,
        },
        city: city.trim() || undefined,
        kind,
      };

      const saved = await fetchJSON<ServiceProvider>('/service-providers/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setData(saved);

      setDocument(getDocumentDigits(saved));
      setCep(getCepDigits(saved));

      const savedAddr = getAddress(saved);
      if (savedAddr) {
        setStreet(savedAddr.street ?? street);
        setDistrict(savedAddr.district ?? district);
        setCity(savedAddr.city ?? (saved?.city ?? city));
        setUf(savedAddr.uf ?? uf);
        setNumber(savedAddr.number ?? number);
        setComplement(savedAddr.complement ?? complement);
      } else {
        setCity(saved?.city ?? city);
      }

      setMsg({ kind: 'ok', text: '✅ Configurações salvas' });
    } catch (e) {
      setMsg({ kind: 'error', text: msgFromError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function saveTransporterArea() {
    try {
      setSaving(true);
      setMsg({ kind: 'none' });

      const cities = areaCitiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: (tName || 'Transportadora').trim(),
        state: (tState || undefined)?.trim(),
        city: city.trim() || undefined,
        type: data?.transporter?.type ?? 'CARRIER',
        serviceArea: {
          cities,
          radiusKm: Number.isFinite(areaRadiusKm) ? areaRadiusKm : 60,
        },
      };

      const res = await fetchJSON<{ ok: boolean; transporter: Transporter }>(
        '/transporters/me',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setData((prev) =>
        prev
          ? {
              ...prev,
              transporter: res?.transporter ?? prev.transporter,
            }
          : prev,
      );

      setMsg({ kind: 'ok', text: '✅ Área atendida salva' });
    } catch (e) {
      setMsg({ kind: 'error', text: msgFromError(e) });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
              Configurações • Provider
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Perfil de {kind === 'TRANSPORTER' ? 'transportadora' : 'prestador'}
            </h1>

            <p className="mt-2 text-sm text-white/65">
              {kind === 'TRANSPORTER'
                ? 'Identidade e base de operação.'
                : 'Identidade e base de atendimento.'}
            </p>
          </div>

          {/* header actions */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/me"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Ver perfil público
            </Link>

            <Link
              href={backHref}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Voltar ao painel
            </Link>

            <button
              type="button"
              onClick={() => {
                const ok = window.confirm('Sair da conta agora?');
                if (!ok) return;
                handleLogout();
              }}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
            >
              Sair
            </button>
          </div>
        </header>

        {msg.kind !== 'none' ? (
          <div
            className={[
              'mb-4 rounded-2xl border px-4 py-3 text-sm',
              msg.kind === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : msg.kind === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-white/5 text-white/75',
            ].join(' ')}
          >
            {msg.text}
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          {loading ? (
            <p className="text-sm text-white/70">Carregando…</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white/90">
                  Identidade
                </div>

                {data ? (
                  <div className="text-sm text-white/70">
                    Status:{' '}
                    <span className="font-semibold text-white">
                      {data.status}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">{docLabel}</span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={
                      kind === 'TRANSPORTER'
                        ? formatCnpj(document)
                        : formatCpf(document)
                    }
                    onChange={(e) => setDocument(e.target.value)}
                    placeholder={
                      kind === 'TRANSPORTER'
                        ? '00.000.000/0000-00'
                        : '000.000.000-00'
                    }
                    inputMode="numeric"
                  />
                  <span className="text-xs text-white/55">
                    (Salvo no backend como document/documentType.)
                  </span>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">CEP</span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={formatCep(cep)}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCep(next);

                      const digits = onlyDigits(next).slice(0, 8);
                      if (digits.length === 8) void lookupCep(digits);
                    }}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                  <span className="text-xs text-white/55">
                    Ao completar, o Marto completa o endereço.
                  </span>
                </label>

                {/* Handle */}
                <label className="grid gap-2 text-sm sm:col-span-2">
                  <span className="font-semibold text-white/85">
                    Handle (seu @ no Marto)
                  </span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={handle}
                    onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
                    placeholder="ex: luu.entregas"
                    autoComplete="off"
                  />
                  <span className="text-xs text-white/55">
                    Isso vira seu link público:{' '}
                    <span className="font-semibold text-white">
                      /u/{sanitizeHandle(handle) || 'seu_handle'}
                    </span>
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveHandle()}
                      disabled={handleSaving}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
                    >
                      {handleSaving ? 'Salvando…' : 'Salvar handle'}
                    </button>

                    <Link
                      href="/me"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Ver no /me
                    </Link>
                  </div>
                </label>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">Cidade</span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ubá"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">UF</span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    placeholder="MG"
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">Logradouro</span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua..."
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">Número</span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="123"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">
                    Complemento
                  </span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Apto, bloco, referência..."
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-white/85">Bairro</span>
                  <input
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Centro..."
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => void save()}
                  disabled={saving || loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>

                <button
                  onClick={() => void load()}
                  disabled={saving || loading}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                >
                  Recarregar
                </button>
              </div>
            </>
          )}
        </section>

        {kind === 'TRANSPORTER' ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/90">
                Transportadora
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                Área atendida
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-white/85">Nome</span>
                <input
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  placeholder="Trans Ubá Express"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-white/85">UF</span>
                <input
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                  value={tState}
                  onChange={(e) => setTState(e.target.value)}
                  placeholder="MG"
                />
              </label>

              <label className="grid gap-2 text-sm sm:col-span-2">
                <span className="font-semibold text-white/85">
                  Cidades atendidas
                </span>
                <input
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                  value={areaCitiesText}
                  onChange={(e) => setAreaCitiesText(e.target.value)}
                  placeholder="Ubá, Visconde do Rio Branco, ..."
                />
                <span className="text-xs text-white/55">
                  Separe por vírgulas. Ex: Ubá, Visconde do Rio Branco
                </span>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-white/85">Raio (km)</span>
                <input
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                  value={String(areaRadiusKm)}
                  onChange={(e) => setAreaRadiusKm(Number(e.target.value))}
                  inputMode="numeric"
                  placeholder="60"
                />
              </label>

              <div className="flex items-end">
                <button
                  onClick={() => void saveTransporterArea()}
                  disabled={saving || loading}
                  className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : 'Salvar área'}
                </button>
              </div>
            </div>

            <div className="mt-4 text-xs text-white/55">
              Dica Marto: área atendida bem definida = mais pedidos certos, menos
              atrito.
            </div>
          </section>
        ) : null}

        {/* Sessão (padrão Marto) */}
        <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-neutral-50 px-5 py-4">
            <div className="text-sm font-semibold text-neutral-900">Sessão</div>
            <div className="mt-1 text-xs text-neutral-600">
              Você pode sair e entrar novamente quando quiser.
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-neutral-700">
                Se estiver em um computador compartilhado, é recomendado sair da
                conta.
              </div>

              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm('Sair da conta agora?');
                  if (ok) handleLogout();
                }}
                className="w-fit rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Sair da conta
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
