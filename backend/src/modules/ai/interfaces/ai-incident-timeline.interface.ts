export const AI_INCIDENT_TIMELINE_VERSION = '1.0.0';
export const AI_INCIDENT_TIMELINE_CATEGORY = 'AI_INCIDENT_TIMELINE_V1';
export const AI_INCIDENT_EVENT_TYPES = [
  'OPENED',
  'SEVERITY_CHANGED',
  'EVIDENCE_ATTACHED',
  'RUNBOOK_LINKED',
  'ACKNOWLEDGED',
  'MITIGATION_STARTED',
  'MITIGATED',
  'RESOLVED',
  'REOPENED',
  'NOTE_ADDED',
] as const;
export type AiIncidentEventType = (typeof AI_INCIDENT_EVENT_TYPES)[number];
export const AI_INCIDENT_SEVERITIES = [
  'INFO',
  'WARNING',
  'ERROR',
  'CRITICAL',
] as const;
export type AiIncidentSeverity = (typeof AI_INCIDENT_SEVERITIES)[number];
export const AI_INCIDENT_STATUSES = [
  'OPEN',
  'ACKNOWLEDGED',
  'MITIGATING',
  'MITIGATED',
  'RESOLVED',
] as const;
export type AiIncidentStatus = (typeof AI_INCIDENT_STATUSES)[number];

export interface AiIncidentTimelineDocument {
  version: typeof AI_INCIDENT_TIMELINE_VERSION;
  incidentId: string;
  sequence: number;
  eventType: AiIncidentEventType;
  severity: AiIncidentSeverity;
  status: AiIncidentStatus;
  source: string;
  title: string;
  summary: string | null;
  actorId: string;
  occurredAt: string;
  correlation: {
    requestId: string | null;
    traceId: string | null;
    runId: string | null;
    jobId: string | null;
  };
  runbookIds: readonly string[];
  evidence: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}
export interface AiIncidentTimelineEventRecord extends AiIncidentTimelineDocument {
  eventId: string;
  createdAt: string;
}
