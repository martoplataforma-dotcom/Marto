'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

export default function ReviewPage() {
  const params = useSearchParams();
  const router = useRouter();
  const serviceRequestId = params.get('serviceRequestId');

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const canSend = useMemo(() => {
    return !!serviceRequestId && !saving;
  }, [serviceRequestId, saving]);

  async function enviar() {
    // prova visual de clique
    setMsg('');

    if (!serviceRequestId) {
      setMsg('serviceRequestId não informado na URL');
      return;
    }

    try {
      setSaving(true);

      const token = getToken();

      await fetchJSON(`/reviews`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          serviceRequestId,
          rating,
          comment,
        }),
      });

      // destino simples (pode ajustar depois)
      router.replace('/dash/consumer');
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Avaliar serviço</h1>
      <p className="mt-2 text-sm opacity-80">Conte como foi sua experiência.</p>

      <div className="mt-6 grid gap-3 rounded-xl border p-4">
        <div className="text-sm">
          <b>serviceRequestId:</b> {serviceRequestId ?? '(não veio na URL)'}
        </div>

        <label className="grid gap-1 text-sm">
          <span>Nota</span>
          <select
            className="rounded-xl border p-3"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Comentário (opcional)</span>
          <input
            className="rounded-xl border p-3"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: chegou certinho, atendimento ótimo…"
          />
        </label>

        <button
          type="button"
          className="rounded-xl border p-3 text-sm"
          onClick={enviar}
          disabled={!canSend}
        >
          {saving ? 'Enviando…' : 'Enviar avaliação'}
        </button>

        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
    </main>
  );
}
