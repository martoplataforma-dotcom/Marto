// apps/web/app/dash/consumer/orders/[id]/page.tsx
'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchJSON, type ApiError } from '../../../../../src/lib/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

// ✅ helpers de “dismiss” (card de post verificado)
function dismissKey(orderId: string) {
  return `marto:dismiss_post_card:${orderId}`;
}

function isDismissed(orderId: string) {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(dismissKey(orderId));
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() < ts;
}

function dismissForDays(orderId: string, days: number) {
  if (typeof window === 'undefined') return;
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(dismissKey(orderId), String(until));
}

// ✅ helper: extrair capa do campo images
function coverFromImages(images: unknown): string | null {
  // aceita:
  // - ["url", ...]
  // - [{ url: "..." }, ...]
  // - { urls: [...] } ou { items: [...] } (fallback)
  if (!images) return null;

  if (Array.isArray(images)) {
    const first = images[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first && typeof first === 'object') {
      const url = (first as Record<string, unknown>).url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
    return null;
  }

  if (typeof images === 'object') {
    const r = images as Record<string, unknown>;
    const arr = Array.isArray(r.urls)
      ? r.urls
      : Array.isArray(r.items)
        ? r.items
        : null;
    if (arr && arr.length) return coverFromImages(arr);
  }

  return null;
}

// ✅ SUBSTITUIR toAbsoluteUrl por este (inteiro)
function apiOrigin() {
  // Seu .env tem NEXT_PUBLIC_API_URL = http://localhost:3001/api
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  // remove o /api do final (ou no meio) pra virar ORIGIN
  // ex: http://localhost:3001/api -> http://localhost:3001
  return base.replace(/\/api\/?$/, '');
}

function toAbsoluteUrl(url: string | null) {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;

  // já é absoluta
  if (u.startsWith('http://') || u.startsWith('https://')) return u;

  // vira absoluta usando ORIGIN (sem /api)
  const origin = apiOrigin();

  if (u.startsWith('/')) return `${origin}${u}`;
  return `${origin}/${u}`;
}

type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
};

type OrderServiceOffer = {
  serviceType: string;
  isRequired: boolean;
  sortOrder: number;
};

type OrderServiceOfferItem = {
  productId: string;
  quantity: number;
  services: OrderServiceOffer[];
};

type ServiceOfferSummary = {
  hasServiceOptions: boolean;
  serviceTypes: string[];
  items: OrderServiceOfferItem[];
};

type ProviderOption = {
  id: string;
  city?: string | null;
  cepPrefix?: string | null;
  kind?: string | null;
  specialties: string[];
  matchedServiceTypes?: string[];
  rankingScore?: number;
  reputation?: {
    averageRating?: number | null;
    reviewCount?: number | null;
  } | null;
  profile?: {
    handle?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

type ProviderOptionsOk = {
  ok: true;
  orderId: string;
  serviceTypes: string[];
  providers: ProviderOption[];
};

type ProviderOptionsFail = {
  ok: false;
  message?: string;
};

type ProviderOptionsResponse = ProviderOptionsOk | ProviderOptionsFail;

type OrderServiceRequest = {
  id: string;
  orderId: string;
  userId: string;
  providerId?: string | null;
  serviceType: string;
  linkedProductId?: string | null;
  title: string;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  provider?: {
    id: string;
    city?: string | null;
    kind?: string | null;
    profile?: {
      handle?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
    } | null;
  } | null;
  serviceReview?: {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type OrderServiceRequestsResponse = {
  ok: true;
  orderId: string;
  requests: OrderServiceRequest[];
};

type OrderEvent = {
  id: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  message?: string | null;
  meta?: unknown;
  createdAt: string;
};

type Order = {
  id: string;
  status: string;
  merchantId: string;
  // ✅ NOVO: merchant no payload
  merchant?: { id: string; tradeName: string | null } | null;
  userId: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
  serviceOfferSummary?: ServiceOfferSummary | null;
};

type ShipmentEvent = {
  id: string;
  shipmentId: string;
  status: string;
  description?: string | null;
  createdAt: string;
};

type Shipment = {
  id: string;
  orderId: string;
  status: string;
  transporterId?: string | null;
  events?: ShipmentEvent[];
  review?: {
    id: string;
    shipmentId: string;
    rating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
    comment?: string | null;
    createdAt: string;
  } | null;
};

// ✅ ProductLite (ajustado)
type ProductLite = {
  id: string;
  title?: string | null;
  images?: unknown;
};

// ✅ cache em memória + loader
const productCache = new Map<string, ProductLite>();

async function loadProduct(productId: string): Promise<ProductLite | null> {
  const pid = String(productId ?? '').trim();
  if (!pid) return null;

  const cached = productCache.get(pid);
  if (cached) return cached;

  const token = getToken();
  if (!token) return null;

  // ✅ ajuste rota se for diferente no seu backend
  const res = await fetchJSON<unknown>(`/products/${encodeURIComponent(pid)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const p =
    res && typeof res === 'object'
      ? (res as Record<string, unknown>).product ?? res
      : null;

  if (!p || typeof p !== 'object') return null;

  const pr = p as Record<string, unknown>;

  const out: ProductLite = {
    id: pid,
    title: typeof pr.title === 'string' ? pr.title : null,
    images: pr.images,
  };

  productCache.set(pid, out);
  return out;
}

// ✅ tipos do response: /orders/:id
type OrderByIdOk = { ok: true; order: Order };
type OrderByIdFail = { ok: false; message?: string };
type OrderByIdResponse = OrderByIdOk | OrderByIdFail;

function isOrderByIdOk(res: unknown): res is OrderByIdOk {
  if (!res || typeof res !== 'object') return false;
  const r = res as Record<string, unknown>;
  return r.ok === true && !!r.order && typeof r.order === 'object';
}

function orderByIdErrorMessage(res: unknown): string {
  if (!res || typeof res !== 'object') return 'Falha ao carregar pedido';
  const r = res as Record<string, unknown>;
  const msg = r.message;
  return typeof msg === 'string' && msg.trim()
    ? msg
    : 'Falha ao carregar pedido';
}

type SetStatusOk = { ok: true; order: unknown };
type SetStatusFail = { ok: false; message?: string };
type SetStatusResponse = SetStatusOk | SetStatusFail;

type OrderStatus =
  | 'CREATED'
  | 'PAID'
  | 'CONFIRMED_BY_SELLER'
  | 'READY_FOR_PICKUP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | string;

type PayMethod = 'PIX' | 'CARD';
type DeliveryMode = 'PICKUP' | 'DELIVERY';

type PayMode = 'PAYMENTS_MOCK' | 'DIRECT_PAID';

// ✅ troque aqui conforme seu backend hoje
const PAY_MODE: PayMode = 'PAYMENTS_MOCK';
// const PAY_MODE: PayMode = 'DIRECT_PAID';

function buyerActionsAllowed(status: OrderStatus) {
  const s = String(status ?? '').toUpperCase();

  // ajuste aqui se sua regra permitir cancelar em PAID
  const canCancel = s === 'CREATED' || s === 'PAID';

  return {
    canPay: s === 'CREATED',
    canCancel,
    canReturn: s === 'DELIVERED',
    isReturnRequested: s === 'RETURN_REQUESTED',
    isCompleted: s === 'COMPLETED',
  };
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('pt-BR');
  } catch {
    return dt;
  }
}

function badgeClass(status: string) {
  const s = String(status || '').toUpperCase();
  if (s.includes('CANCEL'))
    return 'bg-red-500/15 text-red-100 border-red-500/25';
  if (s.includes('RETURN') || s.includes('DISPUTE'))
    return 'bg-amber-500/15 text-amber-100 border-amber-500/25';
  if (s.includes('DELIVER'))
    return 'bg-emerald-500/15 text-emerald-100 border-emerald-500/25';
  if (s.includes('TRANSIT'))
    return 'bg-sky-500/15 text-sky-100 border-sky-500/25';
  if (s.includes('PAID') || s.includes('CONFIRM'))
    return 'bg-violet-500/15 text-violet-100 border-violet-500/25';
  return 'bg-white/10 text-white/90 border-white/15';
}

// ✅ label PT-BR para status da entrega
function shipmentStatusPT(raw: unknown) {
  const s = String(raw ?? '').toUpperCase();
  if (!s || s === '—') return '—';

  if (s === 'CREATED') return 'Criada';
  if (s === 'PICKED_UP') return 'Coletada';
  if (s === 'IN_TRANSIT') return 'Em trânsito';
  if (s === 'DELIVERED') return 'Entregue';
  if (s === 'CANCELLED') return 'Cancelada';

  return s;
}

// ✅ label PT-BR para status do pedido
function statusLabelPT(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'CREATED') return 'Criado';
  if (s === 'PAID') return 'Pago';
  if (s === 'CONFIRMED_BY_SELLER') return 'Confirmado pelo Loja';
  if (s === 'READY_FOR_PICKUP') return 'Pronto para coleta';
  if (s === 'IN_TRANSIT') return 'Em trânsito';
  if (s === 'DELIVERED') return 'Entregue';
  if (s === 'COMPLETED') return 'Concluído';
  if (s === 'CANCELLED') return 'Cancelado';
  if (s === 'RETURN_REQUESTED') return 'Devolução solicitada';
  return s;
}

function normStatus(s: unknown): string {
  return String(s ?? '').trim().toUpperCase();
}

function isPaidStatus(s: unknown): boolean {
  return normStatus(s) === 'PAID';
}

function needsPaymentGate(s: unknown): boolean {
  const st = normStatus(s);
  return st === 'CREATED' || st === 'PENDING_PAYMENT';
}

function parseBRNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (Number.isNaN(n)) return null;
  return n;
}

function totalLabel(order: Order) {
  const items = Array.isArray(order.items) ? order.items : [];
  let sum = 0;
  for (const it of items) {
    const q = Number(it.quantity ?? 0);
    const up = parseBRNumber(it.unitPrice) ?? 0;
    sum += q * up;
  }
  return sum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type ApiFailShape = { ok: false; message?: string };

function isApiFailShape(x: unknown): x is ApiFailShape {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return r.ok === false;
}

async function postOrderStatus(
  orderId: string,
  toStatus: string,
  message?: string,
) {
  const token = getToken();
  if (!token) throw new Error('Sem token. Faça login novamente.');

  const data = await fetchJSON<SetStatusResponse>(`/orders/${orderId}/status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ toStatus, message: message || undefined }),
  });

  if (isApiFailShape(data)) {
    throw new Error(
      typeof data.message === 'string' && data.message.trim()
        ? data.message
        : 'Falha ao atualizar status',
    );
  }

  return data;
}

async function postMockPayment(orderId: string) {
  const token = getToken();
  if (!token) throw new Error('Sem token. Faça login novamente.');

  const res = await fetch(`/api/payments/mock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      data && typeof data === 'object'
        ? (data as Record<string, unknown>).message ??
          (data as Record<string, unknown>).error
        : null;

    throw new Error(
      typeof msg === 'string' && msg.trim()
        ? msg
        : `Falha ao pagar (${res.status})`,
    );
  }

  return data;
}

async function postCreatePaymentForOrder(
  orderId: string,
  method: PayMethod,
): Promise<{ paymentId: string }> {
  const token = getToken();
  if (!token) throw new Error('Sem token. Faça login novamente.');

  const res = await fetchJSON<{
    ok?: boolean;
    paymentId?: string;
    status?: string;
    message?: string;
  }>(`/payments/order/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ method }),
  });

  if (
    (res as Record<string, unknown> | null)?.ok === false ||
    !(res as Record<string, unknown> | null)?.paymentId
  ) {
    throw new Error(
      ((res as Record<string, unknown> | null)?.message as string) ||
        'Falha ao criar cobrança',
    );
  }

  return {
    paymentId: String((res as Record<string, unknown>).paymentId),
  };
}

async function postConfirmPayment(paymentId: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Sem token. Faça login novamente.');

  const res = await fetchJSON<{
    ok?: boolean;
    status?: string;
    message?: string;
  }>(`/payments/${encodeURIComponent(paymentId)}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });

  const status = String(
    (res as Record<string, unknown> | null)?.status ?? '',
  ).toUpperCase();
  if (
    (res as Record<string, unknown> | null)?.ok === false ||
    status !== 'PAID'
  ) {
    throw new Error(
      ((res as Record<string, unknown> | null)?.message as string) ||
        'Falha ao confirmar pagamento',
    );
  }
}

// ✅ helper único de copiar texto
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ✅ pega o primeiro productId de um order (compatível sem usar any)
function firstProductIdFromOrder(orderLike: unknown): string | null {
  if (!orderLike || typeof orderLike !== 'object') return null;

  const o = orderLike as Record<string, unknown>;

  const tryArray = (key: 'items' | 'orderItems') => {
    const arr = o[key];
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const first = arr[0];
    if (!first || typeof first !== 'object') return null;

    const pid = (first as Record<string, unknown>).productId;
    if (typeof pid === 'string' && pid.trim()) return pid;
    return null;
  };

  return tryArray('items') ?? tryArray('orderItems');
}

function Btn({
  tone,
  disabled,
  children,
  onClick,
  title,
}: {
  tone: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const base = 'rounded-xl px-3 py-2 text-sm font-semibold transition border';
  const styles =
    tone === 'primary'
      ? 'border-white/15 bg-white text-black hover:opacity-90'
      : tone === 'danger'
        ? 'border-red-500/25 bg-red-500/10 text-red-100 hover:bg-red-500/15'
        : 'border-white/15 bg-white/10 text-white hover:bg-white/15';

  return (
    <button
      type="button"
      className={`${base} ${styles} ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  assembly: 'Montagem',
  installation: 'Instalação',
  maintenance: 'Manutenção',
  delivery: 'Entrega',
  technical_visit: 'Visita técnica',
  electrical: 'Elétrica',
  hydraulic: 'Hidráulica',
  carpentry: 'Marcenaria',
  upholstery: 'Estofaria',
};

function serviceTypeLabel(value: string) {
  return SERVICE_TYPE_LABELS[String(value ?? '').trim()] ?? value;
}

export default function ConsumerOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = String(id ?? '');

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [toast, setToast] = useState<string>('');

  const [shipment, setShipment] = useState<Shipment | null>(null);

  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string>('');

  const [showCancelModal, setShowCancelModal] = useState(false);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  // ✅ (Montagem)
  const [showAssemblyModal, setShowAssemblyModal] = useState(false);
  const [assemblyNotes, setAssemblyNotes] = useState('');

  // ✅ states da montagem (loading/erro)
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<
    null | 'CANCEL' | 'PAY' | 'RETURN'
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('PIX');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('PICKUP');
  const [deliveryCep, setDeliveryCep] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  // ✅ ids vizinhos (front-only) — não dá mais pra calcular sem /orders/me
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);

  // ✅ eventos locais (UI-only)
  const [localEvents, setLocalEvents] = useState<
    {
      key: string;
      source: 'SERVICE';
      title: string;
      desc?: string;
      createdAt: string;
    }[]
  >([]);

  // ✅ checar se já existe post verificado desse pedido
  const [hasPost, setHasPost] = useState(false);
  const [checkingPost, setCheckingPost] = useState(true);

  // ✅ state pra controlar se o card foi dismissado
  const [hidePostCard, setHidePostCard] = useState(false);

  // ✅ state para map de produtos carregados
  const [productsById, setProductsById] = useState<Record<string, ProductLite>>(
    {},
  );
  const [providerOptionsOpen, setProviderOptionsOpen] = useState(false);
  const [providerOptionsLoading, setProviderOptionsLoading] = useState(false);
  const [providerOptionsError, setProviderOptionsError] = useState<string | null>(
    null,
  );
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [providerOptionServiceTypes, setProviderOptionServiceTypes] = useState<
    string[]
  >([]);
  const [serviceRequestLoadingKey, setServiceRequestLoadingKey] = useState<
    string | null
  >(null);
  const [serviceRequestError, setServiceRequestError] = useState<string | null>(
    null,
  );
  const [orderServiceRequests, setOrderServiceRequests] = useState<
    OrderServiceRequest[]
  >([]);
  const [orderServiceRequestsLoading, setOrderServiceRequestsLoading] =
    useState(false);
  const [orderServiceRequestsError, setOrderServiceRequestsError] = useState<
    string | null
  >(null);
  const [reviewSubmittingKey, setReviewSubmittingKey] = useState<string | null>(
    null,
  );
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orderId) return;
    setHidePostCard(isDismissed(orderId));
  }, [orderId]);

  function reviewStarsLabel(
    rating: Shipment['review'] extends infer R
      ? R extends { rating: infer T }
        ? T
        : never
      : never,
  ) {
    const v = String(rating ?? '').toUpperCase();
    if (v === 'ONE') return '1';
    if (v === 'TWO') return '2';
    if (v === 'THREE') return '3';
    if (v === 'FOUR') return '4';
    if (v === 'FIVE') return '5';
    return '—';
  }

  async function submitShipmentReview() {
    if (!shipment?.id) return;

    if (shipment.review) {
      setReviewMsg('Esta entrega já foi avaliada.');
      return;
    }

    setReviewLoading(true);
    setReviewMsg('');
    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      await fetchJSON(
        `/logistics/shipments/${encodeURIComponent(shipment.id)}/review`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rating: reviewRating, // 1..5
            comment: reviewComment?.trim() || undefined,
          }),
        },
      );

      // ✅ (1) limpa o textarea após sucesso
      setReviewComment('');
      // mantém a nota (se quiser resetar):
      // setReviewRating(5);

      // ✅ (2) mensagem “Marto”
      setReviewMsg('✅ Avaliação registrada no seu rastro.');

      setReloadTick((t) => t + 1);
    } catch (e) {
      setReviewMsg(e instanceof Error ? e.message : 'Erro ao enviar avaliação');
    } finally {
      setReviewLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      const res = await fetchJSON<OrderByIdResponse>(
        `/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!isOrderByIdOk(res)) throw new Error(orderByIdErrorMessage(res));

      const found = res.order ?? null;
      setOrder(found);

      setPrevId(null);
      setNextId(null);

      if (found?.id) {
        try {
          const shRaw = await fetchJSON<unknown>(
            `/logistics/shipments/by-order/${encodeURIComponent(found.id)}`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          const sh =
            shRaw &&
            typeof shRaw === 'object' &&
            'ok' in shRaw &&
            (shRaw as Record<string, unknown>).ok === true &&
            'shipment' in shRaw
              ? ((shRaw as Record<string, unknown>).shipment as Shipment | null)
              : (shRaw as Shipment | null);

          setShipment(sh ?? null);
        } catch {
          setShipment(null);
        }
      } else {
        setShipment(null);
      }
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae?.message || 'Erro ao carregar');
      setOrder(null);
      setShipment(null);
      setPrevId(null);
      setNextId(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadProviderOptions() {
    if (!order?.id) return;

    setProviderOptionsError(null);
    setProviderOptionsLoading(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      const res = await fetchJSON<ProviderOptionsResponse>(
        `/orders/${encodeURIComponent(order.id)}/provider-options`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res || typeof res !== 'object' || res.ok !== true) {
        throw new Error(
          (res &&
          typeof res === 'object' &&
          'message' in res &&
          typeof res.message === 'string'
            ? res.message
            : 'Falha ao carregar profissionais compatíveis.') ||
            'Falha ao carregar profissionais compatíveis.',
        );
      }

      setProviderOptionServiceTypes(
        Array.isArray(res.serviceTypes) ? res.serviceTypes : [],
      );
      setProviderOptions(Array.isArray(res.providers) ? res.providers : []);
      setProviderOptionsOpen(true);
    } catch (e) {
      setProviderOptionsError(
        e instanceof Error ? e.message : 'Erro ao carregar profissionais.',
      );
      setProviderOptions([]);
      setProviderOptionServiceTypes([]);
      setProviderOptionsOpen(true);
    } finally {
      setProviderOptionsLoading(false);
    }
  }

  async function requestServiceWithProvider(provider: ProviderOption) {
    if (!order?.id) return;

    setServiceRequestError(null);
    setServiceRequestLoadingKey(provider.id);

    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      const matchedServiceType = providerOptionServiceTypes.find((serviceType) =>
        provider.specialties.includes(serviceType),
      );

      if (!matchedServiceType) {
        throw new Error(
          'Nenhum serviço compatível encontrado para este prestador.',
        );
      }

      const linkedItem = order.serviceOfferSummary?.items.find((entry) =>
        entry.services.some(
          (service) => service.serviceType === matchedServiceType,
        ),
      );

      const linkedProductId = linkedItem?.productId ?? undefined;

      const sr = await fetchJSON<{
        id: string;
        orderId: string;
        providerId?: string | null;
        serviceType?: string | null;
        linkedProductId?: string | null;
        title: string;
        notes: string | null;
        status: string;
        createdAt: string;
      }>('/service-requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          providerId: provider.id,
          serviceType: matchedServiceType,
          linkedProductId,
          title: `Solicitação de ${serviceTypeLabel(matchedServiceType)}`,
          notes: `Pedido ${order.id} • prestador selecionado pelo consumidor`,
        }),
      });

      setToast(
        `✅ Serviço solicitado com ${
          provider.profile?.displayName ||
          provider.profile?.handle ||
          'prestador'
        }. ID: ${sr.id}`,
      );

      setLocalEvents((prev) => [
        ...prev,
        {
          key: `service:${sr.id}`,
          source: 'SERVICE',
          title: `Serviço solicitado: ${serviceTypeLabel(matchedServiceType)}`,
          desc: `Prestador: ${
            provider.profile?.displayName ||
            provider.profile?.handle ||
            provider.id
          }`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setServiceRequestError(
        e instanceof Error ? e.message : 'Erro ao solicitar serviço.',
      );
    } finally {
      setServiceRequestLoadingKey(null);
    }
  }

  async function submitServiceReview(serviceRequest: OrderServiceRequest) {
    try {
      setReviewError(null);
      setReviewSubmittingKey(serviceRequest.id);

      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');

      const rating = Number(reviewRatings[serviceRequest.id] ?? 0);
      const comment = String(reviewComments[serviceRequest.id] ?? '').trim();

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Escolha uma nota de 1 a 5.');
      }

      const created = await fetchJSON<{
        id: string;
        rating: number;
        comment?: string | null;
        createdAt: string;
        updatedAt: string;
      }>('/service-requests/reviews', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceRequestId: serviceRequest.id,
          rating,
          comment: comment || undefined,
        }),
      });

      setOrderServiceRequests((prev) =>
        prev.map((item) =>
          item.id === serviceRequest.id
            ? {
                ...item,
                serviceReview: {
                  id: created.id,
                  rating: created.rating,
                  comment: created.comment ?? null,
                  createdAt: created.createdAt,
                  updatedAt: created.updatedAt,
                },
              }
            : item,
        ),
      );

      setToast('✅ Avaliação enviada com sucesso.');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Erro ao enviar avaliação.');
    } finally {
      setReviewSubmittingKey(null);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, reloadTick]);

  useEffect(() => {
    let alive = true;

    async function loadOrderServiceRequests() {
      if (!order?.id) return;

      try {
        setOrderServiceRequestsLoading(true);
        setOrderServiceRequestsError(null);

        const token = getToken();
        if (!token) throw new Error('Sem token. Faça login novamente.');

        const res = await fetchJSON<OrderServiceRequestsResponse>(
          `/service-requests/by-order/${encodeURIComponent(order.id)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!alive) return;
        setOrderServiceRequests(Array.isArray(res?.requests) ? res.requests : []);
      } catch (e) {
        if (!alive) return;
        setOrderServiceRequestsError(
          e instanceof Error ? e.message : 'Erro ao carregar serviços do pedido.',
        );
        setOrderServiceRequests([]);
      } finally {
        if (alive) setOrderServiceRequestsLoading(false);
      }
    }

    void loadOrderServiceRequests();

    return () => {
      alive = false;
    };
  }, [order?.id]);

  useEffect(() => {
    if (!order?.id) return;

    const token = getToken();
    if (!token) {
      setCheckingPost(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setCheckingPost(true);

        const res = await fetch(`/api/social/posts/by-order/${order.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = (await res.json()) as { posts?: unknown[] };
        const has = Array.isArray(data.posts) && data.posts.length > 0;

        if (alive) setHasPost(has);
      } finally {
        if (alive) setCheckingPost(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [order?.id]);

  useEffect(() => {
    const items = order?.items ?? [];
    if (!items.length) return;

    let alive = true;

    (async () => {
      const ids = Array.from(
        new Set(
          items
            .map((it) => String(it.productId ?? '').trim())
            .filter(Boolean),
        ),
      );

      const results = await Promise.all(
        ids.map(async (pid) => {
          try {
            return await loadProduct(pid);
          } catch {
            return null;
          }
        }),
      );

      if (!alive) return;

      setProductsById((prev) => {
        const next = { ...prev };
        for (const p of results) {
          if (p?.id) next[p.id] = p;
        }
        return next;
      });
    })();

    return () => {
      alive = false;
    };
  }, [order?.items]);

  // ✅ Timeline unificada (ORDER + ENTREGA + SERVICE UI-only)
  type UnifiedEvent = {
    key: string;
    source: 'ORDER' | 'SHIPMENT' | 'SERVICE';
    title: string;
    desc?: string | null;
    createdAt: string;
  };

  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    const list: UnifiedEvent[] = [];

    for (const ev of order?.events ?? []) {
      list.push({
        key: `order:${ev.id}`,
        source: 'ORDER',
        title:
          ev.fromStatus && ev.toStatus
            ? `${statusLabelPT(ev.fromStatus)} → ${statusLabelPT(ev.toStatus)}`
            : statusLabelPT(String(ev.toStatus ?? ev.type ?? 'EVENT')),
        desc:
          ev.message ??
          `Ação: ${(ev.actorRole ?? '—').toString().toLowerCase()} de ${
            ev.fromStatus ?? '—'
          } → ${ev.toStatus ?? '—'}`,
        createdAt: ev.createdAt,
      });
    }

    for (const sev of shipment?.events ?? []) {
      list.push({
        key: `ship:${sev.id}`,
        source: 'SHIPMENT',
        title: shipmentStatusPT(sev.status),
        desc: sev.description ?? null,
        createdAt: sev.createdAt,
      });
    }

    for (const lev of localEvents) {
      list.push({
        key: lev.key,
        source: 'SERVICE',
        title: lev.title,
        desc: lev.desc ?? null,
        createdAt: lev.createdAt,
      });
    }

    // ✅ mais recente no topo (melhor UX)
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return list;
  }, [order?.events, shipment?.events, localEvents]);

  // ✅ ÚLTIMA ATUALIZAÇÃO (rastro real)
  const lastOrderEventAt = useMemo(() => {
    const evs = order?.events ?? [];
    if (!evs.length) return null;
    return evs.reduce((acc, ev) => {
      const t = +new Date(ev.createdAt);
      return t > acc ? t : acc;
    }, 0);
  }, [order?.events]);

  const lastShipmentEventAt = useMemo(() => {
    const evs = shipment?.events ?? [];
    if (!evs.length) return null;
    return evs.reduce((acc, ev) => {
      const t = +new Date(ev.createdAt);
      return t > acc ? t : acc;
    }, 0);
  }, [shipment?.events]);

  const status = (order?.status ?? '') as OrderStatus;
  const allow = buyerActionsAllowed(status);

  async function doSetStatus(toStatus: string, message?: string) {
    if (!orderId) return;

    setToast('');
    try {
      await postOrderStatus(orderId, toStatus, message);
      setToast(`Status atualizado → ${toStatus}`);
      setReloadTick((t) => t + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao atualizar status.';
      setToast(msg);
    }
  }

  async function confirmCancel() {
    if (!order?.id) return;

    setActionError(null);
    setActionLoading('CANCEL');

    try {
      await postOrderStatus(order.id, 'CANCELLED');
      setShowCancelModal(false);
      setReloadTick((t) => t + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao cancelar');
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmPay() {
    if (!order?.id) return;

    if (payMethod === 'CARD') {
      setToast('💳 Cartão: em breve no Marto Pay.');
      return;
    }

    setActionError(null);
    setActionLoading('PAY');
    setToast('⏳ Iniciando Marto Pay…');

    try {
      const { paymentId } = await postCreatePaymentForOrder(order.id, payMethod);
      await postConfirmPayment(paymentId);

      setToast('✅ Pagamento confirmado. Atualizando status…');

      setLocalEvents((prev) => [
        ...prev,
        {
          key: `service:pay-${Date.now()}`,
          source: 'SERVICE',
          title: 'Pagamento confirmado',
          desc: `Pagamento confirmado (MVP). paymentId: ${paymentId}`,
          createdAt: new Date().toISOString(),
        },
      ]);

      setReloadTick((t) => t + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao pagar');
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmReturn() {
    if (!order?.id) return;

    setActionError(null);
    setActionLoading('RETURN');

    try {
      await postOrderStatus(
        order.id,
        'RETURN_REQUESTED',
        returnReason?.trim() ? returnReason.trim() : undefined,
      );

      setShowReturnModal(false);
      setReturnReason('');
      setReloadTick((t) => t + 1);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Erro ao pedir devolução',
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function createAssemblyRequest() {
    setAssemblyError(null);
    setAssemblyLoading(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Sem token. Faça login novamente.');
      if (!orderId) throw new Error('orderId inválido');

      const sr = await fetchJSON<{
        id: string;
        orderId: string;
        title: string;
        notes: string | null;
        status: string;
        createdAt: string;
      }>('/service-requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          title: 'Montagem',
          notes: assemblyNotes?.trim() || undefined,
        }),
      });

      setShowAssemblyModal(false);
      setAssemblyNotes('');
      setToast(`✅ Montagem solicitada. ID do serviço: ${sr.id}`);

      setLocalEvents((prev) => [
        ...prev,
        {
          key: `service:${sr.id}`,
          source: 'SERVICE',
          title: 'Serviço solicitado: Montagem',
          desc: `ID do serviço: ${sr.id}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setAssemblyError(
        e instanceof Error ? e.message : 'Erro ao solicitar montagem',
      );
    } finally {
      setAssemblyLoading(false);
    }
  }

  const canPost = String(order?.status ?? '').toUpperCase() === 'COMPLETED';

  // ✅ (NOVO) nextUrl para post
  const pid = firstProductIdFromOrder(order);
  const nextUrl = pid
    ? `/shop/p/${encodeURIComponent(pid)}/posts`
    : `/dash/consumer/orders/${encodeURIComponent(order?.id ?? orderId)}`;

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_10%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_520px_at_80%_0%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.55))]" />

      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Compra</h1>
            <p className="text-sm text-white/75">
              Acompanhe o histórico completo da sua compra.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dash/consumer/orders"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              Voltar
            </Link>

            {prevId ? (
              <Link
                href={`/dash/consumer/orders/${prevId}`}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                ← Anterior
              </Link>
            ) : null}

            {nextId ? (
              <Link
                href={`/dash/consumer/orders/${nextId}`}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                Próximo →
              </Link>
            ) : null}
          </div>
        </header>

        {toast ? (
          <div className="mb-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            {toast}
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
            {actionError}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Carregando…
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {err}
          </div>
        ) : !order ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
            Pedido não encontrado.
          </div>
        ) : (
          <section className="grid gap-4 lg:grid-cols-3">
            {/* Card resumo + ações buyer */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/75">ID</div>

                    <button
                      type="button"
                      className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                      onClick={async () => {
                        const ok = await copyText(order.id);
                        setToast(ok ? '✅ ID copiado' : 'Não foi possível copiar o ID');
                      }}
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="break-all text-sm font-medium text-white/95">
                    {order.id}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                    order.status,
                  )}`}
                >
                  <div className="grid">
                    <div>{statusLabelPT(order.status)}</div>
                    <div className="mt-1 text-[11px] font-medium text-white/70">
                      Loja:{' '}
                      <span className="font-mono text-white/80">
                        {order.merchant?.tradeName
                          ? order.merchant.tradeName
                          : order.merchant?.id ?? order.merchantId}
                      </span>
                    </div>
                  </div>
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Cidade/UF</span>
                  <span className="text-white/95">
                    {(order.city ?? '—') + ' / ' + (order.state ?? '—')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Loja</span>
                  <span className="break-all text-white/95">
                    {order.merchant?.tradeName
                      ? order.merchant.tradeName
                      : order.merchant?.id ?? order.merchantId ?? '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Criado</span>
                  <span className="text-white/95">{fmt(order.createdAt)}</span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Atualizado</span>
                  <span className="text-white/95">{fmt(order.updatedAt)}</span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span className="text-white/70">Total do pedido</span>
                  <span className="text-base font-semibold text-white">
                    {totalLabel(order)}
                  </span>
                </div>
              </div>

              {/* Itens */}
              <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="text-xs font-semibold text-white/85">Itens</div>

                {order.items?.length ? (
                  <div className="mt-3 grid gap-2">
                    {order.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            {(() => {
                              const p = productsById[String(it.productId)];
                              const title = p?.title?.trim() || null;

                              const img = toAbsoluteUrl(coverFromImages(p?.images));

                              return (
                                <div className="flex items-start gap-3">
                                  {img ? (
                                    <div className="shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={img}
                                        alt={title ?? 'Produto'}
                                        className="h-14 w-14 object-cover"
                                        loading="lazy"
                                        onError={() => {
                                          console.log('IMG ERROR:', img);
                                          setToast(`Falha ao carregar imagem: ${img}`);
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white/60">
                                      M
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white/90">
                                      {title ??
                                        `Produto ${String(it.productId).slice(0, 8)}…`}
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
                                      <span>
                                        ID:{' '}
                                        <span className="font-mono text-white/80">
                                          {it.productId}
                                        </span>
                                      </span>

                                      <Link
                                        href={`/shop/p/${String(it.productId)}`}
                                        className="text-white/75 underline decoration-white/20 underline-offset-2 hover:text-white"
                                      >
                                        Ver produto →
                                      </Link>
                                    </div>

                                    {/* ✅ Subtotal (mais “produto”) */}
                                    <div className="mt-1 text-xs text-white/65">
                                      {it.quantity} ×{' '}
                                      {Number(
                                        parseBRNumber(it.unitPrice) ?? 0,
                                      ).toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}{' '}
                                      ={' '}
                                      {(
                                        (Number(it.quantity ?? 0) || 0) *
                                        (parseBRNumber(it.unitPrice) ?? 0)
                                      ).toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            <button
                              type="button"
                              className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
                              onClick={async () => {
                                const pid = String(it.productId);
                                const ok = await copyText(pid);
                                setToast(
                                  ok
                                    ? '✅ productId copiado'
                                    : 'Não foi possível copiar o productId',
                                );
                              }}
                              title="Copiar productId"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>

                        <div className="shrink-0 text-sm font-semibold text-white/85">
                          {(
                            (Number(it.quantity ?? 0) || 0) *
                            (parseBRNumber(it.unitPrice) ?? 0)
                          ).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-white/70">Sem itens.</div>
                )}
              </div>

              {order.serviceOfferSummary?.hasServiceOptions ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white/85">
                        Profissionais para este pedido
                      </div>
                      <div className="mt-1 text-sm text-white/70">
                        O Marto encontrou prestadores compatíveis com os serviços
                        detectados nesta compra.
                      </div>
                    </div>

                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                      Pós-compra
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.serviceOfferSummary.serviceTypes.map((serviceType) => (
                      <span
                        key={serviceType}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85"
                      >
                        {serviceTypeLabel(serviceType)}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadProviderOptions()}
                      disabled={providerOptionsLoading}
                      className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {providerOptionsLoading
                        ? 'Carregando profissionais…'
                        : 'Ver profissionais para este pedido'}
                    </button>

                    {providerOptionsOpen ? (
                      <button
                        type="button"
                        onClick={() => setProviderOptionsOpen(false)}
                        className="rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                      >
                        Ocultar
                      </button>
                    ) : null}
                  </div>

                  {providerOptionsError ? (
                    <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
                      {providerOptionsError}
                    </div>
                  ) : null}

                  {providerOptionsOpen ? (
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-white/70">
                        Compatibilidade atual
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {providerOptionServiceTypes.map((serviceType) => (
                          <span
                            key={`provider-match:${serviceType}`}
                            className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/70"
                          >
                            {serviceTypeLabel(serviceType)}
                          </span>
                        ))}
                      </div>

                      {serviceRequestError ? (
                        <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
                          {serviceRequestError}
                        </div>
                      ) : null}

                      {providerOptionsLoading ? (
                        <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/75">
                          Buscando profissionais compatíveis…
                        </div>
                      ) : providerOptions.length === 0 ? (
                        <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/75">
                          Nenhum profissional compatível encontrado por enquanto.
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-3">
                          {providerOptions.map((provider) => {
                            const displayName =
                              provider.profile?.displayName?.trim() ||
                              provider.profile?.handle?.trim() ||
                              `Prestador ${provider.id.slice(0, 8)}…`;
                            const matchedCount = Array.isArray(
                              provider.matchedServiceTypes,
                            )
                              ? provider.matchedServiceTypes.length
                              : 0;

                            const hasReviews =
                              (provider.reputation?.reviewCount ?? 0) > 0;
                            const hasHighReputation =
                              hasReviews &&
                              (provider.reputation?.averageRating ?? 0) >= 4.5;

                            return (
                              <div
                                key={provider.id}
                                className="rounded-xl border border-white/10 bg-white/5 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white/90">
                                      {displayName}
                                    </div>

                                    <div className="mt-1 text-xs text-white/60">
                                      {provider.city
                                        ? `${provider.city}`
                                        : 'Cidade não definida'}
                                      {provider.cepPrefix
                                        ? ` • CEP base ${provider.cepPrefix}`
                                        : ''}
                                    </div>

                                    <div className="mt-1 text-xs text-white/60">
                                      {provider.reputation?.reviewCount
                                        ? `Nota média ${
                                            provider.reputation.averageRating ?? '-'
                                          } • ${provider.reputation.reviewCount} avaliação(ões)`
                                        : 'Ainda sem avaliações'}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {matchedCount > 0 ? (
                                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                                          Cobre {matchedCount} serviço
                                          {matchedCount > 1 ? 's' : ''} deste
                                          pedido
                                        </span>
                                      ) : null}

                                      {matchedCount >= 2 ? (
                                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                                          Melhor match
                                        </span>
                                      ) : null}

                                      {hasHighReputation ? (
                                        <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                                          Alta reputação
                                        </span>
                                      ) : !hasReviews ? (
                                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/60">
                                          Novo no Marto
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                                    {provider.kind ?? 'GENERIC'}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {provider.specialties.map((specialty) => (
                                    <span
                                      key={`${provider.id}:${specialty}`}
                                      className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/70"
                                    >
                                      {serviceTypeLabel(specialty)}
                                    </span>
                                  ))}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void requestServiceWithProvider(provider)
                                    }
                                    disabled={serviceRequestLoadingKey === provider.id}
                                    className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {serviceRequestLoadingKey === provider.id
                                      ? 'Solicitando…'
                                      : 'Solicitar serviço com este profissional'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {orderServiceRequestsError ? (
                <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
                  {orderServiceRequestsError}
                </div>
              ) : null}

              {reviewError ? (
                <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
                  {reviewError}
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/85">
                      Serviços deste pedido
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      Acompanhe as solicitações de serviço e avalie quando forem
                      concluídas.
                    </div>
                  </div>

                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                    {orderServiceRequestsLoading
                      ? 'Carregando…'
                      : `${orderServiceRequests.length} solicitações`}
                  </span>
                </div>

                {orderServiceRequestsLoading ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                    Carregando solicitações de serviço…
                  </div>
                ) : orderServiceRequests.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                    Este pedido ainda não possui solicitações de serviço.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {orderServiceRequests.map((request) => {
                      const providerName =
                        request.provider?.profile?.displayName?.trim() ||
                        request.provider?.profile?.handle?.trim() ||
                        'Prestador selecionado';

                      const selectedRating = reviewRatings[request.id] ?? 0;
                      const selectedComment = reviewComments[request.id] ?? '';

                      return (
                        <div
                          key={request.id}
                          className="rounded-xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white/90">
                                {request.title}
                              </div>

                              <div className="mt-1 text-xs text-white/60">
                                {serviceTypeLabel(request.serviceType)} •{' '}
                                {request.status}
                              </div>

                              {request.provider ? (
                                <div className="mt-1 text-xs text-white/60">
                                  Prestador: {providerName}
                                </div>
                              ) : null}

                              {request.linkedProductId ? (
                                <div className="mt-1 text-xs text-white/55">
                                  Produto vinculado:{' '}
                                  {request.linkedProductId.slice(0, 8)}…
                                </div>
                              ) : null}

                              {request.notes ? (
                                <p className="mt-2 text-sm text-white/70">
                                  {request.notes}
                                </p>
                              ) : null}
                            </div>

                            <span
                              className={[
                                'rounded-full border px-3 py-1 text-xs font-semibold',
                                request.status === 'COMPLETED'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                  : request.status === 'IN_PROGRESS'
                                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
                                    : request.status === 'ASSIGNED'
                                      ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                                      : request.status === 'CANCELLED'
                                        ? 'border-red-500/30 bg-red-500/10 text-red-200'
                                        : 'border-white/10 bg-white/5 text-white/70',
                              ].join(' ')}
                            >
                              {request.status}
                            </span>
                          </div>

                          {request.serviceReview ? (
                            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                              <div className="text-sm font-semibold text-emerald-200">
                                Serviço avaliado
                              </div>
                              <div className="mt-1 text-sm text-emerald-100">
                                Nota: {request.serviceReview.rating}/5
                              </div>
                              {request.serviceReview.comment ? (
                                <div className="mt-1 text-sm text-emerald-100/90">
                                  {request.serviceReview.comment}
                                </div>
                              ) : null}
                            </div>
                          ) : request.status === 'COMPLETED' ? (
                            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
                              <div className="text-sm font-semibold text-white/85">
                                Avaliar serviço
                              </div>
                              <div className="mt-1 text-sm text-white/65">
                                Conte ao Marto como foi esse atendimento.
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map((rating) => (
                                  <button
                                    key={`${request.id}:${rating}`}
                                    type="button"
                                    onClick={() =>
                                      setReviewRatings((prev) => ({
                                        ...prev,
                                        [request.id]: rating,
                                      }))
                                    }
                                    className={[
                                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                                      selectedRating === rating
                                        ? 'border-white bg-white text-black'
                                        : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
                                    ].join(' ')}
                                  >
                                    {rating}
                                  </button>
                                ))}
                              </div>

                              <div className="mt-3">
                                <textarea
                                  value={selectedComment}
                                  onChange={(e) =>
                                    setReviewComments((prev) => ({
                                      ...prev,
                                      [request.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Comentário opcional sobre o serviço…"
                                  className="min-h-[88px] w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                                />
                              </div>

                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => void submitServiceReview(request)}
                                  disabled={reviewSubmittingKey === request.id}
                                  className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
                                >
                                  {reviewSubmittingKey === request.id
                                    ? 'Enviando avaliação…'
                                    : 'Enviar avaliação'}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {order.serviceOfferSummary?.hasServiceOptions ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white/85">
                        Serviços disponíveis para este pedido
                      </div>
                      <div className="mt-1 text-sm text-white/70">
                        Este pedido pode receber serviços complementares na sua região.
                      </div>
                    </div>

                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75">
                      Pós-compra
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.serviceOfferSummary.serviceTypes.map((serviceType) => (
                      <span
                        key={serviceType}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85"
                      >
                        {serviceTypeLabel(serviceType)}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {order.serviceOfferSummary.items.map((entry) => {
                      const product = productsById[String(entry.productId)];
                      const title =
                        product?.title?.trim() || `Produto ${String(entry.productId).slice(0, 8)}…`;

                      return (
                        <div
                          key={entry.productId}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="text-sm font-semibold text-white/90">{title}</div>

                          <div className="mt-1 text-xs text-white/60">
                            Quantidade: {entry.quantity}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {entry.services.map((service) => (
                              <span
                                key={`${entry.productId}:${service.serviceType}`}
                                className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/70"
                              >
                                {serviceTypeLabel(service.serviceType)}
                                {service.isRequired ? ' • obrigatório' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-xs text-white/55">
                    Em breve você poderá contratar e agendar esses serviços diretamente aqui.
                  </div>
                </div>
              ) : null}

              {order && needsPaymentGate(order.status) ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  <div className="text-sm font-semibold text-white/85">
                    Pagamento pendente
                  </div>

                  <div className="mt-2 text-sm text-white/70">
                    O ciclo Marto só avança após o pagamento ser confirmado.
                  </div>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                    Status:{' '}
                    <span className="text-white/95">{String(order.status)}</span>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/15 bg-black/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-white/85">
                        Resumo da cobrança
                      </div>
                      <div className="text-xs font-semibold text-white/70">
                        Marto Pay
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 text-sm text-white/80">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/70">Itens</span>
                        <span className="text-white/95">
                          {Array.isArray(order?.items) ? order.items.length : 0}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/70">Total</span>
                        <span className="font-semibold text-white/95">
                          {order ? totalLabel(order) : '—'}
                        </span>
                      </div>

                      {order?.merchant?.tradeName ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/70">Loja</span>
                          <span className="text-white/95">
                            {order.merchant.tradeName}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs text-white/60">
                      Confirmação MVP (sandbox). Em produção: Pix com expiração
                      + webhook.
                    </div>
                  </div>

                  <section className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white/85">
                          Entrega
                        </div>
                        <div className="mt-1 text-xs text-white/65">
                          Defina como você quer receber - o ciclo avança com
                          rastreio e prova.
                        </div>
                      </div>

                      <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                        MVP
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryMode('PICKUP')}
                        className={[
                          'rounded-full border px-3 py-1 text-xs font-semibold',
                          deliveryMode === 'PICKUP'
                            ? 'border-white/25 bg-white/10 text-white/90'
                            : 'border-white/15 bg-black/40 text-white/70 hover:bg-white/5',
                        ].join(' ')}
                      >
                        Retirada
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryMode('DELIVERY')}
                        className={[
                          'rounded-full border px-3 py-1 text-xs font-semibold',
                          deliveryMode === 'DELIVERY'
                            ? 'border-white/25 bg-white/10 text-white/90'
                            : 'border-white/15 bg-black/40 text-white/70 hover:bg-white/5',
                        ].join(' ')}
                      >
                        Entrega
                      </button>
                    </div>

                    <div className="mt-2 text-xs text-white/60">
                      Retirada é uma capacidade da loja - em breve isso vem
                      travado por produto.
                    </div>

                    {deliveryMode === 'PICKUP' ? (
                      <div className="mt-3 rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white/75">
                        Você escolheu <b>Retirada</b>. A loja vai confirmar o
                        ponto e horário.
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-white/15 bg-black/40 p-3">
                        <div className="text-xs font-semibold text-white/85">
                          Endereço (MVP)
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <input
                            value={deliveryCep}
                            onChange={(e) => setDeliveryCep(e.target.value)}
                            placeholder="CEP"
                            className="w-full rounded-xl border border-white/15 bg-black/60 p-2 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
                          />
                          <input
                            value={deliveryCity}
                            onChange={(e) => setDeliveryCity(e.target.value)}
                            placeholder="Cidade"
                            className="w-full rounded-xl border border-white/15 bg-black/60 p-2 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
                          />
                          <input
                            value={deliveryState}
                            onChange={(e) => setDeliveryState(e.target.value)}
                            placeholder="UF"
                            className="w-full rounded-xl border border-white/15 bg-black/60 p-2 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
                          />
                        </div>

                        <div className="mt-2 text-xs text-white/60">
                          Em breve: cotação automática + transportadoras +
                          rastreio.
                        </div>
                      </div>
                    )}

                    {!shipment ? (
                      <div className="mt-3 text-xs text-white/60">
                        Status da transportadora:{' '}
                        <span className="text-white/70">—</span>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-white/60">
                        Status da transportadora:{' '}
                        <span className="text-white/80">
                          {shipmentStatusPT(shipment.status)}
                        </span>
                      </div>
                    )}
                  </section>

                  <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
                    <div className="text-xs font-semibold text-white/85">
                      Método
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPayMethod('PIX')}
                        className={[
                          'rounded-full border px-3 py-1 text-xs font-semibold',
                          payMethod === 'PIX'
                            ? 'border-white/25 bg-white/10 text-white/90'
                            : 'border-white/15 bg-black/40 text-white/70 hover:bg-white/5',
                        ].join(' ')}
                      >
                        PIX
                      </button>

                      <button
                        type="button"
                        disabled
                        className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white/45"
                        title="Em breve"
                      >
                        Cartão (em breve)
                      </button>
                    </div>

                    <div className="mt-2 text-xs text-white/60">
                      {payMethod === 'PIX'
                        ? 'PIX: confirmação MVP (sandbox).'
                        : 'Cartão estará disponível em breve.'}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => void confirmPay()}
                      className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading === 'PAY' ? 'Pagando…' : 'Pagar agora'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void load()}
                      className="rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                    >
                      Atualizar status
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Entrega */}
                  <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    <div className="text-xs font-semibold text-white/85">
                      Entrega
                    </div>

                    {!shipment ? (
                      <div className="mt-2 text-sm text-white/70">
                        Nenhuma entrega vinculada ainda para esta compra.
                      </div>
                    ) : (
                      <div className="mt-2 grid gap-2 text-sm text-white/80">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/70">Entrega</span>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-white/85">
                              {shipment.id}
                            </span>

                            <button
                              type="button"
                              className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white/75 hover:bg-white/10"
                              onClick={async () => {
                                const ok = await copyText(shipment.id);
                                setToast(
                                  ok
                                    ? '✅ ID da entrega copiado'
                                    : 'Não foi possível copiar o ID da entrega',
                                );
                              }}
                              title="Copiar ID da entrega"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/70">Status</span>
                          <span className="text-white/95">
                            {shipmentStatusPT(shipment.status)}
                          </span>
                        </div>

                        {String(shipment.status ?? '').toUpperCase().trim() ===
                          'DELIVERED' && !shipment.review ? (
                          <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                            Entrega concluída. Leva 30s: avalie agora para
                            registrar sua experiência.
                          </div>
                        ) : null}

                        {shipment.review ? (
                          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                            ✅ Entrega avaliada (
                            {reviewStarsLabel(shipment.review.rating)}★)
                          </div>
                        ) : shipment.status !== 'DELIVERED' ? (
                          <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/75">
                            Avaliação disponível após a entrega ser marcada como{' '}
                            <b>DELIVERED</b>.
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
                            <div className="text-xs font-semibold text-white/85">
                              Avaliar entrega
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <label className="text-xs text-white/70">
                                Nota (1–5)
                              </label>
                              <select
                                value={reviewRating}
                                onChange={(e) =>
                                  setReviewRating(Number(e.target.value))
                                }
                                className="rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-sm text-white/85"
                                disabled={
                                  reviewLoading || Boolean(shipment?.review)
                                }
                              >
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <textarea
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="Opcional: como foi a entrega?"
                              className="mt-2 w-full rounded-xl border border-white/15 bg-black/60 p-2 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
                              disabled={
                                reviewLoading || Boolean(shipment?.review)
                              }
                            />

                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={
                                  reviewLoading || Boolean(shipment?.review)
                                }
                                onClick={submitShipmentReview}
                                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {shipment?.review
                                  ? 'Avaliado'
                                  : reviewLoading
                                    ? 'Enviando…'
                                    : 'Enviar avaliação'}
                              </button>

                              {reviewMsg ? (
                                <div className="text-xs text-white/75">
                                  {reviewMsg}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pagamento (Marto) */}
                  {allow.canPay ? (
                    <div className="mt-4 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                      <div className="text-xs font-semibold text-white/85">
                        Pagamento
                      </div>
                      <div className="mt-2 text-sm text-white/75">
                        Este pedido foi criado e ainda não foi pago. Ao pagar, o
                        rastro avança e a loja pode confirmar.
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={false}
                          onClick={() => {
                            setToast('✅ clique chegou no botão');
                            console.log('CLICK PAY BUTTON');
                          }}
                          className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
                        >
                          TESTE CLIQUE
                        </button>

                        <span className="text-xs text-white/60">
                          (MVP) Pagamento simulado
                        </span>
                      </div>

                      {actionError ? (
                        <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                          {actionError}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Ações do comprador */}
                  <div className="mt-5 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                    <div className="text-xs font-semibold text-white/85">
                      Ações do comprador
                    </div>
                    <div className="mt-2 text-xs text-white/70">
                      Os botões aparecem/somem conforme o status.
                    </div>

                    {actionError && (
                      <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                        {actionError}
                      </div>
                    )}

                    {String(status).toUpperCase() === 'RETURN_REQUESTED' && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
                        ⏳ Devolução solicitada
                      </div>
                    )}

                    {String(status).toUpperCase() === 'COMPLETED' && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
                        ✅ Pedido concluído
                      </div>
                    )}

                    {String(status).toUpperCase() === 'DELIVERED' ? (
                      shipment ? (
                        <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                          Sua entrega foi marcada como <b>Entregue</b>. Confirme o
                          recebimento para concluir o pedido.
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                          Este pedido está como <b>Entregue</b>, mas ainda não
                          existe entrega vinculada. No MVP, a confirmação depende
                          da entrega.
                        </div>
                      )
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {allow.canCancel && (
                        <Btn
                          tone="ghost"
                          disabled={actionLoading !== null}
                          title="Cancelar"
                          onClick={() => {
                            setActionError(null);
                            setShowCancelModal(true);
                          }}
                        >
                          Cancelar
                        </Btn>
                      )}

                      {allow.canReturn &&
                        String(shipment?.status ?? '').toUpperCase() ===
                          'DELIVERED' && (
                          <button
                            type="button"
                            disabled={actionLoading !== null}
                            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => {
                              setActionError(null);
                              setShowReturnModal(true);
                            }}
                          >
                            Pedir devolução
                          </button>
                        )}

                      {String(status).toUpperCase() === 'DELIVERED' &&
                        String(shipment?.status ?? '').toUpperCase() ===
                          'DELIVERED' && (
                          <Btn
                            tone="primary"
                            disabled={actionLoading !== null}
                            title="Confirmar recebimento"
                            onClick={() => {
                              void doSetStatus('COMPLETED', 'recebido');
                            }}
                          >
                            Confirmar recebimento
                          </Btn>
                        )}

                      <Btn
                        tone="ghost"
                        disabled={
                          actionLoading !== null ||
                          String(status).toUpperCase().includes('CANCEL')
                        }
                        title="Contratar montagem"
                        onClick={() => {
                          setToast('');
                          setAssemblyError(null);
                          setShowAssemblyModal(true);
                        }}
                      >
                        Contratar montagem
                      </Btn>
                    </div>

                    {!allow.canPay &&
                    !allow.canCancel &&
                    !allow.canReturn &&
                    !allow.isReturnRequested &&
                    !allow.isCompleted &&
                    String(status).toUpperCase() !== 'DELIVERED' ? (
                      <div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3 text-xs text-white/75">
                        Nenhuma ação disponível agora.
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {/* Card Timeline */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur lg:col-span-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Histórico</div>
                  <div className="mt-1 text-xs text-white/70">
                    Cada mudança vira um evento — reputação e verdade.
                  </div>
                </div>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-white/70">Status da Loja</div>
                  <div className="mt-2 text-sm font-semibold text-white/90">
                    {statusLabelPT(order.status)}
                  </div>

                  <div className="mt-1 text-xs text-white/60">
                    {lastOrderEventAt
                      ? `Último evento: ${fmt(new Date(lastOrderEventAt).toString())}`
                      : '—'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-white/70">
                    Status da transportadora
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white/90">
                    {shipment ? shipmentStatusPT(shipment.status) : '—'}
                  </div>

                  <div className="mt-1 text-xs text-white/60">
                    {lastShipmentEventAt
                      ? `Último evento: ${fmt(
                          new Date(lastShipmentEventAt).toString(),
                        )}`
                      : '—'}
                  </div>
                </div>
              </div>

              {unifiedEvents.length === 0 ? (
                <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-sm text-white/75">
                  Ainda não há movimentações.
                </div>
              ) : (
                <div className="grid gap-3">
                  {unifiedEvents.map((ev, idx) => (
                    <div
                      key={ev.key}
                      className={`rounded-2xl border p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur ${
                        idx === 0
                          ? 'border-emerald-500/25 bg-emerald-500/10'
                          : 'border-white/15 bg-neutral-950/75'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              ev.source === 'ORDER'
                                ? 'border-white/15 bg-white/10 text-white/80'
                                : ev.source === 'SHIPMENT'
                                  ? 'border-sky-500/25 bg-sky-500/10 text-sky-100'
                                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                            }`}
                          >
                            {ev.source === 'ORDER'
                              ? 'Loja'
                              : ev.source === 'SHIPMENT'
                                ? 'Transportadora'
                                : 'Serviço'}
                          </span>

                          <div className="text-sm font-semibold text-white/90">{ev.title}</div>
                        </div>

                        <div className="text-xs text-white/70">{fmt(ev.createdAt)}</div>
                      </div>

                      {ev.desc ? (
                        <div className="mt-2 text-xs text-white/75">{ev.desc}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* Card Post verificado */}
              {canPost && !hidePostCard && (
                <section className="mt-6 rounded-2xl border border-white/15 bg-neutral-950/75 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-semibold text-white/85">
                      Transformar em post verificado
                    </div>

                    {/* ✅ TEXTO AJUSTADO (coerente: só libera após confirmar) */}
                    <div className="text-sm text-white/75">
                      Após <span className="text-white/85">confirmar o recebimento</span>,
                      você pode publicar sua experiência. O Marto marca como{' '}
                      <span className="text-white/85">verificado</span> porque veio de um
                      pedido real.
                    </div>

                    <div className="mt-2 text-xs text-white/70">
                      Isso aparece no seu perfil público e pode aparecer no produto/na
                      loja.
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {checkingPost ? (
                      <span className="rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-sm font-medium text-white/70">
                        Checando…
                      </span>
                    ) : hasPost ? (
                      <Link
                        href={
                          firstProductIdFromOrder(order)
                            ? `/shop/p/${encodeURIComponent(
                                String(firstProductIdFromOrder(order)),
                              )}/posts`
                            : `/dash/consumer/orders/${encodeURIComponent(order.id)}`
                        }
                        className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
                      >
                        ✅ Ver meu post no produto
                      </Link>
                    ) : (
                      <Link
                        href={`/dash/consumer/orders/${encodeURIComponent(
                          order.id,
                        )}/post?next=${encodeURIComponent(nextUrl)}`}
                        className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
                      >
                        Criar post
                      </Link>
                    )}

                    <button
                      type="button"
                      className="rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/5"
                      onClick={() => {
                        dismissForDays(orderId, 7);
                        setHidePostCard(true);
                        setToast('Ok — vou te lembrar depois.');
                      }}
                    >
                      Agora não
                    </button>
                  </div>
                </section>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Modal cancelar */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => (actionLoading ? null : setShowCancelModal(false))}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <h3 className="text-lg font-semibold text-white">Cancelar pedido?</h3>
            <p className="mt-2 text-sm text-white/75">
              Essa ação tenta cancelar o pedido imediatamente. Se o pedido já estiver
              avançado demais, o sistema pode negar.
            </p>

            {actionError && (
              <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                {actionError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setShowCancelModal(false)}
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={confirmCancel}
              >
                {actionLoading === 'CANCEL' ? 'Cancelando…' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal devolução */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => (actionLoading ? null : setShowReturnModal(false))}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <h3 className="text-lg font-semibold text-white">Pedir devolução</h3>
            <p className="mt-2 text-sm text-white/75">
              Explique rapidamente o motivo (opcional). Você poderá acompanhar o status
              na timeline.
            </p>

            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Ex: produto com avaria, não serviu, etc."
              className="mt-3 min-h-[90px] w-full rounded-xl border border-white/15 bg-black/60 p-3 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
            />

            {actionError && (
              <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                {actionError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setShowReturnModal(false)}
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={actionLoading !== null}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={confirmReturn}
              >
                {actionLoading ? 'Enviando…' : 'Confirmar devolução'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal montagem */}
      {showAssemblyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => (assemblyLoading ? null : setShowAssemblyModal(false))}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <h3 className="text-lg font-semibold text-white">Solicitar montagem</h3>
            <p className="mt-2 text-sm text-white/75">
              Essa solicitação fica vinculada à sua compra. O Marto usa isso para
              conectar você com prestadores disponíveis e registrar o resultado no seu
              histórico.
            </p>

            <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/85">
              <div className="text-xs font-semibold text-white/80">Vinculado à compra</div>
              <div className="mt-1 break-all font-mono text-xs text-white/75">{orderId}</div>
            </div>

            <label className="mt-4 block">
              <div className="text-sm font-semibold text-white/85">Observações (opcional)</div>
              <textarea
                value={assemblyNotes}
                onChange={(e) => setAssemblyNotes(e.target.value)}
                placeholder="Ex: preferir horário após 18h, cuidado com parede, etc."
                className="mt-2 min-h-[90px] w-full rounded-xl border border-white/15 bg-black/60 p-3 text-sm text-white/85 placeholder:text-white/50 focus:outline-none"
              />
              <div className="mt-2 text-xs text-white/65">
                (MVP) Isso prepara o fluxo de contratação. Vamos plugar no backend na
                etapa de serviços.
              </div>
            </label>

            {assemblyError ? (
              <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                {assemblyError}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={assemblyLoading}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setShowAssemblyModal(false)}
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={assemblyLoading}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void createAssemblyRequest();
                }}
              >
                {assemblyLoading ? 'Solicitando…' : 'Solicitar montagem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
