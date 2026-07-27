export const AI_BUDGET_ENFORCEMENT_VERSION = '1.0.0';

export const AI_BUDGET_POLICY_SCHEMA_VERSION = '1.0.0';

export const AI_BUDGET_POLICY_RULE_TYPE = 'AI_BUDGET_POLICY_V1';

export type AiBudgetScope =
  'GLOBAL' | 'USER' | 'AGENT' | 'PROVIDER' | 'MODEL' | 'TASK';

export type AiBudgetWindow =
  'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ROLLING_24_HOURS';

export type AiBudgetDecision = 'NO_POLICY' | 'ALLOW' | 'WARN' | 'BLOCK';

export type AiBudgetUnknownPricingMode = 'WARN' | 'BLOCK';

export type AiBudgetReservationStatus = 'RESERVED' | 'RECONCILED';

export interface AiBudgetPolicyDocument {
  readonly schemaVersion: typeof AI_BUDGET_POLICY_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly scope: AiBudgetScope;
  readonly scopeValue: string | null;
  readonly window: AiBudgetWindow;
  readonly softLimitMicros: string;
  readonly hardLimitMicros: string;
  readonly unknownPricingMode: AiBudgetUnknownPricingMode;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly updatedById: string | null;
}

export interface AiBudgetPolicyRecord extends AiBudgetPolicyDocument {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly priority: number;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface AiBudgetExecutionContext {
  readonly runLogId: string | null;
  readonly taskType: string;
  readonly userId: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly agentId: string | null;
  readonly executionId: string | null;
  readonly correlationId: string | null;
  readonly requestId: string | null;
}

export interface AiBudgetCostEstimate {
  readonly pricingStatus: 'CALCULATED' | 'UNPRICED' | 'NOT_EVALUATED';
  readonly estimatedCostMicros: string | null;
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
}

export interface AiBudgetPolicyDecisionEvidence {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly scope: AiBudgetScope;
  readonly scopeValue: string | null;
  readonly window: AiBudgetWindow;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly decision: Exclude<AiBudgetDecision, 'NO_POLICY'>;
  readonly pricingStatus: AiBudgetCostEstimate['pricingStatus'];
  readonly softLimitMicros: string;
  readonly hardLimitMicros: string;
  readonly actualCostMicros: string;
  readonly activeReservationMicros: string;
  readonly requestedReservationMicros: string | null;
  readonly projectedCostMicros: string | null;
  readonly unknownPricingMode: AiBudgetUnknownPricingMode;
}

export interface AiBudgetReservationEvidence {
  readonly version: typeof AI_BUDGET_ENFORCEMENT_VERSION;
  readonly reservationId: string;
  readonly status: AiBudgetReservationStatus;
  readonly attemptSequence: number;
  readonly attemptKind: 'PRIMARY' | 'FALLBACK' | 'EMBEDDING';
  readonly context: AiBudgetExecutionContext;
  readonly pricingStatus: AiBudgetCostEstimate['pricingStatus'];
  readonly estimatedCostMicros: string | null;
  readonly actualCostMicros: string | null;
  readonly deltaCostMicros: string | null;
  readonly providerAttemptId: string | null;
  readonly providerAttemptStatus: string | null;
  readonly policyDecisions: readonly AiBudgetPolicyDecisionEvidence[];
  readonly reservedAt: string;
  readonly reconciledAt: string | null;
}

export interface AiBudgetDecisionEvidence {
  readonly version: typeof AI_BUDGET_ENFORCEMENT_VERSION;
  readonly decisionId: string;
  readonly decision: AiBudgetDecision;
  readonly context: AiBudgetExecutionContext;
  readonly pricingStatus: AiBudgetCostEstimate['pricingStatus'];
  readonly estimatedCostMicros: string | null;
  readonly policyDecisions: readonly AiBudgetPolicyDecisionEvidence[];
  readonly decidedAt: string;
}

export interface AiBudgetRunEvidence {
  readonly version: typeof AI_BUDGET_ENFORCEMENT_VERSION;
  readonly decisions: readonly AiBudgetDecisionEvidence[];
  readonly reservations: readonly AiBudgetReservationEvidence[];
}

export interface AiBudgetReservationResult {
  readonly version: typeof AI_BUDGET_ENFORCEMENT_VERSION;
  readonly decision: AiBudgetDecision;
  readonly reservationId: string | null;
  readonly policyDecisions: readonly AiBudgetPolicyDecisionEvidence[];
  readonly estimate: AiBudgetCostEstimate;
}
