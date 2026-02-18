import { Injectable } from '@nestjs/common';
import { OrderStatus, PixChargeStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PixService } from './pix.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly pix: PixService,
  ) {}

  async createForOrder(userId: string, orderId: string, method: 'PIX' | 'CARD') {
    const actorUserId = String(userId ?? '').trim();
    const targetOrderId = String(orderId ?? '').trim();

    if (!actorUserId) return { ok: false, message: 'Sem userId no token' };
    if (!targetOrderId) return { ok: false, message: 'orderId não informado' };

    const order = await this.orders.getOrderById(targetOrderId);
    if (!order) return { ok: false, message: 'Pedido não encontrado' };

    if (!order.userId || String(order.userId) !== actorUserId) {
      return { ok: false, message: 'Somente o comprador pode pagar este pedido.' };
    }

    if (order.status === OrderStatus.PAID) {
      return { ok: false, message: 'Pedido já está pago' };
    }

    const total = order.items.reduce((acc, item) => {
      return acc + Number(item.unitPrice) * item.quantity;
    }, 0);

    const charge = await this.pix.createCharge({
      reference: order.id,
      amount: total.toFixed(2),
      expiresMinutes: 30,
    });

    return {
      ok: true,
      paymentId: charge.id,
      status: charge.status === PixChargeStatus.WAITING_PAYMENT ? 'PENDING' : charge.status,
      method,
      orderId: order.id,
    };
  }

  async confirmPayment(userId: string, paymentId: string) {
    const actorUserId = String(userId ?? '').trim();
    const id = String(paymentId ?? '').trim();

    if (!actorUserId) return { ok: false, message: 'Sem userId no token' };
    if (!id) return { ok: false, message: 'paymentId não informado' };

    const payment = await this.prisma.pixCharge.findUnique({ where: { id } });
    if (!payment) return { ok: false, message: 'Payment não encontrado' };

    const order = await this.orders.getOrderById(String(payment.reference ?? ''));
    if (!order) return { ok: false, message: 'Pedido não encontrado' };

    if (!order.userId || String(order.userId) !== actorUserId) {
      return { ok: false, message: 'Somente o comprador pode confirmar este pagamento.' };
    }

    if (order.status === OrderStatus.PAID) {
      return { ok: true, status: 'PAID', orderId: order.id };
    }

    if (payment.status !== PixChargeStatus.PAID) {
      await this.pix.markPaid({ chargeId: payment.id });
    }

    await this.orders.transitionStatus({
      orderId: order.id,
      toStatus: OrderStatus.PAID,
      actorUserId: actorUserId,
      actorRole: 'buyer',
      message: 'pagou',
      meta: { provider: 'sandbox', paymentId: payment.id, at: new Date().toISOString() },
    });

    return { ok: true, status: 'PAID', orderId: order.id };
  }
}
