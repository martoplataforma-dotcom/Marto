'use client';

import Link from 'next/link';

export function MerchantProfileSection() {
  return (
    <div
      id="lojista"
      className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white/90">Lojista</h2>
          <p className="mt-1 text-sm text-white/70">
            Configurações da loja e presença pública. Operação fica no painel.
          </p>
        </div>

        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
          ativo
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
        O perfil da loja (CNPJ, logo, capa, @handle da vitrine) fica no seu
        painel, em{' '}
        <span className="font-semibold text-white/85">Perfil da loja</span>.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/dash/merchant/profile"
          className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Abrir perfil da loja →
        </Link>

        <Link
          href="/dash/merchant"
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Voltar ao painel do lojista
        </Link>
      </div>
    </div>
  );
}
