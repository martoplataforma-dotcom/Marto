// apps/web/app/shop/[id]/posts/page.tsx
'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

type Post = {
  id: string;
  caption?: string | null;
  content?: string | null; // se você ainda usa
  createdAt?: string | null;
  verified?: boolean | null;
  rating?: number | null;
  author?: { handle?: string | null } | null;
  media?: Array<{ type?: 'IMAGE' | 'VIDEO'; url?: string | null }> | null;
};

export default function ProductVerifiedPostsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = String(id ?? '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError('');
        setPosts([]);

        // ✅ endpoint público (sem Authorization)
        const res = await fetch(
          `/api/social/products/${encodeURIComponent(productId)}/posts`,
        );

        const data = (await res.json().catch(() => null)) as {
          posts?: Post[];
          message?: string;
        } | null;

        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar (${res.status})`);
        }

        const list = Array.isArray(data?.posts) ? data!.posts : [];

        if (alive) setPosts(list);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [productId]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Experiências verificadas
            </h1>
            <p className="text-sm text-white/75">
              Aqui só entra o que veio de compra real.
            </p>
          </div>

          <Link
            href={`/shop/${encodeURIComponent(productId)}`}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            Voltar
          </Link>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Carregando…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Nenhuma experiência verificada ainda.
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white/90">
                    {p.author?.handle ? `@${p.author.handle}` : 'Consumidor'}
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                    ✅ verificado
                  </div>
                </div>

                {Array.isArray(p.media) && p.media.length > 0 ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {/* MVP: mostra só a 1ª mídia */}
                    {String(p.media[0]?.type ?? 'IMAGE').toUpperCase() ===
                    'VIDEO' ? (
                      <video
                        controls
                        className="h-auto w-full"
                        src={String(p.media[0]?.url ?? '')}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt="Mídia do post"
                        className="h-auto w-full object-cover"
                        src={String(p.media[0]?.url ?? '')}
                      />
                    )}
                  </div>
                ) : null}

                {p.caption ? (
                  <div className="mt-3 text-sm text-white/80">{p.caption}</div>
                ) : p.content ? (
                  <div className="mt-3 text-sm text-white/80">{p.content}</div>
                ) : (
                  <div className="mt-3 text-sm text-white/60">
                    (sem comentário)
                  </div>
                )}

                <div className="mt-3 text-xs text-white/60">
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleString('pt-BR')
                    : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
