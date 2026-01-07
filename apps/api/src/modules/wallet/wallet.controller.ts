import { Body, Controller, Get, Post, Query, Param } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletType, LedgerEntryType } from '@prisma/client';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('demo')
  async demo(
    @Query('ownerId') ownerId: string,
    @Query('type') typeRaw: string,
    @Query('amount') amount = '10.00',
  ) {
    const type = String(typeRaw).split(',')[0].trim() as WalletType;

    const w = await this.wallet.getOrCreateWallet({ ownerId, type });

    await this.wallet.postEntry({
      walletId: w.id,
      type: LedgerEntryType.CREDIT,
      amount,
      description: 'Demo credit',
      reference: 'demo',
    });

    const balance = await this.wallet.getBalances(w.id);

    return { wallet: w, balance };
  }

  /**
   * 📄 GET /api/wallet/statement/:walletId
   * Extrato simples: ledger + holds
   *
   * (rota colocada ANTES do :ownerId pra não conflitar)
   */
  @Get('statement/:walletId')
  async statement(@Param('walletId') walletId: string) {
    return this.wallet.getStatement(walletId);
  }

  /**
   * 💰 GET /api/wallet/balance/:walletId
   * Retorna total / blocked / available
   */
  @Get('balance/:walletId')
  async balance(@Param('walletId') walletId: string) {
    return this.wallet.getBalances(walletId);
  }

  /**
   * 🏦 POST /api/wallet/withdraw
   * Solicita saque (cria HOLD)
   */
  @Post('withdraw')
  async requestWithdraw(
    @Body()
    body: {
      walletId: string;
      amount: string; // "25.00"
      reason?: string;
    },
  ) {
    return this.wallet.requestWithdraw(body);
  }

  /**
   * ✅ POST /api/wallet/withdraw/confirm
   * Confirma saque (gera DEBIT e libera HOLD)
   */
  @Post('withdraw/confirm')
  async confirmWithdraw(
    @Body()
    body: {
      walletId: string;
      withdrawRef: string;
    },
  ) {
    return this.wallet.confirmWithdraw(body);
  }

  /**
   * 🔁 POST /api/wallet/transfer
   * Transferência interna wallet -> wallet
   */
  @Post('transfer')
  async transfer(
    @Body()
    body: {
      fromWalletId: string;
      toWalletId: string;
      amount: string;
      reference: string; // ex: transfer:<uuid>
      description?: string;
    },
  ) {
    return this.wallet.transfer(body);
  }

  /**
   * 💳 POST /api/wallet/deposit
   * Depósito / topup (mock)
   */
  @Post('deposit')
  async deposit(
    @Body()
    body: {
      walletId: string;
      amount: string;
      reference: string; // ex: topup:<id>
      description?: string;
    },
  ) {
    return this.wallet.deposit(body);
  }

  /**
   * 🔎 GET /api/wallet/:ownerId
   * Retorna a wallet do owner por tipo (query)
   * Ex: /api/wallet/user_123?type=USER
   */
  @Get(':ownerId')
  async getWallet(
    @Param('ownerId') ownerId: string,
    @Query('type') typeRaw: string,
  ) {
    const type = String(typeRaw).split(',')[0].trim() as WalletType;

    const wallet = await this.wallet.getOrCreateWallet({
      ownerId,
      type,
    });

    const balance = await this.wallet.getBalances(wallet.id);

    return { wallet, balance };
  }
}
