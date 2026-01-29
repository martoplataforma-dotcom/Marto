// apps/web/app/settings/page.tsx
'use client';

import Link from 'next/link';

export default function SettingsPage() {
  return (
    <main className="relative min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_55%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_100%_60%,rgba(255,255,255,0.08),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white/90">
              Configurações
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Central de ajustes da conta e preferências do Marto (MVP).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/me"
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Voltar para Conta
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-sm font-semibold text-white/90">Perfil público</div>
            <div className="mt-1 text-sm text-white/65">
              Nome público, bio, @handle e foto do perfil.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/me"
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Abrir /me
              </Link>
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70">
                (Hoje fica em /me)
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-sm font-semibold text-white/90">Preferências</div>
            <div className="mt-1 text-sm text-white/65">
              Notificações, privacidade e experiência.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/notifications"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Notificações
              </Link>
              <button
                type="button"
                onClick={() => alert('Privacidade: em breve.')}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Privacidade
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur md:col-span-2">
            <div className="text-sm font-semibold text-white/90">Sessão</div>
            <div className="mt-1 text-sm text-white/65">
              Ações de conta e autenticação.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/login"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Entrar novamente
              </Link>
              <Link
                href="/me"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Sair (via /me)
              </Link>
            </div>

            <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
              Próximo: consolidar tudo em /settings e deixar /me focado em identidade.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
