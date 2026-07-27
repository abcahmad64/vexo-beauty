import { AI_PROVIDER_PRICING_CATALOG_VERSION } from '../interfaces/ai-provider-cost-accounting.interface';

import type { AiProviderPricingEntry } from '../interfaces/ai-provider-cost-accounting.interface';

const ZERO_PROVIDER_TOKEN_RATE = '0';

const CATALOG: readonly AiProviderPricingEntry[] = Object.freeze([
  Object.freeze({
    catalogVersion: AI_PROVIDER_PRICING_CATALOG_VERSION,
    provider: 'ollama',
    modelPattern: '*',
    currency: 'USD',
    effectiveAt: '2026-07-23T00:00:00.000Z',
    source: 'LOCAL_SELF_HOSTED_NO_EXTERNAL_PROVIDER_TOKEN_FEE',
    costBasis: 'PROVIDER_TOKEN_FEE_ONLY',
    billable: false,
    inputMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    outputMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    cachedInputMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    cacheWriteMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    reasoningMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
  }),
  Object.freeze({
    catalogVersion: AI_PROVIDER_PRICING_CATALOG_VERSION,
    provider: 'backend',
    modelPattern: '*',
    currency: 'USD',
    effectiveAt: '2026-07-23T00:00:00.000Z',
    source: 'DETERMINISTIC_BACKEND_NO_EXTERNAL_PROVIDER_TOKEN_FEE',
    costBasis: 'PROVIDER_TOKEN_FEE_ONLY',
    billable: false,
    inputMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    outputMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    cachedInputMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    cacheWriteMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
    reasoningMicroUsdPerMillionTokens: ZERO_PROVIDER_TOKEN_RATE,
  }),
]);

export function resolveAiProviderPricing(
  provider: string,
  model: string,
): AiProviderPricingEntry | null {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedModel = model.trim().toLowerCase();

  const exact = CATALOG.find(
    (entry) =>
      entry.provider === normalizedProvider &&
      entry.modelPattern.toLowerCase() === normalizedModel,
  );

  const wildcard = CATALOG.find(
    (entry) =>
      entry.provider === normalizedProvider && entry.modelPattern === '*',
  );

  return exact ?? wildcard ?? null;
}

export function getAiProviderPricingCatalogSnapshot(): readonly AiProviderPricingEntry[] {
  return CATALOG.map((entry) => Object.freeze({ ...entry }));
}
