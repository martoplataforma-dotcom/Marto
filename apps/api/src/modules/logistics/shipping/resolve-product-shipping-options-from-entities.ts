import { resolveProductShippingOptions } from './resolve-product-shipping-options';
import {
  type ProductShippingPermissions,
  type ResolvedShippingModesResult,
  type SellerShippingCapabilities,
} from './shipping.types';

export type ShippingProductEntity = {
  requiresShipping: boolean | null;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  allowCorreios: boolean | null;
  allowTransportadora: boolean | null;
  allowLocalDelivery: boolean | null;
  allowPickup: boolean | null;
};

export type ShippingExpeditorProfileEntity = {
  originZipCode: string | null;
  supportsCorreios: boolean | null;
  supportsTransportadora: boolean | null;
  supportsLocalDelivery: boolean | null;
  supportsPickup: boolean | null;
};

function toProductPermissions(
  product: ShippingProductEntity,
): ProductShippingPermissions {
  return {
    allowCorreios: Boolean(product.allowCorreios),
    allowTransportadora: Boolean(product.allowTransportadora),
    allowLocalDelivery: Boolean(product.allowLocalDelivery),
    allowPickup: Boolean(product.allowPickup),
  };
}

function toSellerCapabilities(
  profile: ShippingExpeditorProfileEntity,
): SellerShippingCapabilities {
  return {
    supportsCorreios: Boolean(profile.supportsCorreios),
    supportsTransportadora: Boolean(profile.supportsTransportadora),
    supportsLocalDelivery: Boolean(profile.supportsLocalDelivery),
    supportsPickup: Boolean(profile.supportsPickup),
  };
}

export function resolveProductShippingOptionsFromEntities(input: {
  product: ShippingProductEntity;
  expeditorProfile: ShippingExpeditorProfileEntity;
}): ResolvedShippingModesResult {
  return resolveProductShippingOptions({
    requiresShipping: Boolean(input.product.requiresShipping),
    weightGrams: input.product.weightGrams ?? null,
    lengthCm: input.product.lengthCm ?? null,
    widthCm: input.product.widthCm ?? null,
    heightCm: input.product.heightCm ?? null,
    permissions: toProductPermissions(input.product),
    capabilities: toSellerCapabilities(input.expeditorProfile),
  });
}
