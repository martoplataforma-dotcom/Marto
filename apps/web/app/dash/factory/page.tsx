'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';
import { LogoutButton } from '../../../src/components/LogoutButton';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

type FactoryMeResponse = {
  ok: boolean;
  factory: {
    id: string;
    userId: string;
    tradeName: string;
    legalName: string | null;
    document: string;
    city: string | null;
    state: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type SaveResponse =
  | { ok: true; factory: unknown }
  | { ok: false; message?: string };

function formatCnpjDigits(digits: string) {
  const d = String(digits ?? '')
    .replace(/\D/g, '')
    .slice(0, 14);

  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(
      /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
      '$1.$2.$3/$4-$5',
    );
}

export default function FactoryDash() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // ✅ NOVO: controla abrir/fechar o formulário
  const [showInfo, setShowInfo] = useState(false);

  const [form, setForm] = useState({
    tradeName: '',
    legalName: '',
    document: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMsg('');

        const token = getToken();
        if (!token) {
          setMsg('Sem token. Faça login primeiro.');
          return;
        }

        const data = await fetchJSON<FactoryMeResponse>(`/factories/me`, {
          method: 'GET',
        });

        const f = data?.factory ?? null;

        if (f) {
          setForm({
            tradeName: f.tradeName ?? '',
            legalName: f.legalName ?? '',
            document: formatCnpjDigits(f.document ?? ''),
            city: f.city ?? '',
            state: f.state ?? '',
          });
        }
      } catch (e) {
        const a = e as ApiError;
        setMsg(`${a.status} - ${a.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSave() {
    try {
      setSaving(true);
      setMsg('');

      const token = getToken();
      if (!token) {
        setMsg('Sem token. Faça login primeiro.');
        return;
      }

      const payload = {
        tradeName: String(form.tradeName ?? '').trim(),
        legalName: String(form.legalName ?? '').trim() || null,
        document: String(form.document ?? '').trim(),
        city: String(form.city ?? '').trim() || null,
        state: String(form.state ?? '').trim() || null,
      };

      const res = await fetchJSON<SaveResponse>(`/factories/me`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!res || res.ok !== true) {
        setMsg(res?.message ?? 'Falha ao salvar.');
        return;
      }

      setMsg('✅ Salvo com sucesso!');
      setShowInfo(false); // opcional: fecha depois de salvar
    } catch (e) {
      const a = e as ApiError;
      setMsg(`${a.status} - ${a.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      {/* ===== FUNDO MARTO (GRID + GLOWS) ===== */}
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

      {/* ===== CONTEÚDO ===== */}
      <div className="relative z-10 mx-auto max-w-5xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard • Fabricante</h1>

            <div className="mt-1 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              Papel principal:{' '}
              <span className="ml-1 font-semibold text-white">Fabricante</span>
            </div>

            <p className="text-sm text-white/65">
              Gerencie o perfil da sua fábrica (trade name, CNPJ, cidade/estado).
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/me"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Conta
            </Link>

            {/* ✅ ALTERAÇÃO PEDIDA: Perfil público agora vai pra /me */}
            <Link
              href="/me"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Perfil público
            </Link>

            <LogoutButton
              redirectTo="/login"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            />
          </nav>
        </header>

        {msg ? (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            {msg}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10">
            <h2 className="text-base font-semibold text-white">Catálogo</h2>

            <p className="mt-1 text-sm text-white/65">
              Gerencie os produtos fabricados e disponibilizados no Marto.
            </p>

            <div className="mt-4">
              <Link
                href="/dash/factory/catalog"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Acessar catálogo
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10">
            <h2 className="text-base font-semibold text-white">Pedidos</h2>

            <p className="mt-1 text-sm text-white/65">
              Acompanhe pedidos realizados e a demanda pelos seus produtos.
            </p>

            <div className="mt-4">
              <Link
                href="/dash/factory/orders"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Ver pedidos
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10">
            <h2 className="text-base font-semibold text-white">
              Representantes
            </h2>

            <p className="mt-1 text-sm text-white/65">
              Gerencie sua rede comercial, convites e regiões.
            </p>

            <div className="mt-4">
              <Link
                href="/dash/factory/representatives"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Gerenciar representantes
              </Link>
            </div>
          </div>
        </section>

        <p className="mb-4 text-sm text-white/65">
          Essas informações identificam sua fábrica dentro do Marto. Elas serão
          usadas em catálogos, serviços e relações comerciais.
        </p>

        {/* ✅ FORM CONTAINER */}
        <section className="rounded-2xl border border-white/10 bg-white/5">
          {/* ✅ header com Editar/Fechar + Salvar */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Informações da fábrica
              </h2>
              <p className="text-xs text-white/55">
                Base institucional usada no ecossistema Marto.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
              >
                {showInfo ? 'Fechar' : 'Editar'}
              </button>

              <button
                onClick={onSave}
                disabled={loading || saving || !showInfo}
                className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-60"
                title={!showInfo ? 'Abra em Editar para salvar' : undefined}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>

          {/* ✅ conteúdo condicional */}
          {showInfo ? (
            <>
              <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">
                    Nome fantasia
                  </span>
                  <input
                    value={form.tradeName}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, tradeName: e.target.value }))
                    }
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">
                    Razão social
                  </span>
                  <input
                    value={form.legalName}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, legalName: e.target.value }))
                    }
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">CNPJ</span>
                  <input
                    value={form.document}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        document: formatCnpjDigits(e.target.value),
                      }))
                    }
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">
                    Cidade
                  </span>
                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, city: e.target.value }))
                    }
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-white/85">
                    Estado
                  </span>
                  <input
                    value={form.state}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, state: e.target.value }))
                    }
                    maxLength={2}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </label>
              </div>

              <div className="px-4 pb-4 text-xs text-white/55">
                Dica: o CNPJ será salvo só com dígitos no backend.
              </div>
            </>
          ) : (
            <div className="px-4 py-4 text-sm text-white/65">
              Configuração avançada. Abra em <b>Editar</b> para revisar e
              atualizar os dados institucionais.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
