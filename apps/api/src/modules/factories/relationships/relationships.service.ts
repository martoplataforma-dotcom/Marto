import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async countRelationships(): Promise<number> {
    const total = await this.prisma.relationshipHistory.count();
    return total;
  }

  async openFromIntent(data: {
    channelId: string;
    purchaseIntentId: string;
    summary?: string;
    internalNotes?: string;
  }): Promise<unknown> {
    const created = await this.prisma.relationshipHistory.create({
      data: {
        channelId: data.channelId,
        purchaseIntentId: data.purchaseIntentId,
        summary: data.summary,
        internalNotes: data.internalNotes,
        status: 'ACTIVE' as any,
      },
    });

    return created;
  }

  async listByChannel(channelId: string): Promise<unknown[]> {
    const rows = await this.prisma.relationshipHistory.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
    });

    return rows as unknown[];
  }
}
