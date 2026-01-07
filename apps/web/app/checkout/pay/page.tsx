'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

export default function PayPage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get('orderId');

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function pagar() {
    if (!orderId) {
      setMsg('orderId não informado');
      return;
    }

    try {
      setLoading(true);
      setMsg('');

      const r = await fetchJSON<{ ok: boolean }>(`/payments/mock`, {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });

      setMsg(JSON.stringify(r));
      router.push(`/service?orderId=${orderId}`);
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Pagamento</h1>

      <p className="mt-2 text-gray-600">Pedido: {orderId ?? '(sem orderId)'}</p>

      <button
        onClick={pagar}
        disabled={loading}
        className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Pagando...' : 'Pagar (mock)'}
      </button>

      <pre className="mt-4 text-sm">{msg}</pre>
    </main>
  );
}
