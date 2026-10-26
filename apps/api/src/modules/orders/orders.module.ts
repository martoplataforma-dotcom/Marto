import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { ExternalOrderIngestionService } from './external-order-ingestion.service';
import { OrdersService } from './orders.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [OrdersController],
  providers: [OrdersService, ExternalOrderIngestionService],
  exports: [OrdersService, ExternalOrderIngestionService],
})
export class OrdersModule {}
