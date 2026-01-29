// apps/web/app/profile/_sections/consumer.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

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

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

export function ConsumerPrefsSection({
  home,
  loading,
  onMsg,
  initialCity,
  initialCepPrefix,
}: {
  home: 'consumer' | null;
  loading: boolean;
  onMsg: (m: string) => void;
  initialCity: string;
  initialCepPrefix: string;
}) {
  const [savingConsumer, setSavingConsumer] = useState(false);

  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [addr, setAddr] = useState<{
    street: string;
    district: string;
    city: string;
    uf: string;
  } | null>(null);

  // ✅ aplica iniciais quando mudar (ex: load inicial do /profile)
  useEffect(() => {
    setCity(String(initialCity ?? ''));
    setCepPrefix(String(initialCepPrefix ?? ''));
    setCep('');
    setAddr(null);
  }, [initialCity, initialCepPrefix]);

  // ✅ validações básicas
  const canSaveConsumer = useMemo(() => {
    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) return false;
    return true;
  }, [cepPrefix]);

  async function loadConsumerPrefs() {
    const token = getToken();
    if (!token) {
      onMsg('Sem token. Faça login novamente.');
      return;
    }

    try {
      const prefs = await fetchJSON<Consumer>('/consumers/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      setCity(prefs.city ?? '');
      setCepPrefix(prefs.cepPrefix ?? '');

      setCep('');
      setAddr(null);
    } catch (e: unknown) {
      const err = e as ApiError;
      onMsg(err?.message ?? 'Não foi possível carregar preferências do consumidor.');
    }
  }

  async function lookupCep(value: string) {
    onMsg('');
    const clean = value.replace(/\D/g, '').slice(0, 8);
    setCep(clean);

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
        onMsg('CEP não encontrado.');
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

      if (!city.trim() && foundCity) setCity(foundCity);
    } catch {
      setAddr(null);
      onMsg('Não foi possível consultar o CEP agora.');
    } finally {
      setCepLoading(false);
    }
  }

  async function onSaveConsumerPrefs() {
    onMsg('');
    const token = getToken();
    if (!token) {
      onMsg('Sem token. Faça login novamente.');
      return;
    }

    if (home && home !== 'consumer') {
      onMsg('Preferências do Consumidor não se aplicam ao seu papel atual.');
      return;
    }

    const digits = String(cep ?? '').replace(/\D/g, '').slice(0, 8);
    const nextPrefix = digits.length >= 5 ? digits.slice(0, 5) : '';

    if (!nextPrefix) {
      onMsg('Digite pelo menos 5 números do CEP para salvar preferências.');
      return;
    }

    setSavingConsumer(true);
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

      const fresh = await fetchJSON<Consumer>('/consumers/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      setCity(fresh.city ?? city);
      setCepPrefix(fresh.cepPrefix ?? nextPrefix);

      onMsg('Preferências salvas.');
      setTimeout(() => onMsg(''), 2500);
    } catch (e: unknown) {
      const err = e as ApiError;
      onMsg(err?.message ?? 'Não foi possível salvar preferências.');
    } finally {
      setSavingConsumer(false);
    }
  }

  return (
    <div
      id="preferencias"
      className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white/90">
            Preferências (Consumidor)
          </h2>
          <p className="mt-1 text-sm text-white/70">
            CEP para sugestões e logística (por enquanto: prefixo).
          </p>
        </div>

        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
          ativo
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-white/85">
                Carregar preferências
              </div>
              <div className="text-xs text-white/65">
                Se você acabou de entrar, puxe seus dados salvos.
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadConsumerPrefs()}
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
              disabled={loading || savingConsumer || cepLoading}
            >
              Recarregar
            </button>
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-white/85">
            CEP (8 dígitos)
          </span>
          <input
            value={cep}
            onChange={(e) => void lookupCep(e.target.value)}
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

        {cepPrefix ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">Região salva</div>
            <div className="mt-2 text-sm text-white/75">
              CEP base:{' '}
              <span className="font-semibold text-white">{cepPrefix}</span>
            </div>
            <div className="mt-2 text-xs text-white/55">
              Por enquanto o Marto salva só o prefixo (5 primeiros dígitos) para
              sugestões.
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
              Endereço completo vem depois. Agora é foco: sugestões e logística
              base.
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
            onClick={() => void onSaveConsumerPrefs()}
            disabled={loading || savingConsumer || cepLoading || !canSaveConsumer}
            className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {savingConsumer ? 'Salvando…' : 'Salvar preferências'}
          </button>

          <button
            type="button"
            onClick={() => {
              setCep('');
              setAddr(null);
              setCepPrefix('');
              onMsg('CEP limpo.');
              setTimeout(() => onMsg(''), 1800);
            }}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            disabled={loading || savingConsumer}
          >
            Limpar CEP
          </button>
        </div>
      </div>
    </div>
  );
}
