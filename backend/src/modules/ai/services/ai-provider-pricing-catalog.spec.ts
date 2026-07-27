import { AI_PROVIDER_PRICING_CATALOG_VERSION } from '../interfaces/ai-provider-cost-accounting.interface';

import {
  getAiProviderPricingCatalogSnapshot,
  resolveAiProviderPricing,
} from './ai-provider-pricing-catalog';

describe('AI provider pricing catalog', () => {
  it('resolves the versioned zero external-provider fee for local Ollama', () => {
    expect(resolveAiProviderPricing(' OLLAMA ', 'qwen3:8b')).toEqual(
      expect.objectContaining({
        catalogVersion: AI_PROVIDER_PRICING_CATALOG_VERSION,
        provider: 'ollama',
        modelPattern: '*',
        currency: 'USD',
        billable: false,
        costBasis: 'PROVIDER_TOKEN_FEE_ONLY',
        inputMicroUsdPerMillionTokens: '0',
        outputMicroUsdPerMillionTokens: '0',
      }),
    );
  });

  it('leaves an unknown provider unpriced instead of silently assigning zero', () => {
    expect(resolveAiProviderPricing('unknown-cloud', 'model-x')).toBeNull();
  });

  it('returns copied immutable catalog entries', () => {
    const first = getAiProviderPricingCatalogSnapshot();
    const second = getAiProviderPricingCatalogSnapshot();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first[0])).toBe(true);
  });
});
