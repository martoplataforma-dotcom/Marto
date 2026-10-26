import { OrderStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import type {
  NormalizedExternalOrderInput,
  NormalizedExternalOrderItem,
} from '../../orders/types/normalized-external-order';

type JsonRecord = Record<string, unknown>;

type MutableJsonObject = Record<string, Prisma.InputJsonValue>;

export type MercadoLivreOrderAdapterInput = {
  salesChannelId: string;
  order: JsonRecord;
  shipment?: JsonRecord;
};

export class MercadoLivreOrderAdapter {
  normalize(
    input: MercadoLivreOrderAdapterInput,
  ): NormalizedExternalOrderInput {
    const salesChannelId = this.requireString(
      input.salesChannelId,
      'salesChannelId',
    );

    const externalOrderId = this.requireExternalId(input.order.id, 'order.id');

    const externalStatus = this.requireString(
      input.order.status,
      'order.status',
    );

    const externalCreatedAt = this.requireDate(
      input.order.date_created,
      'date_created',
    );

    const externalUpdatedAt = this.requireDate(
      input.order.last_updated,
      'last_updated',
    );

    const canonicalStatus = this.resolveCanonicalStatus(
      externalStatus,
      input.shipment,
    );

    const items = this.normalizeOrderItems(input.order.order_items);

    const result: NormalizedExternalOrderInput = {
      salesChannelId,
      externalOrderId,
      externalStatus,
      externalCreatedAt,
      externalUpdatedAt,
      canonicalStatus,
      items,
    };

    const metadata = this.normalizeMetadata(input.order, input.shipment);

    if (metadata !== undefined) {
      result.metadata = metadata;
    }

    const buyer = this.asRecord(input.order.buyer);

    if (buyer) {
      const buyerName = this.normalizeBuyerName(buyer);

      if (buyerName !== undefined) {
        result.buyerName = buyerName;
      }

      const buyerContact = this.normalizeBuyerContact(buyer);

      if (buyerContact !== undefined) {
        result.buyerContact = buyerContact;
      }
    }

    if (input.shipment) {
      this.applyShipmentDestination(result, input.shipment);
    }

    return result;
  }

  private resolveCanonicalStatus(
    orderStatus: string,
    shipment?: JsonRecord,
  ): OrderStatus {
    const shipmentStatus = this.optionalString(shipment?.status);

    if (shipmentStatus !== undefined) {
      switch (shipmentStatus) {
        case 'delivered':
          return OrderStatus.DELIVERED;

        case 'shipped':
          return OrderStatus.IN_TRANSIT;

        default:
          throw new Error(
            `Unsupported Mercado Livre shipment status: ${shipmentStatus}`,
          );
      }
    }

    switch (orderStatus) {
      case 'paid':
        return OrderStatus.PAID;

      case 'cancelled':
        return OrderStatus.CANCELLED;

      default:
        throw new Error(
          `Unsupported Mercado Livre order status: ${orderStatus}`,
        );
    }
  }

  private normalizeOrderItems(value: unknown): NormalizedExternalOrderItem[] {
    if (!Array.isArray(value)) {
      throw new Error('Mercado Livre order_items must be an array');
    }

    if (value.length !== 1) {
      throw new Error(
        'Mercado Livre order_items must contain exactly one item',
      );
    }

    const orderItem = this.asRecord(value[0]);

    if (!orderItem) {
      throw new Error('Mercado Livre order_items contains an invalid item');
    }

    const item = this.asRecord(orderItem.item);

    if (!item) {
      throw new Error('Mercado Livre order_items item structure is invalid');
    }

    const externalItemId = this.requireExternalId(item.id, 'item.id');

    const title = this.requireString(item.title, 'item.title');

    const quantity = this.requirePositiveInteger(
      orderItem.quantity,
      'order_items.quantity',
    );

    const unitPrice = this.requireMoneyString(
      orderItem.unit_price,
      'order_items.unit_price',
    );

    const normalized: NormalizedExternalOrderItem = {
      externalItemId,
      title,
      quantity,
      unitPrice,
    };

    const sellerSku = this.optionalString(item.seller_sku);

    const sellerCustomField = this.optionalString(item.seller_custom_field);

    const sku = sellerSku ?? sellerCustomField;

    if (sku !== undefined) {
      normalized.sku = sku;
    }

    const variation = this.normalizeVariation(item);

    if (variation !== undefined) {
      normalized.variation = variation;
    }

    return [normalized];
  }

  private normalizeVariation(
    item: JsonRecord,
  ): Prisma.InputJsonValue | undefined {
    const variationId = this.optionalExternalId(item.variation_id);

    let attributes: Prisma.InputJsonObject[] | undefined;

    if (item.variation_attributes !== undefined) {
      if (!Array.isArray(item.variation_attributes)) {
        throw new Error('Mercado Livre variation_attributes must be an array');
      }

      attributes = item.variation_attributes.map((value, index) => {
        const attribute = this.asRecord(value);

        if (!attribute) {
          throw new Error(
            `Mercado Livre variation attribute ${index} is invalid`,
          );
        }

        const normalized: MutableJsonObject = {};

        const id = this.optionalString(attribute.id);
        const name = this.optionalString(attribute.name);
        const valueId = this.optionalString(attribute.value_id);
        const valueName = this.optionalString(attribute.value_name);

        if (id !== undefined) {
          normalized.id = id;
        }

        if (name !== undefined) {
          normalized.name = name;
        }

        if (valueId !== undefined) {
          normalized.valueId = valueId;
        }

        if (valueName !== undefined) {
          normalized.valueName = valueName;
        }

        return normalized;
      });
    }

    if (variationId === undefined && attributes === undefined) {
      return undefined;
    }

    const variation: MutableJsonObject = {};

    if (variationId !== undefined) {
      variation.variationId = variationId;
    }

    if (attributes !== undefined) {
      variation.attributes = attributes;
    }

    return variation;
  }

  private normalizeMetadata(
    order: JsonRecord,
    shipment?: JsonRecord,
  ): Prisma.InputJsonValue | undefined {
    const metadata: MutableJsonObject = {};

    const packId = this.optionalExternalId(order.pack_id);

    if (packId !== undefined) {
      metadata.packId = packId;
    }

    const currencyId = this.optionalString(order.currency_id);

    if (currencyId !== undefined) {
      metadata.currencyId = currencyId;
    }

    const shipmentId = this.optionalExternalId(shipment?.id);

    if (shipmentId !== undefined) {
      metadata.shipmentId = shipmentId;
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private normalizeBuyerName(buyer: JsonRecord): string | undefined {
    const firstName = this.optionalString(buyer.first_name);

    const lastName = this.optionalString(buyer.last_name);

    const fullName = [firstName, lastName]
      .filter((value): value is string => value !== undefined)
      .join(' ')
      .trim();

    if (fullName !== '') {
      return fullName;
    }

    return this.optionalString(buyer.nickname);
  }

  private normalizeBuyerContact(
    buyer: JsonRecord,
  ): Prisma.InputJsonValue | undefined {
    const buyerContact: MutableJsonObject = {};

    const externalBuyerId = this.optionalExternalId(buyer.id);

    if (externalBuyerId !== undefined) {
      buyerContact.externalBuyerId = externalBuyerId;
    }

    const nickname = this.optionalString(buyer.nickname);

    if (nickname !== undefined) {
      buyerContact.nickname = nickname;
    }

    return Object.keys(buyerContact).length > 0 ? buyerContact : undefined;
  }

  private applyShipmentDestination(
    result: NormalizedExternalOrderInput,
    shipment: JsonRecord,
  ) {
    const receiverAddress = this.asRecord(shipment.receiver_address);

    if (!receiverAddress) {
      return;
    }

    const recipientName = this.optionalString(receiverAddress.receiver_name);

    if (recipientName !== undefined) {
      result.recipientName = recipientName;
    }

    const zipCode = this.optionalString(receiverAddress.zip_code);

    if (zipCode !== undefined) {
      result.destinationZipCode = zipCode;
    }

    const city = this.extractNestedName(receiverAddress.city);

    if (city !== undefined) {
      result.city = city;
    }

    const state = this.extractNestedName(receiverAddress.state);

    if (state !== undefined) {
      result.state = state;
    }

    const address: MutableJsonObject = {};

    const addressLine = this.optionalString(receiverAddress.address_line);

    const streetName = this.optionalString(receiverAddress.street_name);

    const streetNumber = this.optionalString(receiverAddress.street_number);

    const neighborhood = this.extractNestedName(receiverAddress.neighborhood);

    const comment = this.optionalString(receiverAddress.comment);

    if (addressLine !== undefined) {
      address.addressLine = addressLine;
    }

    if (streetName !== undefined) {
      address.streetName = streetName;
    }

    if (streetNumber !== undefined) {
      address.streetNumber = streetNumber;
    }

    if (neighborhood !== undefined) {
      address.neighborhood = neighborhood;
    }

    if (comment !== undefined) {
      address.comment = comment;
    }

    if (Object.keys(address).length > 0) {
      result.destinationAddress = address;
    }
  }

  private extractNestedName(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return this.optionalString(value);
    }

    const record = this.asRecord(value);

    return record ? this.optionalString(record.name) : undefined;
  }

  private asRecord(value: unknown): JsonRecord | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }

    return value as JsonRecord;
  }

  private requireString(value: unknown, field: string): string {
    const normalized = this.optionalString(value);

    if (normalized === undefined) {
      throw new Error(`Mercado Livre ${field} is required`);
    }

    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized === '' ? undefined : normalized;
  }

  private requireExternalId(value: unknown, field: string): string {
    const normalized = this.optionalExternalId(value);

    if (normalized === undefined) {
      throw new Error(`Mercado Livre ${field} is required`);
    }

    return normalized;
  }

  private optionalExternalId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalized = value.trim();

      return normalized === '' ? undefined : normalized;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return undefined;
  }

  private requireDate(value: unknown, field: string): Date {
    if (typeof value !== 'string' && !(value instanceof Date)) {
      throw new Error(`Mercado Livre ${field} is required`);
    }

    const date =
      value instanceof Date ? new Date(value.getTime()) : new Date(value);

    if (!Number.isFinite(date.getTime())) {
      throw new Error(`Invalid Mercado Livre ${field}`);
    }

    return date;
  }

  private requirePositiveInteger(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid Mercado Livre ${field}`);
    }

    return value;
  }

  private requireMoneyString(value: unknown, field: string): string {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return String(value);
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      const numericValue = Number(normalized);

      if (
        normalized !== '' &&
        Number.isFinite(numericValue) &&
        numericValue >= 0
      ) {
        return normalized;
      }
    }

    throw new Error(`Invalid Mercado Livre ${field}`);
  }
}
