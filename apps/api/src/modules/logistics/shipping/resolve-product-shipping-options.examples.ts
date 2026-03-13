import { resolveProductShippingOptions } from './resolve-product-shipping-options';

const smallMerchantResult = resolveProductShippingOptions({
  requiresShipping: true,
  weightGrams: 1_200,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 15,
  permissions: {
    allowCorreios: true,
    allowTransportadora: false,
    allowLocalDelivery: false,
    allowPickup: false,
  },
  capabilities: {
    supportsCorreios: true,
    supportsTransportadora: false,
    supportsLocalDelivery: false,
    supportsPickup: true,
  },
});

const mediumFactoryResult = resolveProductShippingOptions({
  requiresShipping: true,
  weightGrams: 12_000,
  lengthCm: 80,
  widthCm: 50,
  heightCm: 40,
  permissions: {
    allowCorreios: true,
    allowTransportadora: true,
    allowLocalDelivery: false,
    allowPickup: true,
  },
  capabilities: {
    supportsCorreios: false,
    supportsTransportadora: true,
    supportsLocalDelivery: true,
    supportsPickup: true,
  },
});

const largeFactoryResult = resolveProductShippingOptions({
  requiresShipping: true,
  weightGrams: 35_000,
  lengthCm: 140,
  widthCm: 70,
  heightCm: 20,
  permissions: {
    allowCorreios: false,
    allowTransportadora: true,
    allowLocalDelivery: false,
    allowPickup: true,
  },
  capabilities: {
    supportsCorreios: false,
    supportsTransportadora: true,
    supportsLocalDelivery: true,
    supportsPickup: true,
  },
});

console.log('smallMerchantResult', smallMerchantResult);
console.log('mediumFactoryResult', mediumFactoryResult);
console.log('largeFactoryResult', largeFactoryResult);
