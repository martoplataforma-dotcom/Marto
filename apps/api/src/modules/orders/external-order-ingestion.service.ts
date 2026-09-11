import { Injectable } from '@nestjs/common';
import { OrderEventType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { NormalizedExternalOrderInput } from './types/normalized-external-order';

@Injectable()
export class ExternalOrderIngestionService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeOptionalString(value?: string | null) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized || undefined;
  }

  private isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private mergeJsonObjects(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...existing };

    for (const [key, incomingValue] of Object.entries(incoming)) {
      if (incomingValue === null) {
        continue;
      }

      const existingValue = merged[key];

      if (
        this.isJsonObject(existingValue) &&
        this.isJsonObject(incomingValue)
      ) {
        merged[key] = this.mergeJsonObjects(existingValue, incomingValue);
        continue;
      }

      merged[key] = incomingValue;
    }

    return merged;
  }

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

  private async createExternalOrder(input: {
    normalized: NormalizedExternalOrderInput;
    salesChannel: {
      id: string;
      merchantId: string;
      status: string;
    };
    externalOrderId: string;
  }) {
    const { normalized, salesChannel, externalOrderId } = input;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const transactionalSalesChannel =
              await tx.salesChannel.findUnique({
                where: {
                  id: salesChannel.id,
                },
                select: {
                  id: true,
                  merchantId: true,
                  status: true,
                },
              });

            if (!transactionalSalesChannel) {
              throw new Error('Sales channel not found during transaction.');
            }

            const existingReference =
              await tx.externalOrderReference.findUnique({
                where: {
                  salesChannelId_externalOrderId: {
                    salesChannelId: transactionalSalesChannel.id,
                    externalOrderId,
                  },
                },
                select: {
                  id: true,
                  orderId: true,
                  externalUpdatedAt: true,
                  lastSyncedAt: true,
                  order: {
                    select: {
                      merchantId: true,
                    },
                  },
                },
              });

            if (existingReference) {
              if (
                existingReference.order.merchantId !==
                transactionalSalesChannel.merchantId
              ) {
                throw new Error(
                  'External order reference points to an order from another merchant.',
                );
              }

              const isStale =
                existingReference.externalUpdatedAt &&
                normalized.externalUpdatedAt &&
                normalized.externalUpdatedAt.getTime() <
                  existingReference.externalUpdatedAt.getTime();

              return {
                action: isStale
                  ? ('ignored_stale' as const)
                  : ('update' as const),
                salesChannel: transactionalSalesChannel,
                externalOrderId,
                existingReference: {
                  id: existingReference.id,
                  orderId: existingReference.orderId,
                  externalUpdatedAt: existingReference.externalUpdatedAt,
                  lastSyncedAt: existingReference.lastSyncedAt,
                },
              };
            }

            this.validateCreateInput(normalized);

            const items = normalized.items!;
            const canonicalStatus = normalized.canonicalStatus!;

            const normalizedItems = items.map((item, index) => {
              const productId =
                item.productId === undefined || item.productId === null
                  ? null
                  : item.productId.trim();

              if (item.productId != null && !productId) {
                throw new Error(`items[${index}].productId is invalid.`);
              }

              return {
                productId,
                titleSnapshot: item.title.trim(),
                skuSnapshot: item.sku?.trim() || null,
                variationSnapshot: item.variation,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              };
            });

            const productIds = Array.from(
              new Set(
                normalizedItems
                  .map((item) => item.productId)
                  .filter((id): id is string => Boolean(id)),
              ),
            );

            if (productIds.length > 0) {
              const products = await tx.product.findMany({
                where: {
                  id: {
                    in: productIds,
                  },
                  merchantId: transactionalSalesChannel.merchantId,
                },
                select: {
                  id: true,
                },
              });

              const validProductIds = new Set(
                products.map((product) => product.id),
              );

              const invalidProductId = productIds.find(
                (productId) => !validProductIds.has(productId),
              );

              if (invalidProductId) {
                throw new Error(
                  `Product does not exist or belongs to another merchant: ${invalidProductId}`,
                );
              }
            }

            const order = await tx.order.create({
              data: {
                merchantId: transactionalSalesChannel.merchantId,
                userId: null,
                status: canonicalStatus,

                buyerNameSnapshot: normalized.buyerName?.trim() || null,
                buyerContactSnapshot: normalized.buyerContact ?? undefined,

                recipientNameSnapshot:
                  normalized.recipientName?.trim() || null,
                destinationZipCode:
                  normalized.destinationZipCode?.trim() || null,
                city: normalized.city?.trim() || null,
                state: normalized.state?.trim() || null,
                destinationAddressSnapshot:
                  normalized.destinationAddress ?? undefined,

                items: {
                  create: normalizedItems,
                },

                externalOrderReferences: {
                  create: {
                    salesChannelId: transactionalSalesChannel.id,
                    externalOrderId,
                    externalStatus: normalized.externalStatus?.trim() || null,
                    externalCreatedAt:
                      normalized.externalCreatedAt ?? null,
                    externalUpdatedAt:
                      normalized.externalUpdatedAt ?? null,
                    lastSyncedAt: new Date(),
                    metadata: normalized.metadata ?? undefined,
                  },
                },
              },
              include: {
                items: true,
                externalOrderReferences: true,
              },
            });

            return {
              action: 'create' as const,
              salesChannel: transactionalSalesChannel,
              externalOrderId,
              existingReference: null,
              order,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2002');

        if (!retryable || attempt === 3) {
          throw error;
        }
      }
    }

    throw new Error('External order creation transaction failed.');
  }

  private async updateExternalOrder(input: {
    normalized: NormalizedExternalOrderInput;
    salesChannel: {
      id: string;
      merchantId: string;
      status: string;
    };
    externalOrderId: string;
  }) {
    const { normalized, salesChannel, externalOrderId } = input;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const transactionalSalesChannel =
              await tx.salesChannel.findUnique({
                where: {
                  id: salesChannel.id,
                },
                select: {
                  id: true,
                  merchantId: true,
                  status: true,
                },
              });

            if (!transactionalSalesChannel) {
              throw new Error(
                'Sales channel not found during update transaction.',
              );
            }

            const existingReference =
              await tx.externalOrderReference.findUnique({
                where: {
                  salesChannelId_externalOrderId: {
                    salesChannelId: transactionalSalesChannel.id,
                    externalOrderId,
                  },
                },
                select: {
                  id: true,
                  orderId: true,
                  externalStatus: true,
                  externalCreatedAt: true,
                  externalUpdatedAt: true,
                  lastSyncedAt: true,
                  metadata: true,
                  order: {
                    select: {
                      id: true,
                      merchantId: true,
                      status: true,
                      buyerNameSnapshot: true,
                      buyerContactSnapshot: true,
                      recipientNameSnapshot: true,
                      destinationZipCode: true,
                      city: true,
                      state: true,
                      destinationAddressSnapshot: true,
                    },
                  },
                },
              });

            if (!existingReference) {
              throw new Error(
                'External order reference not found during update transaction.',
              );
            }

            if (
              existingReference.order.merchantId !==
              transactionalSalesChannel.merchantId
            ) {
              throw new Error(
                'External order reference points to an order from another merchant.',
              );
            }

            const isStale =
              existingReference.externalUpdatedAt &&
              normalized.externalUpdatedAt &&
              normalized.externalUpdatedAt.getTime() <
                existingReference.externalUpdatedAt.getTime();

            if (isStale) {
              const updatedReference =
                await tx.externalOrderReference.update({
                  where: {
                    id: existingReference.id,
                  },
                  data: {
                    lastSyncedAt: new Date(),
                  },
                  select: {
                    id: true,
                    orderId: true,
                    externalUpdatedAt: true,
                    lastSyncedAt: true,
                  },
                });

              return {
                action: 'ignored_stale' as const,
                salesChannel: transactionalSalesChannel,
                externalOrderId,
                existingReference: updatedReference,
              };
            }

            const externalCreatedAt =
              existingReference.externalCreatedAt === null &&
              normalized.externalCreatedAt !== undefined &&
              normalized.externalCreatedAt !== null
                ? normalized.externalCreatedAt
                : undefined;

            let metadata: Prisma.InputJsonValue | undefined;

            if (this.isJsonObject(normalized.metadata)) {
              if (existingReference.metadata === null) {
                metadata = normalized.metadata as Prisma.InputJsonObject;
              } else if (this.isJsonObject(existingReference.metadata)) {
                metadata = this.mergeJsonObjects(
                  existingReference.metadata,
                  normalized.metadata,
                ) as Prisma.InputJsonObject;
              }
            }

            const externalStatus = this.normalizeOptionalString(
              normalized.externalStatus,
            );

            const buyerName = this.normalizeOptionalString(normalized.buyerName);
            const recipientName = this.normalizeOptionalString(
              normalized.recipientName,
            );
            const destinationZipCode = this.normalizeOptionalString(
              normalized.destinationZipCode,
            );
            const city = this.normalizeOptionalString(normalized.city);
            const state = this.normalizeOptionalString(normalized.state);

            const statusChanged =
              normalized.canonicalStatus !== undefined &&
              normalized.canonicalStatus !== existingReference.order.status;

            const orderUpdateData: Prisma.OrderUpdateInput = {};

            if (
              normalized.buyerContact !== undefined &&
              normalized.buyerContact !== null
            ) {
              orderUpdateData.buyerContactSnapshot = normalized.buyerContact;
            }

            if (
              normalized.destinationAddress !== undefined &&
              normalized.destinationAddress !== null
            ) {
              orderUpdateData.destinationAddressSnapshot =
                normalized.destinationAddress;
            }

            if (
              buyerName !== undefined &&
              buyerName !== existingReference.order.buyerNameSnapshot
            ) {
              orderUpdateData.buyerNameSnapshot = buyerName;
            }

            if (
              recipientName !== undefined &&
              recipientName !== existingReference.order.recipientNameSnapshot
            ) {
              orderUpdateData.recipientNameSnapshot = recipientName;
            }

            if (
              destinationZipCode !== undefined &&
              destinationZipCode !== existingReference.order.destinationZipCode
            ) {
              orderUpdateData.destinationZipCode = destinationZipCode;
            }

            if (city !== undefined && city !== existingReference.order.city) {
              orderUpdateData.city = city;
            }

            if (state !== undefined && state !== existingReference.order.state) {
              orderUpdateData.state = state;
            }

            if (statusChanged) {
              orderUpdateData.status = normalized.canonicalStatus;
            }

            if (Object.keys(orderUpdateData).length > 0) {
              await tx.order.update({
                where: {
                  id: existingReference.orderId,
                },
                data: orderUpdateData,
              });
            }

            if (statusChanged) {
              const eventMeta: Prisma.InputJsonObject =
                externalStatus !== undefined
                  ? {
                      salesChannelId: transactionalSalesChannel.id,
                      externalOrderId,
                      externalStatus,
                    }
                  : {
                      salesChannelId: transactionalSalesChannel.id,
                      externalOrderId,
                    };

              await tx.orderEvent.create({
                data: {
                  orderId: existingReference.orderId,
                  type: OrderEventType.STATUS_CHANGED,
                  actorUserId: null,
                  actorRole: 'system',
                  fromStatus: existingReference.order.status,
                  toStatus: normalized.canonicalStatus,
                  message:
                    'Status atualizado por sincronização de canal externo.',
                  meta: eventMeta,
                },
              });
            }

            const updatedReference = await tx.externalOrderReference.update({
              where: {
                id: existingReference.id,
              },
              data: {
                externalStatus,
                externalCreatedAt,
                metadata,
                externalUpdatedAt: normalized.externalUpdatedAt ?? undefined,
                lastSyncedAt: new Date(),
              },
              select: {
                id: true,
                orderId: true,
                externalUpdatedAt: true,
                lastSyncedAt: true,
              },
            });

            return {
              action: 'update' as const,
              salesChannel: transactionalSalesChannel,
              externalOrderId,
              existingReference: updatedReference,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!retryable || attempt === 3) {
          throw error;
        }
      }
    }

    throw new Error('External order update transaction failed.');
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

    if (!existingReference) {
      return this.createExternalOrder({
        normalized: input,
        salesChannel,
        externalOrderId,
      });
    }

    return this.updateExternalOrder({
      normalized: input,
      salesChannel,
      externalOrderId,
    });
  }
}
