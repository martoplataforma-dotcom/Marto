import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async countChannels(): Promise<number> {
    const total = await this.prisma.factoryChannel.count();
    return total;
  }

  async createChannel(data: {
    factoryId: string;
    name: string;
    description?: string;
    catalogInfo?: unknown;
  }): Promise<unknown> {
    const created = await this.prisma.factoryChannel.create({
      data: {
        factoryId: data.factoryId,
        name: data.name,
        description: data.description,
        catalogInfo: data.catalogInfo as any,
      },
    });

    return created;
  }

  async listChannels(): Promise<unknown[]> {
    const rows = await this.prisma.factoryChannel.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows as unknown[];
  }
}
