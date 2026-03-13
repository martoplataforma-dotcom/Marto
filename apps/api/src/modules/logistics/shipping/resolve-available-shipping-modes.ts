import { hasCompletePhysicalData } from './analyze-shipping-profile';
import {
  type BlockedShippingMode,
  type ResolveAvailableShippingModesInput,
  type ResolvedShippingModesResult,
  type ShippingMode,
} from './shipping.types';

function pushBlocked(
  blockedModes: BlockedShippingMode[],
  mode: ShippingMode,
  reason: string,
): void {
  blockedModes.push({ mode, reason });
}

function pickSuggestedPrimaryShippingMode(
  availableShippingModes: ShippingMode[],
  input: ResolveAvailableShippingModesInput,
): ShippingMode | null {
  if (availableShippingModes.length === 0) {
    return null;
  }

  if (
    input.analysis.shouldPrioritizeTransportadora &&
    availableShippingModes.includes('TRANSPORTADORA')
  ) {
    return 'TRANSPORTADORA';
  }

  if (
    input.analysis.canUseCorreios &&
    availableShippingModes.includes('CORREIOS')
  ) {
    return 'CORREIOS';
  }

  if (availableShippingModes.includes('TRANSPORTADORA')) {
    return 'TRANSPORTADORA';
  }

  if (availableShippingModes.includes('LOCAL_DELIVERY')) {
    return 'LOCAL_DELIVERY';
  }

  if (availableShippingModes.includes('PICKUP')) {
    return 'PICKUP';
  }

  return null;
}

export function resolveAvailableShippingModes(
  input: ResolveAvailableShippingModesInput,
): ResolvedShippingModesResult {
  if (!input.requiresShipping) {
    return {
      analysis: input.analysis,
      availableShippingModes: [],
      blockedModes: [],
      suggestedPrimaryShippingMode: null,
    };
  }

  const availableShippingModes: ShippingMode[] = [];
  const blockedModes: BlockedShippingMode[] = [];

  const hasPhysicalData = hasCompletePhysicalData({
    weightGrams: input.weightGrams,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
  });

  // CORREIOS
  if (!hasPhysicalData) {
    pushBlocked(
      blockedModes,
      'CORREIOS',
      'Dados logísticos do produto incompletos.',
    );
  } else if (!input.analysis.canUseCorreios) {
    pushBlocked(
      blockedModes,
      'CORREIOS',
      'Perfil logístico incompatível com Correios.',
    );
  } else if (!input.permissions.allowCorreios) {
    pushBlocked(
      blockedModes,
      'CORREIOS',
      'Produto não permite envio por Correios.',
    );
  } else if (!input.capabilities.supportsCorreios) {
    pushBlocked(blockedModes, 'CORREIOS', 'Vendedor não opera com Correios.');
  } else {
    availableShippingModes.push('CORREIOS');
  }

  // TRANSPORTADORA
  if (!hasPhysicalData) {
    pushBlocked(
      blockedModes,
      'TRANSPORTADORA',
      'Dados logísticos do produto incompletos.',
    );
  } else if (!input.permissions.allowTransportadora) {
    pushBlocked(
      blockedModes,
      'TRANSPORTADORA',
      'Produto não permite envio por transportadora.',
    );
  } else if (!input.capabilities.supportsTransportadora) {
    pushBlocked(
      blockedModes,
      'TRANSPORTADORA',
      'Vendedor não opera com transportadora.',
    );
  } else {
    availableShippingModes.push('TRANSPORTADORA');
  }

  // LOCAL_DELIVERY
  if (!input.permissions.allowLocalDelivery) {
    pushBlocked(
      blockedModes,
      'LOCAL_DELIVERY',
      'Produto não permite entrega local.',
    );
  } else if (!input.capabilities.supportsLocalDelivery) {
    pushBlocked(
      blockedModes,
      'LOCAL_DELIVERY',
      'Vendedor não oferece entrega local.',
    );
  } else {
    availableShippingModes.push('LOCAL_DELIVERY');
  }

  // PICKUP
  if (!input.permissions.allowPickup) {
    pushBlocked(blockedModes, 'PICKUP', 'Produto não permite retirada.');
  } else if (!input.capabilities.supportsPickup) {
    pushBlocked(blockedModes, 'PICKUP', 'Vendedor não oferece retirada.');
  } else {
    availableShippingModes.push('PICKUP');
  }

  return {
    analysis: input.analysis,
    availableShippingModes,
    blockedModes,
    suggestedPrimaryShippingMode: pickSuggestedPrimaryShippingMode(
      availableShippingModes,
      input,
    ),
  };
}
