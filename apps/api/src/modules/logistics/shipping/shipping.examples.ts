import { analyzeShippingProfile } from './analyze-shipping-profile';
import { resolveAvailableShippingModes } from './resolve-available-shipping-modes';

const smallProductAnalysis = analyzeShippingProfile({
  requiresShipping: true,
  weightGrams: 1_200,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 15,
});

const smallProductResolved = resolveAvailableShippingModes({
  analysis: smallProductAnalysis,
  requiresShipping: true,
  permissions: {
    allowCorreios: true,
    allowTransportadora: false,
    allowLocalDelivery: false,
    allowPickup: false,
  },
  capabilities: {
    supportsCorreios: true,
    supportsTransportadora: true,
    supportsLocalDelivery: false,
    supportsPickup: true,
  },
  weightGrams: 1_200,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 15,
});

const mediumProductAnalysis = analyzeShippingProfile({
  requiresShipping: true,
  weightGrams: 12_000,
  lengthCm: 80,
  widthCm: 50,
  heightCm: 40,
});

const mediumProductResolved = resolveAvailableShippingModes({
  analysis: mediumProductAnalysis,
  requiresShipping: true,
  permissions: {
    allowCorreios: true,
    allowTransportadora: true,
    allowLocalDelivery: false,
    allowPickup: true,
  },
  capabilities: {
    supportsCorreios: true,
    supportsTransportadora: true,
    supportsLocalDelivery: false,
    supportsPickup: true,
  },
  weightGrams: 12_000,
  lengthCm: 80,
  widthCm: 50,
  heightCm: 40,
});

const largeProductAnalysis = analyzeShippingProfile({
  requiresShipping: true,
  weightGrams: 35_000,
  lengthCm: 140,
  widthCm: 70,
  heightCm: 20,
});

const largeProductResolved = resolveAvailableShippingModes({
  analysis: largeProductAnalysis,
  requiresShipping: true,
  permissions: {
    allowCorreios: false,
    allowTransportadora: true,
    allowLocalDelivery: false,
    allowPickup: true,
  },
  capabilities: {
    supportsCorreios: true,
    supportsTransportadora: true,
    supportsLocalDelivery: false,
    supportsPickup: true,
  },
  weightGrams: 35_000,
  lengthCm: 140,
  widthCm: 70,
  heightCm: 20,
});

console.log('smallProductAnalysis', smallProductAnalysis);
console.log('smallProductResolved', smallProductResolved);

console.log('mediumProductAnalysis', mediumProductAnalysis);
console.log('mediumProductResolved', mediumProductResolved);

console.log('largeProductAnalysis', largeProductAnalysis);
console.log('largeProductResolved', largeProductResolved);
