import { Controller, Get, Body, Post } from '@nestjs/common';
import { PurchaseIntentsService } from './purchase-intents.service';

@Controller('factories/purchase-intents')
export class PurchaseIntentsController {
  constructor(private readonly service: PurchaseIntentsService) {}

  @Get('count')
  async count() {
    const total = await this.service.countIntents();
    return { total };
  }

  @Post()
  async create(
    @Body()
    body: {
      channelId: string;
      companyName: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      productInfo: unknown;
      quantity?: number;
      frequency?: string;
      notes?: string;
    },
  ) {
    const created = await this.service.createIntent(body);
    return created;
  }
}
