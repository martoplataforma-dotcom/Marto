// apps/api/src/modules/marto-fund/marto-fund.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type FundEntryType, type PointsTxType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MartoFundService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------
  // Helpers (tx-safe)
  // -------------------------

  private async getOrCreateFundId(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const existing = await tx.martoFund.findFirst({ select: { id: true } });
    if (existing?.id) return existing.id;

    const created = await tx.martoFund.create({
      data: { balance: new Prisma.Decimal(0) },
      select: { id: true },
    });
    return created.id;
  }

  private async getOrCreatePointsWallet(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ id: string; balance: number }> {
    const existing = await tx.pointsWallet.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });

    if (existing?.id) {
      return { id: existing.id, balance: Number(existing.balance ?? 0) };
    }

    const created = await tx.pointsWallet.create({
      data: { userId, balance: 0 },
      select: { id: true, balance: true },
    });

    return { id: created.id, balance: Number(created.balance ?? 0) };
  }

  // -------------------------
  // Read-only
  // -------------------------

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

    return Number(fund.balance) / Number(totalPoints);
  }

  // -------------------------
  // Fund entries
  // -------------------------

  /**
   * 🔹 Registra entrada no Fundo Marto
   * ✅ Sempre inclui fundId na MartoFundEntry
   */
  async addFundEntry(
    amount: number,
    type: FundEntryType,
    reason?: string,
    refType?: string,
    refId?: string,
  ) {
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException('amount deve ser número e != 0');
    }

    await this.prisma.$transaction(async (tx) => {
      const fundId = await this.getOrCreateFundId(tx);

      await tx.martoFundEntry.create({
        data: {
          fundId,
          type,
          amount: new Prisma.Decimal(amount),
          reason,
          refType,
          refId,
        },
      });

      await tx.martoFund.update({
        where: { id: fundId },
        data: { balance: { increment: new Prisma.Decimal(amount) } },
      });
    });
  }

  // -------------------------
  // Points
  // -------------------------

  /**
   * 🔹 Emite pontos (ganho)
   * ✅ PointsTransaction agora usa walletId (não userId)
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

    await this.prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreatePointsWallet(tx, userId);

      await tx.pointsTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type,
          description,
          refType,
          refId,
        },
      });

      await tx.pointsWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
    });
  }

  /**
   * 🔹 Gasta pontos (cashback)
   * ✅ PointsTransaction agora usa walletId (não userId)
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

    await this.prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreatePointsWallet(tx, userId);

      if (wallet.balance < amount) {
        throw new BadRequestException('saldo de pontos insuficiente');
      }

      await tx.pointsTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -amount,
          type: 'SPEND_CASHBACK' as PointsTxType,
          description,
          refType,
          refId,
        },
      });

      await tx.pointsWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });
    });
  }
}
