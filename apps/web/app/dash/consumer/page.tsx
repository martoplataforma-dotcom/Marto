'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type Consumer = {
  city?: string | null;
  cepPrefix?: string | null;
};

export default function ConsumerDash() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  const canSave = useMemo(() => {
    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) return false;
    return true;
  }, [cepPrefix]);

  useEffect(() => {
    (async () => {
      setMsg('');
      const token = getToken();
      if (!token) {
        setMsg('Você precisa entrar novamente.');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchJSON<Consumer>('/consumers/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setCity(data.city ?? '');
        setCepPrefix(data.cepPrefix ?? '');
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar seu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSave() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Você precisa entrar novamente.');
      return;
    }

    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) {
      setMsg('CEP (prefixo) deve ter 5 números (ex: 36500).');
      return;
    }

    setSaving(true);
    try {
      await fetchJSON('/consumers/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city: city.trim() || null,
          cepPrefix: cepPrefix.trim() || null,
        }),
      });

      setMsg('Preferências salvas.');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      {/* fundo (grid + glows) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[32rem] w-[62rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Topbar (dark) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/60 ring-1 ring-white/10">
              <Image src="/marto-m.svg" alt="Marto" width={20} height={20} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Consumidor • Marto</div>
              <div className="text-xs text-white/60">
                Social como consequência. Sem feed.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/me"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Meu perfil
            </Link>

            <Link
              href="/profile"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Configurações
            </Link>

            {/* ✅ NOVO: Perfil público */}
            <Link
              href="/u/teste"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Perfil público
            </Link>

            <button
              onClick={() => {
                localStorage.removeItem('marto_access');
                window.location.href = '/login';
              }}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Sair
            </button>
          </div>
        </div>

        {/* HERO + CANVAS */}
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            {/* esquerda */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                Central do Consumidor
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                O que você quer fazer agora?
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Explore produtos, contrate serviços e acompanhe seus pedidos. O
                Marto registra tudo para você decidir com segurança.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/demo/catalog"
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Explorar catálogo
                </Link>

                <Link
                  href="/demo"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Comprar (demo)
                </Link>

                <Link
                  href="/choose-role"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Adicionar outro papel
                </Link>
              </div>
            </div>

            {/* direita: Painel Marto (operacional, sem “minha reputação”) */}
            <div className="w-full max-w-xl">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 ring-1 ring-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Resumo</div>
                    <div className="mt-1 text-xs text-white/60">
                      Visão rápida do seu uso recente (MVP).
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
                    MVP
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Kpi label="Pedidos" value="1" hint="mock" />
                  <Kpi label="Serviços" value="1" hint="mock" />
                  <Kpi label="Avaliações" value="1" hint="mock" />
                  <Kpi label="Atividade" value="7" hint="registros no rastro" />
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/70">
                    Dica: comece por “Comprar (demo)” para ver o ciclo completo.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AÇÕES RÁPIDAS */}
          <div className="mt-10">
            <div className="mb-3">
              <div className="text-sm font-semibold text-white">Ações rápidas</div>
              <div className="mt-1 text-xs text-white/60">Comece por aqui.</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <BlockCard
                eyebrow="Começar"
                title="Comprar (demo)"
                desc="Simule uma compra e veja o ciclo completo do Marto."
                href="/demo"
                cta="Abrir →"
              />
              <BlockCard
                eyebrow="Explorar"
                title="Catálogo"
                desc="Navegue por produtos mock e explore possibilidades."
                href="/demo/catalog"
                cta="Ver produtos →"
              />
              <BlockCard
                eyebrow="Consolidar"
                title="Meus pedidos"
                desc="Acompanhe seus pedidos e abra a timeline completa."
                href="/dash/consumer/orders"
                cta="Ver pedidos →"
              />
              <BlockCard
                eyebrow="Consolidar"
                title="Avaliar pendências"
                desc="Registre avaliações pendentes (MVP mock)."
                href="/review"
                cta="Avaliar →"
              />
            </div>
          </div>

          {/* Atividade recente */}
          <section className="mt-10 rounded-3xl border border-white/10 bg-black/25 p-6 text-white ring-1 ring-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Atividade recente</div>
                <div className="mt-1 max-w-xl text-sm text-white/60">
                  Resumo do que aconteceu com você recentemente. (MVP mock)
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                mock
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <HistoryRow
                title="Compra registrada"
                meta="Catálogo • agora"
                desc="Uma ação entrou no seu rastro."
                status="verificado"
              />
              <HistoryRow
                title="Serviço concluído"
                meta="Prestador • hoje"
                desc="Resultado entregue e registrado."
                status="verificado"
              />
              <HistoryRow
                title="Avaliação vinculada"
                meta="Experiência • 5★"
                desc="Avaliação ligada à ação real."
                status="verificado"
              />
              <HistoryRow
                title="Relação criada"
                meta="Recorrência"
                desc="Sugestão: volte onde foi bom."
                status="em construção"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Aqui é operacional: o que aconteceu, o que falta, e o que fazer
              depois.
            </div>
          </section>

          {/* Preferências */}
          <details className="mt-10 rounded-3xl border border-white/10 bg-black/25 p-6 ring-1 ring-white/5">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">Preferências</div>
                  <div className="mt-1 text-sm text-white/60">
                    Opcional. Ajuda a sugerir coisas perto de você.
                  </div>
                </div>
                <div className="text-sm font-semibold text-white/70">
                  {loading ? 'Carregando…' : 'Editar'}
                </div>
              </div>
            </summary>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Cidade (opcional)</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Ubá"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40"
                  disabled={loading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  CEP (prefixo) — opcional
                </span>
                <input
                  value={cepPrefix}
                  onChange={(e) =>
                    setCepPrefix(e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  placeholder="Ex: 36500"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40"
                  disabled={loading}
                  inputMode="numeric"
                />
                <span className="text-xs text-white/55">
                  Se não souber, deixe em branco.
                </span>
              </label>

              {msg ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  {msg}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onSave}
                  disabled={loading || saving || !canSave}
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : 'Salvar preferências'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCity('');
                    setCepPrefix('');
                    setMsg('Ok — você pode configurar isso depois.');
                  }}
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  disabled={loading || saving}
                >
                  Limpar
                </button>
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/55">{hint}</div>
    </div>
  );
}

function BlockCard({
  eyebrow,
  title,
  desc,
  href,
  cta,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
    >
      <div className="text-xs font-semibold text-white/60">{eyebrow}</div>
      <div className="mt-2 text-base font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-white/65">{desc}</div>
      <div className="mt-6 text-xs font-semibold text-white/70">{cta}</div>
    </Link>
  );
}

function HistoryRow({
  title,
  meta,
  desc,
  status,
}: {
  title: string;
  meta: string;
  desc: string;
  status: 'verificado' | 'em construção';
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-white/55">{meta}</div>
        <div className="mt-2 text-sm text-white/70">{desc}</div>
      </div>

      <div
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          status === 'verificado'
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-white/10 text-white/70'
        }`}
      >
        {status}
      </div>
    </div>
  );
}
