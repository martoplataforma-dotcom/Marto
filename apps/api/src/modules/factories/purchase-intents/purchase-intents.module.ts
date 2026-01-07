import { Module } from '@nestjs/common';
import { PurchaseIntentsController } from './purchase-intents.controller';
import { PurchaseIntentsService } from './purchase-intents.service';

@Module({
  controllers: [PurchaseIntentsController],
  providers: [PurchaseIntentsService],
})
export class PurchaseIntentsModule {}
