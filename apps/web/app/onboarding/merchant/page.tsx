'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

export default function MerchantOnboardingPage() {
  const router = useRouter();
  const [tradeName, setTradeName] = useState('');
  const [city, setCity] = useState('Ubá');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    try {
      setSaving(true);
      setMsg('');

      const token = getToken();
      if (!token) {
        setMsg('Sem token (marto_access).');
        return;
      }

      await fetchJSON(`/me/roles`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          role: 'MERCHANT',
          merchant: { tradeName, city },
        }),
      });

      router.replace('/');
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Onboarding Lojista</h1>
      <p className="mt-2 text-sm opacity-80">Só o mínimo pra começar (MVP).</p>

      <div className="mt-6 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span>Nome da loja</span>
          <input
            className="rounded-xl border p-3"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            placeholder="Ex: Loja do João"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Cidade</span>
          <input
            className="rounded-xl border p-3"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex: Ubá"
          />
        </label>

        <button
          className="rounded-xl border p-3 text-sm"
          onClick={submit}
          disabled={saving || tradeName.trim().length === 0}
        >
          {saving ? 'Salvando…' : 'Finalizar'}
        </button>

        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
    </main>
  );
}
