import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChannelsService } from './channels.service';

@Controller('factories/channels')
export class ChannelsController {
  constructor(private readonly service: ChannelsService) {}

  @Get('ping')
  ping() {
    return {
      ok: true,
      module: 'factories/channels',
      message: 'Representante Virtual (Channels) online',
    };
  }

  @Get('count')
  async count() {
    const total = await this.service.countChannels();
    return { total };
  }

  @Post()
  async create(
    @Body()
    body: {
      factoryId: string;
      name: string;
      description?: string;
      catalogInfo?: unknown;
    },
  ) {
    const created = await this.service.createChannel(body);
    return created;
  }

  @Get()
  async list() {
    const rows = await this.service.listChannels();
    return rows;
  }
}
