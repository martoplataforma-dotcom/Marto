"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProductShippingOptions = resolveProductShippingOptions;
const analyze_shipping_profile_1 = require("./analyze-shipping-profile");
const resolve_available_shipping_modes_1 = require("./resolve-available-shipping-modes");
function resolveProductShippingOptions(input) {
    const analysis = (0, analyze_shipping_profile_1.analyzeShippingProfile)({
        requiresShipping: input.requiresShipping,
        weightGrams: input.weightGrams,
        lengthCm: input.lengthCm,
        widthCm: input.widthCm,
        heightCm: input.heightCm,
    });
    return (0, resolve_available_shipping_modes_1.resolveAvailableShippingModes)({
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
