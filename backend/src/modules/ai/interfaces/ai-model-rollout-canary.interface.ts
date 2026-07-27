export const AI_MODEL_ROLLOUT_VERSION = '1.0.0';
export const AI_MODEL_ROLLOUT_SCHEMA_VERSION = '1.0.0';
export const AI_MODEL_ROLLOUT_RULE_TYPE = 'AI_MODEL_ROLLOUT_V1';

export const AI_MODEL_ROLLOUT_DECISIONS = [
  'INSUFFICIENT_DATA',
  'CONTINUE',
  'HOLD',
  'ROLLBACK_RECOMMENDED',
] as const;
export type AiModelRolloutDecision =
  (typeof AI_MODEL_ROLLOUT_DECISIONS)[number];

export interface AiModelRolloutDocument {
  readonly schemaVersion: typeof AI_MODEL_ROLLOUT_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly baselineProvider: string;
  readonly baselineModel: string;
  readonly candidateProvider: string;
  readonly candidateModel: string;
  readonly taskType: string | null;
  readonly trafficPercent: number;
  readonly cohortSalt: string;
  readonly minimumSampleSize: number;
  readonly maxFailureRateIncreasePercent: number;
  readonly maxP95LatencyIncreasePercent: number;
  readonly maxCostIncreasePercent: number | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly updatedById: string;
  readonly updatedAt: string;
}

export interface AiModelRolloutRecord extends AiModelRolloutDocument {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly priority: number;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly databaseUpdatedAt: string;
  readonly deletedAt: string | null;
}
