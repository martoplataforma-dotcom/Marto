// apps/web/app/dash/provider/profile/page.tsx
'use client';

import Link from 'next/link';
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
  specialties?: string[] | null;
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

function normalizeSpecialties(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter(Boolean);
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

export default function ProviderProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<MsgState>({ kind: 'none' });
  const [data, setData] = useState<ServiceProvider | null>(null);

  const [document, setDocument] = useState('');
  const [cep, setCep] = useState('');

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
  const [specialties, setSpecialties] = useState<string[]>([]);

  const kind: ServiceProviderKind = useMemo(() => {
    if (data?.kind === 'TRANSPORTER') return 'TRANSPORTER';
    return 'GENERIC';
  }, [data?.kind]);

  const docLabel = kind === 'TRANSPORTER' ? 'CNPJ' : 'CPF';
  const primarySpecialty = useMemo(() => {
    if (kind === 'TRANSPORTER') return 'delivery';
    return specialties[0] ?? '';
  }, [kind, specialties]);

  const primarySpecialtyLabel = useMemo(() => {
    if (!primarySpecialty) return 'Ainda não definida';
    return SPECIALTY_LABELS[primarySpecialty] ?? primarySpecialty;
  }, [primarySpecialty]);

  const hasPrimarySpecialty = kind === 'TRANSPORTER' || specialties.length > 0;

  // ✅ regra certa do Marto:
  // - provider normal volta pro painel de trabalho: /dash/provider/services
  // - transporter volta pro painel transporter
  const backHref =
    kind === 'TRANSPORTER'
      ? '/dash/provider/transporter'
      : '/dash/provider/services';

  const baseSignals = useMemo(() => {
    const docDigits = onlyDigits(document);
    const cepDigits = onlyDigits(cep);

    const documentOk =
      kind === 'TRANSPORTER' ? docDigits.length === 14 : docDigits.length === 11;
    const cepOk = cepDigits.length === 8;
    const cityOk = city.trim().length > 0;
    const ufOk = uf.trim().length === 2;
    const streetOk = street.trim().length > 0;
    const numberOk = number.trim().length > 0;
    const districtOk = district.trim().length > 0;

    const addressOk =
      cepOk && cityOk && ufOk && streetOk && numberOk && districtOk;

    const specialtyOk = kind === 'TRANSPORTER' ? true : specialties.length > 0;
    const done = [documentOk, addressOk, specialtyOk].filter(Boolean).length;

    return {
      documentOk,
      addressOk,
      specialtyOk,
      done,
      total: 3,
    };
  }, [city, cep, district, document, kind, number, specialties, street, uf]);

  const specialtyMeta = useMemo(() => {
    if (kind === 'TRANSPORTER') {
      return {
        heroTitle: 'Estruture sua operação logística no Marto',
        heroDesc:
          'Sua base logística define como o Marto vai ler área atendida, capacidade de rota, tipos de entrega e promessa operacional.',
        baseTitle: 'Entrega logística',
        baseDesc:
          'Sua operação usa entrega como base principal para posicionamento, leitura e distribuição.',
        readingDesc:
          'O Marto começa a confiar melhor na sua operação quando documento, base territorial e estrutura logística ficam nítidos.',
        nextTitle:
          baseSignals.done === baseSignals.total
            ? 'Expandir operação logística'
            : 'Fechar sua base logística',
        nextDesc:
          'Depois dessa base, a evolução natural é conectar área atendida, tipos de entrega, SLA, reputação e financeiro.',
        publicDesc:
          'Aqui você estrutura a leitura pública da sua operação logística usando entrega, base territorial e sinais operacionais reais.',
      };
    }

    if (!hasPrimarySpecialty) {
      return {
        heroTitle: 'Escolha sua base profissional no Marto',
        heroDesc:
          'Sua especialidade principal define como o ecossistema vai te posicionar, quais missões combinam com você e como sua reputação começa a crescer.',
        baseTitle: 'Escolher especialidade',
        baseDesc:
          'Antes de operar, o Marto precisa entender qual base profissional representa melhor sua atuação.',
        readingDesc:
          'O Marto começa a confiar melhor na sua operação quando documento, base territorial e especialidade principal ficam nítidos.',
        nextTitle: 'Definir sua base profissional',
        nextDesc:
          'Depois dessa escolha, a evolução natural é conectar agenda, região, reputação, checklist e financeiro em uma estrutura coerente.',
        publicDesc:
          'Aqui você estrutura a leitura pública do prestador usando especialidade, base territorial e operação real, sem misturar com o lojista.',
      };
    }

    switch (primarySpecialty) {
      case 'assembly':
        return {
          heroTitle: 'Estruture sua operação de montagem no Marto',
          heroDesc:
            'Sua base de montagem ajuda o Marto a ler execução por etapa, acabamento, consistência e qualidade entregue.',
          baseTitle: 'Montagem',
          baseDesc:
            'O ecossistema passa a te posicionar como operação de montagem, com leitura de execução e qualidade final.',
          readingDesc:
            'O Marto começa a confiar melhor na sua operação quando documento, base territorial e especialidade de montagem ficam nítidos.',
          nextTitle: 'Conectar agenda e execução',
          nextDesc:
            'Depois dessa base, a evolução natural é conectar agenda, checklist, reputação e histórico de qualidade por montagem.',
          publicDesc:
            'Aqui você estrutura a leitura pública do prestador com foco em montagem, base territorial e sinais de execução.',
        };

      case 'installation':
        return {
          heroTitle: 'Estruture sua operação de instalação no Marto',
          heroDesc:
            'Sua base de instalação ajuda o Marto a ler ajuste técnico, validação no local e qualidade de entrega final.',
          baseTitle: 'Instalação',
          baseDesc:
            'O ecossistema passa a te posicionar como operação de instalação, com foco em ajuste, precisão e resultado final.',
          readingDesc:
            'O Marto começa a confiar melhor na sua operação quando documento, base territorial e especialidade de instalação ficam nítidos.',
          nextTitle: 'Conectar agenda e validação técnica',
          nextDesc:
            'Depois dessa base, a evolução natural é conectar agenda, checklist, retrabalho, reputação e histórico técnico.',
          publicDesc:
            'Aqui você estrutura a leitura pública do prestador com foco em instalação, base territorial e sinais técnicos reais.',
        };

      case 'technical_visit':
        return {
          heroTitle: 'Estruture sua operação de visita técnica no Marto',
          heroDesc:
            'Sua base técnica ajuda o Marto a ler diagnóstico, clareza profissional e precisão antes da execução.',
          baseTitle: 'Visita técnica',
          baseDesc:
            'O ecossistema passa a te posicionar como leitura técnica, análise e direcionamento profissional.',
          readingDesc:
            'O Marto começa a confiar melhor na sua operação quando documento, base territorial e especialidade técnica ficam nítidos.',
          nextTitle: 'Conectar agenda e diagnóstico',
          nextDesc:
            'Depois dessa base, a evolução natural é conectar agenda, laudo, direcionamento e reputação técnica.',
          publicDesc:
            'Aqui você estrutura a leitura pública do prestador com foco em diagnóstico, base territorial e clareza técnica.',
        };

      default:
        return {
          heroTitle: `Estruture sua base de ${primarySpecialtyLabel.toLowerCase()} no Marto`,
          heroDesc:
            'Sua especialidade principal define como o Marto vai ler sua operação, organizar encaixe e construir sua reputação profissional.',
          baseTitle: primarySpecialtyLabel,
          baseDesc:
            'O ecossistema passa a te posicionar de acordo com sua base profissional escolhida.',
          readingDesc:
            'O Marto começa a confiar melhor na sua operação quando documento, base territorial e especialidade principal ficam nítidos.',
          nextTitle: 'Conectar operação e reputação',
          nextDesc:
            'Depois dessa base, a evolução natural é conectar agenda, execução, reputação, checklist e financeiro.',
          publicDesc:
            'Aqui você estrutura a leitura pública do prestador usando sua especialidade, sua base territorial e sua operação real.',
        };
    }
  }, [
    baseSignals.done,
    baseSignals.total,
    hasPrimarySpecialty,
    kind,
    primarySpecialty,
    primarySpecialtyLabel,
  ]);

  function handleLogout() {
    localStorage.removeItem('marto_access');
    window.location.href = '/login';
  }

  async function load() {
    try {
      setLoading(true);
      setMsg({ kind: 'none' });

      const sp = await fetchJSON<ServiceProvider | null>('/service-providers/me');
      setData(sp);
      setSpecialties(normalizeSpecialties(sp?.specialties));

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

      if (kind !== 'TRANSPORTER' && specialties.length === 0) {
        setMsg({
          kind: 'error',
          text: 'Escolha sua especialidade principal antes de salvar.',
        });
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
        specialties?: string[];
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
        specialties: kind === 'TRANSPORTER' ? ['delivery'] : specialties,
      };

      const saved = await fetchJSON<ServiceProvider>('/service-providers/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setData(saved);
      setSpecialties(normalizeSpecialties(saved?.specialties));

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
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <section className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-[2.2rem] border border-white/15 bg-neutral-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="relative p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-x-8 top-0 h-32 rounded-full bg-white/8 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 top-20 h-52 w-52 rounded-full bg-white/5 blur-3xl" />

              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    Provider • Base profissional
                  </span>

                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    {kind === 'TRANSPORTER' ? 'Operação logística' : 'Operação de atendimento'}
                  </span>
                </div>

                <div className="mt-5 max-w-3xl">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {specialtyMeta.heroTitle}
                  </h1>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-[15px]">
                    {specialtyMeta.heroDesc}
                  </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Identidade base
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {baseSignals.documentOk ? `${docLabel} validado` : `Definir ${docLabel}`}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-white/60">
                      Documento é a base mínima para o Marto reconhecer sua operação.
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Base territorial
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {baseSignals.addressOk ? 'Estrutura legível' : 'Ainda incompleto'}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-white/60">
                      Cidade, CEP e endereço dão contexto real para onde sua operação começa.
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Base profissional
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {specialtyMeta.baseTitle}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-white/60">
                      {specialtyMeta.baseDesc}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={backHref}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Voltar ao painel
                  </Link>

                </div>
              </div>
            </div>

            <div className="border-t border-white/8 bg-white/[0.03] px-6 py-4 sm:px-7">
              <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Leitura do Marto
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {baseSignals.done}/{baseSignals.total} pilares legíveis
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    {specialtyMeta.readingDesc}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Identidade pública
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    Gerida na conta central
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    O perfil público do Marto é único para a conta. O prestador lê essa identidade aqui, mas não edita por esta tela.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-white/15 bg-neutral-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Sinais da base
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { ok: baseSignals.documentOk, label: docLabel },
                  { ok: baseSignals.addressOk, label: 'Endereço base' },
                  {
                    ok: baseSignals.specialtyOk,
                    label: kind === 'TRANSPORTER' ? 'Base logística' : 'Especialidade principal',
                  },
                ].map((item) => (
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
                        style={{ width: item.ok ? '100%' : '30%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-neutral-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Próximo salto
              </div>

              <div className="mt-3 text-lg font-semibold text-white">
                {specialtyMeta.nextTitle}
              </div>

              <p className="mt-2 text-sm leading-6 text-white/68">
                {specialtyMeta.nextDesc}
              </p>
            </div>
          </div>
        </section>

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
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    Identidade e confiança
                  </div>
                  <p className="mt-1 text-sm leading-6 text-white/65">
                    Preencha a base mínima que o Marto usa para reconhecer sua operação,
                    montar seu contexto territorial e começar sua presença profissional.
                  </p>
                </div>

                {data ? (
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    Status: <span className="text-white">{data.status}</span>
                  </div>
                ) : null}
              </div>

              {kind !== 'TRANSPORTER' ? (
                <div className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        Provider • Especialidade principal
                      </div>

                      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                        Escolha a base profissional que representa sua operação
                      </h2>

                      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                        Essa escolha não é só visual. Ela define como o Marto vai te posicionar,
                        quais missões combinam com você, que sinais operacionais passam a importar
                        e como sua reputação começa a crescer.
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        Base atual
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {hasPrimarySpecialty ? primarySpecialtyLabel : 'Ainda não definida'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {SPECIALTY_OPTIONS.filter((option) => option.key !== 'delivery').map((option) => {
                      const selected = specialties[0] === option.key;

                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setSpecialties([option.key])}
                          className={[
                            'text-left rounded-[1.75rem] border p-5 transition',
                            selected
                              ? 'border-white/25 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)]'
                              : 'border-white/12 bg-white/[0.045] hover:border-white/20 hover:bg-white/[0.06]',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold text-white">{option.label}</div>
                              <p className="mt-2 text-sm leading-6 text-white/68">{option.desc}</p>
                            </div>

                            <span
                              className={[
                                'rounded-full px-3 py-1 text-[11px] font-semibold',
                                selected
                                  ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                                  : 'border border-white/10 bg-white/5 text-white/65',
                              ].join(' ')}
                            >
                              {selected ? 'Principal' : 'Selecionar'}
                            </span>
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/70">
                            {option.signal}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    Provider • Base logística
                  </div>

                  <div className="mt-4 text-xl font-semibold text-white">
                    Entrega é a base principal da sua operação logística
                  </div>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                    Como esse perfil está no modo transportadora, o Marto usa entrega como base
                    principal para organizar agenda, região, tipos de entrega e SLA.
                  </p>
                </div>
              )}

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

                <div className="grid gap-2 text-sm sm:col-span-2">
                  <span className="font-semibold text-white/85">
                    Perfil público e identidade
                  </span>

                  <div className="grid gap-4 sm:col-span-2 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                      <div className="text-sm font-semibold text-white">
                        Handle do prestador
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        Ainda não definido
                      </div>
                      <p className="mt-1 text-sm leading-6 text-white/65">
                        O perfil público próprio do prestador ainda não foi ativado. Aqui ele
                        começa do zero, sem herdar o handle do lojista ou da conta global.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                      <div className="text-sm font-semibold text-white">
                        Perfil público do prestador
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        Leitura protegida por papel
                      </div>
                      <p className="mt-1 text-sm leading-6 text-white/65">
                        O perfil público do prestador será criado em estrutura própria, sem
                        misturar identidade global da conta com o papel de lojista.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href="#provider-public-profile"
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Criar identidade pública
                        </Link>

                        <Link
                          href="#provider-public-profile"
                          className="pointer-events-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/40"
                        >
                          Abrir perfil público
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div
                    id="provider-public-profile"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="text-sm font-semibold text-white">
                      Perfil público do prestador
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/65">
                      {specialtyMeta.publicDesc}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-white/55">Especialidade</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {hasPrimarySpecialty ? primarySpecialtyLabel : 'Ainda não definida'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-white/55">Base territorial</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {city?.trim() ? `${city}${uf?.trim() ? ` / ${uf}` : ''}` : 'Cidade / CEP / região'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-white/55">Confiança pública</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {baseSignals.done === baseSignals.total ? 'Base legível no Marto' : 'Base em construção'}
                      </div>
                    </div>
                  </div>
                </div>
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
        <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-sm backdrop-blur">
          <div className="border-b border-white/10 bg-white/5 px-5 py-4">
            <div className="text-sm font-semibold text-white">Sessão</div>
            <div className="mt-1 text-xs text-white/60">
              Você pode sair e entrar novamente quando quiser.
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/70">
                Se estiver em um computador compartilhado, é recomendado sair da
                conta.
              </div>

              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm('Sair da conta agora?');
                  if (ok) handleLogout();
                }}
                className="w-fit rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
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
