import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller';

import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

import { ShopsController } from './shops/shops.controller';
import { ShopsService } from './shops/shops.service';

@Module({
  controllers: [MerchantsController, ProductsController, ShopsController],
  providers: [ProductsService, ShopsService],
})
export class MerchantsModule {}
