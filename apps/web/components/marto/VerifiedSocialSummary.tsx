'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  productId: string;
};

export function VerifiedSocialSummary({ productId }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/social/posts/by-product/${encodeURIComponent(productId)}`,
        );

        if (!res.ok) {
          if (alive) setCount(0);
          return;
        }

        const data = (await res.json()) as { posts?: unknown[] };
        if (alive) setCount(Array.isArray(data.posts) ? data.posts.length : 0);
      } catch {
        if (alive) setCount(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, [productId]);

  const postsHref = useMemo(
    () => `/shop/p/${encodeURIComponent(productId)}/posts`,
    [productId],
  );

  const isLoading = count === null;
  const isEmpty = !isLoading && count === 0;
  const hasVerified = !isLoading && (count ?? 0) > 0;

  return (
    <section
      className={[
        'rounded-2xl border border-white/10 bg-black/30 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur',
        isEmpty ? 'p-4' : 'p-5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Resumo verificado
          </div>

          <div className="mt-2 text-sm font-semibold text-white/88">
            {isEmpty
              ? 'Ainda sem experiências verificadas'
              : 'Experiências verificadas'}
          </div>
        </div>

        <div
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold',
            hasVerified
              ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
              : 'border border-white/12 bg-white/6 text-white/72',
          ].join(' ')}
        >
          {isLoading
            ? '—'
            : hasVerified
              ? `${count} verificada${count === 1 ? '' : 's'}`
              : '0 verificadas'}
        </div>
      </div>

      {isEmpty ? (
        <div className="mt-3 text-sm leading-6 text-white/66">
          A reputação desta peça começa no primeiro pedido real concluído dentro
          do Marto.
        </div>
      ) : (
        <>
          <div className="mt-3 text-sm leading-6 text-white/72">
            Só entram aqui rastros que nasceram de compra real dentro do fluxo
            da peça.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={postsHref}
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Ver experiências →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
