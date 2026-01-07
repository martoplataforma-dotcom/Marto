import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { SettlementService } from './settlement.service';
import { AnticipationService } from './anticipation.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, SettlementService, AnticipationService],
  exports: [WalletService, SettlementService, AnticipationService],
})
export class WalletModule {}
