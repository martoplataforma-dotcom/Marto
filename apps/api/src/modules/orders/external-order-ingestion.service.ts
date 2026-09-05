import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { NormalizedExternalOrderInput } from './types/normalized-external-order';

@Injectable()
export class ExternalOrderIngestionService {
  constructor(private readonly prisma: PrismaService) {}

  private validateCreateInput(input: NormalizedExternalOrderInput) {
    if (!input.canonicalStatus) {
      throw new Error(
        'canonicalStatus is required when creating an external order.',
      );
    }

    if (!input.items?.length) {
      throw new Error(
        'At least one item is required when creating an external order.',
      );
    }

    input.items.forEach((item, index) => {
      if (!item.title.trim()) {
        throw new Error(`items[${index}].title is required.`);
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(
          `items[${index}].quantity must be an integer greater than zero.`,
        );
      }

      let unitPrice: Prisma.Decimal;

      try {
        unitPrice = new Prisma.Decimal(item.unitPrice);
      } catch {
        throw new Error(`items[${index}].unitPrice is invalid.`);
      }

      if (!unitPrice.isFinite() || unitPrice.isNegative()) {
        throw new Error(
          `items[${index}].unitPrice must be greater than or equal to zero.`,
        );
      }
    });
  }

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

    if (!existingReference) {
      this.validateCreateInput(input);
    }

    return {
      action: existingReference ? ('update' as const) : ('create' as const),
      salesChannel,
      externalOrderId,
      existingReference,
    };
  }
}
