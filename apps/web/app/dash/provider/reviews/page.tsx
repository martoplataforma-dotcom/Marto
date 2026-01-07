'use client';

import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type Review = {
  id: string;
  serviceRequestId: string;
  providerUserId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export default function ProviderReviewsPage() {
  const [msg, setMsg] = useState('');
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMsg('');

        const token = getToken();
        if (!token) {
          setMsg('Sem token (marto_access).');
          return;
        }

        // por enquanto usamos o GET /reviews (mock)
        const data = await fetchJSON<Review[]>(`/reviews`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        const a = e as ApiError;
        setMsg(`${a.status} - ${a.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Avaliações (A3.2.6)</h1>
      <p className="mt-2 text-sm text-red-600">A3.2.6 FRONT — LISTAR AVALIAÇÕES</p>

      {loading && <p className="mt-4 text-sm">Carregando…</p>}
      {msg && <p className="mt-4 text-sm text-red-600">{msg}</p>}

      {!loading && !msg && items.length === 0 && (
        <p className="mt-4 text-sm opacity-80">Nenhuma avaliação ainda.</p>
      )}

      <div className="mt-6 grid gap-3">
        {items.map((r) => (
          <div key={r.id} className="rounded-xl border p-4 text-sm">
            <div>
              <b>Nota:</b> {r.rating}/5
            </div>
            <div className="mt-1">
              <b>Comentário:</b> {r.comment ?? '-'}
            </div>
            <div className="mt-1">
              <b>ServiceRequest:</b> {r.serviceRequestId}
            </div>
            <div className="mt-1 opacity-80">{r.createdAt}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
