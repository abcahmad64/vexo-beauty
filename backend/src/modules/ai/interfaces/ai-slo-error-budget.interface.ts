export const AI_SLO_ERROR_BUDGET_VERSION = '1.0.0';
export const AI_SLO_POLICY_SCHEMA_VERSION = '1.0.0';
export const AI_SLO_POLICY_RULE_TYPE = 'AI_SLO_POLICY_V1';

export const AI_SLO_SCOPES = [
  'GLOBAL',
  'USER',
  'AGENT',
  'PROVIDER',
  'MODEL',
  'TASK',
] as const;
export type AiSloScope = (typeof AI_SLO_SCOPES)[number];

export const AI_SLO_WINDOWS = [
  'ROLLING_1_HOUR',
  'ROLLING_24_HOURS',
  'ROLLING_7_DAYS',
  'ROLLING_30_DAYS',
] as const;
export type AiSloWindow = (typeof AI_SLO_WINDOWS)[number];

export const AI_SLO_DECISIONS = [
  'INSUFFICIENT_DATA',
  'HEALTHY',
  'WARN',
  'BREACHED',
] as const;
export type AiSloDecision = (typeof AI_SLO_DECISIONS)[number];

export interface AiSloPolicyDocument {
  readonly schemaVersion: typeof AI_SLO_POLICY_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly scope: AiSloScope;
  readonly scopeValue: string | null;
  readonly window: AiSloWindow;
  readonly availabilityTargetPercent: number;
  readonly latencyTargetMs: number | null;
  readonly minimumSampleSize: number;
  readonly warningBurnRate: number;
  readonly criticalBurnRate: number;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly updatedById: string;
  readonly updatedAt: string;
}

export interface AiSloPolicyRecord extends AiSloPolicyDocument {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly priority: number;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly databaseUpdatedAt: string;
  readonly deletedAt: string | null;
}
