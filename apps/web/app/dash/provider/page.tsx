'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

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

type ServiceProvider = {
  cpf: string;
  city?: string | null;
  cepPrefix?: string | null;
  status: string;
  kind?: ServiceProviderKind;
  transporter?: Transporter | null;
};

function Card({
  title,
  desc,
  href,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-base font-semibold text-neutral-900">{title}</div>
        {badge ? (
          <span className="rounded-full border bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
            {badge}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-neutral-600">{desc}</p>

      <div className="mt-4 text-sm font-medium text-neutral-900">
        Abrir <span className="inline-block transition group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}

function ChoiceButton({
  title,
  desc,
  active,
  onClick,
  disabled,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'text-left rounded-2xl border bg-white p-5 shadow-sm transition',
        'hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0',
        active ? 'border-neutral-900' : '',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-base font-semibold text-neutral-900">{title}</div>
        <span className="rounded-full border bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
          {active ? 'Ativo' : 'Selecionar'}
        </span>
      </div>
      <p className="text-sm text-neutral-600">{desc}</p>
    </button>
  );
}

export default function ProviderHubPage() {
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [msg, setMsg] = useState('');
  const [me, setMe] = useState<ServiceProvider | null>(null);

  const kind: ServiceProviderKind = useMemo(() => {
    if (me?.kind === 'TRANSPORTER') return 'TRANSPORTER';
    return 'GENERIC';
  }, [me?.kind]);

  const headline = useMemo(() => {
    if (kind === 'TRANSPORTER') return 'Painel Marto • Transportadora';
    return 'Painel Marto • Prestador';
  }, [kind]);

  async function load() {
    try {
      setLoading(true);
      setMsg('');

      const sp = await fetchJSON<ServiceProvider | null>('/service-providers/me');
      setMe(sp);
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function setKind(nextKind: ServiceProviderKind) {
    if (!me) return;

    const cpf = String(me.cpf ?? '').trim();
    if (!cpf) {
      setMsg('Para escolher seu tipo, primeiro preencha seu CPF no “Meu perfil”.');
      return;
    }

    try {
      setSwitching(true);
      setMsg('');

      const saved = await fetchJSON<ServiceProvider>('/service-providers/me', {
        method: 'PUT',
        body: JSON.stringify({
          cpf,
          city: me.city ?? undefined,
          cepPrefix: me.cepPrefix ?? undefined,
          kind: nextKind,
        }),
      });

      setMe(saved);
      setMsg(nextKind === 'TRANSPORTER' ? '✅ Modo transportadora ativado.' : '✅ Modo prestador ativado.');
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
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{headline}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Escolha seu tipo. Depois você completa seus dados e ativa sua operação.
        </p>

        {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
      </header>

      <section className="mb-6">
        <div className="mb-3 text-sm font-semibold text-neutral-900">Qual é o seu modo?</div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceButton
            title="Prestador de serviço"
            desc="Montagem, instalação, manutenção e outros serviços. Ideal para quem atende pedidos."
            active={kind === 'GENERIC'}
            disabled={loading || switching || !me}
            onClick={() => void setKind('GENERIC')}
          />

          <ChoiceButton
            title="Transportadora"
            desc="Operação de entregas, rotas e comprovantes. Ideal para logística local/regional."
            active={kind === 'TRANSPORTER'}
            disabled={loading || switching || !me}
            onClick={() => void setKind('TRANSPORTER')}
          />
        </div>

        <div className="mt-3 text-sm text-neutral-600">
          Não achou seu tipo? Por enquanto temos esses 2. Depois a gente expande (montador, técnico, etc.).
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card
          title="Meu perfil"
          desc="Dados básicos e identidade. Obrigatório para reputação e ativação."
          href="/dash/provider/profile"
          badge={me?.status ? `Status: ${me.status}` : undefined}
        />

        <Card
          title="Minha operação"
          desc={
            kind === 'TRANSPORTER'
              ? 'Sua transportadora pode operar entregas. Configure nome/área e depois criaremos rotas.'
              : 'Sua operação de serviços será configurada aqui (agenda, raio, categorias) em breve.'
          }
          href="/dash/provider/profile"
          badge={kind === 'TRANSPORTER' ? 'Logística' : 'Serviços'}
        />
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-neutral-900">Resumo</div>
          <button
            onClick={() => void load()}
            disabled={loading || switching}
            className="rounded-xl border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-600">Carregando…</p>
        ) : me ? (
          <div className="grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
            <div>
              <span className="text-neutral-500">Cidade:</span>{' '}
              <span className="font-medium text-neutral-900">{me.city ?? '—'}</span>
            </div>

            <div>
              <span className="text-neutral-500">CEP Prefixo:</span>{' '}
              <span className="font-medium text-neutral-900">{me.cepPrefix ?? '—'}</span>
            </div>

            <div>
              <span className="text-neutral-500">Modo:</span>{' '}
              <span className="font-medium text-neutral-900">
                {kind === 'TRANSPORTER' ? 'Transportadora' : 'Prestador'}
              </span>
            </div>

            <div>
              <span className="text-neutral-500">Transportadora:</span>{' '}
              <span className="font-medium text-neutral-900">
                {me.transporter?.name ?? '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-600">
            Não encontrei seu perfil de prestador. Abra “Meu perfil” para concluir o cadastro.
          </p>
        )}
      </section>
    </main>
  );
}
