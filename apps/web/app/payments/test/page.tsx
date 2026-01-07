'use client';

import { useState } from 'react';
import { authFetchJSON } from '../../../src/lib/auth';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

export default function PaymentsTestPage() {
  const [msg, setMsg] = useState('');

  async function criarPagamentoProtegido() {
    try {
      setMsg('');

      // 1) cria pedido rápido (sem auth) - usa orderId real
      const order = await fetchJSON<{ id: string }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: 'prod-1', quantity: 1 }],
        }),
      });

      // 2) chama rota protegida com token (authFetchJSON)
      const pay = await authFetchJSON('/payments', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          amount: 100,
          method: 'CARD',
        }),
      });

      setMsg(JSON.stringify(pay, null, 2));
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status ?? ''} ${a.message ?? ''}\n${JSON.stringify(e)}`);
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Teste Payments (JWT)</h1>

      <button
        onClick={criarPagamentoProtegido}
        className="mt-4 rounded bg-black px-4 py-2 text-white"
      >
        Testar rota protegida
      </button>

      <pre className="mt-4 text-sm whitespace-pre-wrap">{msg}</pre>
    </main>
  );
}
