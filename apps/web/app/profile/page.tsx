// apps/web/app/profile/page.tsx
'use client';

import Link from 'next/link';
import Image, { type ImageLoader } from 'next/image';
import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../src/lib/api';
import { MerchantProfileSection } from './_sections/merchant';
import { ConsumerPrefsSection } from './_sections/consumer';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type Consumer = {
  city?: string | null;
  cepPrefix?: string | null;
};


type Home =
  | 'consumer'
  | 'merchant'
  | 'service_provider'
  | 'representative'
  | 'factory';

type MeResponse = {
  email?: string;
  home?: Home;
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

function dashboardFromHome(home?: Home | null) {
  switch (home) {
    case 'merchant':
      return '/dash/merchant';
    case 'factory':
      return '/dash/factory';
    case 'service_provider':
      return '/dash/provider/services';
    case 'representative':
      return '/dash/representative';
    case 'consumer':
    default:
      return '/dash/consumer';
  }
}

function labelFromHome(home?: Home | null) {
  return home === 'merchant'
    ? 'Lojista'
    : home === 'factory'
      ? 'Fabricante'
      : home === 'service_provider'
        ? 'Prestador'
        : home === 'representative'
          ? 'Representante'
          : 'Consumidor';
}

// ✅ sanitize do @handle
function sanitizeHandle(raw: string) {
  return String(raw ?? '')
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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);

  // mensagens
  const [msg, setMsg] = useState('');

  // ✅ home + handle + email
  const [home, setHome] = useState<Home | null>(null);

  // ---------- Perfil público (UNIVERSAL) ----------
  const [savingPublic, setSavingPublic] = useState(false);

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // upload/remover
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ---------- Preferências do Consumidor (CONDICIONAL) ----------
  const [consumerCity, setConsumerCity] = useState('');
  const [consumerCepPrefix, setConsumerCepPrefix] = useState('');

  const effectiveHandle = sanitizeHandle(handle);
  const hasPublicProfile = Boolean(effectiveHandle);

  const badge = labelFromHome(home);
  const dashboardHref = dashboardFromHome(home);

  const avatar = normalizeAvatarUrl(avatarUrl);

  useEffect(() => {
    (async () => {
      setMsg('');
      const token = getToken();
      if (!token) {
        setMsg('Sem token. Faça login novamente.');
        setLoading(false);
        return;
      }

      try {
        // ✅ 1) /me (fonte da verdade: home + perfil público)
        const data = await fetchJSON<MeResponse>('/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const h =
          data?.home === 'consumer' ||
          data?.home === 'merchant' ||
          data?.home === 'service_provider' ||
          data?.home === 'representative' ||
          data?.home === 'factory'
            ? data.home
            : null;

        setHome(h);

        // preenche perfil público (universal)
        const backendHandle = String(data?.profile?.handle ?? '').trim();
        const backendDisplayName = String(data?.profile?.displayName ?? '').trim();
        const backendBio = String(data?.profile?.bio ?? '').trim();
        const backendAvatar = normalizeAvatarUrl(data?.profile?.avatarUrl);

        setHandle(backendHandle);
        setDisplayName(backendDisplayName);
        setBio(backendBio);
        setAvatarUrl(backendAvatar);

        // ✅ 2) se for consumidor, carrega prefs consumer
        if (!h || h === 'consumer') {
          const prefs = await fetchJSON<Consumer>('/consumers/me', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });

          setConsumerCity(prefs.city ?? '');
          setConsumerCepPrefix(prefs.cepPrefix ?? '');
        }
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar suas configurações.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- PERFIL PÚBLICO (UNIVERSAL) ----------
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

  async function onSavePublicProfile() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Sem token. Faça login novamente.');
      return;
    }

    const nextHandle = sanitizeHandle(handle);
    const nextName = displayName.trim();
    const nextBio = bio.trim();

    if (!isValidHttpUrl(avatar)) {
      setMsg('Foto do perfil: use um link válido (http/https).');
      return;
    }

    setSavingPublic(true);
    try {
      const res = await fetchJSON<UpdateProfileResponse>('/me/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle: nextHandle,
          displayName: nextName || null,
          bio: nextBio || null,
          avatarUrl: avatar || null,
        }),
      });

      setHandle(res.profile.handle ?? '');
      setDisplayName(res.profile.displayName ?? '');
      setBio(res.profile.bio ?? '');
      setAvatarUrl(normalizeAvatarUrl(res.profile.avatarUrl));

      setMsg('Perfil público salvo.');
      setTimeout(() => setMsg(''), 2200);
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar o perfil público.');
    } finally {
      setSavingPublic(false);
    }
  }

  const showConsumerPrefs = !home || home === 'consumer';

  // 1) Novas flags de papel (condicionais)
  const showMerchantModule = home === 'merchant';
  const showFactoryModule = home === 'factory';
  const showProviderModule = home === 'service_provider';
  const showRepModule = home === 'representative';

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div
        className="pointer-events-none fixed inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="pointer-events-none fixed -top-48 left-1/2 h-[32rem] w-[62rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none fixed top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none fixed top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />

      {/* HERO */}
      <header className="relative">
        <div className="relative mx-auto max-w-6xl p-6 pt-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-neutral-950/75 px-3 py-1 text-xs font-semibold text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                Configurações • {badge}
                <span className="opacity-60">•</span>
                Porque reputação importa
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Configurações
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Privado por padrão. Público só quando faz sentido: consequência do
                histórico.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={dashboardHref}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Voltar ao dashboard
              </Link>

              <Link
                href="/me"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Minha conta
              </Link>
            </div>
          </div>

          {hasPublicProfile ? (
            <div className="mt-4 text-xs text-white/65">
              Seu perfil público:{' '}
              <span className="font-semibold text-white/85">
                /u/{effectiveHandle}
              </span>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <span className="font-semibold">Perfil público desativado:</span>{' '}
              crie um <span className="font-semibold">@handle</span> em{' '}
              <a href="#publico" className="font-semibold underline">
                Perfil público
              </a>
              .
            </div>
          )}

          {msg ? (
            <div className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 px-4 py-3 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              {msg}
            </div>
          ) : null}
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-6xl p-6 pb-10">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* SIDEBAR */}
          <aside className="lg:col-span-4">
            <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="text-sm font-semibold text-white/90">Seções</div>

              <div className="mt-4 grid gap-2 text-sm">
                <a
                  href="#publico"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  Perfil público
                  <div className="mt-1 text-xs text-white/65">
                    @handle, bio, foto
                  </div>
                </a>

                {/* Módulos por papel */}
                {showMerchantModule ? (
                  <a
                    href="#lojista"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Lojista
                    <div className="mt-1 text-xs text-white/65">
                      loja, vitrine, identidade comercial
                    </div>
                  </a>
                ) : null}

                {showFactoryModule ? (
                  <a
                    href="#fabrica"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Fábrica
                    <div className="mt-1 text-xs text-white/65">
                      perfil e configurações industriais
                    </div>
                  </a>
                ) : null}

                {showProviderModule ? (
                  <a
                    href="#prestador"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Prestador
                    <div className="mt-1 text-xs text-white/65">
                      perfil profissional e serviços
                    </div>
                  </a>
                ) : null}

                {showRepModule ? (
                  <a
                    href="#representante"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Representante
                    <div className="mt-1 text-xs text-white/65">
                      regiões e carteira
                    </div>
                  </a>
                ) : null}

                {/* (Recomendado) esconder Preferências quando não for consumer */}
                {showConsumerPrefs ? (
                  <a
                    href="#preferencias"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                  >
                    Preferências (Consumidor)
                    <div className="mt-1 text-xs text-white/65">CEP + sugestões</div>
                  </a>
                ) : null}

                <a
                  href="#pagamentos"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  Pagamentos
                  <div className="mt-1 text-xs text-white/65">
                    Marto Pay (em breve)
                  </div>
                </a>

                <a
                  href="#documentos"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  Documentos
                  <div className="mt-1 text-xs text-white/65">
                    CPF/telefone (em breve)
                  </div>
                </a>

                <a
                  href="#seguranca"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  Segurança
                  <div className="mt-1 text-xs text-white/65">
                    email, senha, sessões
                  </div>
                </a>
              </div>

              <div className="mt-6 rounded-2xl border border-white/15 bg-black/25 p-4 text-xs text-white/70 ring-1 ring-white/5">
                Marto: dados da conta são privados. O público é consequência real —
                não currículo.
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <section className="lg:col-span-8">
            {/* Perfil público (UNIVERSAL) */}
            <div
              id="publico"
              className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white/90">
                    Perfil público
                  </h2>
                  <p className="mt-1 text-sm text-white/70">
                    {hasPublicProfile
                      ? 'Seu link público. Não é currículo: é consequência do histórico.'
                      : 'Crie seu @handle para ter um link único. Público só quando faz sentido.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {hasPublicProfile ? (
                    <Link
                      href={`/u/${encodeURIComponent(effectiveHandle)}`}
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Abrir público
                    </Link>
                  ) : (
                    <a
                      href="#publico"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Ativar aqui
                    </a>
                  )}

                  <button
                    onClick={onSavePublicProfile}
                    disabled={
                      loading || savingPublic || uploadingPhoto || !effectiveHandle
                    }
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
                  >
                    {savingPublic
                      ? 'Salvando…'
                      : hasPublicProfile
                        ? 'Salvar público'
                        : 'Criar meu @handle'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {/* Foto do perfil (UPLOAD) */}
                <div className="rounded-2xl border border-white/15 bg-black/25 p-4 ring-1 ring-white/5">
                  <div className="text-sm font-semibold text-white/90">Foto</div>
                  <div className="mt-1 text-sm text-white/65">
                    Aparece no público e em partes do ecossistema.
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

                      <div className="mt-2 text-xs text-white/60">
                        Formatos: JPG, PNG, WEBP • até 5MB
                      </div>
                    </div>
                  </div>
                </div>

                {/* @handle */}
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/85">
                    Seu @handle (URL pública)
                  </span>

                  <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/80 px-4 py-3">
                    <span className="text-sm text-white/55">@</span>
                    <input
                      value={handle}
                      onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
                      className="w-full bg-transparent text-white/85 outline-none placeholder:text-white/35"
                      placeholder="ex: joao.uba"
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>

                  <span className="text-xs text-white/60">
                    Aparece como:{' '}
                    <span className="font-semibold text-white/85">
                      /u/{effectiveHandle || 'seu_handle'}
                    </span>
                  </span>
                  {!effectiveHandle ? (
                    <div className="text-xs text-white/60">
                      Defina um @handle para ativar seu link público.
                    </div>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/85">
                    Nome público
                  </span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white/85 outline-none placeholder:text-white/35 focus:border-white/35"
                    placeholder="Ex: João Silva"
                    disabled={loading}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white/85">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="min-h-[110px] rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white/85 outline-none placeholder:text-white/35 focus:border-white/35"
                    placeholder="Uma frase curta sobre você no Marto."
                    disabled={loading}
                  />
                  <div className="text-xs text-white/60">
                    Curta, direta, real. Sem exagero. Sem promessa.
                  </div>
                </label>
              </div>
            </div>

            {/* Lojista (CONDICIONAL) */}
            {showMerchantModule ? <MerchantProfileSection /> : null}

            {/* (Opcional) Placeholders para evitar link morto */}
            {showFactoryModule ? (
              <div
                id="fabrica"
                className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">Fábrica</h2>
                    <p className="mt-1 text-sm text-white/70">
                      Configurações industriais e identidade do fabricante.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                    em breve
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                  Este módulo vai consolidar dados do fabricante (marca, políticas,
                  qualidade e presença). Por enquanto, use o painel.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/dash/factory"
                    className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Abrir painel da fábrica
                  </Link>
                </div>
              </div>
            ) : null}

            {showProviderModule ? (
              <div
                id="prestador"
                className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">Prestador</h2>
                    <p className="mt-1 text-sm text-white/70">
                      Perfil profissional, serviços e disponibilidade.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                    em breve
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                  Este módulo vai centralizar identidade do prestador e parâmetros
                  de serviço. Por enquanto, use o painel.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/dash/provider/services"
                    className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Abrir painel do prestador
                  </Link>
                </div>
              </div>
            ) : null}

            {showRepModule ? (
              <div
                id="representante"
                className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">
                      Representante
                    </h2>
                    <p className="mt-1 text-sm text-white/70">
                      Regiões, carteira e presença comercial.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                    em breve
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                  Este módulo vai consolidar regiões, metas e carteira. Por
                  enquanto, use o painel.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/dash/representative"
                    className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Abrir painel do representante
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Preferências do Consumidor (CONDICIONAL) */}
            {showConsumerPrefs ? (
              <ConsumerPrefsSection
                home={home ?? null}
                loading={loading}
                onMsg={setMsg}
                initialCity={consumerCity}
                initialCepPrefix={consumerCepPrefix}
              />
            ) : null}

            {/* Pagamentos (em breve) */}
            <div
              id="pagamentos"
              className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white/90">
                    Pagamentos
                  </h2>
                  <p className="mt-1 text-sm text-white/70">
                    Cartões e métodos no Marto Pay. Sem fricção.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                  em breve
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                Quando ativarmos o Marto Pay, você gerencia seus métodos aqui.
              </div>
            </div>

            {/* Documentos (em breve) */}
            <div
              id="documentos"
              className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white/90">
                    Documentos
                  </h2>
                  <p className="mt-1 text-sm text-white/70">
                    CPF e dados sensíveis ficam aqui — privados.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                  em breve
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/75 ring-1 ring-white/5">
                Isso não aparece no seu perfil público. Serve para compras,
                notas e segurança.
              </div>
            </div>

            {/* Segurança (em breve) */}
            <div
              id="seguranca"
              className="mt-6 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white/90">
                    Segurança
                  </h2>
                  <p className="mt-1 text-sm text-white/70">
                    Em breve: confirmar email, trocar senha e sessões.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                  em breve
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white/90">
                    Confirmação de email
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    Vai virar requisito para recursos sensíveis (carteira, saque).
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white/90">
                    Sessões e dispositivos
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    Em breve: ver onde sua conta está logada.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
