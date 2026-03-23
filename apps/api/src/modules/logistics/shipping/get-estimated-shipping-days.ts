import { type ShippingMode } from './shipping.types';

export function getEstimatedShippingDays(
  selectedShippingMode: ShippingMode | null | undefined,
): number | null {
  if (!selectedShippingMode) {
    return null;
  }

  if (selectedShippingMode === 'CORREIOS') {
    return 5;
  }

  if (selectedShippingMode === 'TRANSPORTADORA') {
    return 7;
  }

  if (selectedShippingMode === 'LOCAL_DELIVERY') {
    return 1;
  }

  if (selectedShippingMode === 'PICKUP') {
    return 0;
  }

  return null;
}
