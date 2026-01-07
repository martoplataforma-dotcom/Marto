import { Injectable } from '@nestjs/common';
import {
  LedgerEntryType,
  LedgerStatus,
  WalletType,
  WalletHoldStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from './wallet.service';

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Liquida um pedido (split interno):
   * - Confere HOLD ativo do comprador (reference = orderId)
   * - Lança DEBIT no comprador
   * - Lança CREDIT no lojista
   * - Lança CREDIT no Marto (taxa)
   * - Libera HOLD(s) do comprador para esse orderId
   */
  async settleOrder(params: {
    orderId: string;
    buyerOwnerId: string; // userId do comprador (no seu MVP pode ser "anonymous")
    merchantOwnerId: string; // merchantId
    totalAmount: string; // ex "100.00"
    martoFeeAmount: string; // ex "5.00"
  }) {
    return await this.prisma.$transaction(async (tx) => {
      const buyerWallet = await this.wallet.getOrCreateWallet({
        type: WalletType.USER,
        ownerId: params.buyerOwnerId,
      });

      const merchantWallet = await this.wallet.getOrCreateWallet({
        type: WalletType.MERCHANT,
        ownerId: params.merchantOwnerId,
      });

      // Wallet master do Marto (padrão simples: ownerId fixo)
      const martoWallet = await this.wallet.getOrCreateWallet({
        type: WalletType.MARTO,
        ownerId: 'marto',
      });

      // 1) Confere HOLD ativo do comprador para este pedido
      const holdsAgg = await tx.walletHold.aggregate({
        where: {
          walletId: buyerWallet.id,
          reference: params.orderId,
          status: WalletHoldStatus.ACTIVE,
        },
        _sum: { amount: true },
      });

      const held = Number(holdsAgg._sum.amount ?? 0);
      const total = Number(params.totalAmount);

      if (held + 1e-9 < total) {
        throw new Error(
          `Insufficient held funds for order ${params.orderId}. Held=${held.toFixed(
            2,
          )} Total=${total.toFixed(2)}`,
        );
      }

      // 2) Calcula split
      const fee = Number(params.martoFeeAmount);
      if (fee < 0) throw new Error('Invalid marto fee');

      const merchantNet = total - fee;
      if (merchantNet < 0) throw new Error('Fee greater than total');

      const ref = params.orderId;

      // 3) Lançamentos no ledger (imutável)
      await tx.ledgerEntry.create({
        data: {
          walletId: buyerWallet.id,
          type: LedgerEntryType.DEBIT,
          amount: params.totalAmount,
          description: 'Order settlement (debit buyer)',
          reference: ref,
          status: LedgerStatus.POSTED,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: merchantWallet.id,
          type: LedgerEntryType.CREDIT,
          amount: merchantNet.toFixed(2),
          description: 'Order settlement (credit merchant)',
          reference: ref,
          status: LedgerStatus.POSTED,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: martoWallet.id,
          type: LedgerEntryType.CREDIT,
          amount: fee.toFixed(2),
          description: 'Marto fee (credit marto)',
          reference: ref,
          status: LedgerStatus.POSTED,
        },
      });

      // 4) Libera o(s) hold(s)
      await tx.walletHold.updateMany({
        where: {
          walletId: buyerWallet.id,
          reference: ref,
          status: WalletHoldStatus.ACTIVE,
        },
        data: { status: WalletHoldStatus.RELEASED },
      });

      return {
        orderId: params.orderId,
        buyerWalletId: buyerWallet.id,
        merchantWalletId: merchantWallet.id,
        martoWalletId: martoWallet.id,
        total: total.toFixed(2),
        merchantNet: merchantNet.toFixed(2),
        martoFee: fee.toFixed(2),
      };
    });
  }
}
