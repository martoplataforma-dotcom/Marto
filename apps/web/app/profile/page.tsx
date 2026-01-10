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

type MeResponse = {
  home?: 'consumer' | 'merchant' | 'service_provider' | 'representative' | 'factory';
};

function dashboardFromHome(home?: MeResponse['home'] | null) {
  switch (home) {
    case 'merchant':
      return '/dash/merchant';
    case 'factory':
      return '/dash/factory';
    case 'service_provider':
      return '/dash/service-provider';
    case 'representative':
      return '/dash/representative';
    case 'consumer':
    default:
      return '/dash/consumer';
  }
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Preferências atuais (persistidas)
  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  // UX nova: CEP completo (não persistimos ainda) + endereço encontrado
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [addr, setAddr] = useState<{
    street: string;
    district: string;
    city: string;
    uf: string;
  } | null>(null);

  // ✅ guarda o "home"
  const [home, setHome] = useState<MeResponse['home'] | null>(null);

  const canSave = useMemo(() => {
    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) return false;
    return true;
  }, [cepPrefix]);

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
        // ✅ A) Primeiro: buscar o home via /me (pela rewrite /api)
        const me = await fetchJSON<MeResponse>('/me', { method: 'GET' });
        const h =
          me?.home === 'consumer' ||
          me?.home === 'merchant' ||
          me?.home === 'service_provider' ||
          me?.home === 'representative' ||
          me?.home === 'factory'
            ? me.home
            : null;

        setHome(h);

        // ✅ B) Buscar preferências somente quando fizer sentido
        // Por enquanto, este /profile é “Preferências do consumidor/lojista”.
        if (h === 'merchant') {
          const data = await fetchJSON<Consumer>('/merchants/me', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });

          setCity(data.city ?? '');
          setCepPrefix(data.cepPrefix ?? '');
          if (data.cepPrefix) setCep(String(data.cepPrefix));
        } else if (h === 'consumer' || !h) {
          const data = await fetchJSON<Consumer>('/consumers/me', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });

          setCity(data.city ?? '');
          setCepPrefix(data.cepPrefix ?? '');
          if (data.cepPrefix) setCep(String(data.cepPrefix));
        } else {
          // factory / rep / service_provider
          setMsg(
            'Configurações de localização ainda não existem para este papel. (Por enquanto, só consumidor/lojista.)',
          );
        }
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar suas configurações.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function lookupCep(value: string) {
    setMsg('');
    const clean = value.replace(/\D/g, '').slice(0, 8);
    setCep(clean);

    if (clean.length !== 8) {
      setAddr(null);

      if (clean.length >= 5) setCepPrefix(clean.slice(0, 5));
      else setCepPrefix('');

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

      setCepPrefix(clean.slice(0, 5));
      if (!city.trim() && foundCity) setCity(foundCity);
    } catch {
      setAddr(null);
      setMsg('Não foi possível consultar o CEP agora.');
    } finally {
      setCepLoading(false);
    }
  }

  async function onSave() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token. Faça login novamente.');
      return;
    }

    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) {
      setMsg('CEP (prefixo) deve ter 5 números (ex: 36500).');
      return;
    }

    // ✅ por enquanto só consumidor/lojista salvam localização
    if (home && home !== 'consumer' && home !== 'merchant') {
      setMsg('Salvar preferências ainda não existe para este papel.');
      return;
    }

    setSaving(true);
    try {
      if (home === 'merchant') {
        await fetchJSON('/merchants/me', {
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
      } else {
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
      }

      setMsg('Configurações salvas.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* HERO */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                Conta • Configurações
                <span className="opacity-60">•</span>
                Porque reputação importa
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Central da Conta
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Aqui ficam seus ajustes e segurança. O social e a reputação vivem
                no seu perfil público.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={dashboardFromHome(home)}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Voltar ao dashboard
              </Link>

              <Link
                href="/me"
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Ver meu perfil público
              </Link>

              <button
                onClick={onSave}
                disabled={loading || saving || !canSave}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>

          {msg ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {msg}
            </div>
          ) : null}
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* SIDEBAR */}
          <aside className="lg:col-span-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold">Seções</div>

              <div className="mt-4 grid gap-2 text-sm">
                <a
                  href="#local"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  Preferências
                  <div className="mt-1 text-xs text-white/60">
                    CEP com auto-complete + cidade
                  </div>
                </a>

                <a
                  href="#seguranca"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  Segurança
                  <div className="mt-1 text-xs text-white/60">
                    verificação de email e senha
                  </div>
                </a>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/65">
                Dica: no Marto, localização só serve pra destravar conveniência —
                nunca pra travar o usuário.
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <section className="lg:col-span-8">
            {/* Preferências */}
            <div
              id="local"
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Preferências</h2>
                  <p className="mt-1 text-sm text-white/65">
                    Digite o CEP e o Marto completa o endereço automaticamente.
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                  {home === 'merchant'
                    ? 'Lojista'
                    : home === 'factory'
                      ? 'Fabricante'
                      : home === 'service_provider'
                        ? 'Prestador'
                        : home === 'representative'
                          ? 'Representante'
                          : 'Consumidor'}
                </span>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/90">
                    CEP (8 dígitos)
                  </span>
                  <input
                    value={cep}
                    onChange={(e) => lookupCep(e.target.value)}
                    placeholder="Ex: 36500000"
                    className="rounded-2xl border border-white/10 bg-zinc-950/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/30"
                    inputMode="numeric"
                    disabled={loading || (home !== null && home !== 'consumer' && home !== 'merchant')}
                  />
                  <span className="text-xs text-white/55">
                    {home !== null && home !== 'consumer' && home !== 'merchant'
                      ? 'Preferências de localização ainda não existem para este papel.'
                      : cepLoading
                        ? 'Buscando endereço…'
                        : 'Ao completar 8 dígitos, buscamos automaticamente.'}
                  </span>
                </label>

                {addr ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white">
                      Endereço encontrado
                    </div>
                    <div className="mt-2 text-sm text-white/75">
                      {addr.street ? `${addr.street}` : '—'}
                      {addr.district ? ` • ${addr.district}` : ''}
                      <br />
                      {addr.city}/{addr.uf}
                    </div>

                    <div className="mt-3 text-xs text-white/55">
                      (Por enquanto salvamos só o prefixo do CEP no banco.
                      Endereço completo vem no próximo passo.)
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-white/90">
                      Cidade (opcional)
                    </span>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: Ubá"
                      className="rounded-2xl border border-white/10 bg-zinc-950/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/30"
                      disabled={loading || (home !== null && home !== 'consumer' && home !== 'merchant')}
                    />

                    <div className="text-xs text-white/55">
                      Salvaremos automaticamente o prefixo do CEP (5 primeiros
                      dígitos) para sugestões.
                    </div>
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={onSave}
                    disabled={
                      loading ||
                      saving ||
                      !canSave ||
                      (home !== null && home !== 'consumer' && home !== 'merchant')
                    }
                    className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {saving ? 'Salvando…' : 'Salvar preferências'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCep('');
                      setAddr(null);
                      setCity('');
                      setCepPrefix('');
                      setMsg('Preferências limpas.');
                    }}
                    className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    disabled={loading || saving}
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            {/* Segurança */}
            <div
              id="seguranca"
              className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-lg font-semibold">Segurança</h2>
              <p className="mt-1 text-sm text-white/65">
                Em breve: confirmar email, trocar senha e ações sensíveis.
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                Status:{' '}
                <span className="font-semibold">
                  verificação de email (em breve)
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">
                    Confirmação de email
                  </div>
                  <div className="mt-1 text-sm text-white/65">
                    Vai virar requisito para recursos sensíveis (carteira, saque,
                    etc).
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">
                    Sessões e dispositivos
                  </div>
                  <div className="mt-1 text-sm text-white/65">
                    Em breve: ver onde sua conta está logada.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
