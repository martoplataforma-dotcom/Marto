// apps/api/src/modules/orders/orders.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderEventType, OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => {
      const j = toJsonValue(v);
      return j === undefined ? null : j;
    }) as Prisma.InputJsonArray;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, Prisma.InputJsonValue> = {};

    for (const [k, v] of Object.entries(obj)) {
      const j = toJsonValue(v);
      if (j !== undefined) out[k] = j;
    }

    return out as Prisma.InputJsonObject;
  }

  return undefined;
}

type ActorRole = 'buyer' | 'seller' | 'system';

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true; events: true };
}>;

function roleLabel(role: ActorRole) {
  if (role === 'buyer') return 'buyer';
  if (role === 'seller') return 'seller';
  return 'system';
}

// ✅ matriz de transição por papel
const ALLOWED: Record<string, Record<string, OrderStatus[]>> = {
  buyer: {
    // criação/pagamento
    CREATED: [OrderStatus.PAID, OrderStatus.CANCELLED] as any,

    PAID: [
      OrderStatus.CANCELLED,
      OrderStatus.RETURN_REQUESTED,
      OrderStatus.DISPUTE,
    ] as any,

    // ✅ pós-entrega
    // ✅ buyer pode confirmar recebimento (COMPLETED) ou pedir devolução
    DELIVERED: [
      OrderStatus.COMPLETED,
      OrderStatus.RETURN_REQUESTED,
      OrderStatus.DISPUTE,
    ] as any,

    COMPLETED: [OrderStatus.RETURN_REQUESTED, OrderStatus.DISPUTE] as any,

    // em devolução (buyer pode abrir disputa a qualquer momento)
    RETURN_REQUESTED: [OrderStatus.DISPUTE] as any,
    RETURN_IN_TRANSIT: [OrderStatus.DISPUTE] as any,
    RETURNED: [OrderStatus.DISPUTE] as any,
  } as any,

  seller: {
    // vendas
    PAID: [OrderStatus.CONFIRMED_BY_SELLER, OrderStatus.CANCELLED] as any,

    CONFIRMED_BY_SELLER: [
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.CANCELLED,
    ] as any,

    READY_FOR_PICKUP: [OrderStatus.IN_TRANSIT] as any,

    // ✅ GARANTIA: seller pode marcar entregue quando estiver em trânsito
    IN_TRANSIT: [OrderStatus.DELIVERED] as any,

    DELIVERED: [OrderStatus.COMPLETED] as any,

    // devolução (seller opera a logística reversa)
    RETURN_REQUESTED: [
      OrderStatus.RETURN_IN_TRANSIT,
      OrderStatus.DISPUTE,
    ] as any,

    RETURN_IN_TRANSIT: [OrderStatus.RETURNED, OrderStatus.DISPUTE] as any,
    RETURNED: [OrderStatus.DISPUTE] as any,
  } as any,

  // ✅ NOVO: sistema (gateway/pagamento)
  system: {
    CREATED: [OrderStatus.PAID] as any,
  } as any,
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * MVP:
   * Cria um pedido com itens e retorna o pedido criado
   * ✅ Agora também cria HOLD no wallet do comprador (se tiver userId)
   */
  async createOrder(params: {
    merchantId: string;
    userId?: string;
    city?: string;
    state?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: string; // Decimal como string
    }>;
  }) {
    const order = await this.prisma.order.create({
      data: {
        userId: params.userId ?? 'user_test',
        city: params.city ?? 'SAO_PAULO',
        state: params.state ?? 'SP',
        merchantId: params.merchantId ?? 'merchant_test',

        items: {
          create: params.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice ?? '100.00',
          })),
        },
      },
      include: {
        items: true,
      },
    });

    if (params.userId) {
      const total = order.items.reduce((acc, item) => {
        return acc + Number(item.unitPrice) * item.quantity;
      }, 0);

      const buyerWallet = await this.wallet.getOrCreateWallet({
        type: 'USER',
        ownerId: params.userId,
      });

      await this.prisma.walletHold.create({
        data: {
          walletId: buyerWallet.id,
          amount: total.toFixed(2),
          reason: 'ORDER_PAYMENT',
          reference: order.id,
        },
      });
    }

    return order;
  }

  /**
   * 🔎 Busca pedido por ID (com itens + events)
   */
  async getOrderById(orderId: string): Promise<OrderWithItems | null> {
    const id = String(orderId ?? '').trim();
    if (!id) return null;

    // ✅ usa await pra não disparar lint (require-await)
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    return order;
  }

  /**
   * 🔁 Transiciona o status do pedido e cria um OrderEvent (timeline/auditoria)
   * MVP: apenas troca status (sem regras complexas ainda)
   *
   * ✅ Também seta timestamps por status (MVP)
   */
  async transitionStatus(params: {
    orderId: string;
    toStatus: OrderStatus;
    actorUserId?: string;
    actorRole?: string; // 'buyer' | 'seller' | 'system' | etc
    message?: string;
    meta?: unknown;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
      select: { id: true, status: true, userId: true, merchantId: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (!params.actorUserId) {
      throw new Error('actorUserId is required for status transition');
    }

    const actorUserId = String(params.actorUserId);

    // buyer = order.userId
    const isBuyer = order.userId && String(order.userId) === actorUserId;

    // seller = merchant.userId (dono do merchant)
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: order.merchantId },
      select: { userId: true },
    });

    const isSeller =
      merchant?.userId && String(merchant.userId) === actorUserId;

    // ✅ prioridade: se é buyer e seller ao mesmo tempo,
    // tratamos como BUYER (principalmente para pagamento).
    let role: ActorRole | null = null;
    if (isBuyer) role = 'buyer';
    else if (isSeller) role = 'seller';

    if (!role) {
      // MVP: só buyer ou seller pode trocar status
      throw new ForbiddenException(
        'Only buyer or seller can transition this order',
      );
    }

    const from = order.status;
    const to = params.toStatus;

    // valida matriz
    const allowedTargets = (ALLOWED[role]?.[from] ?? []) as any[];

    if (!allowedTargets.includes(to)) {
      throw new ForbiddenException(
        `${role} cannot transition from ${String(from)} to ${String(to)}`,
      );
    }

    const fromStatus = order.status;

    // ✅ garante enum real (mesmo se vier string)
    const statusEnum =
      OrderStatus[params.toStatus as unknown as keyof typeof OrderStatus];

    const meta = toJsonValue(params.meta);

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const data: Prisma.OrderUpdateInput = {
        status: statusEnum,
      };

      // timestamps automáticos por status (MVP)
      if (statusEnum === OrderStatus.PAID) {
        data.paidAt = now;
      }

      if (statusEnum === OrderStatus.CONFIRMED_BY_SELLER) {
        data.confirmedAt = now;
      }

      if (statusEnum === OrderStatus.READY_FOR_PICKUP) {
        data.readyForPickupAt = now;
      }

      if (statusEnum === OrderStatus.IN_TRANSIT) {
        data.inTransitAt = now;
      }

      if (statusEnum === OrderStatus.DELIVERED) {
        data.deliveredAt = now;
      }

      if (statusEnum === OrderStatus.COMPLETED) {
        data.completedAt = now;
      }

      if (statusEnum === OrderStatus.CANCELLED) {
        data.cancelledAt = now;
      }

      if (statusEnum === OrderStatus.RETURN_REQUESTED) {
        data.returnRequestedAt = now;
      }

      if (statusEnum === OrderStatus.RETURN_IN_TRANSIT) {
        data.returnInTransitAt = now;
      }

      if (statusEnum === OrderStatus.RETURNED) {
        data.returnedAt = now;
      }

      if (statusEnum === OrderStatus.DISPUTE) {
        data.disputeAt = now;
      }

      const saved = await tx.order.update({
        where: { id: params.orderId },
        data,
      });

      await tx.orderEvent.create({
        data: {
          orderId: params.orderId,
          type: OrderEventType.STATUS_CHANGED,
          actorUserId: params.actorUserId ?? null,
          actorRole: roleLabel(role),
          fromStatus,
          toStatus: statusEnum,
          message: params.message ?? null,
          meta,
        },
      });

      return saved;
    });

    return { ok: true, order: updated };
  }

  /**
   * 📦 Lista pedidos do comprador logado (buyer)
   */
  async listMyOrders(params: { userId: string }) {
    const userId = String(params.userId ?? '').trim();
    if (!userId) {
      return { ok: false, items: [] as any[] };
    }

    const items = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    return { ok: true, items };
  }

  /**
   * 🧾 Lista vendas do lojista logado (seller)
   * Como o model Order não tem relation "merchant" no Prisma,
   * buscamos os merchants do user e filtramos por merchantId.
   */
  async listMySales(params: { userId: string }) {
    const userId = String(params.userId ?? '').trim();
    if (!userId) {
      return { ok: false, items: [] as any[] };
    }

    const merchants = await this.prisma.merchant.findMany({
      where: { userId },
      select: { id: true },
    });

    const merchantIds = merchants.map((m) => m.id);
    if (merchantIds.length === 0) {
      return { ok: true, items: [] as any[] };
    }

    const items = await this.prisma.order.findMany({
      where: { merchantId: { in: merchantIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    return { ok: true, items };
  }

  // ✅ seller vê pedidos do merchant dele (helper p/ controller)
  async canSellerAccessOrder(params: { orderId: string; actorUserId: string }) {
    const { orderId, actorUserId } = params;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { merchantId: true },
    });
    if (!order) return false;

    const merchant = await this.prisma.merchant.findFirst({
      where: { id: order.merchantId, userId: actorUserId },
      select: { id: true },
    });

    return !!merchant;
  }
}
