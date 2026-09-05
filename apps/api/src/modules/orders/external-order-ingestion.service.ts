import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { NormalizedExternalOrderInput } from './types/normalized-external-order';

@Injectable()
export class ExternalOrderIngestionService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(input: NormalizedExternalOrderInput) {
    const salesChannelId = input.salesChannelId.trim();
    const externalOrderId = input.externalOrderId.trim();

    if (!salesChannelId) {
      throw new Error('salesChannelId is required.');
    }

    if (!externalOrderId) {
      throw new Error('externalOrderId is required.');
    }

    const salesChannel = await this.prisma.salesChannel.findUnique({
      where: {
        id: salesChannelId,
      },
      select: {
        id: true,
        merchantId: true,
        status: true,
      },
    });

    if (!salesChannel) {
      throw new Error('Sales channel not found.');
    }

    const existingReference =
      await this.prisma.externalOrderReference.findUnique({
        where: {
          salesChannelId_externalOrderId: {
            salesChannelId,
            externalOrderId,
          },
        },
        select: {
          id: true,
          orderId: true,
          externalUpdatedAt: true,
          lastSyncedAt: true,
        },
      });

    const isStale =
      existingReference?.externalUpdatedAt &&
      input.externalUpdatedAt &&
      input.externalUpdatedAt.getTime() <
        existingReference.externalUpdatedAt.getTime();

    if (isStale) {
      return {
        action: 'ignored_stale' as const,
        salesChannel,
        externalOrderId,
        existingReference,
      };
    }

    return {
      action: existingReference ? ('update' as const) : ('create' as const),
      salesChannel,
      externalOrderId,
      existingReference,
    };
  }
}
