'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';

type RegisterResponse = { accessToken: string };

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');

    const e2 = email.trim().toLowerCase();
    if (!e2 || !e2.includes('@')) {
      setMsg('Email inválido.');
      return;
    }
    if (password.length < 6) {
      setMsg('Senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetchJSON<RegisterResponse>('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e2, password }),
      });

      localStorage.setItem('marto_access', res.accessToken);
      router.replace('/choose-role');
    } catch (err: unknown) {
      const e = err as ApiError;
      setMsg(e?.message ?? 'Erro ao criar histórico.');
    } finally {
      setLoading(false);
    }
  }

  function onGoogle() {
    // ✅ Só UI por enquanto (sem backend / sem OAuth)
    setMsg('Em breve: continuar com Google para criar seu histórico.');
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
              Entrar
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
                  Início do rastro
                </div>

                <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                  Criar seu histórico
                </h1>

                <p className="mt-2 text-sm text-white/65">
                  Comece com Google ou crie manualmente.
                  <br />
                  Depois, você escolhe como participar do ecossistema.
                </p>
              </div>

              <div className="hidden sm:block rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                fluxo ativo (MVP)
              </div>
            </div>

            <div className="mt-8 grid gap-3">
              {/* Google (UI) */}
              <button
                type="button"
                onClick={onGoogle}
                className="flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black hover:opacity-90"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-black/5 text-[10px] font-bold">
                  G
                </span>
                Continuar com Google
              </button>

              {/* divisor */}
              <div className="my-1 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <div className="text-xs text-white/45">ou</div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Manual (já funciona) */}
              <form className="grid gap-4" onSubmit={onSubmit}>
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

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-white/85">Senha</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-white/30"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder="mínimo 6 caracteres"
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
                  {loading ? 'Criando histórico…' : 'Criar meu histórico'}
                </button>

                <div className="text-center text-sm text-white/65">
                  Já faz parte?{' '}
                  <Link className="font-semibold text-white" href="/login">
                    Entrar
                  </Link>
                </div>

                <div className="mt-2 text-center text-xs text-white/40">
                  Ao criar, você inicia um histórico. Reputação nasce do que aconteceu.
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
