import { createHash, randomUUID } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import type { ResolveAiShadowModelRoutingDto } from '../dto/admin-ai-shadow-model-routing.dto';
import {
  AI_SHADOW_MODEL_ROUTING_VERSION,
  type AiShadowRoutingDecision,
} from '../interfaces/ai-shadow-model-routing.interface';

import { AiModelRolloutCanaryService } from './ai-model-rollout-canary.service';
import { AiShadowRoutingObservabilityService } from './ai-shadow-routing-observability.service';
import { AiModelRouterService } from './ai-model-router.service';

@Injectable()
export class AiShadowModelRoutingService {
  constructor(
    private readonly router: AiModelRouterService,
    private readonly rollouts: AiModelRolloutCanaryService,
    private readonly observability: AiShadowRoutingObservabilityService,
  ) {}

  async resolve(
    input: ResolveAiShadowModelRoutingDto = {},
  ): Promise<AiShadowRoutingDecision> {
    const requestedTask = input.task?.trim() || 'PUBLIC_CHAT';
    const normalizedTaskType = this.router.normalizeTaskType(requestedTask);
    const actualRoute = this.router.resolve({ task: normalizedTaskType });
    const subject = this.resolveSubject(input);
    const rollout = await this.rollouts.findApplicableRollout({
      taskType: actualRoute.taskType,
      baselineProvider: actualRoute.provider,
      baselineModel: actualRoute.model,
      at: new Date(),
    });

    const cohort = rollout
      ? this.rollouts.resolveCohort(rollout, subject.value)
      : null;

    const shadowRoute =
      cohort?.cohort === 'CANDIDATE'
        ? {
            provider: cohort.candidate.provider,
            model: cohort.candidate.model,
          }
        : {
            provider: actualRoute.provider,
            model: actualRoute.model,
          };

    const decision: AiShadowRoutingDecision = {
      version: AI_SHADOW_MODEL_ROUTING_VERSION,
      mode: 'SHADOW_RESOLUTION_ONLY',
      decisionId: randomUUID(),
      resolvedAt: new Date().toISOString(),
      subjectKeySource: subject.source,
      subjectKeyFingerprint: this.fingerprint(subject.value),
      requestedTask,
      taskType: actualRoute.taskType,
      actualRoute: {
        provider: actualRoute.provider,
        model: actualRoute.model,
      },
      rollout:
        rollout && cohort
          ? {
              rolloutId: rollout.id,
              policyVersion: rollout.policyVersion,
              trafficPercent: rollout.trafficPercent,
              bucket: cohort.bucket,
              threshold: cohort.threshold,
              cohort: cohort.cohort,
            }
          : null,
      shadowRoute,
      routeChanged: false,
      providerInvoked: false,
      modelActivated: false,
      decisionPersisted: false,
    };

    const decisionPersisted = await this.observability.persistDecision(
      decision,
      input,
    );

    return { ...decision, decisionPersisted };
  }

  getSnapshot() {
    return {
      version: AI_SHADOW_MODEL_ROUTING_VERSION,
      mode: 'SHADOW_RESOLUTION_ONLY',
      actualRouter: 'AiModelRouterService',
      rolloutRegistry: 'AiModelRolloutCanaryService',
      trafficRoutingMutation: false,
      providerInvocation: false,
      modelActivation: false,
      decisionPersistence: true,
      persistenceMode: 'APPEND_ONLY_IDEMPOTENT',
      retentionDays: 30,
      subjectKeyPersistence: false,
    };
  }

  private resolveSubject(input: ResolveAiShadowModelRoutingDto): {
    source: 'EXPLICIT' | 'USER_ID' | 'REQUEST_ID' | 'TRACE_ID' | 'EXECUTION_ID';
    value: string;
  } {
    const candidates = [
      ['EXPLICIT', input.subjectKey],
      ['USER_ID', input.userId],
      ['REQUEST_ID', input.requestId],
      ['TRACE_ID', input.traceId],
      ['EXECUTION_ID', input.executionId],
    ] as const;

    for (const [source, raw] of candidates) {
      const value = raw?.trim();
      if (value) return { source, value };
    }

    throw new BadRequestException(
      'حداقل یکی از subjectKey، userId، requestId، traceId یا executionId الزامی است.',
    );
  }

  private fingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 24);
  }
}
