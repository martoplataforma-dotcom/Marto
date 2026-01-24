// apps/web/app/notifications/page.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Kind = 'ALL' | 'ORDERS' | 'SHIPMENTS' | 'SOCIAL' | 'SERVICES';

type Notif = {
  id: string;
  kind: Exclude<Kind, 'ALL'>;
  title: string;
  desc: string;
  createdAt: string; // iso
  unread: boolean;
  href?: string;
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('pt-BR');
  } catch {
    return dt;
  }
}

function pillForKind(kind: Notif['kind']) {
  if (kind === 'ORDERS')
    return 'border-violet-500/25 bg-violet-500/10 text-violet-100';
  if (kind === 'SHIPMENTS')
    return 'border-sky-500/25 bg-sky-500/10 text-sky-100';
  if (kind === 'SOCIAL')
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100';
  return 'border-amber-500/25 bg-amber-500/10 text-amber-100';
}

function labelForKind(kind: Notif['kind']) {
  if (kind === 'ORDERS') return 'Pedido';
  if (kind === 'SHIPMENTS') return 'Entrega';
  if (kind === 'SOCIAL') return 'Social';
  return 'Serviço';
}

function tabLabel(k: Kind) {
  if (k === 'ALL') return 'Tudo';
  if (k === 'ORDERS') return 'Pedidos';
  if (k === 'SHIPMENTS') return 'Entregas';
  if (k === 'SOCIAL') return 'Social';
  return 'Serviços';
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<Kind>('ALL');

  // ✅ MVP UI: exemplos (depois vira fetch)
  const [items, setItems] = useState<Notif[]>(() => [
    {
      id: 'n1',
      kind: 'ORDERS',
      title: 'Pedido pago',
      desc: 'Sua compra foi confirmada. Agora a loja precisa avançar o status.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      unread: true,
      href: '/dash/consumer/orders',
    },
    {
      id: 'n2',
      kind: 'SHIPMENTS',
      title: 'Entrega em trânsito',
      desc: 'A transportadora atualizou o status. Acompanhe a timeline do pedido.',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      unread: true,
      href: '/dash/consumer/orders',
    },
    {
      id: 'n3',
      kind: 'SOCIAL',
      title: 'Experiência verificada disponível',
      desc: 'Sua compra foi entregue. Transforme em post verificado e registre a realidade.',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      unread: false,
      href: '/dash/consumer/orders',
    },
  ]);

  const filtered = useMemo(() => {
    if (tab === 'ALL') return items;
    return items.filter((n) => n.kind === tab);
  }, [items, tab]);

  const unreadCount = useMemo(
    () => items.filter((n) => n.unread).length,
    [items],
  );

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  function toggleRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n)),
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* fundo Marto */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">
                Notificações
              </h1>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                {unreadCount} não lida{unreadCount === 1 ? '' : 's'}
              </span>
            </div>

            <p className="mt-1 text-sm text-white/75">
              Sem feed infinito. Só consequência de ações reais.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Marcar tudo como lido
            </button>

            <Link
              href="/me"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              Voltar
            </Link>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(['ALL', 'ORDERS', 'SHIPMENTS', 'SOCIAL', 'SERVICES'] as Kind[]).map(
            (k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                  tab === k
                    ? 'border-white/25 bg-white/15 text-white'
                    : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/15',
                ].join(' ')}
              >
                {tabLabel(k)}
              </button>
            ),
          )}
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <section className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="text-sm font-semibold text-white/90">
              Caixa de entrada
            </div>
            <div className="mt-1 text-sm text-white/70">
              Nada por aqui nesse filtro.
            </div>

            <div className="mt-5 rounded-2xl border border-white/15 bg-black/40 p-5 text-sm text-white/80 ring-1 ring-white/10">
              Sem notificações.
            </div>
          </section>
        ) : (
          <div className="grid gap-3">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={[
                  'rounded-3xl border bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur',
                  n.unread ? 'border-white/25' : 'border-white/15',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${pillForKind(
                          n.kind,
                        )}`}
                      >
                        {labelForKind(n.kind)}
                      </span>

                      {n.unread ? (
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                          não lida
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm font-semibold text-white/90">
                      {n.title}
                    </div>
                    <div className="mt-1 text-sm text-white/70">{n.desc}</div>

                    <div className="mt-3 text-xs text-white/60">
                      {fmt(n.createdAt)}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRead(n.id)}
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                    >
                      {n.unread ? 'Marcar como lida' : 'Marcar como não lida'}
                    </button>

                    {n.href ? (
                      <Link
                        href={n.href}
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:opacity-90"
                      >
                        Abrir →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 text-xs text-white/65">
          (MVP) Próximo: substituir esses exemplos por eventos reais do backend.
        </div>
      </div>
    </main>
  );
}
