'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const e2 = email.trim().toLowerCase();
    if (!e2 || !e2.includes('@')) {
      setMsg('Email inválido.');
      return;
    }

    try {
      setLoading(true);
      setMsg('');

      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e2 }),
      });

      setMsg(
        'Se existir uma conta com esse email, enviaremos um link para recuperar o acesso.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-white">
      {/* fundo com grid sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      {/* glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[56rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-14">
        <div className="w-full max-w-xl">
          {/* topo */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-3 text-sm font-semibold text-white/85 hover:text-white"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-black">
                <Image src="/marto-m.svg" alt="Marto" width={20} height={20} />
              </span>
              <span className="leading-tight">
                <span className="block">Marto</span>
                <span className="block text-xs font-normal text-white/55">
                  Sem feed. Só histórico.
                </span>
              </span>
            </Link>

            <Link
              href="/login"
              className="text-sm font-semibold text-white/75 hover:text-white"
            >
              Voltar
            </Link>
          </div>

          {/* card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
            {/* marca d’água */}
            <div className="pointer-events-none absolute -right-10 -top-10 opacity-[0.06]">
              <Image src="/marto-m.svg" alt="" width={160} height={160} />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
                  Recuperar acesso
                </div>

                <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                  Recuperar acesso
                </h1>

                <p className="mt-2 text-sm text-white/65">
                  Informe seu email para receber um link de recuperação.
                  <br />
                  Se o email existir, a gente te guia de volta.
                </p>
              </div>

              <div className="hidden sm:block rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                fluxo ativo (MVP)
              </div>
            </div>

            <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-white/85">Email</span>
                <input
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                />
              </label>

              {msg ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
                  {msg}
                </div>
              ) : null}

              <button
                disabled={loading}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                type="submit"
              >
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>

              <div className="mt-2 flex items-center justify-between">
                <Link
                  href="/login"
                  className="text-sm text-white/70 hover:text-white underline underline-offset-4"
                >
                  Voltar para login
                </Link>

                <Link
                  href="/register"
                  className="text-sm font-semibold text-white/85 hover:text-white"
                >
                  Criar histórico
                </Link>
              </div>

              <div className="mt-2 text-center text-xs text-white/40">
                Sem feed. Sem barulho. Só histórico.
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
