import type { AiCanonicalTaskType } from './ai-provider.interface';

export const AI_SHADOW_MODEL_ROUTING_VERSION = '1.0.0';

export type AiShadowRoutingCohort = 'BASELINE' | 'CANDIDATE' | 'NO_ROLLOUT';

export interface AiShadowRoutingDecision {
  readonly version: typeof AI_SHADOW_MODEL_ROUTING_VERSION;
  readonly mode: 'SHADOW_RESOLUTION_ONLY';
  readonly decisionId: string;
  readonly resolvedAt: string;
  readonly subjectKeySource:
    'EXPLICIT' | 'USER_ID' | 'REQUEST_ID' | 'TRACE_ID' | 'EXECUTION_ID';
  readonly subjectKeyFingerprint: string;
  readonly requestedTask: string;
  readonly taskType: AiCanonicalTaskType;
  readonly actualRoute: {
    readonly provider: string;
    readonly model: string;
  };
  readonly rollout: {
    readonly rolloutId: string;
    readonly policyVersion: number;
    readonly trafficPercent: number;
    readonly bucket: number;
    readonly threshold: number;
    readonly cohort: AiShadowRoutingCohort;
  } | null;
  readonly shadowRoute: {
    readonly provider: string;
    readonly model: string;
  };
  readonly routeChanged: false;
  readonly providerInvoked: false;
  readonly modelActivated: false;
  readonly decisionPersisted: boolean;
}
