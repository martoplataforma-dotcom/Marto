'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';
import { authFetchJSON } from '../../../src/lib/auth';

type ServiceRequest = {
  id: string;
  status?: string;
};

export default function ProviderChecklistPage() {
  const params = useSearchParams();
  const router = useRouter();
  const serviceRequestId = params.get('serviceRequestId');

  const [sr, setSr] = useState<ServiceRequest | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!serviceRequestId) {
      setMsg('serviceRequestId não informado');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setMsg('');
        setLoading(true);

        const data = await fetchJSON<ServiceRequest>(
          `/service-requests/${serviceRequestId}`,
        );
        setSr(data);
      } catch (e) {
        const a = e as ApiError;
        setMsg(`${a.status} - ${a.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceRequestId]);

  async function concluir() {
    if (!serviceRequestId) return;

    try {
      setSaving(true);
      setMsg('');

      // 1) submit checklist (se seu endpoint tiver outro nome, vai dar 404 e você cola aqui)
      await authFetchJSON(`/checklists/submit`, {
        method: 'POST',
        body: JSON.stringify({
          serviceRequestId,
          answers: [{ key: 'ok', value: true }],
        }),
      });

      // 2) marcar service como completo
      await authFetchJSON(`/service-requests/${serviceRequestId}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      router.push(`/review?serviceRequestId=${serviceRequestId}`);
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Checklist do Prestador</h1>

      {loading && <p className="mt-4">Carregando...</p>}

      {msg && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm">
          {msg}
        </p>
      )}

      {sr && (
        <div className="mt-4 rounded border p-4">
          <div className="text-sm text-gray-600">ServiceRequest:</div>
          <div className="font-mono text-sm">{sr.id}</div>
          <div className="mt-2 text-sm text-gray-600">
            Status: {sr.status ?? '(sem status)'}
          </div>

          <button
            onClick={concluir}
            disabled={saving}
            className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Concluir checklist'}
          </button>
        </div>
      )}
    </main>
  );
}
