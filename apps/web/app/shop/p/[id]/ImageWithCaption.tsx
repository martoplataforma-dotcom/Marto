import { useMemo, useState } from 'react';

export function ImageWithCaption({
  url,
  alt,
  lines,
  label = 'VISÃO RÁPIDA',
}: {
  url: string;
  alt: string;
  lines?: string[] | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const safeLines = useMemo(() => {
    const raw = Array.isArray(lines) ? lines : [];
    return raw
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [lines]);

  const has = safeLines.length > 0;

  return (
    <div
      className="relative group rounded-2xl"
      onMouseLeave={() => setOpen(false)} // ✅ nunca fica “preso” no desktop
    >
      {/* imagem */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="block h-full w-full object-contain"
          loading="lazy"
        />
      </div>

      {/* botão info: serve pro touch / “fixar” se quiser */}
      {has ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur hover:bg-black/55"
          aria-label="Mostrar visão rápida"
          title="Visão rápida"
        >
          i
        </button>
      ) : null}

      {/* overlay Marto: compacto e leve */}
      {has ? (
        <div
          className={[
            'pointer-events-none absolute left-4 bottom-4 max-w-[62%] rounded-2xl',
            'border border-white/15 bg-neutral-950/55 backdrop-blur-md',
            'shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_14px_40px_rgba(0,0,0,0.45)]',
            'px-3 py-2.5',
            // desktop: hover | touch: open
            open ? 'opacity-100' : 'opacity-0',
            'transition-opacity duration-200',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {label}
            </div>
          </div>

          <div className="mt-1 grid gap-1">
            {safeLines.map((t, i) => (
              <div
                key={`${t}-${i}`}
                className="flex items-start gap-2 text-xs leading-snug text-white/85"
              >
                <span className="mt-1.5 h-1 w-1 rounded-full bg-white/45" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
