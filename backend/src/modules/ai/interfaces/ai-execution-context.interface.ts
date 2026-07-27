import type {
  AiAgentCapability,
  AiAgentExecutionMode,
  AiAgentModelRequirements,
} from './ai-agent.interface';

import type {
  AiCanonicalTaskType,
  AiGenerateOptions,
} from './ai-provider.interface';

export const AI_EXECUTION_CONTEXT_VERSION = '1.0.0';

export interface AiExecutionContext {
  executionId: string;
  correlationId: string;
  requestId: string;
  source: string;
  startedAt: string;
  contextVersion: string;
  requestedTask: string;
  taskType: AiCanonicalTaskType;
  agentId: string;
  agentVersion: string;
  agentExecutionMode: AiAgentExecutionMode;
  agentCapabilities: readonly AiAgentCapability[];
  agentSupportsHumanHandoff: boolean;
  agentModelRequirements: AiAgentModelRequirements;
}

export interface AiExecutionPreparation {
  context: AiExecutionContext;
  options: AiGenerateOptions;
}
