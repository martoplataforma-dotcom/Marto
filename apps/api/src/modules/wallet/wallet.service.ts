import { Injectable } from '@nestjs/common';
import {
  LedgerEntryType,
  LedgerStatus,
  WalletType,
  WalletHoldStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type CreateOrGetWalletInput = {
  type: WalletType;
  ownerId: string;
};

type PostLedgerEntryInput = {
  walletId: string;
  type: LedgerEntryType;
  amount: string; // Decimal como string
  description: string;
  reference?: string;
  status?: LedgerStatus;
};

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateWallet(input: CreateOrGetWalletInput) {
    const existing = await this.prisma.wallet.findUnique({
      where: { type_ownerId: { type: input.type, ownerId: input.ownerId } },
    });

    if (existing) return existing;

    return this.prisma.wallet.create({
      data: { type: input.type, ownerId: input.ownerId },
    });
  }

  // 🔁 SUBSTITUÍDO (somente este método)
  async postEntry(input: PostLedgerEntryInput) {
    const entry = await this.prisma.ledgerEntry.create({
      data: {
        walletId: input.walletId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        reference: input.reference,
        status: input.status ?? LedgerStatus.POSTED,
      },
    });

    return entry;
  }

  async getBalances(walletId: string) {
    const credits = await this.prisma.ledgerEntry.aggregate({
      where: {
        walletId,
        status: LedgerStatus.POSTED,
        type: LedgerEntryType.CREDIT,
      },
      _sum: { amount: true },
    });

    const debits = await this.prisma.ledgerEntry.aggregate({
      where: {
        walletId,
        status: LedgerStatus.POSTED,
        type: LedgerEntryType.DEBIT,
      },
      _sum: { amount: true },
    });

    const holds = await this.prisma.walletHold.aggregate({
      where: {
        walletId,
        status: WalletHoldStatus.ACTIVE,
      },
      _sum: { amount: true },
    });

    const credit = Number(credits._sum.amount ?? 0);
    const debit = Number(debits._sum.amount ?? 0);
    const blocked = Number(holds._sum.amount ?? 0);

    const total = credit - debit;
    const available = total - blocked;

    return {
      walletId,
      total: total.toFixed(2),
      blocked: blocked.toFixed(2),
      available: available.toFixed(2),
    };
  }

  async holdFunds(params: {
    walletId: string;
    amount: string; // Decimal como string
    reason: string;
    reference: string; // ex: orderId
  }) {
    const hold = await this.prisma.walletHold.create({
      data: {
        walletId: params.walletId,
        amount: params.amount,
        reason: params.reason,
        reference: params.reference,
        status: 'ACTIVE',
      },
    });

    return hold;
  }

  async releaseHold(params: { walletId: string; reference: string }) {
    const updated = await this.prisma.walletHold.updateMany({
      where: {
        walletId: params.walletId,
        reference: params.reference,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
      },
    });

    return updated;
  }

  /**
   * 📄 Extrato simples (MVP):
   * - ledger entries (POSTED primeiro)
   * - holds ativos
   */
  async getStatement(walletId: string) {
    const ledger = await this.prisma.ledgerEntry.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const holds = await this.prisma.walletHold.findMany({
      where: { walletId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      walletId,
      ledger,
      holds,
    };
  }

  /**
   * 🏦 Solicita saque (MVP):
   * - valida saldo disponível
   * - cria HOLD ACTIVE com referência "withdraw:<id>"
   * (o DEBIT entra no próximo passo, quando aprovar/confirmar)
   */
  async requestWithdraw(params: {
    walletId: string;
    amount: string; // Decimal string, ex "25.00"
    reason?: string;
  }) {
    const amountNum = Number(params.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }

    const balance = await this.getBalances(params.walletId);
    const available = Number(balance.available);

    if (available < amountNum) {
      throw new Error(
        `Insufficient available funds. Available=${balance.available} Requested=${params.amount}`,
      );
    }

    const withdrawRef = `withdraw:${crypto.randomUUID()}`;

    const hold = await this.prisma.walletHold.create({
      data: {
        walletId: params.walletId,
        amount: params.amount,
        reason: params.reason ?? 'WITHDRAW_REQUEST',
        reference: withdrawRef,
        status: 'ACTIVE',
      },
    });

    return { withdrawRef, hold };
  }

  /**
   * ✅ Confirma saque (MVP):
   * - encontra o HOLD pelo reference
   * - cria DEBIT no ledger
   * - marca HOLD como RELEASED
   */
  async confirmWithdraw(params: { walletId: string; withdrawRef: string }) {
    const hold = await this.prisma.walletHold.findFirst({
      where: {
        walletId: params.walletId,
        reference: params.withdrawRef,
        status: 'ACTIVE',
      },
    });

    if (!hold) {
      throw new Error('Withdraw hold not found or already processed');
    }

    await this.postEntry({
      walletId: params.walletId,
      type: LedgerEntryType.DEBIT,
      amount: hold.amount.toString(),
      description: 'Withdraw payout (debit)',
      reference: params.withdrawRef,
    });

    const updatedHold = await this.prisma.walletHold.update({
      where: { id: hold.id },
      data: { status: 'RELEASED' },
    });

    return { ok: true, hold: updatedHold };
  }

  /**
   * 🔁 Transferência interna (MVP):
   * - valida saldo disponível do remetente
   * - cria DEBIT (from) e CREDIT (to) em transação
   * - idempotência por reference (se já existir o DEBIT, retorna "already_processed")
   */
  async transfer(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: string; // "10.50"
    reference: string; // ex: "transfer:<id>" (quem chama deve gerar)
    description?: string;
  }) {
    if (params.fromWalletId === params.toWalletId) {
      throw new Error('fromWalletId and toWalletId must be different');
    }

    const amountNum = Number(params.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }

    // idempotência simples: se já existe o DEBIT com a mesma reference, não processa de novo
    const already = await this.prisma.ledgerEntry.findFirst({
      where: {
        walletId: params.fromWalletId,
        type: 'DEBIT',
        reference: params.reference,
        status: 'POSTED',
      },
      select: { id: true },
    });

    if (already) {
      return {
        ok: true,
        status: 'already_processed',
        reference: params.reference,
      };
    }

    const balance = await this.getBalances(params.fromWalletId);
    const available = Number(balance.available);

    if (available < amountNum) {
      throw new Error(
        `Insufficient available funds. Available=${balance.available} Requested=${params.amount}`,
      );
    }

    const description = params.description ?? 'Internal transfer';

    return await this.prisma.$transaction(async (tx) => {
      const debit = await tx.ledgerEntry.create({
        data: {
          walletId: params.fromWalletId,
          type: 'DEBIT',
          amount: params.amount,
          description: `${description} (debit)`,
          reference: params.reference,
          status: 'POSTED',
        },
      });

      const credit = await tx.ledgerEntry.create({
        data: {
          walletId: params.toWalletId,
          type: 'CREDIT',
          amount: params.amount,
          description: `${description} (credit)`,
          reference: params.reference,
          status: 'POSTED',
        },
      });

      return {
        ok: true,
        status: 'posted',
        reference: params.reference,
        debitId: debit.id,
        creditId: credit.id,
      };
    });
  }

  /**
   * 💳 Depósito / Top-up (MOCK):
   * - cria um CREDIT na wallet
   * - idempotência por reference
   */
  async deposit(params: {
    walletId: string;
    amount: string; // "10.00"
    reference: string; // ex: "topup:<id>"
    description?: string;
  }) {
    const amountNum = Number(params.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }

    // idempotência: se já existe CREDIT com mesma reference, não duplica
    const already = await this.prisma.ledgerEntry.findFirst({
      where: {
        walletId: params.walletId,
        type: 'CREDIT',
        reference: params.reference,
        status: 'POSTED',
      },
      select: { id: true },
    });

    if (already) {
      return {
        ok: true,
        status: 'already_processed',
        reference: params.reference,
      };
    }

    await this.postEntry({
      walletId: params.walletId,
      type: 'CREDIT',
      amount: params.amount,
      description: params.description ?? 'External topup (mock)',
      reference: params.reference,
    });

    const balance = await this.getBalances(params.walletId);

    return {
      ok: true,
      status: 'posted',
      reference: params.reference,
      balance,
    };
  }
}
