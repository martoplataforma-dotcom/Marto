'use client';

import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type ServiceRequest = {
  id: string;
  orderId: string;
  paymentId?: string | null;
  title: string;
  notes?: string | null;
  status: string;
  createdAt: string;
};

export default function ProviderTasksPage() {
  const [msg, setMsg] = useState('');
  const [id, setId] = useState('');
  const [data, setData] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMsg('');
  }, []);

  async function buscar() {
    try {
      setLoading(true);
      setMsg('');
      setData(null);

      const token = getToken();
      if (!token) {
        setMsg('Sem token (marto_access).');
        return;
      }

      const sr = await fetchJSON<ServiceRequest>(
        `/service-requests/${encodeURIComponent(id)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setData(sr);
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Tarefas do Prestador (A3.2.1)</h1>
      <p className="mt-2 text-sm text-red-600">A3.2.1 FRONT — BUSCAR TAREFA</p>

      <div className="mt-6 grid gap-3 rounded-xl border p-4">
        <label className="grid gap-1 text-sm">
          <span>serviceRequestId</span>
          <input
            className="rounded-xl border p-3"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Ex: sr-1700000000000"
          />
        </label>

        <button
          className="rounded-xl border p-3 text-sm"
          onClick={buscar}
          disabled={loading || id.trim().length === 0}
        >
          {loading ? 'Buscando…' : 'Buscar'}
        </button>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        {data && (
          <div className="mt-2 rounded-xl border p-3 text-sm">
            <div>
              <b>ID:</b> {data.id}
            </div>
            <div className="mt-1">
              <b>Status:</b> {data.status}
            </div>
            <div className="mt-1">
              <b>Order:</b> {data.orderId}
            </div>
            <div className="mt-1">
              <b>Título:</b> {data.title}
            </div>
            <div className="mt-1">
              <b>Notas:</b> {data.notes ?? '-'}
            </div>
            <div className="mt-1">
              <b>Criado em:</b> {data.createdAt}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
