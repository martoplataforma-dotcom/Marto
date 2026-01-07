import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller';

import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

@Module({
  controllers: [MerchantsController, ProductsController],
  providers: [ProductsService],
})
export class MerchantsModule {}
