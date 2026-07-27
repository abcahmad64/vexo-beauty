export const AI_ALERT_RUNBOOK_VERSION = '1.0.0';
export const AI_ALERT_RUNBOOK_SCHEMA_VERSION = '1.0.0';
export const AI_ALERT_RUNBOOK_RULE_TYPE = 'AI_ALERT_RUNBOOK_V1';

export const AI_ALERT_SOURCES = [
  'SLO',
  'QUEUE',
  'OPERATIONS',
  'SECURITY',
] as const;
export type AiAlertSource = (typeof AI_ALERT_SOURCES)[number];

export const AI_ALERT_SEVERITIES = [
  'INFO',
  'WARNING',
  'ERROR',
  'CRITICAL',
] as const;
export type AiAlertSeverity = (typeof AI_ALERT_SEVERITIES)[number];

export const AI_ALERT_DECISIONS = [
  'ANY',
  'WARN',
  'BREACHED',
  'DEGRADED',
  'UNHEALTHY',
  'CRITICAL',
] as const;
export type AiAlertDecision = (typeof AI_ALERT_DECISIONS)[number];

export interface AiAlertRunbookDocument {
  readonly schemaVersion: typeof AI_ALERT_RUNBOOK_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly source: AiAlertSource;
  readonly decision: AiAlertDecision;
  readonly severity: AiAlertSeverity;
  readonly scope: string | null;
  readonly scopeValue: string | null;
  readonly title: string;
  readonly url: string;
  readonly owner: string;
  readonly summary: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly updatedById: string;
  readonly updatedAt: string;
}

export interface AiAlertRunbookRecord extends AiAlertRunbookDocument {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly priority: number;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly databaseUpdatedAt: string;
  readonly deletedAt: string | null;
}

export interface AiAlertRunbookResolveInput {
  readonly source: AiAlertSource;
  readonly decision: string;
  readonly severity: AiAlertSeverity;
  readonly scope?: string | null;
  readonly scopeValue?: string | null;
  readonly asOf?: string;
}
