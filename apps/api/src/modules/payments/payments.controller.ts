import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PixService } from './pix.service';
import { SettlementService } from '../wallet/settlement.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';

function getUserId(req: Request): string {
  const u = req.user as { id?: string; sub?: string } | undefined;
  return String(u?.id ?? u?.sub ?? '').trim();
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly pix: PixService,
    private readonly settlement: SettlementService,
    private readonly orders: OrdersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * ✅ POST /api/payments/order/:orderId
   * Cria cobrança pendente (sandbox), sem marcar como paga.
   */
  @UseGuards(JwtAuthGuard)
  @Post('order/:orderId')
  async createForOrder(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() body: { method?: 'PIX' | 'CARD' },
  ) {
    const userId = getUserId(req);
    return this.paymentsService.createForOrder(
      userId,
      orderId,
      body?.method ?? 'PIX',
    );
  }

  /**
   * ✅ POST /api/payments/:paymentId/confirm
   * Simula confirmação/aprovação e liquida o pedido para PAID.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':paymentId/confirm')
  async confirm(@Req() req: Request, @Param('paymentId') paymentId: string) {
    const userId = getUserId(req);
    return this.paymentsService.confirmPayment(userId, paymentId);
  }

  /**
   * 🔒 MOCK de pagamento genérico (CARD / PIX abstrato)
   * Usado para simular fluxo financeiro + payout HOLD
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  createPayment(
    @Body()
    body: {
      orderId: string;
      amount: number;
      method?: 'PIX' | 'CARD';
    },
  ) {
    return {
      id: `pay-${Date.now()}`,
      orderId: body.orderId,
      amount: body.amount,
      method: body.method ?? 'CARD',
      status: 'CAPTURED',
      payout: {
        id: `payout-${Date.now()}`,
        status: 'HELD',
        heldReason: 'SERVICE_NOT_COMPLETED',
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * ✅ POST /api/payments/mock
   * Mantido por compatibilidade. Agora apenas cria cobrança pendente.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mock')
  async mock(
    @Req() req: Request,
    @Body() body: { orderId: string; method?: 'PIX' | 'CARD' },
  ) {
    const userId = getUserId(req);
    const orderId = String(body?.orderId ?? '').trim();
    return this.paymentsService.createForOrder(
      userId,
      orderId,
      body?.method ?? 'PIX',
    );
  }

  /**
   * 💠 POST /api/payments/pix/charge
   * Cria cobrança PIX (QR Code / BR Code)
   */
  @Post('pix/charge')
  async createPixCharge(
    @Body()
    body: {
      reference: string;
      amount: string; // Decimal como string
      expiresMinutes?: number;
    },
  ) {
    return this.pix.createCharge(body);
  }

  /**
   * ✅ POST /api/payments/pix/paid
   * Marca cobrança PIX como paga + liquida o pedido (manual)
   */
  @Post('pix/paid')
  async markPixPaid(
    @Body()
    body: {
      chargeId: string;
      orderId: string;
      buyerOwnerId: string;
      merchantOwnerId: string;
      totalAmount: string;
      martoFeeAmount: string;
    },
  ) {
    const charge = await this.pix.markPaid({ chargeId: body.chargeId });

    try {
      const settlement = await this.settlement.settleOrder({
        orderId: body.orderId,
        buyerOwnerId: body.buyerOwnerId,
        merchantOwnerId: body.merchantOwnerId,
        totalAmount: body.totalAmount,
        martoFeeAmount: body.martoFeeAmount,
      });

      // 🔒 marca que a cobrança já foi liquidada
      await this.pix.markSettled({ chargeId: body.chargeId });

      return { charge, settlement };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return { charge, error: msg };
    }
  }

  /**
   * 🔔 POST /api/payments/pix/webhook/mock
   * Simula webhook do provedor PIX (automático)
   */
  @Post('pix/webhook/mock')
  async pixWebhookMock(
    @Body() body: { chargeId: string; martoFeeAmount?: string },
  ) {
    const charge = await this.pix.markPaid({ chargeId: body.chargeId });

    // idempotência: já liquidado
    if (charge.settledAt) {
      return { ok: true, status: 'already_settled', charge };
    }

    const orderId = charge.reference;
    const order = await this.orders.getOrderById(orderId);

    if (!order) {
      return { ok: false, error: `Order not found: ${orderId}` };
    }

    const total = order.items.reduce((acc, item) => {
      return acc + Number(item.unitPrice) * item.quantity;
    }, 0);

    const settlement = await this.settlement.settleOrder({
      orderId,
      buyerOwnerId: order.userId ?? 'anonymous',
      merchantOwnerId: order.merchantId,
      totalAmount: total.toFixed(2),
      martoFeeAmount: body.martoFeeAmount ?? '0.50',
    });

    await this.pix.markSettled({ chargeId: body.chargeId });

    return { ok: true, chargeId: body.chargeId, settlement };
  }
}
