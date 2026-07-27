import {
  AI_PROVIDER_COST_ACCOUNTING_VERSION,
  AiProviderPricingEntry,
} from '../interfaces/ai-provider-cost-accounting.interface';

import { AiProviderCostAccountingUtil } from './ai-provider-cost-accounting.util';

describe('AiProviderCostAccountingUtil', () => {
  it('normalizes Ollama usage into the immutable canonical token contract', () => {
    const usage = AiProviderCostAccountingUtil.normalizeUsage(
      {
        promptEvalCount: 10,
        evalCount: 20,
        cachedInputTokens: 3,
      },
      'OLLAMA_CHAT',
    );

    expect(usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      cachedInputTokens: 3,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      reported: true,
      source: 'OLLAMA_CHAT',
    });
    expect(Object.isFrozen(usage)).toBe(true);
  });

  it('uses deterministic integer micro-USD half-up rounding', () => {
    const pricing: AiProviderPricingEntry = {
      catalogVersion: 'test.v1',
      provider: 'test',
      modelPattern: '*',
      currency: 'USD',
      effectiveAt: '2026-07-23T00:00:00.000Z',
      source: 'UNIT_TEST',
      costBasis: 'PROVIDER_TOKEN_FEE_ONLY',
      billable: true,
      inputMicroUsdPerMillionTokens: '1500000',
      outputMicroUsdPerMillionTokens: '2000000',
      cachedInputMicroUsdPerMillionTokens: '500000',
      cacheWriteMicroUsdPerMillionTokens: '250000',
      reasoningMicroUsdPerMillionTokens: '3000000',
    };

    const cost = AiProviderCostAccountingUtil.calculateCost(
      {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        cachedInputTokens: 1,
        cacheWriteTokens: 2,
        reasoningTokens: 1,
        reported: true,
        source: 'PROVIDER_RESPONSE',
      },
      pricing,
    );

    expect(cost).toEqual({
      status: 'CALCULATED',
      currency: 'USD',
      inputCostMicros: '2',
      outputCostMicros: '2',
      cachedInputCostMicros: '1',
      cacheWriteCostMicros: '1',
      reasoningCostMicros: '3',
      totalCostMicros: '9',
    });
  });

  it('does not silently price an unknown provider', () => {
    const attempt = AiProviderCostAccountingUtil.createAttempt({
      sequence: 1,
      kind: 'PRIMARY',
      status: 'SUCCESS',
      provider: 'unknown-provider',
      model: 'model-x',
      rawUsage: {
        inputTokens: 5,
        outputTokens: 7,
      },
      taskType: 'SALES',
    });

    expect(attempt.cost.status).toBe('UNPRICED');
    expect(attempt.cost.totalCostMicros).toBeNull();
  });

  it('aggregates primary and fallback attempts once without double counting', () => {
    const metadata = {
      executionId: 'execution-1',
      correlationId: 'correlation-1',
      requestId: 'request-1',
      attemptNumber: 2,
    };
    const primary = AiProviderCostAccountingUtil.createAttempt({
      sequence: 1,
      kind: 'PRIMARY',
      status: 'FAILED',
      provider: 'ollama',
      model: 'primary-model',
      rawUsage: {
        promptEvalCount: 10,
        evalCount: 2,
      },
      usageSource: 'OLLAMA_CHAT',
      metadata,
      taskType: 'SALES',
    });
    const fallback = AiProviderCostAccountingUtil.createAttempt({
      sequence: 2,
      kind: 'FALLBACK',
      status: 'SUCCESS',
      provider: 'ollama',
      model: 'fallback-model',
      rawUsage: {
        promptEvalCount: 11,
        evalCount: 3,
      },
      usageSource: 'OLLAMA_CHAT',
      metadata,
      taskType: 'FALLBACK',
    });

    const summary = AiProviderCostAccountingUtil.summarize([fallback, primary]);

    expect(summary.accountingVersion).toBe(AI_PROVIDER_COST_ACCOUNTING_VERSION);
    expect(summary.attempts.map((attempt) => attempt.sequence)).toEqual([1, 2]);
    expect(summary.aggregateUsage).toEqual(
      expect.objectContaining({
        inputTokens: 21,
        outputTokens: 5,
        totalTokens: 26,
      }),
    );
    expect(summary.fallbackUsed).toBe(true);
    expect(summary.partialUsageAttemptCount).toBe(1);
    expect(summary.aggregateCostMicros).toBe('0');
    expect(primary.attemptId).toBe(
      AiProviderCostAccountingUtil.createAttempt({
        sequence: 1,
        kind: 'PRIMARY',
        status: 'FAILED',
        provider: 'ollama',
        model: 'primary-model',
        rawUsage: {},
        metadata,
        taskType: 'SALES',
      }).attemptId,
    );
  });

  it('records cancelled partial usage explicitly', () => {
    const attempt = AiProviderCostAccountingUtil.createAttempt({
      sequence: 1,
      kind: 'PRIMARY',
      status: 'CANCELLED',
      provider: 'ollama',
      model: 'model',
      rawUsage: {
        promptEvalCount: 4,
      },
      usageSource: 'OLLAMA_CHAT',
      taskType: 'CONTENT',
    });
    const summary = AiProviderCostAccountingUtil.summarize([attempt]);

    expect(summary.cancelledAttemptCount).toBe(1);
    expect(summary.partialUsageAttemptCount).toBe(1);
    expect(summary.aggregateUsage.inputTokens).toBe(4);
  });
});
