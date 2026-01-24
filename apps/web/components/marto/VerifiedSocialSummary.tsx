'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

  return (
    <section className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Experiências verificadas
          </div>
          <div className="mt-1 text-xs text-white/65">
            Sem feed. Só consequência de compra real.
          </div>
        </div>

        <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          {count === null ? '—' : `${count} verificada${count === 1 ? '' : 's'}`}
        </div>
      </div>

      <div className="mt-4 text-sm text-white/75">
        O Marto só marca como verificado quando vem de um pedido real. Isso vira
        reputação e reduz risco.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/shop/${encodeURIComponent(productId)}/posts`}
          onClick={(e) => {
            // fallback: se por algum motivo o Link não navegar, força
            e.preventDefault();
            window.location.href = `/shop/${encodeURIComponent(productId)}/posts`;
          }}
          className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
        >
          Ver posts →
        </Link>
      </div>
    </section>
  );
}
