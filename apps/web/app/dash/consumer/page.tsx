// apps/web/app/dash/consumer/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, type ApiError } from '../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

function scrollToId(id: string) {
  if (typeof window === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

type Consumer = {
  city?: string | null;
  cepPrefix?: string | null;
};

type MeResponse = {
  profile?: { handle?: string | null };
};

type Mission = {
  id: string;
  title: string;
  desc: string;
  done: boolean;
  verified?: boolean;

  // ✅ CTA real
  href?: string;
  cta?: string;
};

type QuickAction = {
  eyebrow: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  highlight?: boolean;
};

type InspoItem = {
  id: string;
  title: string;
  meta: string;
  desc: string;
  badge: 'verificado';
  href: string;
  cta: string;
};

function safeIsoToDateMs(s: unknown): number {
  if (typeof s !== 'string') return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function getOrderId(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const id = r.id;
  if (typeof id === 'string' && id.trim()) return id.trim();
  return null;
}

function getOrderStatus(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const st = r.status;
  if (typeof st === 'string' && st.trim()) return st.trim();
  return null;
}

function getOrderCreatedAt(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const c = r.createdAt;
  if (typeof c === 'string' && c.trim()) return c.trim();
  return null;
}

function getShipmentReviewFlag(sh: unknown): boolean {
  if (!sh || typeof sh !== 'object') return false;
  const r = sh as Record<string, unknown>;
  return Boolean(r.review || r.reviewedAt);
}

function getShipmentStatus(sh: unknown): string | null {
  if (!sh || typeof sh !== 'object') return null;
  const r = sh as Record<string, unknown>;
  const st = r.status;
  if (typeof st === 'string' && st.trim()) return st.trim();
  return st ? String(st) : null;
}

function humanOrderStatus(status: string | null): string {
  const s = (status ?? '').toUpperCase();
  if (!s) return 'Status desconhecido';
  if (s === 'CREATED') return 'Pedido criado';
  if (s === 'PAID') return 'Pagamento confirmado';
  if (s === 'CONFIRMED_BY_SELLER') return 'Confirmado pelo lojista';
  if (s === 'IN_TRANSIT') return 'Em trânsito';
  if (s === 'DELIVERED') return 'Entregue';
  if (s === 'COMPLETED') return 'Concluído';
  if (s === 'CANCELLED') return 'Cancelado';
  if (s === 'RETURN_REQUESTED') return 'Devolução solicitada';
  if (s === 'RETURNED') return 'Devolvido';
  return `Status: ${status}`;
}

function getShipmentStatusLabel(status: string | null): string | null {
  const s = (status ?? '').toUpperCase();
  if (!s) return null;
  if (s === 'CREATED') return 'Entrega criada';
  if (s === 'PICKUP_READY') return 'Pronto para coleta';
  if (s === 'IN_TRANSIT') return 'Em trânsito';
  if (s === 'DELIVERED') return 'Entregue';
  if (s === 'CANCELLED') return 'Entrega cancelada';
  return null;
}

function buildRastroInspo(params: {
  orderId: string | null;
  orderStatus: string | null;
  orderCreatedAt: string | null;
  shipmentStatus: string | null;
  reviewed: boolean;
}): InspoItem[] {
  const { orderId, orderStatus, orderCreatedAt, shipmentStatus, reviewed } =
    params;

  if (!orderId) {
    return [
      {
        id: 'r-0',
        title: 'Comece pelo ciclo completo',
        meta: 'Rastro • primeiro passo',
        desc: 'Explore o catálogo e faça um pedido de teste. O Marto vira “social” quando existe ação real.',
        badge: 'verificado',
        href: '/catalog',
        cta: 'Explorar catálogo →',
      },
    ];
  }

  const createdAtMs = safeIsoToDateMs(orderCreatedAt);
  const metaTime =
    createdAtMs > 0
      ? `Último pedido • ${new Date(createdAtMs).toLocaleDateString('pt-BR')}`
      : 'Último pedido';

  const items: InspoItem[] = [];

  items.push({
    id: 'r-1',
    title: 'Ver timeline do seu último pedido',
    meta: metaTime,
    desc: 'Pedido + entrega + eventos. Aqui nasce a confiança.',
    badge: 'verificado',
    href: `/dash/consumer/orders/${orderId}`,
    cta: 'Abrir timeline →',
  });

  items.push({
    id: 'r-2',
    title: humanOrderStatus(orderStatus),
    meta: 'Pedido • rastro real',
    desc: 'Seu estado atual registrado no sistema (sem achismo).',
    badge: 'verificado',
    href: `/dash/consumer/orders/${orderId}`,
    cta: 'Ver detalhes →',
  });

  if (shipmentStatus) {
    items.push({
      id: 'r-3',
      title:
        getShipmentStatusLabel(shipmentStatus) ?? `Entrega: ${shipmentStatus}`,
      meta: 'Entrega • logística',
      desc: 'Acompanhe a entrega vinculada ao seu pedido.',
      badge: 'verificado',
      href: `/dash/consumer/orders/${orderId}`,
      cta: 'Ver entrega →',
    });
  }

  const orderIsDelivered =
    (orderStatus ?? '').toUpperCase() === 'DELIVERED' ||
    (orderStatus ?? '').toUpperCase() === 'COMPLETED' ||
    (shipmentStatus ?? '').toUpperCase() === 'DELIVERED';

  if (orderIsDelivered && !reviewed) {
    items.push({
      id: 'r-4',
      title: 'Avaliação pendente (fecha o ciclo)',
      meta: 'Experiência • vinculada',
      desc: 'Avaliações vinculadas viram reputação real e ajudam você e todo mundo.',
      badge: 'verificado',
      href: '/review',
      cta: 'Avaliar agora →',
    });
  }

  if (reviewed) {
    items.push({
      id: 'r-5',
      title: 'Repetir o que foi bom',
      meta: 'Recorrência • decisão segura',
      desc: 'Use o rastro pra comprar/contratar com menos risco.',
      badge: 'verificado',
      href: '/catalog',
      cta: 'Explorar →',
    });
  }

  return items.slice(0, 6);
}

export default function ConsumerDash() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const [city, setCity] = useState('');
  const [cepPrefix, setCepPrefix] = useState('');

  const [publicHandle, setPublicHandle] = useState<string | null>(null);

  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [reviewsCount, setReviewsCount] = useState<number | null>(null);

  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // ✅ NOVO: pendências de avaliação (shipments DELIVERED sem review)
  const [reviewPendenciesCount, setReviewPendenciesCount] = useState<
    number | null
  >(null);

  const [lastOrderMeta, setLastOrderMeta] = useState<{
    id: string;
    status: string;
    createdAt?: string | null;
  } | null>(null);

  const [lastShipmentMeta, setLastShipmentMeta] = useState<{
    id: string;
    status: string;
    createdAt?: string | null;
    reviewed?: boolean;
  } | null>(null);

  const [missions, setMissions] = useState<Mission[]>([]);

  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderStatus, setLastOrderStatus] = useState<string | null>(null);
  const [lastOrderCreatedAt, setLastOrderCreatedAt] = useState<string | null>(
    null,
  );
  const [lastShipmentStatus, setLastShipmentStatus] = useState<string | null>(
    null,
  );
  const [lastShipmentReviewed, setLastShipmentReviewed] =
    useState<boolean>(false);

  const canSave = useMemo(() => {
    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) return false;
    return true;
  }, [cepPrefix]);

  const rastroInspo: InspoItem[] = useMemo(() => {
    return buildRastroInspo({
      orderId: lastOrderId,
      orderStatus: lastOrderStatus,
      orderCreatedAt: lastOrderCreatedAt,
      shipmentStatus: lastShipmentStatus,
      reviewed: lastShipmentReviewed,
    });
  }, [
    lastOrderId,
    lastOrderStatus,
    lastOrderCreatedAt,
    lastShipmentStatus,
    lastShipmentReviewed,
  ]);

  const inspoHeader = useMemo(() => {
    if (!lastOrderId) {
      return {
        badge: 'sem rastro',
        title: 'Inspirações reais',
        desc: 'Comece pelo ciclo completo: ação real → rastro → confiança.',
        ctaHref: '/catalog',
        ctaLabel: 'Explorar catálogo →',
      };
    }

    const os = (lastOrderStatus ?? '').toUpperCase();
    const ss = (lastShipmentStatus ?? '').toUpperCase();

    const delivered =
      os === 'DELIVERED' || os === 'COMPLETED' || ss === 'DELIVERED';

    if (delivered && !lastShipmentReviewed) {
      return {
        badge: 'entregue',
        title: 'Feche o ciclo',
        desc: 'Sua entrega foi concluída. Agora a avaliação vira reputação real.',
        ctaHref: '/review',
        ctaLabel: 'Avaliar agora →',
      };
    }

    if (delivered && lastShipmentReviewed) {
      return {
        badge: 'entregue',
        title: 'Repetir o que foi bom',
        desc: 'Use seu rastro e avaliações pra comprar/contratar com menos risco.',
        ctaHref: '/catalog',
        ctaLabel: 'Explorar →',
      };
    }

    return {
      badge: 'em andamento',
      title: 'Acompanhe seu rastro',
      desc: 'Seu último pedido está em andamento. Tudo aparece aqui como consequência do real.',
      ctaHref: lastOrderId
        ? `/dash/consumer/orders/${lastOrderId}`
        : '/dash/consumer/orders',
      ctaLabel: 'Abrir timeline →',
    };
  }, [lastOrderId, lastOrderStatus, lastShipmentStatus, lastShipmentReviewed]);

  const quickActions: QuickAction[] = useMemo(() => {
    const urgent = missions[0] ?? null;

    const base: QuickAction[] = [
      {
        eyebrow: 'Explorar',
        title: 'Catálogo',
        desc: 'Navegue por produtos e explore possibilidades.',
        href: '/catalog',
        cta: 'Ver produtos →',
      },
      {
        eyebrow: 'Consolidar',
        title: 'Meus pedidos',
        desc: 'Acompanhe seus pedidos e abra a timeline completa.',
        href: '/dash/consumer/orders',
        cta: 'Ver pedidos →',
      },
      {
        eyebrow: 'Rastro',
        title: 'Ver timeline',
        desc: 'Abra a timeline do seu último pedido (MVP: escolha na lista).',
        href: lastOrderId
          ? `/dash/consumer/orders/${lastOrderId}`
          : '/dash/consumer/orders',
        cta: 'Abrir →',
      },
      {
        eyebrow: 'Consolidar',
        title: 'Avaliar pendências',
        desc: 'Registre avaliações pendentes.',
        href: '/review',
        cta:
          reviewPendenciesCount === null
            ? 'Abrir →'
            : reviewPendenciesCount > 0
              ? `Avaliar (${reviewPendenciesCount}) →`
              : 'Abrir →',
      },
    ];

    if (!urgent) return base;

    const t = urgent.title.toLowerCase();

    const bringToTop = (predicate: (a: QuickAction) => boolean) => {
      const idx = base.findIndex(predicate);
      if (idx <= 0) return;
      const [it] = base.splice(idx, 1);
      base.unshift({ ...it, highlight: true });
    };

    if (t.includes('avalia')) {
      bringToTop((a) => a.title.toLowerCase().includes('avaliar'));
      return base;
    }

    if (t.includes('falta pagar') || t.includes('pagar')) {
      const href =
        urgent.href ??
        (lastOrderId
          ? `/dash/consumer/orders/${lastOrderId}`
          : '/dash/consumer/orders');

      return [
        {
          eyebrow: 'Urgente',
          title: 'Pagar agora',
          desc: urgent.desc || 'Finalize o pagamento para liberar o fluxo.',
          href,
          cta: 'Abrir pedido →',
          highlight: true,
        },
        ...base.filter((a) => a.title !== 'Ver timeline'),
        {
          eyebrow: 'Rastro',
          title: 'Ver timeline',
          desc: 'Abra o rastro do pedido e acompanhe eventos.',
          href,
          cta: 'Ver rastro →',
        },
      ].slice(0, 4);
    }

    if (t.includes('devolu')) {
      const href = urgent.href ?? '/dash/consumer/orders';
      return [
        {
          eyebrow: 'Urgente',
          title: 'Acompanhar devolução',
          desc: urgent.desc || 'Veja prazos e eventos do processo.',
          href,
          cta: 'Acompanhar →',
          highlight: true,
        },
        ...base.filter((a) => !a.title.toLowerCase().includes('avaliar')),
      ].slice(0, 4);
    }

    if (t.includes('rastro') || t.includes('timeline')) {
      bringToTop((a) => a.title.toLowerCase().includes('timeline'));
      return base;
    }

    bringToTop((a) => a.title.toLowerCase().includes('catálogo'));
    return base;
  }, [missions, lastOrderId, reviewPendenciesCount]);

  const quickActionsFinal = useMemo(() => {
    const base = Array.isArray(quickActions) ? quickActions : [];

    if (!lastOrderId) {
      return [
        {
          eyebrow: 'Começar',
          title: 'Explorar catálogo',
          desc: 'Veja produtos e comece seu rastro com segurança.',
          href: '/catalog',
          cta: 'Abrir →',
          highlight: true,
        },
        ...base,
      ];
    }

    return [
      {
        eyebrow: 'Continuar',
        title: 'Última compra',
        desc: `Abrir timeline do seu último pedido${
          lastOrderStatus ? ` • ${String(lastOrderStatus)}` : ''
        }.`,
        href: `/dash/consumer/orders/${encodeURIComponent(lastOrderId)}`,
        cta: 'Abrir timeline →',
        highlight: true,
      },
      ...base,
    ];
  }, [quickActions, lastOrderId, lastOrderStatus]);

  useEffect(() => {
    (async () => {
      setMsg('');
      const token = getToken();
      if (!token) {
        setMsg('Você precisa entrar novamente.');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchJSON<Consumer>('/consumers/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setCity(data.city ?? '');
        setCepPrefix(data.cepPrefix ?? '');

        const ordersRes = await fetchJSON<
          unknown[] | { orders?: unknown[]; items?: unknown[] }
        >('/orders/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const list = Array.isArray(ordersRes)
          ? ordersRes
          : Array.isArray(ordersRes.orders)
            ? ordersRes.orders
            : Array.isArray(ordersRes.items)
              ? ordersRes.items
              : [];

        setOrdersCount(list.length);

        const sorted = [...list].sort((a, b) => {
          const ams = safeIsoToDateMs(getOrderCreatedAt(a));
          const bms = safeIsoToDateMs(getOrderCreatedAt(b));
          return bms - ams;
        });

        const last = sorted[0] ?? null;
        const lastId = getOrderId(last);

        setLastOrderId(lastId);
        setLastOrderStatus(getOrderStatus(last));
        setLastOrderCreatedAt(getOrderCreatedAt(last));

        // ✅ meta do último pedido
        const first = list[0] as unknown;
        if (first && typeof first === 'object') {
          const r = first as Record<string, unknown>;
          const id = typeof r.id === 'string' ? r.id : '';
          const status = typeof r.status === 'string' ? r.status : '—';
          const createdAt = typeof r.createdAt === 'string' ? r.createdAt : null;

          if (id) setLastOrderMeta({ id, status, createdAt });
          else setLastOrderMeta(null);
        } else {
          setLastOrderMeta(null);
        }

        const norm = (s: unknown) =>
          typeof s === 'string' ? s.toUpperCase() : '';
        const byCreatedDesc = [...list].sort((a, b) => {
          const ams = safeIsoToDateMs(getOrderCreatedAt(a));
          const bms = safeIsoToDateMs(getOrderCreatedAt(b));
          return bms - ams;
        });

        const newestCreated =
          byCreatedDesc.find((o) => norm(getOrderStatus(o)) === 'CREATED') ??
          null;
        const newestPaid =
          byCreatedDesc.find((o) => norm(getOrderStatus(o)) === 'PAID') ?? null;
        const newestReturn =
          byCreatedDesc.find(
            (o) => norm(getOrderStatus(o)) === 'RETURN_REQUESTED',
          ) ?? null;

        let reviewedOrderIds = new Set<string>();

        const prefDone = Boolean((data.city ?? '') || (data.cepPrefix ?? ''));

        setMissions([
          {
            id: 'm-rastro',
            title: 'Abrir seu rastro',
            desc: 'Timeline do último pedido: pedido + entrega + eventos.',
            done: Boolean(lastId),
            verified: true,
            href: lastId
              ? `/dash/consumer/orders/${lastId}`
              : '/dash/consumer/orders',
            cta: 'Abrir →',
          },
          {
            id: 'm-pref',
            title: 'Preferências (opcional)',
            desc: 'Cidade/CEP ajudam sugestões locais sem te encher.',
            done: prefDone,
            verified: false,
            href: '#preferencias',
            cta: 'Editar →',
          },
        ]);

        const services = list.filter((o) => {
          if (!o || typeof o !== 'object') return false;

          const r = o as Record<string, unknown>;

          if (r.shipmentId) return true;

          const sh = r.shipment;
          if (!sh || typeof sh !== 'object') return false;

          const sr = sh as Record<string, unknown>;
          return Boolean(sr.id);
        }).length;

        setServicesCount(services);

        // ✅ Pendências: pedidos que ainda não finalizaram
        const pending = list.filter((o) => {
          if (!o || typeof o !== 'object') return false;
          const r = o as Record<string, unknown>;
          const st = String(r.status ?? '').toUpperCase();
          if (!st) return false;
          return st !== 'COMPLETED' && st !== 'CANCELLED';
        }).length;

        setPendingCount(pending);

        setReviewsCount(null);
        setReviewPendenciesCount(null);

        const shipmentResults = await Promise.all(
          list.map(async (o): Promise<unknown | null> => {
            const orderId = getOrderId(o);
            if (!orderId) return null;

            try {
              return await fetchJSON<unknown>(
                `/logistics/shipments/by-order/${orderId}`,
                {
                  method: 'GET',
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
            } catch {
              return null;
            }
          }),
        );

        const shipments = shipmentResults
          .map((r) => {
            if (!r || typeof r !== 'object') return null;
            const rr = r as Record<string, unknown>;
            return rr.shipment ? rr.shipment : r;
          })
          .filter(Boolean) as unknown[];

        const reviewedCount = shipments.filter((s) => getShipmentReviewFlag(s))
          .length;

        setReviewsCount(reviewedCount);

        // ✅ pendências de avaliação: shipment DELIVERED sem review
        const reviewPend = shipments.filter((s) => {
          if (!s || typeof s !== 'object') return false;
          const sr = s as Record<string, unknown>;
          const st = String(sr.status ?? '').toUpperCase();
          if (st !== 'DELIVERED') return false;
          return !sr.review && !sr.reviewedAt;
        }).length;

        setReviewPendenciesCount(reviewPend);

        // ✅ pega a entrega mais recente (se houver)
        const mostRecentShipment = (() => {
          if (!shipments.length) return null;

          let best: Record<string, unknown> | null = null;
          let bestT = -1;

          for (const s of shipments) {
            if (!s || typeof s !== 'object') continue;
            const r = s as Record<string, unknown>;

            const dt = typeof r.createdAt === 'string' ? r.createdAt : null;
            const t = dt ? +new Date(dt) : 0;

            if (t > bestT) {
              bestT = t;
              best = r;
            }
          }

          return best;
        })();

        if (mostRecentShipment) {
          const id =
            typeof mostRecentShipment.id === 'string' ? mostRecentShipment.id : '';
          const status =
            typeof mostRecentShipment.status === 'string'
              ? mostRecentShipment.status
              : '—';
          const createdAt =
            typeof mostRecentShipment.createdAt === 'string'
              ? mostRecentShipment.createdAt
              : null;
          const reviewed = Boolean(
            mostRecentShipment.review || mostRecentShipment.reviewedAt,
          );

          if (id) setLastShipmentMeta({ id, status, createdAt, reviewed });
          else setLastShipmentMeta(null);
        } else {
          setLastShipmentMeta(null);
        }

        reviewedOrderIds = new Set<string>();
        shipments.forEach((s) => {
          if (!s || typeof s !== 'object') return;
          const sr = s as Record<string, unknown>;
          const oid = sr.orderId;
          const orderId =
            typeof oid === 'string' && oid.trim() ? oid.trim() : null;
          if (!orderId) return;
          if (getShipmentReviewFlag(s)) reviewedOrderIds.add(orderId);
        });

        const newestDeliveredNoReview =
          byCreatedDesc.find((o) => {
            const id = getOrderId(o);
            if (!id) return false;
            const st = norm(getOrderStatus(o));
            const isDelivered = st === 'DELIVERED' || st === 'COMPLETED';
            if (!isDelivered) return false;
            return !reviewedOrderIds.has(id);
          }) ?? null;

        const idCreated = getOrderId(newestCreated);
        const idPaid = getOrderId(newestPaid);
        const idReturn = getOrderId(newestReturn);
        const idNeedReview = getOrderId(newestDeliveredNoReview);

        let urgent: Mission;

        if (idNeedReview) {
          urgent = {
            id: 'm-urgent-review',
            title: 'Avaliação pendente (fecha o ciclo)',
            desc: 'Entrega concluída sem avaliação. Isso vira reputação real.',
            done: false,
            verified: true,
            href: `/dash/consumer/orders/${idNeedReview}`,
            cta: 'Abrir pedido →',
          };
        } else if (idCreated) {
          urgent = {
            id: 'm-urgent-pay',
            title: 'Pedido criado — falta pagar',
            desc: 'Finalize o pagamento para liberar o fluxo.',
            done: false,
            verified: true,
            href: `/dash/consumer/orders/${idCreated}`,
            cta: 'Abrir pedido →',
          };
        } else if (idPaid) {
          urgent = {
            id: 'm-urgent-follow',
            title: 'Pagamento ok — acompanhe a confirmação',
            desc: 'Agora o lojista confirma e o rastro anda.',
            done: false,
            verified: true,
            href: `/dash/consumer/orders/${idPaid}`,
            cta: 'Ver timeline →',
          };
        } else if (idReturn) {
          urgent = {
            id: 'm-urgent-return',
            title: 'Devolução em andamento',
            desc: 'Acompanhe prazos e eventos do processo.',
            done: false,
            verified: true,
            href: `/dash/consumer/orders/${idReturn}`,
            cta: 'Acompanhar →',
          };
        } else if ((list?.length ?? 0) === 0) {
          urgent = {
            id: 'm-urgent-first',
            title: 'Crie seu primeiro rastro',
            desc: 'Explore o catálogo e faça um pedido de teste.',
            done: false,
            verified: true,
            href: '/catalog',
            cta: 'Explorar →',
          };
        } else {
          urgent = {
            id: 'm-urgent-ok',
            title: 'Você está em dia',
            desc: 'Use o rastro pra repetir o que foi bom (menos risco).',
            done: true,
            verified: true,
            href: '/dash/consumer/orders',
            cta: 'Ver rastro →',
          };
        }

        setMissions([
          urgent,
          {
            id: 'm-rastro',
            title: 'Abrir seu rastro',
            desc: 'Timeline do último pedido: pedido + entrega + eventos.',
            done: Boolean(lastId),
            verified: true,
            href: lastId
              ? `/dash/consumer/orders/${lastId}`
              : '/dash/consumer/orders',
            cta: 'Abrir →',
          },
          {
            id: 'm-pref',
            title: 'Preferências (opcional)',
            desc: 'Cidade/CEP ajudam sugestões locais sem te encher.',
            done: Boolean((data.city ?? '') || (data.cepPrefix ?? '')),
            verified: false,
            href: '#preferencias',
            cta: 'Editar →',
          },
        ]);

        setLastShipmentStatus(null);
        setLastShipmentReviewed(false);

        if (lastId) {
          try {
            const shRes = await fetchJSON<unknown>(
              `/logistics/shipments/by-order/${lastId}`,
              {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            const sh =
              shRes && typeof shRes === 'object'
                ? ((shRes as Record<string, unknown>).shipment ?? shRes)
                : null;

            setLastShipmentStatus(getShipmentStatus(sh));
            setLastShipmentReviewed(getShipmentReviewFlag(sh));
          } catch {
            // ok
          }
        }

        const me = await fetchJSON<MeResponse>('/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        setPublicHandle(me.profile?.handle ?? null);
      } catch (e: unknown) {
        const err = e as ApiError;
        setMsg(err?.message ?? 'Não foi possível carregar seu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSave() {
    setMsg('');
    const token = getToken();
    if (!token) {
      setMsg('Você precisa entrar novamente.');
      return;
    }

    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) {
      setMsg('CEP (prefixo) deve ter 5 números (ex: 36500).');
      return;
    }

    setSaving(true);
    try {
      await fetchJSON('/consumers/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city: city.trim() || null,
          cepPrefix: cepPrefix.trim() || null,
        }),
      });

      setMsg('Preferências salvas.');
    } catch (e: unknown) {
      const err = e as ApiError;
      setMsg(err?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
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
        {/* Topbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/60 ring-1 ring-white/10">
              <Image src="/marto-m.svg" alt="Marto" width={20} height={20} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Consumidor • Marto</div>
              <div className="text-xs text-white/60">
                Social de consumo real. Sem conteúdo vazio.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/me"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Meu perfil
            </Link>

            <Link
              href="/profile"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Configurações
            </Link>

            {publicHandle ? (
              <Link
                href={`/u/${publicHandle}`}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Perfil público
              </Link>
            ) : null}

            <button
              onClick={() => {
                localStorage.removeItem('marto_access');
                window.location.href = '/login';
              }}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Sair
            </button>
          </div>
        </div>

        {/* HERO */}
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                Central do Consumidor
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                O que você quer fazer agora?
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Explore produtos, contrate serviços e acompanhe seus pedidos. O
                Marto registra tudo para você decidir com segurança.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/catalog"
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Explorar catálogo
                </Link>

                <Link
                  href="/dash/consumer/orders"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Meus pedidos
                </Link>

                <Link
                  href="/choose-role"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Adicionar outro papel
                </Link>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 ring-1 ring-white/5">
                <div>
                  <div className="text-sm font-semibold">Resumo</div>
                  <div className="mt-1 text-xs text-white/60">
                    Visão rápida do seu uso recente.
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Kpi
                    label="Pedidos"
                    value={ordersCount === null ? '—' : String(ordersCount)}
                    hint={ordersCount === null ? 'carregando…' : 'recentes'}
                  />
                  <Kpi
                    label="Serviços"
                    value={servicesCount === null ? '—' : String(servicesCount)}
                    hint={servicesCount === null ? 'carregando…' : 'recentes'}
                  />
                  <Kpi
                    label="Avaliações"
                    value={reviewsCount === null ? '—' : String(reviewsCount)}
                    hint={reviewsCount === null ? 'carregando…' : 'recentes'}
                  />
                  <Kpi
                    label="Pendências"
                    value={pendingCount === null ? '—' : String(pendingCount)}
                    hint={
                      pendingCount === null
                        ? 'carregando…'
                        : 'pedidos em andamento'
                    }
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/70">
                    Dica: comece por “Catálogo” para ver o ciclo completo.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HOJE NO MARTO */}
          <section className="mt-10 grid gap-4 lg:grid-cols-3">
            <TodayCard missions={missions} loading={loading} />
            <NextActionCard loading={loading} urgent={missions[0] ?? null} />
            <TrustCard />
          </section>

          {/* AÇÕES RÁPIDAS */}
          <div className="mt-10">
            <div className="mb-3">
              <div className="text-sm font-semibold text-white">
                Ações rápidas
              </div>
              <div className="mt-1 text-xs text-white/60">Comece por aqui.</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {quickActionsFinal.map((a) => (
                <BlockCard
                  key={`${a.title}-${a.href}`}
                  eyebrow={a.eyebrow}
                  title={a.title}
                  desc={a.desc}
                  href={a.href}
                  cta={a.cta}
                  highlight={a.highlight}
                />
              ))}
            </div>
          </div>

          {/* ✅ INSPIRAÇÕES REAIS (DO RASTRO) */}
          <section className="mt-10 rounded-3xl border border-white/10 bg-black/25 p-6 ring-1 ring-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{inspoHeader.title}</div>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    {inspoHeader.badge}
                  </span>
                </div>

                <div className="mt-1 max-w-2xl text-sm text-white/60">
                  {inspoHeader.desc}
                </div>
              </div>

              <Link
                href={inspoHeader.ctaHref}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                {inspoHeader.ctaLabel}
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {rastroInspo.map((it) => (
                <InspoCard key={it.id} item={it} />
              ))}
            </div>
          </section>

          {/* ✅ Atividade recente (cards reais) */}
          <section className="mt-10 rounded-3xl border border-white/10 bg-black/25 p-6 text-white ring-1 ring-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Atividade recente</div>
                <div className="mt-1 max-w-xl text-sm text-white/60">
                  Visão rápida: última compra, última entrega e avaliações.
                </div>
              </div>

              {lastOrderId ? (
                <Link
                  href={`/dash/consumer/orders/${lastOrderId}`}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Abrir timeline →
                </Link>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {lastOrderMeta ? (
                <HistoryRow
                  title="Última compra"
                  meta={`${String(lastOrderMeta.status)} • ${
                    lastOrderMeta.createdAt
                      ? new Date(lastOrderMeta.createdAt).toLocaleString('pt-BR')
                      : '—'
                  }`}
                  desc="O Marto registrou a compra e iniciou seu rastro."
                  status="verificado"
                />
              ) : (
                <HistoryRow
                  title="Nenhuma compra ainda"
                  meta="Comece pelo catálogo"
                  desc="Quando você comprar, seu rastro aparece aqui."
                  status="em construção"
                />
              )}

              {lastShipmentMeta ? (
                <HistoryRow
                  title="Última entrega"
                  meta={`${String(lastShipmentMeta.status)} • ${
                    lastShipmentMeta.createdAt
                      ? new Date(
                          lastShipmentMeta.createdAt,
                        ).toLocaleString('pt-BR')
                      : '—'
                  }`}
                  desc={
                    lastShipmentMeta.reviewed
                      ? 'Entrega avaliada e vinculada à experiência.'
                      : 'Entrega registrada. Quando avaliar, vira reputação.'
                  }
                  status="verificado"
                />
              ) : (
                <HistoryRow
                  title="Nenhuma entrega registrada"
                  meta="Aguardando transportadora"
                  desc="Quando uma entrega for criada, ela aparece aqui."
                  status="em construção"
                />
              )}

              {reviewsCount !== null && reviewsCount > 0 ? (
                <HistoryRow
                  title="Avaliação registrada"
                  meta={`${reviewsCount} no total`}
                  desc="Avaliações no Marto são vinculadas a ações reais."
                  status="verificado"
                />
              ) : (
                <HistoryRow
                  title="Sem avaliações ainda"
                  meta="Leva 30 segundos"
                  desc="Após a entrega, avalie e fortaleça seu rastro."
                  status="em construção"
                />
              )}

              <HistoryRow
                title="Rastro do consumidor"
                meta="Sem feed • só consequência"
                desc="Aqui você vê o que aconteceu e o que falta — com verdade."
                status="verificado"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Aqui é operacional: o que aconteceu, o que falta, e o que fazer
              depois.
            </div>
          </section>

          {/* Preferências */}
          <details
            id="preferencias"
            className="mt-10 rounded-3xl border border-white/10 bg-black/25 p-6 ring-1 ring-white/5"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">Preferências</div>
                  <div className="mt-1 text-sm text-white/60">
                    Opcional. Ajuda a sugerir coisas perto de você.
                  </div>
                </div>
                <div className="text-sm font-semibold text-white/70">
                  {loading ? 'Carregando…' : 'Editar'}
                </div>
              </div>
            </summary>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Cidade (opcional)</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Ubá"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40"
                  disabled={loading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  CEP (prefixo) — opcional
                </span>
                <input
                  value={cepPrefix}
                  onChange={(e) =>
                    setCepPrefix(e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  placeholder="Ex: 36500"
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/40"
                  disabled={loading}
                  inputMode="numeric"
                />
                <span className="text-xs text-white/55">
                  Se não souber, deixe em branco.
                </span>
              </label>

              {msg ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  {msg}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onSave}
                  disabled={loading || saving || !canSave}
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : 'Salvar preferências'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCity('');
                    setCepPrefix('');
                    setMsg('Ok — você pode configurar isso depois.');
                  }}
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  disabled={loading || saving}
                >
                  Limpar
                </button>
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/55">{hint}</div>
    </div>
  );
}

function BlockCard({
  eyebrow,
  title,
  desc,
  href,
  cta,
  highlight,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-3xl border p-6 transition ${
        highlight
          ? 'border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="text-xs font-semibold text-white/60">{eyebrow}</div>
      <div className="mt-2 text-base font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-white/65">{desc}</div>
      <div className="mt-6 text-xs font-semibold text-white/70">{cta}</div>
    </Link>
  );
}

function TodayCard({
  missions,
  loading,
}: {
  missions: Mission[];
  loading: boolean;
}) {
  const total = missions.length;
  const done = missions.filter((m) => m.done).length;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-6 ring-1 ring-white/5 lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-white/60">Hoje no Marto</div>
          <div className="mt-2 text-lg font-semibold">
            Missões rápidas (sem enrolação)
          </div>
          <div className="mt-1 text-sm text-white/60">
            O social aqui é consequência. Missões só existem quando são úteis.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80">
          {loading ? '—' : `${done}/${total}`} feito
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {missions.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white/60">Missão</div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  m.verified
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'bg-white/10 text-white/70'
                }`}
              >
                {m.verified ? 'verificado' : 'opcional'}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold">{m.title}</div>
            <div className="mt-2 text-sm text-white/70">{m.desc}</div>

            <div className="mt-4 flex items-center justify-between">
              <span
                className={`text-xs font-semibold ${
                  m.done ? 'text-emerald-200' : 'text-white/70'
                }`}
              >
                {loading ? 'carregando…' : m.done ? 'feito' : 'pendente'}
              </span>

              {m.href && m.cta ? (
                m.href.startsWith('#') ? (
                  <button
                    type="button"
                    onClick={() => scrollToId(m.href!.slice(1))}
                    className="text-xs font-semibold text-white/70 hover:text-white"
                  >
                    {m.cta}
                  </button>
                ) : (
                  <Link
                    href={m.href}
                    className="text-xs font-semibold text-white/70 hover:text-white"
                  >
                    {m.cta}
                  </Link>
                )
              ) : (
                <span className="text-xs text-white/55">MVP</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/dash/consumer/orders"
          className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          Abrir meu rastro →
        </Link>

        <Link
          href="/review"
          className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
        >
          Avaliar agora
        </Link>
      </div>
    </div>
  );
}

function NextActionCard({
  loading,
  urgent,
}: {
  loading: boolean;
  urgent: Mission | null;
}) {
  const title = loading ? 'Carregando…' : urgent?.title ?? 'Próximo passo';

  const desc = loading
    ? 'Montando seu próximo passo.'
    : urgent?.desc ??
      'O Marto decide seu próximo passo com base no seu rastro real.';

  const href = urgent?.href ?? '/dash/consumer/orders';
  const cta = urgent?.cta ?? 'Abrir →';

  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-black/25 p-6 ring-1 ring-white/5 transition hover:bg-white/5"
    >
      <div className="text-xs font-semibold text-white/60">Próximo passo</div>
      <div className="mt-2 text-lg font-semibold">{title}</div>
      <div className="mt-2 text-sm text-white/60">{desc}</div>

      <div className="mt-6 text-xs font-semibold text-white/70">{cta}</div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/65">
        Aqui o Marto te guia por consequência: ação real → rastro → confiança.
      </div>
    </Link>
  );
}

function TrustCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-6 ring-1 ring-white/5">
      <div className="text-xs font-semibold text-white/60">Regra do Marto</div>
      <div className="mt-2 text-lg font-semibold">Nada de conteúdo vazio</div>
      <div className="mt-2 text-sm text-white/60">
        Quando aparecer algo “social”, vai estar ligado a produto, serviço ou
        experiência real. O foco é decisão segura.
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Social como consequência — reputação como ativo.
      </div>
    </div>
  );
}

function InspoCard({ item }: { item: InspoItem }) {
  return (
    <Link
      href={item.href}
      className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{item.title}</div>
          <div className="mt-1 text-xs text-white/55">{item.meta}</div>
        </div>

        <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
          {item.badge}
        </span>
      </div>

      <div className="mt-2 text-sm text-white/70">{item.desc}</div>
      <div className="mt-5 text-xs font-semibold text-white/70">{item.cta}</div>
    </Link>
  );
}

function HistoryRow({
  title,
  meta,
  desc,
  status,
}: {
  title: string;
  meta: string;
  desc: string;
  status: 'verificado' | 'em construção';
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs text-white/55">{meta}</div>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            status === 'verificado'
              ? 'bg-emerald-500/15 text-emerald-200'
              : 'bg-white/10 text-white/70'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="mt-2 text-sm text-white/70">{desc}</div>
    </div>
  );
}
