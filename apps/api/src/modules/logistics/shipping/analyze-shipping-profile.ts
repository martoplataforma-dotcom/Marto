import {
  type AnalyzeShippingProfileInput,
  type ShippingMode,
  type ShippingProfileAnalysis,
  type ShippingSize,
} from './shipping.types';

type CompletePhysicalData = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

function isPositiveNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function hasCompletePhysicalData(
  input: Pick<
    AnalyzeShippingProfileInput,
    'weightGrams' | 'lengthCm' | 'widthCm' | 'heightCm'
  >,
): input is CompletePhysicalData {
  return (
    isPositiveNumber(input.weightGrams) &&
    isPositiveNumber(input.lengthCm) &&
    isPositiveNumber(input.widthCm) &&
    isPositiveNumber(input.heightCm)
  );
}

function buildAnalysis(
  shippingSize: ShippingSize,
  canUseCorreios: boolean,
  shouldPrioritizeTransportadora: boolean,
  recommendedShippingModes: ShippingMode[],
  reason: string,
): ShippingProfileAnalysis {
  return {
    shippingSize,
    canUseCorreios,
    shouldPrioritizeTransportadora,
    recommendedShippingModes,
    reason,
  };
}

export function analyzeShippingProfile(
  input: AnalyzeShippingProfileInput,
): ShippingProfileAnalysis {
  if (!input.requiresShipping) {
    return buildAnalysis(
      'SMALL',
      false,
      false,
      [],
      'Produto não requer frete.',
    );
  }

  if (!hasCompletePhysicalData(input)) {
    return buildAnalysis(
      'SMALL',
      false,
      false,
      [],
      'Dados logísticos incompletos.',
    );
  }

  const weightGrams = input.weightGrams;
  const lengthCm = input.lengthCm;
  const widthCm = input.widthCm;
  const heightCm = input.heightCm;

  const maxDimension = Math.max(lengthCm, widthCm, heightCm);
  const sumDimensions = lengthCm + widthCm + heightCm;

  const isSmall =
    weightGrams <= 5_000 && maxDimension <= 45 && sumDimensions <= 90;

  if (isSmall) {
    return buildAnalysis(
      'SMALL',
      true,
      false,
      ['CORREIOS'],
      'Produto compacto e compatível com fluxo postal.',
    );
  }

  const isMedium =
    weightGrams <= 30_000 && maxDimension <= 100 && sumDimensions <= 200;

  if (isMedium) {
    const isNearUpperMediumLimits =
      weightGrams > 15_000 || maxDimension > 80 || sumDimensions > 160;

    return buildAnalysis(
      'MEDIUM',
      true,
      isNearUpperMediumLimits,
      isNearUpperMediumLimits
        ? ['TRANSPORTADORA', 'CORREIOS']
        : ['CORREIOS', 'TRANSPORTADORA'],
      isNearUpperMediumLimits
        ? 'Produto de porte médio, próximo dos limites do fluxo postal; priorizar transportadora.'
        : 'Produto de porte médio dentro da faixa logística intermediária.',
    );
  }

  return buildAnalysis(
    'LARGE',
    false,
    true,
    ['TRANSPORTADORA'],
    'Produto grande e fora do fluxo postal padrão.',
  );
}
