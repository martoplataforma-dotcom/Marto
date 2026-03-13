import {
  type ProductShippingPermissions,
  type ShippingProfileAnalysis,
} from './shipping.types';

export function getDefaultProductShippingPermissions(
  analysis: ShippingProfileAnalysis,
  requiresShipping: boolean,
): ProductShippingPermissions {
  if (!requiresShipping) {
    return {
      allowCorreios: false,
      allowTransportadora: false,
      allowLocalDelivery: false,
      allowPickup: false,
    };
  }

  if (analysis.shippingSize === 'SMALL') {
    return {
      allowCorreios: true,
      allowTransportadora: false,
      allowLocalDelivery: false,
      allowPickup: false,
    };
  }

  if (analysis.shippingSize === 'MEDIUM') {
    return {
      allowCorreios: analysis.canUseCorreios,
      allowTransportadora: true,
      allowLocalDelivery: false,
      allowPickup: false,
    };
  }

  return {
    allowCorreios: false,
    allowTransportadora: true,
    allowLocalDelivery: false,
    allowPickup: false,
  };
}
