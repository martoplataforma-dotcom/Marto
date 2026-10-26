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

  private normalizeOptionalDate(value?: Date | null) {
    if (!(value instanceof Date)) {
      return undefined;
    }

    return Number.isFinite(value.getTime()) ? value : undefined;
  }

  private isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private areJsonValuesStructurallyEqual(
    left: unknown,
    right: unknown,
  ): boolean {
    if (left === right) {
      return true;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
      if (
        !Array.isArray(left) ||
        !Array.isArray(right) ||
        left.length !== right.length
      ) {
        return false;
      }

      return left.every((value, index) =>
        this.areJsonValuesStructurallyEqual(value, right[index]),
      );
    }

    if (this.isJsonObject(left) || this.isJsonObject(right)) {
      if (!this.isJsonObject(left) || !this.isJsonObject(right)) {
        return false;
      }

      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);

      if (leftKeys.length !== rightKeys.length) {
        return false;
      }

      return leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          this.areJsonValuesStructurallyEqual(left[key], right[key]),
      );
    }

    return false;
  }

  private getSkuComparisonState(
    currentSku: string | null,
    incomingSku?: string | null,
  ): 'not_provided' | 'matches' | 'differs' {
    if (incomingSku === undefined || incomingSku === null) {
      return 'not_provided';
    }

    const normalizedIncomingSku = incomingSku.trim();

    if (normalizedIncomingSku === '') {
      return 'not_provided';
    }

    return currentSku === normalizedIncomingSku ? 'matches' : 'differs';
  }

  private getItemReconciliationPlanState(input: {
    hasCanonicalOrderItem: boolean;
    productIdComparisonState:
      | 'not_comparable'
      | 'not_provided'
      | 'invalid'
      | 'matches'
      | 'differs';
    variationComparisonState:
      | 'not_comparable'
      | 'not_provided'
      | 'matches'
      | 'differs';
    scalarItemComparisonState: 'not_comparable' | 'matches' | 'differs';
  }):
    | 'blocked_not_comparable'
    | 'blocked_invalid_product_id'
    | 'blocked_product_relink_required'
    | 'snapshot_changes_detected'
    | 'no_changes' {
    if (!input.hasCanonicalOrderItem) {
      return 'blocked_not_comparable';
    }

    if (input.productIdComparisonState === 'invalid') {
      return 'blocked_invalid_product_id';
    }

    if (input.productIdComparisonState === 'differs') {
      return 'blocked_product_relink_required';
    }

    if (
      input.scalarItemComparisonState === 'differs' ||
      input.variationComparisonState === 'differs'
    ) {
      return 'snapshot_changes_detected';
    }

    return 'no_changes';
  }

  private summarizeItemReconciliationPlans(
    matches: ReadonlyArray<{
      itemReconciliationPlanState:
        | 'blocked_not_comparable'
        | 'blocked_invalid_product_id'
        | 'blocked_product_relink_required'
        | 'snapshot_changes_detected'
        | 'no_changes';
    }>,
  ) {
    return matches.reduce(
      (summary, match) => {
        summary.totalItems += 1;

        switch (match.itemReconciliationPlanState) {
          case 'no_changes':
            summary.noChanges += 1;
            break;

          case 'snapshot_changes_detected':
            summary.snapshotChangesDetected += 1;
            break;

          case 'blocked_not_comparable':
            summary.blockedNotComparable += 1;
            summary.blockedItems += 1;
            break;

          case 'blocked_invalid_product_id':
            summary.blockedInvalidProductId += 1;
            summary.blockedItems += 1;
            break;

          case 'blocked_product_relink_required':
            summary.blockedProductRelinkRequired += 1;
            summary.blockedItems += 1;
            break;
        }

        return summary;
      },
      {
        totalItems: 0,
        noChanges: 0,
        snapshotChangesDetected: 0,
        blockedNotComparable: 0,
        blockedInvalidProductId: 0,
        blockedProductRelinkRequired: 0,
        blockedItems: 0,
      },
    );
  }

  private getItemReconciliationSetState(input: {
    itemUpdateEligibility:
      | 'matched_items_only'
      | 'blocked_unmatched'
      | 'preserve_items';
    itemReconciliationPlanSummary: {
      blockedItems: number;
      snapshotChangesDetected: number;
    };
  }) {
    if (input.itemUpdateEligibility === 'preserve_items') {
      return 'preserve_items';
    }

    if (input.itemUpdateEligibility === 'blocked_unmatched') {
      return 'blocked_unmatched';
    }

    if (input.itemReconciliationPlanSummary.blockedItems > 0) {
      return 'blocked_item_reconciliation';
    }

    if (input.itemReconciliationPlanSummary.snapshotChangesDetected > 0) {
      return 'snapshot_changes_detected';
    }

    return 'no_changes';
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

  private validateExternalItems(
    items: NonNullable<NormalizedExternalOrderInput['items']>,
  ) {
    const externalItemIds = new Set<string>();

    items.forEach((item, index) => {
      const externalItemId =
        typeof item.externalItemId === 'string'
          ? item.externalItemId.trim()
          : '';

      if (!externalItemId) {
        throw new Error(`items[${index}].externalItemId is required.`);
      }

      if (externalItemIds.has(externalItemId)) {
        throw new Error(
          `items[${index}].externalItemId must be unique within the external order.`,
        );
      }

      externalItemIds.add(externalItemId);

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

    this.validateExternalItems(input.items);
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
                externalItemId: item.externalItemId.trim(),
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

            const createdOrder = await tx.order.create({
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
              },
              select: {
                id: true,
              },
            });

            const externalOrderReference =
              await tx.externalOrderReference.create({
                data: {
                  orderId: createdOrder.id,
                  salesChannelId: transactionalSalesChannel.id,
                  externalOrderId,
                  externalStatus: normalized.externalStatus?.trim() || null,
                  externalCreatedAt:
                    this.normalizeOptionalDate(normalized.externalCreatedAt) ??
                    null,
                  externalUpdatedAt:
                    normalized.externalUpdatedAt ?? null,
                  lastSyncedAt: new Date(),
                  metadata: normalized.metadata ?? undefined,
                },
                select: {
                  id: true,
                },
              });

            for (const item of normalizedItems) {
              const orderItem = await tx.orderItem.create({
                data: {
                  orderId: createdOrder.id,
                  productId: item.productId,
                  titleSnapshot: item.titleSnapshot,
                  skuSnapshot: item.skuSnapshot,
                  variationSnapshot: item.variationSnapshot,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                },
                select: {
                  id: true,
                },
              });

              await tx.externalOrderItemReference.create({
                data: {
                  orderItemId: orderItem.id,
                  externalOrderReferenceId: externalOrderReference.id,
                  externalItemId: item.externalItemId,
                },
              });
            }

            const order = await tx.order.findUniqueOrThrow({
              where: {
                id: createdOrder.id,
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
                      items: {
                        select: {
                          id: true,
                          productId: true,
                          titleSnapshot: true,
                          skuSnapshot: true,
                          variationSnapshot: true,
                          quantity: true,
                          unitPrice: true,
                        },
                      },
                    },
                  },
                  externalItems: {
                    select: {
                      id: true,
                      orderItemId: true,
                      externalItemId: true,
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

            const canonicalOrderItemIds = new Set(
              existingReference.order.items.map((item) => item.id),
            );

            const hasOnlySameOrderItemReferences =
              existingReference.externalItems.every((externalItem) =>
                canonicalOrderItemIds.has(externalItem.orderItemId),
              );

            const hasCompleteItemIdentity =
              existingReference.order.items.length > 0 &&
              existingReference.externalItems.length ===
                existingReference.order.items.length &&
              hasOnlySameOrderItemReferences;

            const itemIdentityState =
              normalized.items === undefined
                ? 'items_omitted'
                : existingReference.order.items.length > 0 &&
                    existingReference.externalItems.length === 0
                  ? 'legacy_unlinked'
                  : hasCompleteItemIdentity
                    ? 'identified_complete'
                    : existingReference.order.items.length === 0 &&
                        existingReference.externalItems.length === 0
                      ? 'empty_unidentified'
                      : 'inconsistent';

            if (
              itemIdentityState === 'identified_complete' &&
              normalized.items !== undefined
            ) {
              this.validateExternalItems(normalized.items);

              const externalItemReferencesByExternalItemId = new Map(
                existingReference.externalItems.map((externalItem) => [
                  externalItem.externalItemId,
                  externalItem,
                ]),
              );

              const canonicalOrderItemsById = new Map(
                existingReference.order.items.map((orderItem) => [
                  orderItem.id,
                  orderItem,
                ]),
              );

              const incomingItemMatches = normalized.items.map((item) => {
                const externalItemId = item.externalItemId.trim();
                const externalItemReference =
                  externalItemReferencesByExternalItemId.get(externalItemId);

                const canonicalOrderItem =
                  externalItemReference === undefined
                    ? null
                    : canonicalOrderItemsById.get(
                          externalItemReference.orderItemId,
                        ) ?? null;

                const normalizedSku = item.sku?.trim() || null;
                const skuComparisonState =
                  canonicalOrderItem === null
                    ? 'not_comparable'
                    : this.getSkuComparisonState(
                        canonicalOrderItem.skuSnapshot,
                        item.sku,
                      );
                const incomingUnitPrice = new Prisma.Decimal(item.unitPrice);
                const normalizedProductId =
                  item.productId === undefined || item.productId === null
                    ? null
                    : item.productId.trim();

                const productIdComparisonState =
                  canonicalOrderItem === null
                    ? 'not_comparable'
                    : item.productId === undefined || item.productId === null
                      ? 'not_provided'
                      : normalizedProductId === ''
                        ? 'invalid'
                        : canonicalOrderItem.productId === normalizedProductId
                          ? 'matches'
                          : 'differs';

                const variationComparisonState =
                  canonicalOrderItem === null
                    ? 'not_comparable'
                    : item.variation === undefined
                      ? 'not_provided'
                      : this.areJsonValuesStructurallyEqual(
                            canonicalOrderItem.variationSnapshot,
                            item.variation,
                          )
                        ? 'matches'
                        : 'differs';

                const scalarItemComparison =
                  canonicalOrderItem === null
                    ? null
                    : {
                        titleMatches:
                          canonicalOrderItem.titleSnapshot === item.title.trim(),
                        skuMatches:
                          skuComparisonState !== 'differs',
                        quantityMatches:
                          canonicalOrderItem.quantity === item.quantity,
                        unitPriceMatches:
                          canonicalOrderItem.unitPrice.equals(incomingUnitPrice),
                      };

                const scalarItemComparisonState =
                  scalarItemComparison === null
                    ? 'not_comparable'
                    : scalarItemComparison.titleMatches &&
                        scalarItemComparison.skuMatches &&
                        scalarItemComparison.quantityMatches &&
                        scalarItemComparison.unitPriceMatches
                      ? 'matches'
                      : 'differs';

                const itemReconciliationPlanState =
                  this.getItemReconciliationPlanState({
                    hasCanonicalOrderItem: canonicalOrderItem !== null,
                    productIdComparisonState,
                    variationComparisonState,
                    scalarItemComparisonState,
                  });

                const scalarItemDifferences =
                  scalarItemComparison === null
                    ? null
                    : [
                        ...(scalarItemComparison.titleMatches ? [] : ['title']),
                        ...(scalarItemComparison.skuMatches ? [] : ['sku']),
                        ...(scalarItemComparison.quantityMatches
                          ? []
                          : ['quantity']),
                        ...(scalarItemComparison.unitPriceMatches
                          ? []
                          : ['unitPrice']),
                      ];

                const scalarItemDifferenceScope =
                  scalarItemDifferences === null
                    ? 'not_comparable'
                    : scalarItemDifferences.length === 0
                      ? 'no_differences'
                      : scalarItemDifferences.length === 1
                        ? 'single_field'
                        : 'multiple_fields';

                const scalarItemDifferenceDetails =
                  scalarItemComparison === null || canonicalOrderItem === null
                    ? null
                    : {
                        ...(scalarItemComparison.titleMatches
                          ? {}
                          : {
                              title: {
                                current: canonicalOrderItem.titleSnapshot,
                                incoming: item.title.trim(),
                              },
                            }),
                        ...(scalarItemComparison.skuMatches
                          ? {}
                          : {
                              sku: {
                                current: canonicalOrderItem.skuSnapshot,
                                incoming: normalizedSku,
                              },
                            }),
                        ...(scalarItemComparison.quantityMatches
                          ? {}
                          : {
                              quantity: {
                                current: canonicalOrderItem.quantity,
                                incoming: item.quantity,
                              },
                            }),
                        ...(scalarItemComparison.unitPriceMatches
                          ? {}
                          : {
                              unitPrice: {
                                current: canonicalOrderItem.unitPrice,
                                incoming: incomingUnitPrice,
                              },
                            }),
                      };

                return {
                  externalItemId,
                  externalOrderItemReferenceId:
                    externalItemReference?.id ?? null,
                  orderItemId: externalItemReference?.orderItemId ?? null,
                  canonicalOrderItem,
                  incomingTitle: item.title.trim(),
                  normalizedSku,
                  incomingVariation: item.variation,
                  incomingQuantity: item.quantity,
                  incomingUnitPrice,
                  incomingProductIdProvided:
                    item.productId !== undefined && item.productId !== null,
                  normalizedProductId,
                  skuComparisonState,
                  productIdComparisonState,
                  variationComparisonState,
                  scalarItemComparison,
                  scalarItemComparisonState,
                  itemReconciliationPlanState,
                  scalarItemDifferences,
                  scalarItemDifferenceScope,
                  scalarItemDifferenceDetails,
                };
              });

              const existingItemMatches = incomingItemMatches.filter(
                (match) => match.canonicalOrderItem !== null,
              );

              const newItemCandidates = incomingItemMatches.filter(
                (match) =>
                  match.canonicalOrderItem === null &&
                  match.externalOrderItemReferenceId === null,
              );

              const itemReconciliationPlanSummary =
                this.summarizeItemReconciliationPlans(existingItemMatches);

              const scalarItemComparisonSummary = existingItemMatches.reduce(
                (summary, match) => {
                  summary.totalItems += 1;

                  switch (match.scalarItemDifferenceScope) {
                    case 'not_comparable':
                      summary.notComparableItems += 1;
                      break;

                    case 'no_differences':
                      summary.comparableItems += 1;
                      summary.noDifferences += 1;
                      break;

                    case 'single_field':
                      summary.comparableItems += 1;
                      summary.singleFieldDifferences += 1;
                      break;

                    case 'multiple_fields':
                      summary.comparableItems += 1;
                      summary.multipleFieldDifferences += 1;
                      break;
                  }

                  return summary;
                },
                {
                  totalItems: 0,
                  comparableItems: 0,
                  notComparableItems: 0,
                  noDifferences: 0,
                  singleFieldDifferences: 0,
                  multipleFieldDifferences: 0,
                },
              );

              const scalarItemDifferenceFieldSummary =
                existingItemMatches.reduce(
                  (summary, match) => {
                    if (match.scalarItemDifferences?.includes('title')) {
                      summary.title += 1;
                    }

                    if (match.scalarItemDifferences?.includes('sku')) {
                      summary.sku += 1;
                    }

                    if (match.scalarItemDifferences?.includes('quantity')) {
                      summary.quantity += 1;
                    }

                    if (match.scalarItemDifferences?.includes('unitPrice')) {
                      summary.unitPrice += 1;
                    }

                    return summary;
                  },
                  {
                    title: 0,
                    sku: 0,
                    quantity: 0,
                    unitPrice: 0,
                  },
                );

              const incomingItemMatchState =
                incomingItemMatches.length === 0
                  ? 'items_empty'
                  : newItemCandidates.length > 0
                    ? 'contains_new_items'
                    : incomingItemMatches.length ===
                        existingReference.externalItems.length
                      ? 'matched_complete_set'
                      : 'matched_subset';

              const itemUpdateEligibility =
                incomingItemMatchState === 'items_empty'
                  ? 'preserve_items'
                  : 'matched_items_only';

              const hasInvalidNewItemProductId = newItemCandidates.some(
                (match) =>
                  match.incomingProductIdProvided &&
                  match.normalizedProductId === '',
              );

              const newItemProductIds = Array.from(
                new Set(
                  newItemCandidates
                    .map((match) => match.normalizedProductId)
                    .filter((id): id is string => Boolean(id)),
                ),
              );

              let hasBlockedNewItemProductId = hasInvalidNewItemProductId;

              if (
                !hasBlockedNewItemProductId &&
                newItemProductIds.length > 0
              ) {
                const products = await tx.product.findMany({
                  where: {
                    id: {
                      in: newItemProductIds,
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

                hasBlockedNewItemProductId = newItemProductIds.some(
                  (productId) => !validProductIds.has(productId),
                );
              }

              const baseItemReconciliationSetState =
                this.getItemReconciliationSetState({
                  itemUpdateEligibility,
                  itemReconciliationPlanSummary,
                });

              const itemReconciliationSetState =
                hasBlockedNewItemProductId
                  ? 'blocked_item_reconciliation'
                  : newItemCandidates.length > 0 &&
                      itemReconciliationPlanSummary.blockedItems === 0
                    ? 'new_items_detected'
                    : baseItemReconciliationSetState;

              const scalarItemReconciliationReadiness =
                itemUpdateEligibility === 'preserve_items'
                  ? 'preserve_items'
                  : scalarItemComparisonSummary.notComparableItems > 0
                    ? 'blocked_not_comparable'
                    : scalarItemComparisonSummary.singleFieldDifferences === 0 &&
                          scalarItemComparisonSummary.multipleFieldDifferences === 0
                      ? 'no_scalar_changes'
                      : 'scalar_changes_detected';

              const canWriteReceivedItems =
                itemReconciliationSetState === 'snapshot_changes_detected' ||
                itemReconciliationSetState === 'new_items_detected';

              if (canWriteReceivedItems) {
                for (const match of existingItemMatches) {
                  if (
                    match.orderItemId === null ||
                    match.canonicalOrderItem === null ||
                    match.scalarItemComparison === null
                  ) {
                    continue;
                  }

                  const orderItemUpdateData: Prisma.OrderItemUpdateInput = {};

                  if (!match.scalarItemComparison.titleMatches) {
                    orderItemUpdateData.titleSnapshot = match.incomingTitle;
                  }

                  if (
                    match.skuComparisonState === 'differs' &&
                    match.normalizedSku !== null
                  ) {
                    orderItemUpdateData.skuSnapshot = match.normalizedSku;
                  }

                  if (
                    match.variationComparisonState === 'differs' &&
                    match.incomingVariation !== undefined
                  ) {
                    orderItemUpdateData.variationSnapshot =
                      match.incomingVariation;
                  }

                  if (!match.scalarItemComparison.quantityMatches) {
                    orderItemUpdateData.quantity = match.incomingQuantity;
                  }

                  if (!match.scalarItemComparison.unitPriceMatches) {
                    orderItemUpdateData.unitPrice = match.incomingUnitPrice;
                  }

                  if (Object.keys(orderItemUpdateData).length > 0) {
                    await tx.orderItem.update({
                      where: {
                        id: match.orderItemId,
                      },
                      data: orderItemUpdateData,
                    });
                  }
                }

                for (const match of newItemCandidates) {
                  const orderItem = await tx.orderItem.create({
                    data: {
                      orderId: existingReference.orderId,
                      productId: match.normalizedProductId,
                      titleSnapshot: match.incomingTitle,
                      skuSnapshot: match.normalizedSku,
                      variationSnapshot: match.incomingVariation,
                      quantity: match.incomingQuantity,
                      unitPrice: match.incomingUnitPrice,
                    },
                    select: {
                      id: true,
                    },
                  });

                  await tx.externalOrderItemReference.create({
                    data: {
                      orderItemId: orderItem.id,
                      externalOrderReferenceId: existingReference.id,
                      externalItemId: match.externalItemId,
                    },
                  });
                }
              }
            }

            const externalCreatedAt =
              existingReference.externalCreatedAt === null
                ? this.normalizeOptionalDate(normalized.externalCreatedAt)
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
          (error.code === 'P2034' || error.code === 'P2002');

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
