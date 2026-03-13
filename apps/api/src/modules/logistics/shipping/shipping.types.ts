export type ShippingMode =
  | 'CORREIOS'
  | 'TRANSPORTADORA'
  | 'LOCAL_DELIVERY'
  | 'PICKUP';

export type ShippingSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export type ShippingProfileAnalysis = {
  shippingSize: ShippingSize;
  canUseCorreios: boolean;
  shouldPrioritizeTransportadora: boolean;
  recommendedShippingModes: ShippingMode[];
  reason: string;
};

export type BlockedShippingMode = {
  mode: ShippingMode;
  reason: string;
};

export type ResolvedShippingModesResult = {
  analysis: ShippingProfileAnalysis;
  availableShippingModes: ShippingMode[];
  blockedModes: BlockedShippingMode[];
  suggestedPrimaryShippingMode: ShippingMode | null;
};

export type AnalyzeShippingProfileInput = {
  requiresShipping: boolean;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

export type ProductShippingPermissions = {
  allowCorreios: boolean;
  allowTransportadora: boolean;
  allowLocalDelivery: boolean;
  allowPickup: boolean;
};

export type SellerShippingCapabilities = {
  supportsCorreios: boolean;
  supportsTransportadora: boolean;
  supportsLocalDelivery: boolean;
  supportsPickup: boolean;
};

export type ResolveAvailableShippingModesInput = {
  analysis: ShippingProfileAnalysis;
  requiresShipping: boolean;
  permissions: ProductShippingPermissions;
  capabilities: SellerShippingCapabilities;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};
