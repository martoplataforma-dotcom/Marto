import { Injectable } from '@nestjs/common';
import { PixChargeStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PixService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * MVP (mock):
   * cria uma cobrança PIX no banco e gera um "brCode" fictício.
   * Depois a gente integra provedor real (Gerencianet/MercadoPago/OpenPix etc).
   */
  async createCharge(params: {
    reference: string; // ex: orderId
    amount: string; // "10.50"
    expiresMinutes?: number;
  }) {
    const expiresAt =
      params.expiresMinutes && params.expiresMinutes > 0
        ? new Date(Date.now() + params.expiresMinutes * 60 * 1000)
        : null;

    const brCode = `BR_CODE_MOCK|ref=${params.reference}|amount=${params.amount}`;

    return await this.prisma.pixCharge.create({
      data: {
        receiver: 'MARTO',
        reference: params.reference,
        amount: params.amount,
        status: PixChargeStatus.WAITING_PAYMENT,
        provider: 'mock',
        providerId: `mock_${Date.now()}`,
        brCode,
        expiresAt: expiresAt ?? undefined,
      },
    });
  }

  /**
   * MVP (mock):
   * marca como pago (simulador) com idempotência.
   * ✅ NUNCA retorna null.
   */
  async markPaid(params: { chargeId: string }) {
    const existing = await this.prisma.pixCharge.findUnique({
      where: { id: params.chargeId },
    });

    if (!existing) {
      throw new Error('PixCharge not found');
    }

    // idempotência: se já liquidou, não muda nada
    if (existing.settledAt) return existing;

    // idempotência: se já pagou, não muda nada
    if (existing.status === PixChargeStatus.PAID && existing.paidAt) {
      return existing;
    }

    return await this.prisma.pixCharge.update({
      where: { id: params.chargeId },
      data: {
        status: PixChargeStatus.PAID,
        paidAt: new Date(),
      },
    });
  }

  /**
   * marca a cobrança como liquidada (após settlement)
   */
  async markSettled(params: { chargeId: string }) {
    return await this.prisma.pixCharge.update({
      where: { id: params.chargeId },
      data: { settledAt: new Date() },
    });
  }
}
