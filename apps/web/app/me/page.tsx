// apps/web/app/me/page.tsx
'use client';

import Link from 'next/link';
import Image, { type ImageLoader } from 'next/image';
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

function isValidHttpUrl(url: string) {
  const v = String(url ?? '').trim();
  if (!v) return true; // vazio é ok
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ✅ helper: normaliza avatarUrl pra evitar "null", "undefined" e imagem quebrada
function normalizeAvatarUrl(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s === 'null' || s === 'undefined') return '';
  return s;
}

/**
 * ✅ "Image direto" (sem otimização)
 * loader + unoptimized = o next/image não tenta otimizar, só renderiza a URL direto (igual <img>)
 */
const passthroughLoader: ImageLoader = ({ src }) => src;

function MartoImage({
  src,
  alt,
  size,
  className,
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    <Image
      loader={passthroughLoader}
      unoptimized
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="text-xs font-semibold text-white/65">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white/90">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-white/60">{hint}</div> : null}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white/90">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-white/65">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
      {children}
    </span>
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
    <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="text-xs text-white/60">{meta}</div>
      </div>
      <div className="mt-1 text-sm text-white/70">{desc}</div>
    </div>
  );
}

// ✅ Avatar Marto (placeholder) — usa o SVG do /public (mesmo do login)
function MartoAvatarPlaceholder({ alt }: { alt?: string }) {
  return (
    <MartoImage
      src="/marto-m.svg"
      alt={alt ?? 'Marto'}
      size={64}
      className="h-full w-full object-cover"
    />
  );
}

export default function MyProfilePage() {
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

  // ✅ Upload/remover da foto
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
        const backendAvatarUrl = normalizeAvatarUrl(data?.profile?.avatarUrl);
        const backendHandle = String(data?.profile?.handle ?? '').trim();

        setHandle(backendHandle);

        const email = String(data?.email ?? '').trim();
        const fallbackName = displayNameFromEmail(email);

        setDisplayName(backendDisplayName || fallbackName);

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

  // ✅ avatar normalizado (evita src="null"/"undefined")
  const avatar = normalizeAvatarUrl(avatarUrl);

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

  const effectiveHandle = sanitizeHandle(handle);
  const hasPublicProfile = Boolean(effectiveHandle);

  const stats = useMemo(() => {
    return {
      level: 'Bronze',
      repLabel: 'Prévia de reputação',
      repValue: '—',
      repCount: 0,
      points: '0',
      missions: '0/0',
      cashback: 'R$ 0,00',
      posts: '0',
      reviews: '0',
      followers: '0',
      following: '0',
    };
  }, []);

  // ✅ Convite: copia um link com ref=handle (ou fallback pelo userId)
  async function onInviteFriends() {
    try {
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:3000';

      const code =
        effectiveHandle || (me?.user?.id ? `u_${me.user.id.slice(0, 6)}` : 'marto');
      const link = `${base}/signup?ref=${encodeURIComponent(code)}`;

      await navigator.clipboard.writeText(link);
      setMsg('Link de convite copiado! Envie no WhatsApp/Instagram.');
    } catch {
      setMsg(
        'Não consegui copiar automaticamente. Seu navegador bloqueou a cópia.',
      );
    }
  }

  async function uploadPhoto(file: File) {
    const token = getToken();
    if (!token) {
      setMsg('Você precisa entrar novamente.');
      return;
    }

    try {
      setUploadingPhoto(true);
      setMsg('');

      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = (await res.json()) as {
        ok?: boolean;
        avatarUrl?: string;
        message?: string;
      };

      if (!res.ok || !data?.avatarUrl) {
        throw new Error(data?.message || 'Não foi possível enviar a foto.');
      }

      const next = normalizeAvatarUrl(data.avatarUrl);
      setAvatarUrl(next);
      setMsg('Foto do perfil atualizada.');
    } catch (e: unknown) {
      const err = e as Error;
      setMsg(err?.message ?? 'Não foi possível enviar a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removePhotoServer() {
    const token = getToken();
    if (!token) {
      setMsg('Você precisa entrar novamente.');
      return;
    }

    const ok = window.confirm('Remover foto do perfil?');
    if (!ok) return;

    try {
      setUploadingPhoto(true);
      setMsg('');

      const res = await fetch('/api/me/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = (await res.json()) as { ok?: boolean; message?: string };

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'Não foi possível remover a foto.');
      }

      setAvatarUrl('');
      setMsg('Foto removida.');
    } catch (e: unknown) {
      const err = e as Error;
      setMsg(err?.message ?? 'Não foi possível remover a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

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

      if (!isValidHttpUrl(avatar)) {
        setMsg('Foto do perfil: use um link válido (http/https).');
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
          avatarUrl: avatar,
        }),
      });

      setMsg('Perfil público salvo.');

      setHandle(res.profile.handle ?? '');
      setDisplayName(res.profile.displayName ?? '');
      setBio(res.profile.bio ?? '');

      const next = normalizeAvatarUrl(res.profile.avatarUrl);
      setAvatarUrl(next);

      localStorage.setItem('marto_bio', res.profile.bio ?? '');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar o perfil.');
    } finally {
      setSavingProfile(false);
      setSavingHandle(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_55%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_100%_60%,rgba(255,255,255,0.08),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl p-6">
        {/* Header / Identidade */}
        <div className="rounded-[2rem] border border-white/15 bg-neutral-950/75 p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {/* Avatar (círculo) */}
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
                {avatar ? (
                  <MartoImage
                    src={avatar}
                    alt="Foto do perfil"
                    size={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <MartoAvatarPlaceholder alt="Marto" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{badge}</Pill>
                  <Pill>
                    Nível <span className="text-white/60">•</span> {stats.level}
                  </Pill>
                  <Pill>Porque reputação importa</Pill>
                </div>

                <h1 className="mt-3 truncate text-3xl font-bold tracking-tight text-white/90">
                  {loading ? 'Carregando…' : name}
                </h1>

                <div className="mt-1 text-sm text-white/65">{email}</div>

                <div className="mt-4 text-sm text-white/80">
                  {bio?.trim()
                    ? bio
                    : 'Adicione uma bio curta. No Marto, sua história é feita de ações reais.'}
                </div>

                {!hasPublicProfile ? (
                  <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80 ring-1 ring-white/10">
                    <span className="font-semibold">Ative seu perfil público:</span>{' '}
                    crie um <span className="font-semibold">@handle</span>. Ele é
                    seu link em <span className="font-semibold">/u/seu-handle</span>.
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-white/70">
                    Seu link:{' '}
                    <span className="font-semibold text-white/85">
                      /u/{effectiveHandle}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações principais */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={dashFromHome(me?.home)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Voltar ao painel
              </Link>

              <Link
                href={
                  hasPublicProfile
                    ? `/u/${encodeURIComponent(effectiveHandle)}`
                    : '/me'
                }
                aria-disabled={!hasPublicProfile}
                className={[
                  'rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15',
                  !hasPublicProfile ? 'pointer-events-none opacity-50' : '',
                ].join(' ')}
                title={
                  hasPublicProfile
                    ? 'Abrir seu perfil público'
                    : 'Crie um @handle para ativar'
                }
              >
                Ver perfil público
              </Link>

              {/* ✅ Configurações agora aponta pra /settings */}
              <Link
                href="/profile"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Configurações
              </Link>

              {/* ✅ NOVO: Notificações */}
              <Link
                href="/notifications"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Notificações
              </Link>

              {/* ✅ NOVOS BOTÕES (sem rota nova / sem 404) */}
              <button
                type="button"
                onClick={() =>
                  setMsg(
                    'Criar post: em breve (vamos ligar no fluxo de compra real).',
                  )
                }
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Criar post
              </button>

              <button
                type="button"
                onClick={() => void onInviteFriends()}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Convidar amigos
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem('marto_access');
                  localStorage.removeItem('marto_bio');
                  window.location.href = '/login';
                }}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Sair
              </button>
            </div>
          </div>

          {msg ? (
            <div className="mt-6 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80 ring-1 ring-white/10">
              {msg}
            </div>
          ) : null}
        </div>

        {/* Placar Marto */}
        <div className="mt-6 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <StatCard label="Pontos" value={stats.points} hint="Progresso real" />
          </div>
          <div className="md:col-span-2">
            <StatCard
              label="Missões"
              value={stats.missions}
              hint="Rumo ao próximo nível"
            />
          </div>
          <div className="md:col-span-2">
            <StatCard
              label="Cashback"
              value={stats.cashback}
              hint="Liberado conforme regras"
            />
          </div>

          <div className="md:col-span-2">
            <StatCard
              label="Posts"
              value={stats.posts}
              hint="Experiências registradas"
            />
          </div>
          <div className="md:col-span-2">
            <StatCard
              label="Avaliações"
              value={stats.reviews}
              hint="Qualidade > volume"
            />
          </div>
          <div className="md:col-span-2">
            <StatCard
              label="Seguidores"
              value={`${stats.followers} / ${stats.following}`}
              hint="Seguidores / Seguindo"
            />
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Link
            href="/dash/consumer"
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur hover:bg-white/10"
          >
            <div className="text-sm font-semibold text-white/90">Meu painel</div>
            <div className="mt-1 text-sm text-white/65">
              Volte pro seu fluxo: pedidos, timeline, ações.
            </div>
          </Link>

          <Link
            href="/dash/consumer/orders"
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur hover:bg-white/10"
          >
            <div className="text-sm font-semibold text-white/90">
              Minhas compras
            </div>
            <div className="mt-1 text-sm text-white/65">
              Seu rastro real: pedidos, entregas, devoluções.
            </div>
          </Link>

          <Link
            href="/catalog"
            className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur hover:bg-white/10"
          >
            <div className="text-sm font-semibold text-white/90">
              Explorar catálogo
            </div>
            <div className="mt-1 text-sm text-white/65">
              Descubra produtos e crie sua próxima experiência.
            </div>
          </Link>
        </div>

        {/* Perfil público (edição) */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <SectionCard
              title="Perfil público"
              subtitle="Essas informações aparecem no seu perfil público e no seu painel."
              right={<Pill>MVP</Pill>}
            >
              <div className="grid gap-4">
                {/* ✅ Foto do perfil (UPLOAD) */}
                <div className="rounded-2xl border border-white/15 bg-black/35 p-4 ring-1 ring-white/10">
                  <div>
                    <div className="text-sm font-semibold text-white/85">
                      Foto do perfil
                    </div>
                    <div className="mt-1 text-sm text-white/65">
                      Agora com upload direto no Marto.
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-4">
                    <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
                      {avatar ? (
                        <MartoImage
                          src={avatar}
                          alt="Foto do perfil (prévia)"
                          size={56}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <MartoAvatarPlaceholder alt="Marto" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90">
                          {uploadingPhoto
                            ? 'Enviando…'
                            : avatar
                              ? 'Trocar foto'
                              : 'Enviar foto'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingPhoto}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              void uploadPhoto(f);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          className={[
                            'rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15',
                            !avatar || uploadingPhoto
                              ? 'pointer-events-none opacity-50'
                              : '',
                          ].join(' ')}
                          onClick={() => void removePhotoServer()}
                          disabled={!avatar || uploadingPhoto}
                        >
                          Remover foto
                        </button>
                      </div>

                      <div className="mt-2 text-sm text-white/65">
                        Essa foto aparece no seu perfil público e no seu painel.
                      </div>

                      <div className="mt-2 text-xs text-white/60">
                        Formatos: JPG, PNG, WEBP • até 5MB
                      </div>
                    </div>
                  </div>
                </div>

                {/* @handle */}
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/85">
                    Seu @handle (URL do perfil público)
                  </span>

                  <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/50 px-4 py-3">
                    <span className="text-sm text-white/55">@</span>
                    <input
                      value={handle}
                      onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
                      className="w-full bg-transparent text-white/85 outline-none placeholder:text-white/40"
                      placeholder="ex: joao.uba"
                      autoComplete="off"
                    />
                  </div>

                  <span className="text-xs text-white/60">
                    Aparece como:{' '}
                    <span className="font-semibold text-white/85">
                      /u/{effectiveHandle || 'seu_handle'}
                    </span>
                  </span>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/85">
                    Nome público
                  </span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-white/85 outline-none placeholder:text-white/40 focus:border-white/40"
                    placeholder="Ex: João Silva"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/85">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="min-h-[110px] rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-white/85 outline-none placeholder:text-white/40 focus:border-white/40"
                    placeholder="Uma frase curta sobre você no Marto."
                  />
                  <div className="text-xs text-white/60">
                    Curta, direta, real. Sem exagero. Sem promessa.
                  </div>
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onSaveProfile}
                    disabled={savingProfile || savingHandle}
                    className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
                  >
                    {savingProfile ? 'Salvando…' : 'Salvar perfil'}
                  </button>

                  <Link
                    href={
                      hasPublicProfile
                        ? `/u/${encodeURIComponent(effectiveHandle)}`
                        : '/me'
                    }
                    aria-disabled={!hasPublicProfile}
                    className={[
                      'rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15',
                      !hasPublicProfile ? 'pointer-events-none opacity-50' : '',
                    ].join(' ')}
                    title={
                      hasPublicProfile
                        ? 'Abrir seu perfil público'
                        : 'Crie um @handle para ativar'
                    }
                  >
                    Ver perfil público
                  </Link>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Reputação (prévia) */}
          <div className="md:col-span-1">
            <SectionCard
              title={stats.repLabel}
              subtitle="Em breve: calculada por ações reais."
              right={<Pill>Prévia</Pill>}
            >
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-bold text-white/90">
                  {stats.repValue}
                </div>
                <div className="text-sm text-white/60">/ 5</div>
              </div>
              <div className="mt-2 text-sm text-white/65">
                {stats.repCount} avaliações registradas
              </div>

              <div className="mt-5 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm text-white/70 ring-1 ring-white/10">
                Reputação no Marto não é promessa: é histórico.
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Histórico */}
        <div className="mt-6">
          <SectionCard
            title="Histórico (social do Marto)"
            subtitle="Aqui aparece o rastro real: compras, serviços e avaliações."
            right={<Pill>MVP</Pill>}
          >
            <div className="grid gap-3">
              <TimelineItem
                title="Perfil criado"
                meta="Conta • agora"
                desc="Sua reputação começa aqui."
              />
              <TimelineItem
                title="Próxima ação"
                meta="Fluxo • recomendado"
                desc="Faça um pedido e registre uma avaliação útil."
              />
              <TimelineItem
                title="Regra Marto"
                meta="Essencial"
                desc="Qualidade pesa mais que volume."
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/catalog"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Ver catálogo
              </Link>
              <Link
                href="/dash/consumer/orders"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Ver pedidos
              </Link>
              <Link
                href="/review"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Avaliar
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
