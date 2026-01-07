'use client';

import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

type ServiceProvider = {
  cpf: string;
  city?: string | null;
  cepPrefix?: string | null;
  status: string;
};

export default function ProviderDash() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState('');
  const [data, setData] = useState<ServiceProvider | null>(null);

  const [cpf, setCpf] = useState('');
  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  async function load() {
    try {
      setLoading(true);
      setMsg('');

      const sp = await fetchJSON<ServiceProvider | null>('/service-providers/me');
      setData(sp);

      setCpf(sp?.cpf ?? '');
      setCity(sp?.city ?? '');
      setCepPrefix(sp?.cepPrefix ?? '');
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setMsg('');

      const saved = await fetchJSON<ServiceProvider>('/service-providers/me', {
        method: 'PUT',
        body: JSON.stringify({
          cpf: cpf.trim(),
          city: city.trim() || undefined,
          cepPrefix: cepPrefix.trim() || undefined,
        }),
      });

      setData(saved);
      setMsg('✅ Perfil salvo com sucesso');
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Dashboard Prestador (A3.5)</h1>
      <p className="mt-2 text-sm text-red-600">A3.5 FRONT — PERFIL PRESTADOR (editar + salvar)</p>

      {msg && <p className="mt-4 text-sm text-red-600">{msg}</p>}

      <div className="mt-6 rounded-xl border p-4 text-sm">
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <>
            <label className="block">
              <span className="text-xs opacity-80">CPF</span>
              <input
                className="mt-1 w-full rounded-lg border p-2"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="12345678900"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-xs opacity-80">Cidade</span>
              <input
                className="mt-1 w-full rounded-lg border p-2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ubá"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-xs opacity-80">CEP Prefixo</span>
              <input
                className="mt-1 w-full rounded-lg border p-2"
                value={cepPrefix}
                onChange={(e) => setCepPrefix(e.target.value)}
                placeholder="36500"
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={saving || !cpf.trim()}
                className="rounded-lg border bg-black px-3 py-2 text-white disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>

              <button
                onClick={load}
                disabled={loading || saving}
                className="rounded-lg border px-3 py-2 disabled:opacity-50"
              >
                Recarregar
              </button>
            </div>

            {data && (
              <div className="mt-4 text-xs opacity-80">
                <div>
                  <b>Status:</b> {data.status}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
