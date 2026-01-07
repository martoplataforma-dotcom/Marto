'use client';

import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

type Representative = {
  region: string;
  inviteCode?: string | null;
  status: string;
};

export default function RepresentativeDash() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({
    region: '',
    inviteCode: '',
  });

  // 🔎 GET /representatives/me
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const data = await fetchJSON<Representative>(`/representatives/me`, {
          method: 'GET',
        });

        if (data) {
          setForm({
            region: data.region ?? '',
            inviteCode: data.inviteCode ?? '',
          });
        }

        setMsg('');
      } catch (e) {
        const a = e as ApiError;
        setMsg(`${a.status} - ${a.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✏️ PUT /representatives/me
  async function salvar() {
    try {
      setMsg('');

      await fetchJSON(`/representatives/me`, {
        method: 'PUT',
        body: JSON.stringify({
          region: form.region,
          inviteCode: form.inviteCode || undefined,
        }),
      });

      setMsg('Salvo com sucesso.');

      // 🔁 Recarrega do backend para confirmar persistência
      const data = await fetchJSON<Representative>(`/representatives/me`, {
        method: 'GET',
      });

      if (data) {
        setForm({
          region: data.region ?? '',
          inviteCode: data.inviteCode ?? '',
        });
      }
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Dashboard Representante (A4)</h1>

      {msg && <p className="mt-4 text-sm">{msg}</p>}

      {loading ? (
        <p className="mt-4 text-sm">Carregando...</p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Região
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.region}
              onChange={(e) =>
                setForm((s) => ({ ...s, region: e.target.value }))
              }
            />
          </label>

          <label className="block text-sm">
            Invite code (opcional)
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.inviteCode}
              onChange={(e) =>
                setForm((s) => ({ ...s, inviteCode: e.target.value }))
              }
            />
          </label>

          <button
            className="mt-2 rounded bg-black px-4 py-2 text-sm text-white"
            onClick={salvar}
          >
            Salvar
          </button>
        </div>
      )}
    </main>
  );
}
