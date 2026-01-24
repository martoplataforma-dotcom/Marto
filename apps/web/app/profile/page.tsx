// apps/web/app/profile/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type Consumer = {
  city?: string | null;
  cepPrefix?: string | null;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

type Home =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type MeResponse = {
  home?: Home;
  profile?: { handle?: string | null };
};

function dashboardFromHome(home?: Home | null) {
  switch (home) {
    case 'merchant':
      return '/dash/merchant';
    case 'factory':
      return '/dash/factory';
    case 'service_provider':
      return '/dash/provider/services';
    case 'representative':
      return '/dash/representative';
    case 'consumer':
    default:
      return '/dash/consumer';
  }
}

function labelFromHome(home?: Home | null) {
  return home === 'merchant'
    ? 'Lojista'
    : home === 'factory'
      ? 'Fabricante'
      : home === 'service_provider'
        ? 'Prestador'
        : home === 'representative'
          ? 'Representante'
          : 'Consumidor';
}

// ✅ sanitize do @handle
function sanitizeHandle(raw: string) {
  return String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 24);
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Preferências atuais (persistidas)
  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  // UX: CEP completo + endereço encontrado
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [addr, setAddr] = useState<{
    street: string;
    district: string;
    city: string;
    uf: string;
  } | null>(null);

  // ✅ guarda o "home" + handle
  const [home, setHome] = useState<Home | null>(null);
  const [handle, setHandle] = useState('');

  // ✅ ainda validamos internamente (mesmo sem input), pra não mandar lixo pro backend
  const canSave = useMemo(() => {
    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) return false;
    return true;
  }, [cepPrefix]);

  const dashboardHref = dashboardFromHome(home);
  const badge = labelFromHome(home);

  const effectiveHandle = sanitizeHandle(handle);
  const publicHref = effectiveHandle ? `/u/${effectiveHandle}` : '/me';
  const publicCtaLabel = effectiveHandle
    ? 'Ver meu perfil público'
    : 'Ativar perfil público';

  const isConsumer = home === 'consumer' || home === null;

  useEffect(() => {
    (async () => {
      setMsg('');
      const token = getToken();
      if (!token) {
        setMsg('Sem token. Faça login novamente.');
        setLoading(false);
        return;
      }

      try {
        // ✅ A) buscar home + handle via /me (COM Authorization)
        const me = await fetchJSON<MeResponse>('/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const h =
          me?.home === 'consumer' ||
          me?.home === 'merchant' ||
          me?.home === 'service_provider' ||
          me?.home === 'representative' ||
          me?.home === 'factory'
            ? me.home
            : null;

        setHome(h);
        setHandle(String(me?.profile?.handle ?? ''));

        // ✅ B) este /profile é a Central do Consumidor
        if (h && h !== 'consumer') {
          setMsg('Esta central é do Consumidor. Vá para sua central correta.');
          return;
        }

        // ✅ C) carrega prefs (fonte da verdade) (COM Authorization)
        const data = await fetchJSON<Consumer>('/consumers/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setCity(data.city ?? '');
        setCepPrefix(data.cepPrefix ?? '');

        // ✅ 1) NÃO preencher o campo “CEP (8 dígitos)” com cepPrefix no load inicial
        setCep('');
        setAddr(null);
      } catch (e: unknown) {
        const err = e as ApiError;

        // ✅ Se /me falhar, ainda assim tenta carregar /consumers/me
        try {
          const token2 = getToken();
          if (token2) {
            const data = await fetchJSON<Consumer>('/consumers/me', {
              method: 'GET',
              headers: { Authorization: `Bearer ${token2}` },
            });

            setCity(data.city ?? '');
            setCepPrefix(data.cepPrefix ?? '');

            // ✅ 1) também não preenche CEP completo no fallback
            setCep('');
            setAddr(null);

            setMsg(
              err?.message
                ? `⚠️ /me falhou (${err.message}), mas preferências carregadas.`
                : '⚠️ /me falhou, mas preferências carregadas.'
            );
          } else {
            setMsg(err?.message ?? 'Não foi possível carregar suas configurações.');
          }
        } catch (e2: unknown) {
          const err2 = e2 as ApiError;
          setMsg(
            err2?.message ??
              err?.message ??
              'Não foi possível carregar suas configurações.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ prefixo é setado assim que tiver 5 dígitos, antes do fetch
  async function lookupCep(value: string) {
    setMsg('');
    const clean = value.replace(/\D/g, '').slice(0, 8);
    setCep(clean);

    // ✅ já vai atualizando prefixo conforme digita
    if (clean.length >= 5) setCepPrefix(clean.slice(0, 5));
    else setCepPrefix('');

    if (clean.length !== 8) {
      setAddr(null);
      return;
    }

    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
        method: 'GET',
      });
      const j = (await r.json()) as ViaCepResponse;

      if (j?.erro) {
        setAddr(null);
        setMsg('CEP não encontrado.');
        return;
      }

      const foundCity = j.localidade ?? '';
      const foundUf = j.uf ?? '';
      const foundStreet = j.logradouro ?? '';
      const foundDistrict = j.bairro ?? '';

      setAddr({
        street: foundStreet,
        district: foundDistrict,
        city: foundCity,
        uf: foundUf,
      });

      // ✅ não força cidade se usuário já colocou algo
      if (!city.trim() && foundCity) setCity(foundCity);
    } catch {
      setAddr(null);
      setMsg('Não foi possível consultar o CEP agora.');
    } finally {
      setCepLoading(false);
    }
  }

  // ✅ Salva derivando o prefixo do CEP (sem input separado)
  async function onSave() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token. Faça login novamente.');
      return;
    }

    if (!isConsumer) {
      setMsg('Esta central é do Consumidor. Vá para sua central correta.');
      return;
    }

    const digits = String(cep ?? '').replace(/\D/g, '').slice(0, 8);
    const nextPrefix = digits.length >= 5 ? digits.slice(0, 5) : '';

    if (!nextPrefix) {
      setMsg('Digite pelo menos 5 números do CEP para salvar preferências.');
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
          cepPrefix: nextPrefix,
        }),
      });

      // ✅ garante consistência já na hora: busca do backend e atualiza a tela
      const fresh = await fetchJSON<Consumer>('/consumers/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      setCity(fresh.city ?? city);
      setCepPrefix(fresh.cepPrefix ?? nextPrefix);

      setMsg('Preferências salvas.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div
        className="pointer-events-none fixed inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="pointer-events-none fixed -top-48 left-1/2 h-[32rem] w-[62rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none fixed top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none fixed top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      {/* HERO */}
      <header className="relative">
        <div className="relative mx-auto max-w-6xl p-6 pt-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-neutral-950/75 px-3 py-1 text-xs font-semibold text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                Conta • Consumidor
                <span className="opacity-60">•</span>
                Porque reputação importa
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Central do Consumidor
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Preferências e segurança. Seu perfil público é outra coisa:
                consequência do histórico.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={dashboardHref}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Voltar ao dashboard
              </Link>

              <Link
                href={publicHref}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                {publicCtaLabel}
              </Link>

              <button
                onClick={onSave}
                disabled={loading || saving || !canSave || !isConsumer}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>

          {effectiveHandle ? (
            <div className="mt-4 text-xs text-white/65">
              Seu perfil público:{' '}
              <span className="font-semibold text-white/85">
                /u/{effectiveHandle}
              </span>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <span className="font-semibold">Ative seu perfil público:</span>{' '}
              crie um <span className="font-semibold">@handle</span> na sua conta
              (/me). Sem handle, não existe link público.
            </div>
          )}

          {msg ? (
            <div className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {msg}
            </div>
          ) : null}
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-6xl p-6 pb-10">
        {/* Se não for consumer, trava e guia */}
        {!isConsumer && home ? (
          <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-sm font-semibold text-white/90">
              Você está logado como: {badge}
            </div>
            <div className="mt-2 text-sm text-white/70">
              Esta central é exclusiva do Consumidor. Cada papel tem sua própria
              central no Marto.
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={dashboardFromHome(home)}
                className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Ir para minha central
              </Link>

              <Link
                href="/me"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Minha conta
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* SIDEBAR */}
            <aside className="lg:col-span-4">
              <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="text-sm font-semibold text-white/90">Seções</div>

                <div className="mt-4 grid gap-2 text-sm">
                  <a
                    href="#preferencias"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Preferências
                    <div className="mt-1 text-xs text-white/65">
                      CEP + sugestões
                    </div>
                  </a>

                  <a
                    href="#pagamentos"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Pagamentos
                    <div className="mt-1 text-xs text-white/65">
                      Marto Pay (em breve)
                    </div>
                  </a>

                  <a
                    href="#documentos"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Documentos
                    <div className="mt-1 text-xs text-white/65">
                      CPF/telefone (em breve)
                    </div>
                  </a>

                  <a
                    href="#seguranca"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Segurança
                    <div className="mt-1 text-xs text-white/65">
                      email, senha, sessões
                    </div>
                  </a>
                </div>

                <div className="mt-6 rounded-2xl border border-white/15 bg-black/25 p-4 text-xs text-white/70 ring-1 ring-white/5">
                  Marto: dados da conta são privados. O público é consequência
                  real — não currículo.
                </div>
              </div>
            </aside>

            {/* MAIN */}
            <section className="lg:col-span-8">
              {/* Preferências */}
              <div
                id="preferencias"
                className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div>
                  <h2 className="text-lg font-semibold text-white/90">
                    Preferências
                  </h2>
                  <p className="mt-1 text-sm text-white/70">
                    Digite o CEP e o Marto completa automaticamente.
                  </p>
                </div>

                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-white/85">
                      CEP (8 dígitos)
                    </span>
                    <input
                      value={cep}
                      onChange={(e) => lookupCep(e.target.value)}
                      placeholder="Ex: 36500000"
                      className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                      inputMode="numeric"
                      disabled={loading}
                    />
                    <span className="text-xs text-white/65">
                      {cepLoading
                        ? 'Buscando endereço…'
                        : 'Ao completar 8 dígitos, buscamos automaticamente.'}
                    </span>
                  </label>

                  {/* ✅ 2) Card “Região salva” quando existir prefixo */}
                  {cepPrefix ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm font-semibold text-white">
                        Região salva
                      </div>
                      <div className="mt-2 text-sm text-white/75">
                        CEP base:{' '}
                        <span className="font-semibold text-white">
                          {cepPrefix}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-white/55">
                        Por enquanto o Marto salva só o prefixo (5 primeiros
                        dígitos) para sugestões. Para ver endereço completo,
                        digite o CEP (8 dígitos).
                      </div>
                    </div>
                  ) : null}

                  {addr ? (
                    <div className="rounded-2xl border border-white/15 bg-black/25 p-4 text-white/80 ring-1 ring-white/5">
                      <div className="text-sm font-semibold text-white">
                        Endereço encontrado
                      </div>
                      <div className="mt-2 text-sm text-white/75">
                        {addr.street ? `${addr.street}` : '—'}
                        {addr.district ? ` • ${addr.district}` : ''}
                        <br />
                        {addr.city}/{addr.uf}
                      </div>

                      <div className="mt-3 text-xs text-white/65">
                        Por enquanto salvamos só o prefixo do CEP (5 primeiros
                        dígitos). Endereço completo vem depois.
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white/85">
                        Cidade (opcional)
                      </span>
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ex: Ubá"
                        className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/35"
                        disabled={loading}
                      />
                      <div className="text-xs text-white/65">
                        Usamos isso para sugestões — não pra te travar.
                      </div>
                    </label>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={onSave}
                      disabled={loading || saving || cepLoading}
                      className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
                    >
                      {saving ? 'Salvando…' : 'Salvar preferências'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCep('');
                        setAddr(null);
                        setCepPrefix('');
                        setMsg('CEP limpo.');
                        setTimeout(() => setMsg(''), 1800);
                      }}
                      className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                      disabled={loading || saving}
                    >
                      Limpar CEP
                    </button>
                  </div>
                </div>
              </div>

              {/* Pagamentos (em breve) */}
              <div
                id="pagamentos"
                className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">
                      Pagamentos
                    </h2>
                    <p className="mt-1 text-sm text-white/70">
                      Cartões e métodos no Marto Pay. Sem fricção, sem gambiarra.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                    em breve
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                  Quando ativarmos o Marto Pay, você gerencia seus métodos aqui.
                </div>
              </div>

              {/* Documentos (em breve) */}
              <div
                id="documentos"
                className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">
                      Documentos
                    </h2>
                    <p className="mt-1 text-sm text-white/70">
                      CPF e dados sensíveis ficam aqui — privados.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                    em breve
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                  Isso não aparece no seu perfil público. Serve para compras,
                  notas e segurança.
                </div>
              </div>

              {/* Segurança */}
              <div
                id="seguranca"
                className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">
                      Segurança
                    </h2>
                    <p className="mt-1 text-sm text-white/70">
                      Em breve: confirmar email, trocar senha e sessões.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                    em breve
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white/90">
                      Confirmação de email
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      Vai virar requisito para recursos sensíveis (carteira,
                      saque, etc).
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white/90">
                      Sessões e dispositivos
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      Em breve: ver onde sua conta está logada.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
