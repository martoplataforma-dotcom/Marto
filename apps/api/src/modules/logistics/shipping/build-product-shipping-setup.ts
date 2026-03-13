import { analyzeShippingProfile } from './analyze-shipping-profile';
import { getDefaultProductShippingPermissions } from './get-default-product-shipping-permissions';
import {
  type AnalyzeShippingProfileInput,
  type ProductShippingPermissions,
  type ShippingProfileAnalysis,
} from './shipping.types';

export type BuildProductShippingSetupResult = {
  analysis: ShippingProfileAnalysis;
  defaultPermissions: ProductShippingPermissions;
};

export function buildProductShippingSetup(
  input: AnalyzeShippingProfileInput,
): BuildProductShippingSetupResult {
  const analysis = analyzeShippingProfile(input);
  const defaultPermissions = getDefaultProductShippingPermissions(
    analysis,
    input.requiresShipping,
  );

  return {
    analysis,
    defaultPermissions,
  };
}
