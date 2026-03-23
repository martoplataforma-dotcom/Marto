// apps/api/src/modules/orders/orders.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderEventType,
  OrderStatus,
  PaymentContextType,
  PaymentStatus,
  PixChargeStatus,
  PayoutStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { getEstimatedShippingDays } from '../logistics/shipping/get-estimated-shipping-days';
import { getShippingPriceCents } from '../logistics/shipping/get-shipping-price-cents';
import { resolveProductShippingOptionsFromEntities } from '../logistics/shipping/resolve-product-shipping-options-from-entities';
import { WalletService } from '../wallet/wallet.service';
import type { MartoPayResponse, MartoPayStage } from './dto/marto-pay.dto';

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

type MerchantMini = { id: string; tradeName: string | null };

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

  private buildMartoPayResponse(input: {
    order: any;
    payment?: any | null;
    payout?: any | null;
    pixCharge?: any | null;
    idempotent?: boolean;
    stage?: MartoPayStage;
    message?: string;
  }): MartoPayResponse {
    const { order, payment, payout, pixCharge, idempotent, stage, message } =
      input;
    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    return {
      ok: true,
      idempotent,
      stage,
      message,
      order,
      payment: payment
        ? {
            id: payment.id,
            payerUserId: payment.payerUserId,
            contextType: payment.contextType,
            contextId: payment.contextId,
            amountCents: payment.amountCents,
            status: payment.status,
            pixChargeId: payment.pixChargeId ?? null,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
          }
        : null,
      payout: payout
        ? {
            id: payout.id,
            paymentId: payout.paymentId,
            payeeUserId: payout.payeeUserId,
            contextType: payout.contextType,
            contextId: payout.contextId,
            amountCents: payout.amountCents,
            status: payout.status,
            releasedAt: payout.releasedAt ?? null,
            paidAt: payout.paidAt ?? null,
            createdAt: payout.createdAt,
            updatedAt: payout.updatedAt,
          }
        : null,
      pixCharge: pixCharge
        ? {
            id: pixCharge.id,
            status: pixCharge.status,
            brCode: pixCharge.brCode ?? null,
            qrCodeUrl: pixCharge.qrCodeUrl ?? null,
            expiresAt: pixCharge.expiresAt ?? null,
            paidAt: pixCharge.paidAt ?? null,
            settledAt: pixCharge.settledAt ?? null,
          }
        : null,
    };
  }

  private isPixExpired(
    pix: { expiresAt?: Date | string | null; status?: string } | null | undefined,
  ) {
    if (!pix?.expiresAt) return false;
    const exp =
      pix.expiresAt instanceof Date
        ? pix.expiresAt.getTime()
        : new Date(pix.expiresAt).getTime();
    const now = Date.now();
    return exp > 0 && exp < now && String(pix.status ?? '').toUpperCase() === 'CREATED';
  }

  // ✅ helper: anexa merchant {id, tradeName} nos pedidos
  private async attachMerchants<T extends { merchantId: string }>(
    rows: T[],
  ): Promise<Array<T & { merchant: MerchantMini | null }>> {
    const ids = Array.from(
      new Set(
        rows.map((r) => String(r.merchantId || '').trim()).filter((v) => !!v),
      ),
    );

    if (ids.length === 0) {
      return rows.map((r) => ({ ...r, merchant: null }));
    }

    const merchants = await this.prisma.merchant.findMany({
      where: { id: { in: ids } },
      select: { id: true, tradeName: true },
    });

    const map = new Map<string, MerchantMini>();
    for (const m of merchants) map.set(m.id, m);

    return rows.map((r) => ({
      ...r,
      merchant: map.get(String(r.merchantId)) ?? null,
    }));
  }

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
    destinationZipCode?: string;
    selectedShippingMode?:
      | 'CORREIOS'
      | 'TRANSPORTADORA'
      | 'LOCAL_DELIVERY'
      | 'PICKUP';
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: string; // Decimal como string
    }>;
  }) {
    const merchantProfile = await this.prisma.merchant.findUnique({
      where: {
        id: params.merchantId,
      },
      select: {
        originZipCode: true,
        supportsCorreios: true,
        supportsTransportadora: true,
        supportsLocalDelivery: true,
        supportsPickup: true,
      },
    });

    const productIds = params.items.map((item) => item.productId);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        merchantId: params.merchantId,
      },
      select: {
        id: true,
        merchantId: true,
        requiresShipping: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        allowCorreios: true,
        allowTransportadora: true,
        allowLocalDelivery: true,
        allowPickup: true,
        serviceLinks: {
          select: {
            serviceType: true,
            isRequired: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const productsById = new Map(products.map((product) => [product.id, product]));
    const hasShippableItems = products.some((product) =>
      Boolean(product.requiresShipping),
    );

    if (hasShippableItems && !params.destinationZipCode) {
      throw new BadRequestException(
        'destinationZipCode é obrigatório para pedidos com itens que exigem frete.',
      );
    }

    if (hasShippableItems && !params.selectedShippingMode) {
      throw new BadRequestException(
        'selectedShippingMode é obrigatório para pedidos com itens que exigem frete.',
      );
    }

    if (hasShippableItems && !merchantProfile?.originZipCode) {
      throw new BadRequestException(
        'originZipCode do merchant é obrigatório para pedidos com itens que exigem frete.',
      );
    }

    const serviceOffersByItem = params.items.map((item) => {
      const product = productsById.get(item.productId);

      const services = (product?.serviceLinks ?? []).map((link) => ({
        serviceType: link.serviceType,
        isRequired: Boolean(link.isRequired),
        sortOrder: Number(link.sortOrder ?? 0),
      }));

      return {
        productId: item.productId,
        quantity: item.quantity,
        services,
      };
    });

    const serviceTypes = Array.from(
      new Set(
        serviceOffersByItem.flatMap((item) =>
          item.services.map((service) => service.serviceType),
        ),
      ),
    );

    const serviceOfferSummary = {
      hasServiceOptions: serviceTypes.length > 0,
      serviceTypes,
      items: serviceOffersByItem.filter((item) => item.services.length > 0),
    };

    if (params.selectedShippingMode) {
      for (const item of params.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new BadRequestException(
            `Produto do pedido não encontrado: ${item.productId}`,
          );
        }

        const resolved = resolveProductShippingOptionsFromEntities({
          product: {
            requiresShipping: product.requiresShipping,
            weightGrams: product.weightGrams,
            lengthCm: product.lengthCm,
            widthCm: product.widthCm,
            heightCm: product.heightCm,
            allowCorreios: product.allowCorreios,
            allowTransportadora: product.allowTransportadora,
            allowLocalDelivery: product.allowLocalDelivery,
            allowPickup: product.allowPickup,
          },
          expeditorProfile: {
            originZipCode: merchantProfile?.originZipCode ?? null,
            supportsCorreios: merchantProfile?.supportsCorreios ?? false,
            supportsTransportadora:
              merchantProfile?.supportsTransportadora ?? false,
            supportsLocalDelivery:
              merchantProfile?.supportsLocalDelivery ?? false,
            supportsPickup: merchantProfile?.supportsPickup ?? false,
          },
        });

        if (
          !resolved.availableShippingModes.includes(params.selectedShippingMode)
        ) {
          throw new BadRequestException(
            `Modo de frete inválido para o produto ${item.productId}: ${params.selectedShippingMode}`,
          );
        }
      }
    }

    const estimatedDays = getEstimatedShippingDays(params.selectedShippingMode);
    const shippingPriceCents = getShippingPriceCents(
      params.selectedShippingMode,
    );

    const order = await this.prisma.order.create({
      data: {
        userId: params.userId ?? 'user_test',
        city: params.city ?? 'SAO_PAULO',
        state: params.state ?? 'SP',
        destinationZipCode: params.destinationZipCode ?? null,
        selectedShippingMode: params.selectedShippingMode ?? null,
        originZipCodeSnapshot: merchantProfile?.originZipCode ?? null,
        estimatedDays,
        shippingPriceCents,
        merchantId: params.merchantId ?? 'merchant_test',
        reservedUntil: new Date(Date.now() + 30 * 60 * 1000),

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

    return {
      ...order,
      serviceOfferSummary,
    };
  }

  async payOrderMock(orderId: string, payerUserId: string) {
    const targetOrderId = String(orderId ?? '').trim();
    const actorUserId = String(payerUserId ?? '').trim();

    if (!targetOrderId) {
      throw new BadRequestException('orderId inválido.');
    }

    if (!actorUserId) {
      throw new BadRequestException('payerUserId inválido.');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: targetOrderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Pedido não encontrado.');
      }

      if (order.status !== OrderStatus.CREATED) {
        throw new BadRequestException(
          `Pedido não pode ser pago no status atual: ${order.status}`,
        );
      }

      const now = Date.now();
      const reservedUntil = order.reservedUntil
        ? new Date(order.reservedUntil).getTime()
        : null;

      if (!reservedUntil || now > reservedUntil) {
        throw new BadRequestException(
          'Pedido expirou. Atualize sua compra para recalcular estoque/frete/preço.',
        );
      }

      if (!order.userId || String(order.userId) !== actorUserId) {
        throw new BadRequestException('Você não pode pagar este pedido.');
      }

      if (!order.items?.length) {
        throw new BadRequestException('Pedido sem itens.');
      }

      const merchant = await tx.merchant.findUnique({
        where: { id: order.merchantId },
        select: { userId: true },
      });

      const merchantUserId = String(merchant?.userId ?? '').trim();
      if (!merchantUserId) {
        throw new BadRequestException(
          'Não foi possível identificar o recebedor (lojista) do pedido.',
        );
      }

      const totalCents = order.items.reduce((acc, item) => {
        const qty = Number(item.quantity ?? 0);
        const unit = Number(item.unitPrice ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) return acc;
        if (!Number.isFinite(unit) || unit <= 0) return acc;
        return acc + Math.round(unit * 100) * Math.trunc(qty);
      }, 0);

      if (!Number.isInteger(totalCents) || totalCents <= 0) {
        throw new BadRequestException(
          'Valor do pedido inválido para pagamento.',
        );
      }

      // 4.5) Idempotência básica: já existe pagamento para este pedido?
      const existingPayment = await tx.payment.findFirst({
        where: {
          contextType: PaymentContextType.order,
          contextId: order.id,
        },
        include: {
          payouts: true,
          pixCharge: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingPayment) {
        // Caso já tenha sido pago, não cria nada de novo
        if (existingPayment.status === PaymentStatus.captured) {
          return this.buildMartoPayResponse({
            order,
            payment: existingPayment,
            payout: existingPayment.payouts?.[0] ?? null,
            pixCharge: existingPayment.pixCharge ?? null,
            idempotent: true,
            stage: 'already_captured',
            message: 'Pedido já foi pago anteriormente.',
          });
        }

        // Caso já exista tentativa em aberto
        if (existingPayment.status === PaymentStatus.authorized) {
          if (this.isPixExpired(existingPayment.pixCharge)) {
            const nextPix = await tx.pixCharge.create({
              data: {
                receiver:
                  existingPayment.payouts?.[0]?.payeeUserId ??
                  existingPayment.payerUserId,
                reference: `order:${order.id}:${Date.now()}`,
                amount: existingPayment.amountCents / 100,
                status: 'CREATED',
                provider: 'marto_mock',
                providerId: `mock_${order.id}_${Date.now()}`,
                brCode: null,
                qrCodeUrl: null,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
              },
            });

            const nextPix2 = await tx.pixCharge.update({
              where: { id: nextPix.id },
              data: {
                brCode: `000201010212...MARTO-MOCK-ORDER-${order.id}-CHARGE-${nextPix.id}`,
              },
            });

            const updatedPayment = await tx.payment.update({
              where: { id: existingPayment.id },
              data: { pixChargeId: nextPix2.id },
            });

            return this.buildMartoPayResponse({
              order,
              payment: updatedPayment,
              payout: existingPayment.payouts?.[0] ?? null,
              pixCharge: nextPix2,
              idempotent: true,
              stage: 'created_charge',
              message: 'Cobrança expirada. Geramos uma nova cobrança Pix.',
            });
          }

          return this.buildMartoPayResponse({
            order,
            payment: existingPayment,
            payout: existingPayment.payouts?.[0] ?? null,
            pixCharge: existingPayment.pixCharge ?? null,
            idempotent: true,
            stage: 'awaiting_confirmation',
            message: 'Cobrança Pix já criada para este pedido.',
          });
        }

        // MVP: bloquear novos pagamentos se houve falha/refund até tratarmos reprocesso
        throw new BadRequestException(
          `Já existe pagamento para este pedido com status ${existingPayment.status}.`,
        );
      }

      const pixCharge = await tx.pixCharge.create({
        data: {
          receiver: merchantUserId,
          reference: `order:${order.id}`,
          amount: totalCents / 100,
          status: 'CREATED',
          provider: 'marto_mock',
          providerId: `mock_${order.id}_${Date.now()}`,
          brCode: null,
          qrCodeUrl: null,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const pixCharge2 = await tx.pixCharge.update({
        where: { id: pixCharge.id },
        data: {
          brCode: `000201010212...MARTO-MOCK-ORDER-${order.id}-CHARGE-${pixCharge.id}`,
        },
      });

      const payment = await tx.payment.create({
        data: {
          payerUserId: actorUserId,
          contextType: PaymentContextType.order,
          contextId: order.id,
          amountCents: totalCents,
          status: PaymentStatus.authorized,
          pixChargeId: pixCharge2.id,
        },
      });

      const payout = await tx.payout.create({
        data: {
          paymentId: payment.id,
          payeeUserId: merchantUserId,
          contextType: PaymentContextType.order,
          contextId: order.id,
          amountCents: totalCents,
          status: PayoutStatus.held,
        },
      });

      return this.buildMartoPayResponse({
        order,
        payment,
        payout,
        pixCharge: pixCharge2,
        stage: 'created_charge',
      });
    });
  }

  async confirmOrderPixMock(orderId: string) {
    const targetOrderId = String(orderId ?? '').trim();
    if (!targetOrderId) {
      throw new BadRequestException('orderId inválido.');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          contextType: PaymentContextType.order,
          contextId: targetOrderId,
        },
        include: {
          pixCharge: true,
          payouts: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!payment) {
        throw new NotFoundException('Pagamento do pedido não encontrado.');
      }

      if (!payment.pixCharge) {
        throw new BadRequestException('Pagamento sem PixCharge vinculado.');
      }

      if (this.isPixExpired(payment.pixCharge)) {
        throw new BadRequestException('Cobrança Pix expirada. Gere uma nova cobrança.');
      }

      if (payment.status === PaymentStatus.captured) {
        const order = await tx.order.findUnique({
          where: { id: targetOrderId },
        });
        if (!order) {
          throw new NotFoundException('Pedido não encontrado.');
        }

        return this.buildMartoPayResponse({
          order,
          payment,
          payout: payment.payouts?.[0] ?? null,
          pixCharge: payment.pixCharge,
          idempotent: true,
          stage: 'already_captured',
          message: 'Pagamento já confirmado anteriormente.',
        });
      }

      const now = new Date();

      const pixCharge = await tx.pixCharge.update({
        where: { id: payment.pixCharge.id },
        data: {
          status: PixChargeStatus.PAID,
          paidAt: now,
          settledAt: now,
        },
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.captured,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: targetOrderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: now,
        },
      });

      return this.buildMartoPayResponse({
        order: updatedOrder,
        payment: updatedPayment,
        payout: payment.payouts?.[0] ?? null,
        pixCharge,
        stage: 'captured',
      });
    });
  }

  async releaseOrderPayoutMock(orderId: string) {
    const targetOrderId = String(orderId ?? '').trim();
    if (!targetOrderId) {
      throw new BadRequestException('orderId inválido.');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: targetOrderId },
      });

      if (!order) {
        throw new NotFoundException('Pedido não encontrado.');
      }

      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException(
          `Payout não pode ser liberado com pedido no status ${order.status}.`,
        );
      }

      const payout = await tx.payout.findFirst({
        where: {
          contextType: PaymentContextType.order,
          contextId: targetOrderId,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!payout) {
        throw new NotFoundException('Payout do pedido não encontrado.');
      }

      if (
        payout.status === PayoutStatus.released ||
        payout.status === PayoutStatus.paid
      ) {
        return this.buildMartoPayResponse({
          order,
          payout,
          idempotent: true,
          stage:
            payout.status === PayoutStatus.paid
              ? 'payout_paid'
              : 'payout_released',
          message:
            payout.status === PayoutStatus.paid
              ? 'Payout já foi pago anteriormente.'
              : 'Payout já foi liberado anteriormente.',
        });
      }

      if (payout.status !== PayoutStatus.held) {
        throw new BadRequestException(
          `Payout em status inválido para liberação: ${String(payout.status)}.`,
        );
      }

      const releasedPayout = await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.released,
          releasedAt: new Date(),
        },
      });

      return this.buildMartoPayResponse({
        order,
        payout: releasedPayout,
        stage: 'payout_released',
      });
    });
  }

  async payOrderPayoutMock(orderId: string) {
    const targetOrderId = String(orderId ?? '').trim();
    if (!targetOrderId) {
      throw new BadRequestException('orderId inválido.');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: targetOrderId },
      });

      if (!order) throw new NotFoundException('Pedido não encontrado.');

      const payout = await tx.payout.findFirst({
        where: {
          contextType: PaymentContextType.order,
          contextId: targetOrderId,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!payout) {
        throw new NotFoundException('Payout do pedido não encontrado.');
      }

      // idempotência
      if (payout.status === PayoutStatus.paid) {
        return this.buildMartoPayResponse({
          order,
          payout,
          idempotent: true,
          stage: 'payout_paid',
          message: 'Payout já foi pago anteriormente.',
        });
      }

      if (payout.status !== PayoutStatus.released) {
        throw new BadRequestException(
          `Payout não pode ser pago no status ${String(payout.status)}.`,
        );
      }

      const paidPayout = await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.paid,
          paidAt: new Date(),
        },
      });

      return this.buildMartoPayResponse({
        order,
        payout: paidPayout,
        stage: 'payout_paid',
      });
    });
  }

  /**
   * 🔎 Busca pedido por ID (com itens + events)
   * ✅ Agora também inclui merchant { id, tradeName }
   */
  async getOrderById(
    orderId: string,
  ): Promise<
    | (OrderWithItems & {
        merchant: MerchantMini | null;
        serviceOfferSummary: {
          hasServiceOptions: boolean;
          serviceTypes: string[];
          items: Array<{
            productId: string;
            quantity: number;
            services: Array<{
              serviceType: string;
              isRequired: boolean;
              sortOrder: number;
            }>;
          }>;
        };
      })
    | null
  > {
    const id = String(orderId ?? '').trim();
    if (!id) return null;

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) return null;

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: order.items.map((item) => item.productId) },
      },
      select: {
        id: true,
        serviceLinks: {
          select: {
            serviceType: true,
            isRequired: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const productsById = new Map(products.map((product) => [product.id, product]));

    const serviceOffersByItem = order.items.map((item) => {
      const product = productsById.get(item.productId);

      const services = (product?.serviceLinks ?? []).map((link) => ({
        serviceType: link.serviceType,
        isRequired: Boolean(link.isRequired),
        sortOrder: Number(link.sortOrder ?? 0),
      }));

      return {
        productId: item.productId,
        quantity: item.quantity,
        services,
      };
    });

    const serviceTypes = Array.from(
      new Set(
        serviceOffersByItem.flatMap((item) =>
          item.services.map((service) => service.serviceType),
        ),
      ),
    );

    const serviceOfferSummary = {
      hasServiceOptions: serviceTypes.length > 0,
      serviceTypes,
      items: serviceOffersByItem.filter((item) => item.services.length > 0),
    };

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: order.merchantId },
      select: { id: true, tradeName: true },
    });

    return {
      ...order,
      merchant: merchant ?? null,
      serviceOfferSummary,
    };
  }

  async getProviderOptionsForOrder(orderId: string) {
    const order = await this.getOrderById(orderId);
    if (!order) return null;

    const serviceTypes = Array.from(
      new Set(
        Array.isArray(order.serviceOfferSummary?.serviceTypes)
          ? order.serviceOfferSummary.serviceTypes
              .map((item) => String(item ?? '').trim().toLowerCase())
              .filter(Boolean)
          : [],
      ),
    );

    if (serviceTypes.length === 0) {
      return {
        order,
        serviceTypes: [],
        providers: [],
      };
    }

    const providers = await this.prisma.serviceProvider.findMany({
      where: {
        status: 'ACTIVE' as any,
        specialties: {
          hasSome: serviceTypes,
        },
      },
      select: {
        id: true,
        city: true,
        cepPrefix: true,
        kind: true,
        specialties: true,
        user: {
          select: {
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    const providerIds = providers.map((provider) => provider.id);

    const reviewStats =
      providerIds.length > 0
        ? await this.prisma.serviceReview.groupBy({
            by: ['providerId'],
            where: {
              providerId: {
                in: providerIds,
              },
            },
            _avg: {
              rating: true,
            },
            _count: {
              _all: true,
            },
          })
        : [];

    const reviewStatsByProviderId = new Map(
      reviewStats.map((item) => [
        item.providerId,
        {
          averageRating:
            typeof item._avg.rating === 'number'
              ? Number(item._avg.rating.toFixed(1))
              : null,
          reviewCount: item._count._all,
        },
      ]),
    );

    const rankedProviders = providers
      .map((provider) => {
        const reputation = reviewStatsByProviderId.get(provider.id) ?? {
          averageRating: null,
          reviewCount: 0,
        };

        const matchedServiceTypes = serviceTypes.filter((serviceType) =>
          Array.isArray(provider.specialties)
            ? provider.specialties.includes(serviceType)
            : false,
        );

        const averageRating = reputation.averageRating ?? 0;
        const reviewCount = reputation.reviewCount ?? 0;

        const rankingScore =
          matchedServiceTypes.length * 1000 +
          averageRating * 100 +
          Math.min(reviewCount, 50);

        return {
          id: provider.id,
          city: provider.city,
          cepPrefix: provider.cepPrefix,
          kind: provider.kind,
          specialties: provider.specialties,
          profile: {
            handle: provider.user?.handle ?? null,
            displayName: provider.user?.displayName ?? null,
            avatarUrl: provider.user?.avatarUrl ?? null,
          },
          reputation,
          matchedServiceTypes,
          rankingScore,
        };
      })
      .sort((a, b) => {
        if (b.rankingScore !== a.rankingScore) {
          return b.rankingScore - a.rankingScore;
        }

        const aRating = a.reputation.averageRating ?? 0;
        const bRating = b.reputation.averageRating ?? 0;
        if (bRating !== aRating) {
          return bRating - aRating;
        }

        const aReviews = a.reputation.reviewCount ?? 0;
        const bReviews = b.reputation.reviewCount ?? 0;
        return bReviews - aReviews;
      });

    return {
      order,
      serviceTypes,
      providers: rankedProviders,
    };
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
   * ✅ Agora também inclui merchant { id, tradeName }
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

    const withMerchants = await this.attachMerchants(items);

    return { ok: true, items: withMerchants };
  }

  /**
   * 🧾 Lista vendas do lojista logado (seller)
   * Como o model Order não tem relation "merchant" no Prisma,
   * buscamos os merchants do user e filtramos por merchantId.
   *
   * ✅ Também inclui merchant { id, tradeName } (útil p/ telas de seller também)
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

    const withMerchants = await this.attachMerchants(items);

    return { ok: true, items: withMerchants };
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
