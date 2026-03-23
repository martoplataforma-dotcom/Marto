import { type ShippingMode } from './shipping.types';

export function getShippingPriceCents(
  selectedShippingMode: ShippingMode | null | undefined,
): number | null {
  if (!selectedShippingMode) {
    return null;
  }

  if (selectedShippingMode === 'CORREIOS') {
    return 2_500;
  }

  if (selectedShippingMode === 'TRANSPORTADORA') {
    return 4_500;
  }

  if (selectedShippingMode === 'LOCAL_DELIVERY') {
    return 1_500;
  }

  if (selectedShippingMode === 'PICKUP') {
    return 0;
  }

  return null;
}
