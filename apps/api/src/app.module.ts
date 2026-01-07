import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IdentityModule } from './modules/identity/identity.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ServicesModule } from './modules/services/services.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FactoriesModule } from './modules/factories/factories.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { SocialModule } from './modules/social/social.module';
import { FundModule } from './modules/fund/fund.module';
import { PurchaseIntentsModule } from './modules/factories/purchase-intents/purchase-intents.module';

import { InsightsAdvancedModule } from './modules/insights-advanced/insights-advanced.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { ServiceProvidersModule } from './modules/service-providers/service-providers.module';
import { ConsumersModule } from './modules/consumers/consumers.module';
import { RepresentativesModule } from './modules/representatives/representatives.module';

// ✅ NOVO
import { PublicModule } from './modules/public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    IdentityModule,
    CatalogModule,
    OrdersModule,
    PaymentsModule,
    ServicesModule,
    ReviewsModule,
    FactoriesModule,
    LogisticsModule,
    SocialModule,
    FundModule,
    PurchaseIntentsModule,
    InsightsAdvancedModule,
    WalletModule,

    MerchantsModule,
    ServiceProvidersModule,
    ConsumersModule,
    RepresentativesModule,

    // ✅ NOVO
    PublicModule,
  ],
})
export class AppModule {}
