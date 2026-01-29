// apps/api/src/modules/merchants/merchants.module.ts
import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller';

import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

import { ShopsController } from './shops/shops.controller';
import { ShopsService } from './shops/shops.service';

import { MerchantOrdersController } from './merchant-orders.controller';
import { MerchantOrdersService } from './merchant-orders.service';

@Module({
  controllers: [
    MerchantsController,
    ProductsController,
    ShopsController,
    MerchantOrdersController,
  ],
  providers: [ProductsService, ShopsService, MerchantOrdersService],
})
export class MerchantsModule {}
