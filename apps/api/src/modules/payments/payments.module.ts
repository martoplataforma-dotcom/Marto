import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PixService } from './pix.service';
import { WalletModule } from '../wallet/wallet.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    WalletModule, // fornece SettlementService
    OrdersModule, // fornece OrdersService
  ],
  controllers: [PaymentsController],
  providers: [PixService],
  exports: [PixService],
})
export class PaymentsModule {}
