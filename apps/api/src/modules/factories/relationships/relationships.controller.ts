import { Controller, Get, Body, Post, Param } from '@nestjs/common';
import { RelationshipsService } from './relationships.service';

@Controller('factories/relationships')
export class RelationshipsController {
  constructor(private readonly service: RelationshipsService) {}

  @Get('count')
  async count() {
    const total = await this.service.countRelationships();
    return { total };
  }

  @Post()
  async open(
    @Body()
    body: {
      channelId: string;
      purchaseIntentId: string;
      summary?: string;
      internalNotes?: string;
    },
  ) {
    const created = await this.service.openFromIntent(body);
    return created;
  }

  @Get('channel/:channelId')
  async listByChannel(@Param('channelId') channelId: string) {
    const rows = await this.service.listByChannel(channelId);
    return rows;
  }
}
