import type { OrderStatus, Prisma } from '@prisma/client';

export type NormalizedExternalOrderItem = {
  productId?: string | null;
  title: string;
  sku?: string | null;
  variation?: Prisma.InputJsonValue;
  quantity: number;
  unitPrice: string;
};

export type NormalizedExternalOrderInput = {
  salesChannelId: string;
  externalOrderId: string;

  externalStatus?: string | null;
  externalCreatedAt?: Date | null;
  externalUpdatedAt?: Date | null;

  canonicalStatus?: OrderStatus;

  buyerName?: string | null;
  buyerContact?: Prisma.InputJsonValue | null;

  recipientName?: string | null;
  destinationZipCode?: string | null;
  city?: string | null;
  state?: string | null;
  destinationAddress?: Prisma.InputJsonValue | null;

  items?: NormalizedExternalOrderItem[];

  metadata?: Prisma.InputJsonValue | null;
};
