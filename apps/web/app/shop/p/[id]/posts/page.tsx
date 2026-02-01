// apps/web/app/shop/p/[id]/posts/page.tsx
'use client';

import Link from 'next/link';
import { use, useMemo } from 'react';

export default function ShopProductPostsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = useMemo(() => decodeURIComponent(rawId), [rawId]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-white/60">
              Experiências do Produto
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white/90">
              Posts verificados
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Compra real → relato → reputação.
            </p>
          </div>

          <Link
            href={`/shop/p/${encodeURIComponent(id)}`}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Voltar ao produto →
          </Link>
        </header>

        <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="text-sm text-white/75">
            MVP: página de listagem completa de posts vai entrar aqui.
          </div>
          <div className="mt-2 text-xs text-white/60">productId: {id}</div>
        </div>
      </div>
    </main>
  );
}
