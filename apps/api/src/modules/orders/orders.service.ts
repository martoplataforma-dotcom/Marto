import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

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
        // ✅ defaults pra não ficar undefined
        userId: params.userId ?? 'user_test',
        city: params.city ?? 'SAO_PAULO',
        state: params.state ?? 'SP',

        // ✅ obrigatório no seu schema
        merchantId: params.merchantId ?? 'merchant_test',

        items: {
          create: params.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            // ✅ unitPrice não pode ser undefined
            unitPrice: it.unitPrice ?? '100.00',
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // ✅ cria HOLD somente se houver userId (comprador identificado)
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
   * 🔎 Busca pedido por ID (com itens)
   */
  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    return order;
  }
}
