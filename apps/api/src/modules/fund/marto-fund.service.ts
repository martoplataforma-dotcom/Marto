import { BadRequestException, Injectable } from '@nestjs/common';
import type { FundEntryType, PointsTxType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MartoFundService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🔹 Retorna o valor atual de 1 ponto
   * Fundo ÷ Total de pontos
   */
  async getPointValue(): Promise<number> {
    const fund = await this.prisma.martoFund.findFirst();
    if (!fund) return 0;

    const totalPointsAgg = await this.prisma.pointsWallet.aggregate({
      _sum: { balance: true },
    });

    const totalPoints = totalPointsAgg._sum.balance ?? 0;
    if (totalPoints === 0) return 0;

    return Number(fund.balance) / totalPoints;
  }

  /**
   * 🔹 Registra entrada no Fundo Marto
   */
  async addFundEntry(
    amount: number,
    type: FundEntryType,
    reason?: string,
    refType?: string,
    refId?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.martoFundEntry.create({
        data: {
          amount, // Prisma aceita number aqui e converte pro Decimal (Postgres numeric)
          type,
          reason,
          refType,
          refId,
        },
      });

      // garante que existe 1 registro de fundo (singleton)
      const existing = await tx.martoFund.findFirst({
        select: { id: true },
      });

      if (!existing) {
        await tx.martoFund.create({
          data: { balance: amount },
        });
      } else {
        await tx.martoFund.update({
          where: { id: existing.id },
          data: { balance: { increment: amount } },
        });
      }
    });
  }

  /**
   * 🔹 Garante que o usuário tem carteira de pontos
   */
  ensureWallet(userId: string) {
    return this.prisma.pointsWallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /**
   * 🔹 Emite pontos (ganho)
   */
  async earnPoints(
    userId: string,
    amount: number,
    type: PointsTxType,
    description?: string,
    refType?: string,
    refId?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId obrigatório');
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount deve ser inteiro > 0');
    }

    await this.ensureWallet(userId);

    await this.prisma.$transaction([
      this.prisma.pointsTransaction.create({
        data: {
          userId,
          amount,
          type,
          description,
          refType,
          refId,
        },
      }),
      this.prisma.pointsWallet.update({
        where: { userId },
        data: {
          balance: { increment: amount },
        },
      }),
    ]);
  }

  /**
   * 🔹 Gasta pontos (cashback)
   */
  async spendPoints(
    userId: string,
    amount: number,
    description?: string,
    refType?: string,
    refId?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId obrigatório');
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount deve ser inteiro > 0');
    }

    const wallet = await this.prisma.pointsWallet.findUnique({
      where: { userId },
      select: { balance: true },
    });

    if (!wallet) {
      throw new BadRequestException('wallet não existe para este userId');
    }

    if (wallet.balance < amount) {
      throw new BadRequestException('saldo de pontos insuficiente');
    }

    await this.prisma.$transaction([
      this.prisma.pointsTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: 'SPEND_CASHBACK' as PointsTxType, // ou PointsTxType.SPEND_CASHBACK se estiver disponível no runtime
          description,
          refType,
          refId,
        },
      }),
      this.prisma.pointsWallet.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
        },
      }),
    ]);
  }
}
