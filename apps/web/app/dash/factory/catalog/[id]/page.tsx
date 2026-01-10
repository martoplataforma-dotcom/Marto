'use client';

import Link from 'next/link';
import { use } from 'react';

type Props = {
  // Next pode entregar params como Promise em Client Components
  params: Promise<{ id: string }>;
};

function niceId(raw: string) {
  return (
    String(raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'produto'
  );
}

export default function FactoryCatalogProductDetailsPage({ params }: Props) {
  const { id } = use(params);
  const pid = niceId(id);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Detalhes do produto</h1>

          <p className="text-sm text-neutral-600">
            Produto <span className="font-medium">{pid}</span> • Visualização no
            Marto • <span className="font-medium">Mock</span>
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/dash/factory/catalog"
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Voltar ao catálogo
          </Link>
          <Link
            href="/logout"
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Sair
          </Link>
        </nav>
      </header>

      <section className="rounded-2xl border bg-white overflow-hidden">
        {/* ✅ bloco de imagem principal (mock) */}
        <div className="border-b bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-500">Imagem principal</div>
              <div className="text-sm font-medium text-neutral-800">
                Aparência do produto no catálogo
              </div>
            </div>

            <button
              disabled
              className="rounded-lg border px-3 py-2 text-xs font-medium opacity-60"
              title="Vamos habilitar quando ligar upload de imagens"
              type="button"
            >
              Trocar foto
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border bg-white">
            <div className="h-56 w-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-400">
              imagem do produto
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Identidade */}
          <div className="mb-5">
            <div className="text-xs text-neutral-500">Identidade</div>
            <h2 className="mt-1 text-lg font-semibold">
              Nome do produto (mock)
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Descrição resumida do produto, variações e posicionamento no
              catálogo.
            </p>
          </div>

          {/* Dados principais */}
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="text-xs text-neutral-500">Status</div>
              <div className="mt-1 text-sm font-medium">Ativo / Rascunho</div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-xs text-neutral-500">Preço base</div>
              <div className="mt-1 text-sm font-medium">R$ 0,00</div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-xs text-neutral-500">SKU</div>
              <div className="mt-1 text-sm font-medium">XXX-000</div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-xs text-neutral-500">Disponibilidade</div>
              <div className="mt-1 text-sm font-medium">Sob demanda</div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 border-t pt-4">
            <button
              disabled
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white opacity-60"
              title="Vamos habilitar quando ligar o backend"
            >
              Editar produto
            </button>

            <button
              disabled
              className="rounded-lg border px-4 py-2 text-sm font-medium opacity-60"
              title="Vamos habilitar quando ligar o backend"
            >
              Publicar
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
