'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function extractSpecialties(payload: unknown): string[] {
  // Seu backend pode retornar:
  // A) objeto direto do prisma { ..., specialties: [...] }
  // B) wrapper { ok: true, serviceProvider: { specialties: [...] } }
  if (!isObj(payload)) return [];

  const direct = payload.specialties;
  if (Array.isArray(direct)) return direct.map(String).filter(Boolean);

  const sp = payload.serviceProvider;
  if (isObj(sp) && Array.isArray(sp.specialties)) {
    return sp.specialties.map(String).filter(Boolean);
  }

  return [];
}

export default function ProviderEntryPage() {
  const router = useRouter();
  const ranRef = useRef(false);

  useEffect(() => {
    // evita rodar 2x em dev/strict
    if (ranRef.current) return;
    ranRef.current = true;

    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    (async () => {
      try {
        // ✅ usa /api pra passar no rewrite do Next
        const res = await fetch('/api/service-providers/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          router.replace('/login');
          return;
        }

        // se ainda não tem perfil/me → onboarding
        if (!res.ok) {
          router.replace('/dash/provider/onboarding/services');
          return;
        }

        const data: unknown = await res.json();
        const specialties = extractSpecialties(data);

        // ✅ se já tem specialties no BANCO, vai direto pra Central
        if (specialties.length) {
          router.replace('/dash/provider/services');
          return;
        }

        // sem specialties -> onboarding
        router.replace('/dash/provider/onboarding/services');
      } catch {
        router.replace('/dash/provider/onboarding/services');
      }
    })();
  }, [router]);

  // UI mínima (quase não aparece porque redireciona)
  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-neutral-900">
          Abrindo seu painel…
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          Se você já configurou suas especialidades, o Marto te leva direto pra
          Central.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dash/provider/services"
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ir para Central
          </Link>
          <Link
            href="/dash/provider/onboarding/services"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Ajustar especialidades
          </Link>
        </div>
      </div>
    </main>
  );
}