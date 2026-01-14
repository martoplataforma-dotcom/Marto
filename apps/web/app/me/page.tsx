// apps/web/app/me/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type MeResponse = {
  email?: string;
  home?:
    | 'consumer'
    | 'merchant'
    | 'service_provider'
    | 'representative'
    | 'factory';
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string;
  };
  profile?: {
    handle?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    updatedAt?: string | null;
  };
};

type UpdateProfileResponse = {
  ok: boolean;
  profile: {
    handle: string | null;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    updatedAt: string;
  };
};

function displayNameFromEmail(email?: string) {
  const base = String(email ?? '').split('@')[0] || 'Usuário';
  return base
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function initialsFromName(name: string) {
  const parts = name.split(' ').filter(Boolean);
  const a = parts[0]?.[0] ?? 'M';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

function dashFromHome(home?: string) {
  if (home === 'factory') return '/dash/factory';
  if (home === 'merchant') return '/dash/merchant';
  if (home === 'service_provider') return '/dash/provider/services';
  if (home === 'representative') return '/dash/representative';
  return '/dash/consumer';
}

function sanitizeHandle(v: string) {
  return String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 24);
}

export default function MyPublicProfile() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [me, setMe] = useState<MeResponse | null>(null);

  // Perfil público (backend /me/profile)
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // ✅ @handle
  const [handle, setHandle] = useState('');
  const [savingHandle, setSavingHandle] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [editingBio, setEditingBio] = useState(false);

  useEffect(() => {
    (async () => {
      setMsg('');
      const token = getToken();
      if (!token) {
        setMsg('Sem token. Entre novamente.');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchJSON<MeResponse>('/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setMe(data);

        const backendDisplayName = String(
          data?.profile?.displayName ?? '',
        ).trim();
        const backendBio = String(data?.profile?.bio ?? '').trim();
        const backendAvatarUrl = String(data?.profile?.avatarUrl ?? '').trim();

        const backendHandle = String(data?.profile?.handle ?? '').trim();
        setHandle(backendHandle);

        const email = String(data?.email ?? '').trim();
        const fallbackName = displayNameFromEmail(email);

        setDisplayName(backendDisplayName || fallbackName);

        // fallback local (se você ainda usa bio local em algum lugar)
        const storedBio = localStorage.getItem('marto_bio') ?? '';
        setBio(backendBio || storedBio);

        setAvatarUrl(backendAvatarUrl);
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar seu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const email = String(me?.email ?? '').trim();
  const name = displayName.trim() || displayNameFromEmail(email);
  const initials = initialsFromName(name);

  // badge baseado em home (fonte da verdade)
  const badge =
    me?.home === 'factory'
      ? 'Fabricante'
      : me?.home === 'merchant'
        ? 'Negócio'
        : me?.home === 'service_provider'
          ? 'Prestador'
          : me?.home === 'representative'
            ? 'Representante'
            : 'Consumidor';

  const rep = useMemo(() => {
    return {
      avg: '—',
      count: 0,
      label: 'Prévia de reputação',
    };
  }, []);

  const effectiveHandle = sanitizeHandle(handle);
  const publicUrl = effectiveHandle ? `/u/${effectiveHandle}` : '/u/teste';

  async function onSaveProfile() {
    try {
      setSavingProfile(true);
      setSavingHandle(true);
      setMsg('');

      const token = getToken();
      if (!token) {
        setMsg('Você precisa entrar novamente.');
        return;
      }

      const res = await fetchJSON<UpdateProfileResponse>('/me/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle: sanitizeHandle(handle),
          displayName: displayName.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
        }),
      });

      setMsg('Perfil público salvo.');

      setHandle(res.profile.handle ?? '');
      setDisplayName(res.profile.displayName ?? '');
      setBio(res.profile.bio ?? '');
      setAvatarUrl(res.profile.avatarUrl ?? '');

      // fallback local (se você ainda usa bio local em algum lugar)
      localStorage.setItem('marto_bio', res.profile.bio ?? '');

      setEditingBio(false);
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar o perfil.');
    } finally {
      setSavingProfile(false);
      setSavingHandle(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      {/* fundo (grid + glows) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[32rem] w-[62rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        {/* HERO do perfil público (dark glass) */}
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-sm backdrop-blur">
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-black/30 text-xl font-bold ring-1 ring-white/10">
                {avatarUrl?.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Avatar"
                    src={avatarUrl.trim()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                  {badge}
                  <span className="opacity-60">•</span>
                  Porque reputação importa
                </div>

                <h1 className="mt-3 text-3xl font-bold tracking-tight">
                  {loading ? 'Carregando…' : name}
                </h1>

                <div className="mt-1 text-sm text-white/70">{email}</div>

                <div className="mt-4">
                  {!editingBio ? (
                    <div className="text-sm text-white/80">
                      {bio?.trim()
                        ? bio
                        : 'Adicione uma bio curta. No Marto, sua história é feita de ações reais.'}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <textarea
                        className="min-h-[90px] w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                        placeholder="Ex: consumidor em Ubá, foco em reformas e serviços rápidos."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
                          onClick={onSaveProfile}
                          disabled={savingProfile || savingHandle}
                        >
                          {savingProfile ? 'Salvando…' : 'Salvar bio'}
                        </button>
                        <button
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                          onClick={() => {
                            setEditingBio(false);
                            const stored =
                              localStorage.getItem('marto_bio') ?? '';
                            const backendBio = String(
                              me?.profile?.bio ?? '',
                            ).trim();
                            setBio(backendBio || stored);
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {!editingBio ? (
                    <button
                      className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                      onClick={() => setEditingBio(true)}
                    >
                      Editar bio
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={dashFromHome(me?.home)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Voltar ao painel
              </Link>

              {effectiveHandle ? (
                <Link
                  href={`/u/${effectiveHandle}`}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Ver perfil público
                </Link>
              ) : null}

              <Link
                href="/dash/provider/profile"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Configurações
              </Link>

              <button
                onClick={() => {
                  localStorage.removeItem('marto_access');
                  localStorage.removeItem('marto_bio');
                  window.location.href = '/login';
                }}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        {msg ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            {msg}
          </div>
        ) : null}

        {/* ✅ Editar Perfil Público (backend) */}
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
          <h2 className="text-lg font-semibold">Perfil público</h2>
          <p className="mt-1 text-sm text-white/60">
            Essas informações aparecem no seu perfil público do Marto.
          </p>

          <div className="mt-4 grid gap-4">
            {/* ✅ @handle */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                Seu @handle (URL do perfil público)
              </span>

              <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <span className="text-sm text-white/50">@</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
                  className="w-full bg-transparent text-white outline-none placeholder:text-white/35"
                  placeholder="ex: entregador.uba"
                  autoComplete="off"
                />
              </div>

              <span className="text-xs text-white/55">
                Aparece como:{' '}
                <span className="font-semibold text-white">
                  /u/{effectiveHandle || 'seu_handle'}
                </span>
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Nome público</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40"
                placeholder="Ex: João Silva"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Bio</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[100px] rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40"
                placeholder="Uma frase curta sobre você no Marto."
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                Avatar URL (opcional)
              </span>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40"
                placeholder="https://..."
              />
              <span className="text-xs text-white/55">
                Upload de imagem vem depois.
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSaveProfile}
                disabled={savingProfile || savingHandle}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {savingProfile ? 'Salvando…' : 'Salvar perfil'}
              </button>

              <Link
                href={publicUrl}
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Ver perfil público
              </Link>
            </div>
          </div>
        </section>

        {/* Reputação + Histórico */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur md:col-span-1">
            <div className="text-sm font-semibold">{rep.label}</div>
            <div className="mt-4 flex items-baseline gap-2">
              <div className="text-4xl font-bold">{rep.avg}</div>
              <div className="text-sm text-white/60">/ 5</div>
            </div>
            <div className="mt-2 text-sm text-white/60">
              {rep.count} avaliações registradas
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70 ring-1 ring-white/5">
              Em breve: reputação calculada a partir de avaliações vinculadas a
              ações reais.
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur md:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">
                  Histórico (social do Marto)
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Aqui aparece o rastro real: compras, serviços e avaliações.
                </div>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                MVP
              </span>
            </div>

            <div className="mt-6 grid gap-3">
              <TimelineItem
                title="Perfil criado"
                meta="Conta • agora"
                desc="Sua reputação começa aqui."
              />
              <TimelineItem
                title="Próxima ação"
                meta="Fluxo • recomendado"
                desc="Explore o catálogo, faça um pedido e registre uma avaliação."
              />
              <TimelineItem
                title="Reputação"
                meta="Construção"
                desc="No Marto, reputação vem de experiência real — não de promessa."
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/demo/catalog"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Ver catálogo
              </Link>
              <Link
                href="/demo"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Criar pedido (demo)
              </Link>
              <Link
                href="/review"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Avaliar
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function TimelineItem({
  title,
  meta,
  desc,
}: {
  title: string;
  meta: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-white/55">{meta}</div>
      </div>
      <div className="mt-1 text-sm text-white/65">{desc}</div>
    </div>
  );
}
