import { analyzeShippingProfile } from './analyze-shipping-profile';
import { resolveAvailableShippingModes } from './resolve-available-shipping-modes';
import {
  type ProductShippingPermissions,
  type ResolvedShippingModesResult,
  type SellerShippingCapabilities,
} from './shipping.types';

export type ResolveProductShippingOptionsInput = {
  requiresShipping: boolean;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  permissions: ProductShippingPermissions;
  capabilities: SellerShippingCapabilities;
};

export function resolveProductShippingOptions(
  input: ResolveProductShippingOptionsInput,
): ResolvedShippingModesResult {
  const analysis = analyzeShippingProfile({
    requiresShipping: input.requiresShipping,
    weightGrams: input.weightGrams,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
  });

  return resolveAvailableShippingModes({
    analysis,
    requiresShipping: input.requiresShipping,
    permissions: input.permissions,
    capabilities: input.capabilities,
    weightGrams: input.weightGrams,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
  });
}
