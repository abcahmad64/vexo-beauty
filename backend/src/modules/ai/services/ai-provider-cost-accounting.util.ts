import { createHash } from 'node:crypto';

import {
  AI_PROVIDER_COST_ACCOUNTING_VERSION,
  AI_PROVIDER_PRICING_CATALOG_VERSION,
} from '../interfaces/ai-provider-cost-accounting.interface';

import type {
  AiProviderAttemptCost,
  AiProviderCostAccountingAttempt,
  AiProviderCostAccountingSummary,
  AiProviderExecutionLineage,
  AiProviderPricingEntry,
  AiProviderTokenUsage,
  AiProviderUsageSource,
} from '../interfaces/ai-provider-cost-accounting.interface';

import { resolveAiProviderPricing } from './ai-provider-pricing-catalog';

const TOKENS_PER_PRICING_UNIT = 1_000_000n;

export interface CreateAiProviderAccountingAttemptInput {
  readonly sequence: number;
  readonly kind: 'PRIMARY' | 'FALLBACK';
  readonly status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  readonly provider: string;
  readonly model: string;
  readonly rawUsage?: unknown;
  readonly usageSource?: AiProviderUsageSource;
  readonly metadata?: Record<string, unknown>;
  readonly taskType: string;
}

export class AiProviderCostAccountingUtil {
  static normalizeUsage(
    rawUsage: unknown,
    source: AiProviderUsageSource = 'PROVIDER_RESPONSE',
  ): AiProviderTokenUsage {
    const record = this.toRecord(rawUsage);

    const inputTokens = this.resolveTokenCount(record, [
      'inputTokens',
      'promptTokens',
      'promptEvalCount',
      'prompt_eval_count',
    ]);
    const outputTokens = this.resolveTokenCount(record, [
      'outputTokens',
      'completionTokens',
      'evalCount',
      'eval_count',
    ]);
    const cachedInputTokens = this.resolveTokenCount(record, [
      'cachedInputTokens',
      'cacheReadTokens',
      'cached_tokens',
    ]);
    const cacheWriteTokens = this.resolveTokenCount(record, [
      'cacheWriteTokens',
      'cacheCreationTokens',
    ]);
    const reasoningTokens = this.resolveTokenCount(record, [
      'reasoningTokens',
      'thinkingTokens',
    ]);
    const explicitTotal = this.resolveTokenCount(record, [
      'totalTokens',
      'total_tokens',
    ]);
    const calculatedTotal = inputTokens + outputTokens;
    const totalTokens = Math.max(explicitTotal, calculatedTotal);
    const reported = this.hasReportedTokenCount(record, [
      'inputTokens',
      'promptTokens',
      'promptEvalCount',
      'prompt_eval_count',
      'outputTokens',
      'completionTokens',
      'evalCount',
      'eval_count',
      'cachedInputTokens',
      'cacheReadTokens',
      'cached_tokens',
      'cacheWriteTokens',
      'cacheCreationTokens',
      'reasoningTokens',
      'thinkingTokens',
      'totalTokens',
      'total_tokens',
    ]);

    return Object.freeze({
      inputTokens,
      outputTokens,
      totalTokens,
      cachedInputTokens,
      cacheWriteTokens,
      reasoningTokens,
      reported,
      source: reported ? source : 'UNREPORTED',
    });
  }

  static createAttempt(
    input: CreateAiProviderAccountingAttemptInput,
  ): AiProviderCostAccountingAttempt {
    const provider = input.provider.trim().toLowerCase();
    const model = input.model.trim();
    const usage = this.normalizeUsage(input.rawUsage, input.usageSource);
    const pricing = resolveAiProviderPricing(provider, model);
    const lineage = this.resolveLineage(input.metadata, input.taskType);
    const cost = this.calculateCost(usage, pricing);
    const attemptId = this.createAttemptId({
      sequence: input.sequence,
      kind: input.kind,
      provider,
      model,
      lineage,
    });

    return Object.freeze({
      accountingVersion: AI_PROVIDER_COST_ACCOUNTING_VERSION,
      attemptId,
      sequence: input.sequence,
      kind: input.kind,
      status: input.status,
      provider,
      model,
      usage,
      pricing,
      cost,
      lineage,
    });
  }

  static summarize(
    attempts: readonly AiProviderCostAccountingAttempt[],
  ): AiProviderCostAccountingSummary {
    if (attempts.length === 0) {
      throw new Error('At least one provider accounting attempt is required.');
    }

    const sortedAttempts = [...attempts].sort(
      (left, right) => left.sequence - right.sequence,
    );
    const aggregateUsage = this.aggregateUsage(sortedAttempts);
    const pricedAttempts = sortedAttempts.filter(
      (attempt) => attempt.cost.status === 'CALCULATED',
    );
    const aggregateCostMicros = pricedAttempts.reduce(
      (sum, attempt) => sum + BigInt(attempt.cost.totalCostMicros ?? '0'),
      0n,
    );

    return Object.freeze({
      accountingVersion: AI_PROVIDER_COST_ACCOUNTING_VERSION,
      pricingCatalogVersion: AI_PROVIDER_PRICING_CATALOG_VERSION,
      currency: 'USD',
      lineage: sortedAttempts[0].lineage,
      attempts: Object.freeze(sortedAttempts),
      aggregateUsage,
      aggregateCostMicros: aggregateCostMicros.toString(),
      pricedAttemptCount: pricedAttempts.length,
      unpricedAttemptCount: sortedAttempts.length - pricedAttempts.length,
      fallbackUsed: sortedAttempts.some(
        (attempt) => attempt.kind === 'FALLBACK',
      ),
      cancelledAttemptCount: sortedAttempts.filter(
        (attempt) => attempt.status === 'CANCELLED',
      ).length,
      partialUsageAttemptCount: sortedAttempts.filter(
        (attempt) => attempt.status !== 'SUCCESS' && attempt.usage.reported,
      ).length,
    });
  }

  static calculateCost(
    usage: AiProviderTokenUsage,
    pricing: AiProviderPricingEntry | null,
  ): AiProviderAttemptCost {
    if (!pricing) {
      return Object.freeze({
        status: 'UNPRICED',
        currency: 'USD',
        inputCostMicros: null,
        outputCostMicros: null,
        cachedInputCostMicros: null,
        cacheWriteCostMicros: null,
        reasoningCostMicros: null,
        totalCostMicros: null,
      });
    }

    const inputCostMicros = this.roundedMicros(
      usage.inputTokens,
      pricing.inputMicroUsdPerMillionTokens,
    );
    const outputCostMicros = this.roundedMicros(
      usage.outputTokens,
      pricing.outputMicroUsdPerMillionTokens,
    );
    const cachedInputCostMicros = this.roundedMicros(
      usage.cachedInputTokens,
      pricing.cachedInputMicroUsdPerMillionTokens,
    );
    const cacheWriteCostMicros = this.roundedMicros(
      usage.cacheWriteTokens,
      pricing.cacheWriteMicroUsdPerMillionTokens,
    );
    const reasoningCostMicros = this.roundedMicros(
      usage.reasoningTokens,
      pricing.reasoningMicroUsdPerMillionTokens,
    );
    const totalCostMicros =
      inputCostMicros +
      outputCostMicros +
      cachedInputCostMicros +
      cacheWriteCostMicros +
      reasoningCostMicros;

    return Object.freeze({
      status: 'CALCULATED',
      currency: pricing.currency,
      inputCostMicros: inputCostMicros.toString(),
      outputCostMicros: outputCostMicros.toString(),
      cachedInputCostMicros: cachedInputCostMicros.toString(),
      cacheWriteCostMicros: cacheWriteCostMicros.toString(),
      reasoningCostMicros: reasoningCostMicros.toString(),
      totalCostMicros: totalCostMicros.toString(),
    });
  }

  private static aggregateUsage(
    attempts: readonly AiProviderCostAccountingAttempt[],
  ): AiProviderTokenUsage {
    return Object.freeze({
      inputTokens: attempts.reduce(
        (sum, attempt) => sum + attempt.usage.inputTokens,
        0,
      ),
      outputTokens: attempts.reduce(
        (sum, attempt) => sum + attempt.usage.outputTokens,
        0,
      ),
      totalTokens: attempts.reduce(
        (sum, attempt) => sum + attempt.usage.totalTokens,
        0,
      ),
      cachedInputTokens: attempts.reduce(
        (sum, attempt) => sum + attempt.usage.cachedInputTokens,
        0,
      ),
      cacheWriteTokens: attempts.reduce(
        (sum, attempt) => sum + attempt.usage.cacheWriteTokens,
        0,
      ),
      reasoningTokens: attempts.reduce(
        (sum, attempt) => sum + attempt.usage.reasoningTokens,
        0,
      ),
      reported: attempts.some((attempt) => attempt.usage.reported),
      source: 'PROVIDER_RESPONSE',
    });
  }

  private static roundedMicros(tokens: number, rate: string): bigint {
    const normalizedTokens = BigInt(Math.max(0, Math.trunc(tokens)));
    const normalizedRate = this.parseNonNegativeBigInt(rate);
    const numerator = normalizedTokens * normalizedRate;

    return (numerator + TOKENS_PER_PRICING_UNIT / 2n) / TOKENS_PER_PRICING_UNIT;
  }

  private static parseNonNegativeBigInt(value: string): bigint {
    if (!/^\d+$/u.test(value)) {
      throw new Error(`Invalid provider pricing rate: ${value}`);
    }

    return BigInt(value);
  }

  private static resolveLineage(
    metadata: Record<string, unknown> | undefined,
    taskType: string,
  ): AiProviderExecutionLineage {
    const source = metadata ?? {};

    return Object.freeze({
      executionId: this.resolveOptionalString(source.executionId),
      correlationId: this.resolveOptionalString(source.correlationId),
      requestId: this.resolveOptionalString(source.requestId),
      source:
        this.resolveOptionalString(source.source) ??
        this.resolveOptionalString(source.channel),
      toolName: this.resolveOptionalString(source.toolName),
      agentId: this.resolveOptionalString(source.agentId),
      taskType,
      retryOrdinal: this.resolveOptionalInteger(
        source.retryOrdinal ?? source.attemptNumber ?? source.attempt,
      ),
    });
  }

  private static createAttemptId(input: {
    readonly sequence: number;
    readonly kind: string;
    readonly provider: string;
    readonly model: string;
    readonly lineage: AiProviderExecutionLineage;
  }): string {
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          version: AI_PROVIDER_COST_ACCOUNTING_VERSION,
          sequence: input.sequence,
          kind: input.kind,
          provider: input.provider,
          model: input.model,
          executionId: input.lineage.executionId,
          correlationId: input.lineage.correlationId,
          requestId: input.lineage.requestId,
          retryOrdinal: input.lineage.retryOrdinal,
        }),
      )
      .digest('hex')
      .slice(0, 32);

    return `ai-cost-${digest}`;
  }

  private static hasReportedTokenCount(
    record: Record<string, unknown>,
    keys: readonly string[],
  ): boolean {
    return keys.some((key) => {
      const value = record[key];
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim().length > 0
            ? Number(value)
            : Number.NaN;

      return Number.isFinite(parsed) && parsed >= 0;
    });
  }

  private static resolveTokenCount(
    record: Record<string, unknown>,
    keys: readonly string[],
  ): number {
    for (const key of keys) {
      const value = record[key];
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim().length > 0
            ? Number(value)
            : Number.NaN;

      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.trunc(parsed);
      }
    }

    return 0;
  }

  private static resolveOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized.slice(0, 240) : null;
  }

  private static resolveOptionalInteger(value: unknown): number | null {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim().length > 0
          ? Number(value)
          : Number.NaN;

    if (!Number.isInteger(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  }

  private static toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
