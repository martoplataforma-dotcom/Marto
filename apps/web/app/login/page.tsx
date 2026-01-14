'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login } from '../../src/lib/auth';
import { fetchJSON, type ApiError } from '../../src/lib/api';

type MeResponse = {
  home?:
    | 'consumer'
    | 'merchant'
    | 'service_provider'
    | 'representative'
    | 'factory';
  needsRoleChoice?: boolean;
};

type ServiceProviderMeResponse = {
  kind?: 'GENERIC' | 'TRANSPORTER' | null;
};

function dashFromHome(home?: MeResponse['home'] | null) {
  switch (home) {
    case 'consumer':
      return '/dash/consumer';
    case 'merchant':
      return '/dash/merchant';
    case 'service_provider':
      return '/dash/provider/services';
    case 'representative':
      return '/dash/representative';
    case 'factory':
      return '/dash/factory';
    default:
      return '/dash/consumer';
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin(e?: React.FormEvent) {
    e?.preventDefault();

    try {
      setLoading(true);
      setMsg('');

      const e2 = email.trim().toLowerCase();
      if (!e2 || !e2.includes('@')) {
        setMsg('Email inválido.');
        return;
      }
      if (!password) {
        setMsg('Digite sua senha.');
        return;
      }

      await login({ email: e2, password });

      const me = await fetchJSON<MeResponse>('/me', { method: 'GET' });

      if (me?.needsRoleChoice) {
        localStorage.removeItem('marto_home');
        router.replace('/choose-role');
        router.refresh();
        return;
      }

      const home = me?.home ?? 'consumer';
      localStorage.setItem('marto_home', home);

      if (home === 'service_provider') {
        const sp = await fetchJSON<ServiceProviderMeResponse>(
          '/service-providers/me',
          { method: 'GET' },
        );

        if (sp?.kind === 'TRANSPORTER') {
          router.replace('/dash/provider/transporter');
          router.refresh();
          return;
        }

        // ✅ provider normal: direto na central de serviços
        router.replace('/dash/provider/services');
        router.refresh();
        return;
      }

      router.replace(dashFromHome(home));
      router.refresh();
    } catch (err: unknown) {
      const a = err as ApiError;
      const text =
        a?.message ||
        (err instanceof Error ? err.message : String(err ?? 'Erro ao entrar.'));
      setMsg(text);
    } finally {
      setLoading(false);
    }
  }

  function onGoogle() {
    setMsg('Em breve: continuar com Google para acessar seu histórico.');
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-white">
      {/* fundo com grid */}
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
              href="/register"
              className="text-sm font-semibold text-white/75 hover:text-white"
            >
              Criar histórico
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
                  Acessar histórico
                </div>

                <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                  Entrar
                </h1>

                <p className="mt-2 text-sm text-white/65">
                  Continue com Google ou entre manualmente.
                  <br />
                  Sua reputação é consequência do que aconteceu.
                </p>
              </div>

              <div className="hidden sm:block rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                fluxo ativo (MVP)
              </div>
            </div>

            <div className="mt-8 grid gap-3">
              {/* Google */}
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

              <div className="my-1 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <div className="text-xs text-white/45">ou</div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Manual */}
              <form className="grid gap-4" onSubmit={onLogin}>
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
                    type="password"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    autoComplete="current-password"
                    placeholder="sua senha"
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
                  {loading ? 'Entrando…' : 'Entrar'}
                </button>

                <div className="text-center">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-white/60 hover:text-white/90 underline underline-offset-4"
                  >
                    Recuperar acesso
                  </Link>
                </div>

                <div className="text-center text-sm text-white/65">
                  Não tem conta?{' '}
                  <Link className="font-semibold text-white" href="/register">
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
      </div>
    </main>
  );
}
