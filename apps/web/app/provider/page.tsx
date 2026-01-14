'use client';

import { useEffect, useRef } from 'react';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function extractSpecialties(payload: unknown): string[] {
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
  const statusRef = useRef<HTMLSpanElement | null>(null);
  const detailsRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const setStatus = (s: string) => {
      if (statusRef.current) statusRef.current.textContent = s;
    };
    const setDetails = (s: string) => {
      if (detailsRef.current) detailsRef.current.textContent = s;
    };

    const token = getToken();

    if (!token) {
      setStatus('sem token → /login');
      window.location.replace('/login');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStatus('checando /api/service-providers/me …');

        const res = await fetch('/api/service-providers/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const text = await res.text();

        if (cancelled) return;

        setDetails(
          `HTTP ${res.status}\n\nBODY (primeiros 800 chars):\n${text.slice(0, 800)}`,
        );

        if (res.status === 401) {
          setStatus('401 → /login');
          window.location.replace('/login');
          return;
        }

        if (!res.ok) {
          setStatus(`${res.status} → onboarding`);
          window.location.replace('/dash/provider/onboarding/services');
          return;
        }

        let data: unknown = null;
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          setStatus('resposta não-JSON → onboarding');
          window.location.replace('/dash/provider/onboarding/services');
          return;
        }

        const specialties = extractSpecialties(data);

        if (specialties.length) {
          setStatus(`ok → central (specialties: ${specialties.join(', ')})`);
          window.location.replace('/dash/provider/services');
          return;
        }

        setStatus('sem specialties → onboarding');
        window.location.replace('/dash/provider/onboarding/services');
      } catch (e) {
        if (cancelled) return;
        setStatus('erro na requisição → onboarding');
        setDetails(String((e as Error)?.message ?? e));
        window.location.replace('/dash/provider/onboarding/services');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-neutral-900">
          Provider entry
        </div>

        <p className="mt-2 text-sm text-neutral-700">
          Status: <span ref={statusRef} className="font-medium">iniciando…</span>
        </p>

        <pre
          ref={detailsRef}
          className="mt-4 whitespace-pre-wrap rounded-xl border bg-neutral-50 p-3 text-xs text-neutral-800"
        >
          (sem detalhes ainda)
        </pre>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.replace('/dash/provider/services')}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Forçar Central
          </button>
          <button
            type="button"
            onClick={() =>
              window.location.replace('/dash/provider/onboarding/services')
            }
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Forçar Onboarding
          </button>
        </div>
      </div>
    </main>
  );
}
