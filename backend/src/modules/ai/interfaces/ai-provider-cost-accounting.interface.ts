export const AI_PROVIDER_COST_ACCOUNTING_VERSION = '1.0.0';

export const AI_PROVIDER_PRICING_CATALOG_VERSION = '2026-07-23.v1';

export type AiProviderCostCurrency = 'USD';

export type AiProviderUsageSource =
  'OLLAMA_CHAT' | 'OLLAMA_EMBEDDING' | 'PROVIDER_RESPONSE' | 'UNREPORTED';

export type AiProviderAttemptKind = 'PRIMARY' | 'FALLBACK';

export type AiProviderAttemptStatus = 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type AiProviderPricingStatus = 'CALCULATED' | 'UNPRICED';

export interface AiProviderTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheWriteTokens: number;
  readonly reasoningTokens: number;
  readonly reported: boolean;
  readonly source: AiProviderUsageSource;
}

export interface AiProviderPricingEntry {
  readonly catalogVersion: string;
  readonly provider: string;
  readonly modelPattern: string;
  readonly currency: AiProviderCostCurrency;
  readonly effectiveAt: string;
  readonly source: string;
  readonly costBasis: 'PROVIDER_TOKEN_FEE_ONLY';
  readonly billable: boolean;
  readonly inputMicroUsdPerMillionTokens: string;
  readonly outputMicroUsdPerMillionTokens: string;
  readonly cachedInputMicroUsdPerMillionTokens: string;
  readonly cacheWriteMicroUsdPerMillionTokens: string;
  readonly reasoningMicroUsdPerMillionTokens: string;
}

export interface AiProviderExecutionLineage {
  readonly executionId: string | null;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly source: string | null;
  readonly toolName: string | null;
  readonly agentId: string | null;
  readonly taskType: string;
  readonly retryOrdinal: number | null;
}

export interface AiProviderAttemptCost {
  readonly status: AiProviderPricingStatus;
  readonly currency: AiProviderCostCurrency;
  readonly inputCostMicros: string | null;
  readonly outputCostMicros: string | null;
  readonly cachedInputCostMicros: string | null;
  readonly cacheWriteCostMicros: string | null;
  readonly reasoningCostMicros: string | null;
  readonly totalCostMicros: string | null;
}

export interface AiProviderCostAccountingAttempt {
  readonly accountingVersion: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly kind: AiProviderAttemptKind;
  readonly status: AiProviderAttemptStatus;
  readonly provider: string;
  readonly model: string;
  readonly usage: AiProviderTokenUsage;
  readonly pricing: AiProviderPricingEntry | null;
  readonly cost: AiProviderAttemptCost;
  readonly lineage: AiProviderExecutionLineage;
}

export interface AiProviderCostAccountingSummary {
  readonly accountingVersion: string;
  readonly pricingCatalogVersion: string;
  readonly currency: AiProviderCostCurrency;
  readonly lineage: AiProviderExecutionLineage;
  readonly attempts: readonly AiProviderCostAccountingAttempt[];
  readonly aggregateUsage: AiProviderTokenUsage;
  readonly aggregateCostMicros: string;
  readonly pricedAttemptCount: number;
  readonly unpricedAttemptCount: number;
  readonly fallbackUsed: boolean;
  readonly cancelledAttemptCount: number;
  readonly partialUsageAttemptCount: number;
}
