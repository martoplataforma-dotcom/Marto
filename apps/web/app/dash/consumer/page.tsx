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

  href?: string;
  cta?: string;

  // micro-feedback (MVP): mostra “quanto rende” fechar isso
  rewardPts?: number;
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

type LoopStep = {
  id: 'comprar' | 'servico' | 'avaliar' | 'postar';
  eyebrow: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  state: 'agora' | 'em seguida' | 'opcional' | 'travado';
  verified?: boolean;
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

type RadarLevel = 'baixo' | 'médio' | 'alto';

type MartoLevel = 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';

function levelFromPoints(points: number): MartoLevel {
  if (points >= 120_000) return 'DIAMANTE';
  if (points >= 45_000) return 'OURO';
  if (points >= 15_000) return 'PRATA';
  return 'BRONZE';
}

function brlFromPoints(points: number): string {
  // doc base: 10.000 pontos -> R$ 10  => 1 ponto = R$ 0,001 (valor ilustrativo)
  const brl = points * 0.001;
  return brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function radarFromState(params: {
  ordersCount: number | null;
  pendingCount: number | null;
  reviewPendenciesCount: number | null;
  lastOrderId: string | null;
  lastOrderStatus: string | null;
  lastShipmentStatus: string | null;
}) {
  const { ordersCount, pendingCount, reviewPendenciesCount, lastOrderId } = params;

  // loading
  if (
    ordersCount === null ||
    pendingCount === null ||
    reviewPendenciesCount === null
  ) {
    return {
      badge: 'analisando',
      title: 'Radar Marto',
      desc: 'Lendo seu rastro para sugerir o próximo passo.',
      level: 'baixo' as RadarLevel,
      ctaLabel: '—',
      ctaHref: '/catalog',
      tone: 'neutral' as const,
      hint: 'consequência do real',
    };
  }

  const hasOrders = ordersCount > 0;
  const hasPending = pendingCount > 0;
  const needsReview = reviewPendenciesCount > 0;

  // regra vanguarda: risco = travas + pendências
  let level: RadarLevel = 'baixo';
  if (hasPending && !needsReview) level = 'médio';
  if (needsReview) level = 'alto';

  if (!hasOrders) {
    return {
      badge: 'sem rastro',
      title: 'Radar Marto',
      desc: 'Você ainda não tem rastro. Comece um ciclo pequeno para destravar confiança.',
      level: 'baixo' as RadarLevel,
      ctaLabel: 'Começar pelo catálogo →',
      ctaHref: '/catalog',
      tone: 'neutral' as const,
      hint: 'ação real → rastro → confiança',
    };
  }

  if (needsReview) {
    return {
      badge: 'ciclo aberto',
      title: 'Radar Marto',
      desc: 'Existe entrega sem avaliação. Fechar o ciclo aumenta sua confiança (e a do sistema).',
      level,
      ctaLabel: `Fechar ciclo (${reviewPendenciesCount}) →`,
      ctaHref: '/review',
      tone: 'emerald' as const,
      hint: 'reputação vinculada',
    };
  }

  if (hasPending) {
    return {
      badge: 'em andamento',
      title: 'Radar Marto',
      desc: 'Você tem fluxo em andamento. O melhor agora é acompanhar a timeline e próximos passos.',
      level,
      ctaLabel: 'Abrir meu rastro →',
      ctaHref: lastOrderId
        ? `/dash/consumer/orders/${encodeURIComponent(lastOrderId)}`
        : '/dash/consumer/orders',
      tone: 'neutral' as const,
      hint: 'menos achismo, mais fatos',
    };
  }

  return {
    badge: 'em dia',
    title: 'Radar Marto',
    desc: 'Você está em dia. Use seu rastro para repetir escolhas seguras.',
    level,
    ctaLabel: 'Explorar com segurança →',
    ctaHref: '/catalog',
    tone: 'neutral' as const,
    hint: 'recorrência inteligente',
  };
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

  const radar = useMemo(() => {
    return radarFromState({
      ordersCount,
      pendingCount,
      reviewPendenciesCount,
      lastOrderId,
      lastOrderStatus,
      lastShipmentStatus,
    });
  }, [
    ordersCount,
    pendingCount,
    reviewPendenciesCount,
    lastOrderId,
    lastOrderStatus,
    lastShipmentStatus,
  ]);

  const rewards = useMemo(() => {
    // MVP: estimativa baseada no rastro (sem backend de pontos ainda)
    const o = Number(ordersCount ?? 0);
    const s = Number(servicesCount ?? 0);
    const r = Number(reviewsCount ?? 0);
    const pendReview = Number(reviewPendenciesCount ?? 0);

    // pesos simples e previsíveis (ajusta depois)
    let points = 0;
    points += o * 180; // comprar (gera rastro)
    points += s * 140; // serviço (dado operacional)
    points += r * 420; // avaliação (reputação real)
    points -= pendReview * 220; // ciclo aberto reduz “recompensa”

    if (points < 0) points = 0;

    const level = levelFromPoints(points);

    const nextTargets: Record<
      MartoLevel,
      { next: MartoLevel | null; target: number }
    > = {
      BRONZE: { next: 'PRATA', target: 15_000 },
      PRATA: { next: 'OURO', target: 45_000 },
      OURO: { next: 'DIAMANTE', target: 120_000 },
      DIAMANTE: { next: null, target: 120_000 },
    };

    const target = nextTargets[level].target;
    const progress = level === 'DIAMANTE' ? 1 : clamp01(points / target);

    return {
      points,
      level,
      progress,
      next: nextTargets[level].next,
      brl: brlFromPoints(points),
    };
  }, [ordersCount, servicesCount, reviewsCount, reviewPendenciesCount]);

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

  const loop = useMemo(() => {
    const hasOrders = Number(ordersCount ?? 0) > 0;
    const hasServices = Number(servicesCount ?? 0) > 0;
    const needsReview = Number(reviewPendenciesCount ?? 0) > 0;

    // decisão “Marto”: o próximo passo vem do rastro
    const now: LoopStep['id'] = !hasOrders
      ? 'comprar'
      : needsReview
        ? 'avaliar'
        : !hasServices
          ? 'servico'
          : 'postar';

    const stepState = (id: LoopStep['id']): LoopStep['state'] => {
      if (id === now) return 'agora';
      if (!hasOrders && id !== 'comprar') return 'travado';
      return 'em seguida';
    };

    const base: LoopStep[] = [
      {
        id: 'comprar',
        eyebrow: 'Ciclo',
        title: 'Comprar',
        desc: 'Ação real abre o rastro (pedido + eventos).',
        href: '/catalog',
        cta: 'Explorar catálogo →',
        state: stepState('comprar'),
        verified: true,
      },
      {
        id: 'servico',
        eyebrow: 'Campo',
        title: 'Serviço / Instala',
        desc: 'Quando existe execução, nasce confiança operacional.',
        href: '/dash/consumer/orders',
        cta: 'Ver meus pedidos →',
        state: stepState('servico'),
        verified: true,
      },
      {
        id: 'avaliar',
        eyebrow: 'Reputação',
        title: 'Avaliar',
        desc: 'Fechar ciclo vira reputação vinculada (sem achismo).',
        href: '/review',
        cta: needsReview
          ? `Fechar ciclo (${reviewPendenciesCount ?? 0}) →`
          : 'Avaliar →',
        state: stepState('avaliar'),
        verified: true,
      },
      {
        id: 'postar',
        eyebrow: 'Marto Social',
        title: 'Postar (verificado)',
        desc: 'Social aqui é consequência: post nasce do rastro.',
        href: '/me',
        cta: 'Abrir meu perfil →',
        state: stepState('postar'),
        verified: true,
      },
    ];

    return { now, items: base };
  }, [ordersCount, servicesCount, reviewPendenciesCount]);

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

        const norm = (s: unknown) => (typeof s === 'string' ? s.toUpperCase() : '');
        const byCreatedDesc = [...list].sort((a, b) => {
          const ams = safeIsoToDateMs(getOrderCreatedAt(a));
          const bms = safeIsoToDateMs(getOrderCreatedAt(b));
          return bms - ams;
        });

        const newestCreated =
          byCreatedDesc.find((o) => norm(getOrderStatus(o)) === 'CREATED') ?? null;
        const newestPaid =
          byCreatedDesc.find((o) => norm(getOrderStatus(o)) === 'PAID') ?? null;
        const newestReturn =
          byCreatedDesc.find((o) => norm(getOrderStatus(o)) === 'RETURN_REQUESTED') ??
          null;

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

        const reviewPend = shipments.filter((s) => {
          if (!s || typeof s !== 'object') return false;
          const sr = s as Record<string, unknown>;
          const st = String(sr.status ?? '').toUpperCase();
          if (st !== 'DELIVERED') return false;
          return !sr.review && !sr.reviewedAt;
        }).length;

        setReviewPendenciesCount(reviewPend);

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
          const orderId = typeof oid === 'string' && oid.trim() ? oid.trim() : null;
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
            rewardPts: 900,
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
            rewardPts: 320,
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
            rewardPts: 180,
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
            rewardPts: 220,
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
            rewardPts: 260,
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
            rewardPts: 80,
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
            href: lastId ? `/dash/consumer/orders/${lastId}` : '/dash/consumer/orders',
            cta: 'Abrir →',
            rewardPts: 120,
          },
          {
            id: 'm-pref',
            title: 'Preferências (opcional)',
            desc: 'Cidade/CEP ajudam sugestões locais sem te encher.',
            done: Boolean((data.city ?? '') || (data.cepPrefix ?? '')),
            verified: false,
            href: '#preferencias',
            cta: 'Editar →',
            rewardPts: 60,
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
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Fundo Marto (padrão) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-neutral-950" />
        <div className="absolute -top-48 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-[18rem] -left-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-[22rem] -right-40 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl p-6">
        {/* Topbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-neutral-950/75 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
              <Image src="/marto-m.svg" alt="Marto" width={20} height={20} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white/85">
                Consumidor • Marto
              </div>
              <div className="text-xs text-white/65">
                Social de consumo real. Sem conteúdo vazio.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/me"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15"
            >
              Meu perfil
            </Link>

            <Link
              href="/profile"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15"
            >
              Configurações
            </Link>

            {publicHandle ? (
              <Link
                href={`/u/${publicHandle}`}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15"
              >
                Perfil público
              </Link>
            ) : null}

            <button
              onClick={() => {
                localStorage.removeItem('marto_access');
                window.location.href = '/login';
              }}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15"
            >
              Sair
            </button>
          </div>
        </div>

        {/* HERO */}
        <section className="rounded-[2rem] border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/75 backdrop-blur">
                Central do Consumidor
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                O que você quer fazer agora?
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Explore produtos, contrate serviços e acompanhe seus pedidos. O
                Marto registra tudo para você decidir com segurança.
              </p>

              <div
                className={`mt-6 rounded-3xl border p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur ${
                  radar.tone === 'emerald'
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-white/15 bg-black/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-white/85">
                        {radar.title}
                      </div>
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                        {radar.badge}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-white/75">{radar.desc}</div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-white/65">
                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-semibold">
                        risco: {radar.level}
                      </span>
                      <span className="text-white/60">{radar.hint}</span>
                    </div>
                  </div>

                  <Link
                    href={radar.ctaHref}
                    className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                      radar.tone === 'emerald'
                        ? 'bg-white text-black hover:opacity-90'
                        : 'border border-white/15 bg-white/10 text-white/85 hover:bg-white/15'
                    }`}
                  >
                    {radar.ctaLabel}
                  </Link>
                </div>
              </div>

              {reviewPendenciesCount !== null && reviewPendenciesCount > 0 ? (
                <Link
                  href="/review"
                  className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
                >
                  Fechar ciclo: avaliar ({reviewPendenciesCount})
                </Link>
              ) : null}
            </div>

            <div className="w-full max-w-xl">
              <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div>
                  <div className="text-sm font-semibold text-white/85">Resumo</div>
                  <div className="mt-1 text-xs text-white/65">
                    Visão rápida do seu uso recente.
                  </div>
                </div>
                {reviewPendenciesCount === null ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/65 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    Ciclo: checando…
                  </div>
                ) : reviewPendenciesCount > 0 ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                    Ciclo: {reviewPendenciesCount} pendência(s)
                  </div>
                ) : (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/65 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    Ciclo: em dia
                  </div>
                )}

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
                    hint={pendingCount === null ? 'carregando…' : 'em andamento'}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white/65">
                        Recompensa Marto
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white/85">
                        Nível {rewards.level} •{' '}
                        {rewards.points.toLocaleString('pt-BR')} pts
                      </div>
                      <div className="mt-1 text-xs text-white/65">
                        Estimativa (MVP) baseada no seu rastro • {rewards.brl}{' '}
                        equivalente
                      </div>
                    </div>

                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      preview
                    </span>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
                    <div
                      className="h-full bg-white/60"
                      style={{ width: `${Math.round(rewards.progress * 100)}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-white/65">
                    <span>ciclo fechado = mais pontos</span>
                    <span>
                      {rewards.next
                        ? `próximo: ${rewards.next}`
                        : 'topo do ecossistema'}
                    </span>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/15 bg-black/40 p-3 text-xs text-white/70">
                    No Marto, recompensa vem de ações reais: comprar, usar
                    serviço, avaliar, postar.
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4 text-xs text-white/70 backdrop-blur">
                  Dica: comece pelo “Catálogo” para ver o ciclo completo.
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
              <div className="text-sm font-semibold text-white/85">Ações rápidas</div>
              <div className="mt-1 text-xs text-white/65">Comece por aqui.</div>
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

          {/* LOOP DO CONSUMIDOR (Marto Social por consequência) */}
          <section className="mt-10 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-white/85">
                    Loop do Consumidor
                  </div>
                  <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70 backdrop-blur">
                    ação real → rastro → confiança
                  </span>
                </div>
                <div className="mt-1 max-w-2xl text-sm text-white/65">
                  No Marto, “social” não é feed. É consequência de compra,
                  execução e avaliação.
                </div>
              </div>

              <Link
                href={
                  loop.now === 'comprar'
                    ? '/catalog'
                    : loop.now === 'avaliar'
                      ? '/review'
                      : '/dash/consumer/orders'
                }
                className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90"
              >
                Ir para o passo “agora” →
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {loop.items.map((s) => (
                <Link
                  key={s.id}
                  href={s.href}
                  className={`rounded-2xl border p-4 backdrop-blur transition ${
                    s.state === 'agora'
                      ? 'border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15'
                      : s.state === 'travado'
                        ? 'border-white/10 bg-black/30 opacity-60'
                        : 'border-white/15 bg-black/40 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold text-white/65">
                      {s.eyebrow}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        s.state === 'agora'
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : s.state === 'travado'
                            ? 'bg-white/10 text-white/60'
                            : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {s.state === 'agora'
                        ? 'agora'
                        : s.state === 'travado'
                          ? 'travado'
                          : 'próximo'}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-semibold text-white/85">
                    {s.title}
                  </div>
                  <div className="mt-2 text-sm text-white/70">{s.desc}</div>

                  <div className="mt-5 text-xs font-semibold text-white/70">
                    {s.cta}
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/15 bg-black/40 p-4 text-xs text-white/70 backdrop-blur">
              Esse loop é o coração do Marto Social: reputação e recompensa
              nascem do que aconteceu de verdade.
            </div>
          </section>

          {/* INSPIRAÇÕES REAIS (DO RASTRO) */}
          <section className="mt-10 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-white/85">
                    {inspoHeader.title}
                  </div>

                  <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70 backdrop-blur">
                    {inspoHeader.badge}
                  </span>
                </div>

                <div className="mt-1 max-w-2xl text-sm text-white/65">
                  {inspoHeader.desc}
                </div>
              </div>

              <Link
                href={inspoHeader.ctaHref}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/15"
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

          {/* TRILHA DO RASTRO */}
          <section className="mt-10 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white/85">
                  Trilha do rastro
                </div>
                <div className="mt-1 max-w-xl text-sm text-white/65">
                  Uma linha clara do que aconteceu, onde você está e o que falta.
                </div>
              </div>

              <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70 backdrop-blur">
                consequência real
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              {/* 1 — Pedido */}
              <div className="flex items-start gap-4">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    Pedido
                  </div>
                  <div className="mt-1 text-sm text-white/65">
                    {lastOrderMeta
                      ? `Último pedido registrado • ${
                          lastOrderMeta.createdAt
                            ? new Date(
                                lastOrderMeta.createdAt,
                              ).toLocaleDateString('pt-BR')
                            : '—'
                        }`
                      : 'Nenhum pedido ainda'}
                  </div>
                </div>
              </div>

              {/* 2 — Entrega / Serviço */}
              <div className="flex items-start gap-4">
                <div
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    lastShipmentMeta ? 'bg-emerald-400' : 'bg-white/30'
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    Entrega / Serviço
                  </div>
                  <div className="mt-1 text-sm text-white/65">
                    {lastShipmentMeta
                      ? `${String(lastShipmentMeta.status)} • ${
                          lastShipmentMeta.createdAt
                            ? new Date(
                                lastShipmentMeta.createdAt,
                              ).toLocaleDateString('pt-BR')
                            : '—'
                        }`
                      : 'Ainda não iniciado'}
                  </div>
                </div>
              </div>

              {/* 3 — Avaliação */}
              <div className="flex items-start gap-4">
                <div
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    reviewPendenciesCount && reviewPendenciesCount > 0
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    Avaliação
                  </div>
                  <div className="mt-1 text-sm text-white/65">
                    {reviewPendenciesCount && reviewPendenciesCount > 0
                      ? `${reviewPendenciesCount} pendência(s) • fechar ciclo`
                      : 'Em dia'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={
                  reviewPendenciesCount && reviewPendenciesCount > 0
                    ? '/review'
                    : lastOrderId
                      ? `/dash/consumer/orders/${lastOrderId}`
                      : '/catalog'
                }
                className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
              >
                Abrir rastro →
              </Link>

              <span className="text-xs text-white/60">
                Aqui não existe feed: só fatos.
              </span>
            </div>
          </section>

          {/* Preferências */}
          <details
            id="preferencias"
            className="mt-10 rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-white/85">
                    Preferências
                  </div>
                  <div className="mt-1 text-sm text-white/65">
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
                <span className="text-sm font-semibold text-white/85">
                  Cidade (opcional)
                </span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Ubá"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white/85 outline-none placeholder:text-white/40 focus:border-white/40"
                  disabled={loading}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/85">
                  CEP (prefixo) — opcional
                </span>
                <input
                  value={cepPrefix}
                  onChange={(e) =>
                    setCepPrefix(e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  placeholder="Ex: 36500"
                  className="rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-white/85 outline-none placeholder:text-white/40 focus:border-white/40"
                  disabled={loading}
                  inputMode="numeric"
                />
                <span className="text-xs text-white/65">
                  Se não souber, deixe em branco.
                </span>
              </label>

              {msg ? (
                <div className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80 backdrop-blur">
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
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white/85 hover:bg-white/15"
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
    <div className="rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur">
      <div className="text-xs font-semibold text-white/65">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white/85">{value}</div>
      <div className="mt-1 text-xs text-white/65">{hint}</div>
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
      className={`rounded-3xl border p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition ${
        highlight
          ? 'border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15'
          : 'border-white/15 bg-neutral-950/75 hover:bg-white/10'
      }`}
    >
      <div className="text-xs font-semibold text-white/65">{eyebrow}</div>
      <div className="mt-2 text-base font-semibold text-white/85">{title}</div>
      <div className="mt-2 text-sm text-white/70">{desc}</div>
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
    <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-white/65">Hoje no Marto</div>
          <div className="mt-2 text-lg font-semibold text-white/85">
            Missões rápidas (sem enrolação)
          </div>
          <div className="mt-1 text-sm text-white/65">
            O social aqui é consequência. Missões só existem quando são úteis.
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur">
          {loading ? '—' : `${done}/${total}`} feito
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {missions.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white/65">Missão</div>
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

            <div className="mt-2 text-sm font-semibold text-white/85">{m.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {typeof m.rewardPts === 'number' ? (
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                  +{m.rewardPts.toLocaleString('pt-BR')} pts
                </span>
              ) : null}
              {m.verified ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                  reputação vinculada
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                  opcional
                </span>
              )}
            </div>
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
                    className="text-xs font-semibold text-white/70 hover:text-white/85"
                  >
                    {m.cta}
                  </button>
                ) : (
                  <Link
                    href={m.href}
                    className="text-xs font-semibold text-white/70 hover:text-white/85"
                  >
                    {m.cta}
                  </Link>
                )
              ) : (
                <span className="text-xs text-white/65">MVP</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={(missions[0]?.href ?? '/dash/consumer/orders') as string}
          className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
        >
          Executar agora →
        </Link>

        <button
          type="button"
          onClick={() => scrollToId('preferencias')}
          className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white/85 hover:bg-white/15"
        >
          Ajustar preferências
        </button>
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
    : urgent?.desc ?? 'O Marto decide seu próximo passo com base no seu rastro real.';

  const href = urgent?.href ?? '/dash/consumer/orders';
  const cta = urgent?.cta ?? 'Abrir →';

  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition hover:bg-white/10"
    >
      <div className="text-xs font-semibold text-white/65">Próximo passo</div>
      <div className="mt-2 text-lg font-semibold text-white/85">{title}</div>
      <div className="mt-2 text-sm text-white/65">{desc}</div>
      {typeof urgent?.rewardPts === 'number' ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          recompensa estimada: +{urgent.rewardPts.toLocaleString('pt-BR')} pts
        </div>
      ) : null}

      <div className="mt-6 text-xs font-semibold text-white/70">{cta}</div>

      <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4 text-xs text-white/65 backdrop-blur">
        Aqui o Marto te guia por consequência: ação real → rastro → confiança.
      </div>
    </Link>
  );
}

function TrustCard() {
  return (
    <div className="rounded-3xl border border-white/15 bg-neutral-950/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="text-xs font-semibold text-white/65">Regra do Marto</div>
      <div className="mt-2 text-lg font-semibold text-white/85">
        Nada de conteúdo vazio
      </div>
      <div className="mt-2 text-sm text-white/65">
        Quando aparecer algo “social”, vai estar ligado a produto, serviço ou
        experiência real. O foco é decisão segura.
      </div>

      <div className="mt-6 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm text-white/70 backdrop-blur">
        Social como consequência — reputação como ativo.
      </div>
    </div>
  );
}

function InspoCard({ item }: { item: InspoItem }) {
  return (
    <Link
      href={item.href}
      className="rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur transition hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/85">{item.title}</div>
          <div className="mt-1 text-xs text-white/65">{item.meta}</div>
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

