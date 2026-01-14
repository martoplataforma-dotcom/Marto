'use client';

import Link from 'next/link';

export default function TransporterSettingsPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transportadora • Configurações</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Ajuste sua operação: nome, tipo, área de atendimento e futuras rotas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dash/provider/transporter"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Abrir dashboard
          </Link>

          <Link
            href="/dash/provider/profile"
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Meu perfil
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-neutral-900">Em breve</div>
        <p className="mt-2 text-sm text-neutral-600">
          Aqui vão entrar: área de atendimento, tipo de operação, SLA, coleta/entrega e
          parâmetros de prova de entrega.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="text-sm font-semibold text-neutral-900">Área</div>
            <p className="mt-1 text-sm text-neutral-600">
              Regiões/rotas atendidas e limites.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm font-semibold text-neutral-900">SLA</div>
            <p className="mt-1 text-sm text-neutral-600">
              Prazos padrão e exceções.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm font-semibold text-neutral-900">POD</div>
            <p className="mt-1 text-sm text-neutral-600">
              Assinatura, foto, geo e regras.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm font-semibold text-neutral-900">Rastreio</div>
            <p className="mt-1 text-sm text-neutral-600">
              Eventos e visibilidade para cliente/lojista.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
