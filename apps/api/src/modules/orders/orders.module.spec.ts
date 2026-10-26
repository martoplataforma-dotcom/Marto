import { MODULE_METADATA } from '@nestjs/common/constants';

import { ExternalOrderIngestionService } from './external-order-ingestion.service';
import { OrdersModule } from './orders.module';

describe('OrdersModule', () => {
  it('registers ExternalOrderIngestionService as a provider', () => {
    const providers =
      (Reflect.getMetadata(
        MODULE_METADATA.PROVIDERS,
        OrdersModule,
      ) as unknown[] | undefined) ?? [];

    expect(providers).toContain(ExternalOrderIngestionService);
  });

  it('exports ExternalOrderIngestionService for internal consumers', () => {
    const exportedProviders =
      (Reflect.getMetadata(
        MODULE_METADATA.EXPORTS,
        OrdersModule,
      ) as unknown[] | undefined) ?? [];

    expect(exportedProviders).toContain(
      ExternalOrderIngestionService,
    );
  });
});