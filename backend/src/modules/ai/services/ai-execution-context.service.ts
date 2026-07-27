import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { AI_EXECUTION_CONTEXT_VERSION } from '../interfaces/ai-execution-context.interface';

import type {
  AiExecutionContext,
  AiExecutionPreparation,
} from '../interfaces/ai-execution-context.interface';

import type { AiGenerateOptions } from '../interfaces/ai-provider.interface';

import { AiAgentRegistryService } from './ai-agent-registry.service';

const PROTECTED_AGENT_METADATA_KEYS = [
  'agentId',
  'agentVersion',
  'agentExecutionMode',
  'agentCapabilities',
  'agentSupportsHumanHandoff',
  'agentTaskType',
  'agentModelRequirements',
] as const;

const GENERATED_EXECUTION_METADATA_KEYS = [
  'executionId',
  'correlationId',
  'requestId',
  'executionStartedAt',
  'executionContextVersion',
] as const;

@Injectable()
export class AiExecutionContextService {
  constructor(private readonly agentRegistry: AiAgentRegistryService) {}

  prepare(options: AiGenerateOptions = {}): AiExecutionPreparation {
    const resolution = this.agentRegistry.resolveForTask(
      options.task ?? 'PUBLIC_CHAT',
    );

    const metadata = options.metadata ?? {};

    this.assertProtectedMetadata(
      metadata,
      resolution.agent.id,
      resolution.agent.version,
      resolution.normalizedTaskType,
    );

    const executionId =
      this.resolveOptionalString(metadata.executionId) ?? randomUUID();

    const correlationId =
      this.resolveOptionalString(metadata.correlationId) ?? executionId;

    const requestId =
      this.resolveOptionalString(metadata.requestId) ?? correlationId;

    const source =
      this.resolveOptionalString(metadata.source) ??
      this.resolveOptionalString(metadata.channel) ??
      'ai-orchestrator';

    const startedAt = new Date().toISOString();

    const context: AiExecutionContext = {
      executionId,
      correlationId,
      requestId,
      source,
      startedAt,
      contextVersion: AI_EXECUTION_CONTEXT_VERSION,
      requestedTask: resolution.requestedTask,
      taskType: resolution.normalizedTaskType,
      agentId: resolution.agent.id,
      agentVersion: resolution.agent.version,
      agentExecutionMode: resolution.agent.executionMode,
      agentCapabilities: resolution.agent.capabilities,
      agentSupportsHumanHandoff: resolution.agent.supportsHumanHandoff,
      agentModelRequirements: resolution.agent.modelRequirements,
    };

    return {
      context,
      options: {
        ...options,
        metadata: {
          ...metadata,
          executionId: context.executionId,
          correlationId: context.correlationId,
          requestId: context.requestId,
          source: context.source,
          executionStartedAt: context.startedAt,
          executionContextVersion: context.contextVersion,
          requestedTask: context.requestedTask,
          agentId: context.agentId,
          agentVersion: context.agentVersion,
          agentExecutionMode: context.agentExecutionMode,
          agentCapabilities: context.agentCapabilities,
          agentSupportsHumanHandoff: context.agentSupportsHumanHandoff,
          agentTaskType: context.taskType,
          agentModelRequirements: context.agentModelRequirements,
        },
      },
    };
  }

  getSnapshot() {
    return {
      version: AI_EXECUTION_CONTEXT_VERSION,
      registryEnforced: true,
      agentSpoofingProtection: true,
      correlationPropagation: true,
      runLogPropagation:
        'AiGenerateOptions.metadata -> AiRunLog.inputJson.metadata',
      protectedAgentMetadataKeys: [...PROTECTED_AGENT_METADATA_KEYS],
      generatedExecutionMetadataKeys: [...GENERATED_EXECUTION_METADATA_KEYS],
    };
  }

  private assertProtectedMetadata(
    metadata: Record<string, unknown>,
    agentId: string,
    agentVersion: string,
    taskType: string,
  ): void {
    this.assertOptionalMatch(
      metadata.agentId,
      agentId,
      'شناسه Agent ارسالی با Agent مالک این وظیفه مطابقت ندارد.',
    );

    this.assertOptionalMatch(
      metadata.agentVersion,
      agentVersion,
      'نسخه Agent ارسالی با نسخه Agent فعال مطابقت ندارد.',
    );

    this.assertOptionalMatch(
      metadata.agentTaskType,
      taskType,
      'نوع وظیفه Agent ارسالی با مسیر اجرایی معتبر مطابقت ندارد.',
    );
  }

  private assertOptionalMatch(
    value: unknown,
    expected: string,
    errorMessage: string,
  ): void {
    const normalized = this.resolveOptionalString(value);

    if (normalized && normalized !== expected) {
      throw new BadRequestException(errorMessage);
    }
  }

  private resolveOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    if (normalized.length === 0) {
      return undefined;
    }

    return normalized.slice(0, 200);
  }
}
