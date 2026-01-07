import { Injectable } from '@nestjs/common';
import {
  AnticipationStatus,
  LedgerEntryType,
  LedgerStatus,
  WalletType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from './wallet.service';

@Injectable()
export class AnticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Antecipação A (simples):
   * - Lojista já tem recebíveis LIQUIDADOS (saldo disponível)
   * - Marto paga agora (DEBIT Marto) e credita lojista (CREDIT)
   * - Registra Anticipation (auditável)
   */
  async anticipate(params: {
    merchantOwnerId: string; // merchantId
    amount: string; // "100.00"
    fee: string; // "3.00"
    orderId?: string;
    reason?: string;
    reference?: string;
  }) {
    return await this.prisma.$transaction(async (tx) => {
      const merchantWallet = await this.wallet.getOrCreateWallet({
        type: WalletType.MERCHANT,
        ownerId: params.merchantOwnerId,
      });

      const martoWallet = await this.wallet.getOrCreateWallet({
        type: WalletType.MARTO,
        ownerId: 'marto',
      });

      const amount = Number(params.amount);
      const fee = Number(params.fee);
      if (amount <= 0) throw new Error('Invalid amount');
      if (fee < 0) throw new Error('Invalid fee');
      const net = amount - fee;
      if (net <= 0) throw new Error('Net amount must be positive');

      // (Opcional) validar saldo disponível do lojista antes — virá depois.
      // Aqui focamos no "motor" bancário.

      const anticipation = await tx.anticipation.create({
        data: {
          merchantId: params.merchantOwnerId,
          orderId: params.orderId,
          amount: amount.toFixed(2),
          fee: fee.toFixed(2),
          netAmount: net.toFixed(2),
          status: AnticipationStatus.APPROVED,
          reason: params.reason,
          reference: params.reference,
        },
      });

      // Paga agora:
      // Marto DEBIT (sai dinheiro do Marto)
      await tx.ledgerEntry.create({
        data: {
          walletId: martoWallet.id,
          type: LedgerEntryType.DEBIT,
          amount: net.toFixed(2),
          description: 'Anticipation payout (debit marto)',
          reference: anticipation.id,
          status: LedgerStatus.POSTED,
        },
      });

      // Lojista CREDIT (entra dinheiro no lojista)
      await tx.ledgerEntry.create({
        data: {
          walletId: merchantWallet.id,
          type: LedgerEntryType.CREDIT,
          amount: net.toFixed(2),
          description: 'Anticipation payout (credit merchant)',
          reference: anticipation.id,
          status: LedgerStatus.POSTED,
        },
      });

      // Receita do Marto (fee): entra no Marto
      if (fee > 0) {
        await tx.ledgerEntry.create({
          data: {
            walletId: martoWallet.id,
            type: LedgerEntryType.CREDIT,
            amount: fee.toFixed(2),
            description: 'Anticipation fee (credit marto)',
            reference: anticipation.id,
            status: LedgerStatus.POSTED,
          },
        });
      }

      // Marca como PAID (padrão simplificado do MVP)
      const updated = await tx.anticipation.update({
        where: { id: anticipation.id },
        data: { status: AnticipationStatus.PAID },
      });

      return {
        anticipationId: updated.id,
        merchantOwnerId: params.merchantOwnerId,
        netAmount: net.toFixed(2),
        fee: fee.toFixed(2),
        status: updated.status,
      };
    });
  }
}
