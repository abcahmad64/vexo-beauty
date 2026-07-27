import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';

import { AI_PROVIDER } from '../constants/ai-provider.tokens';

import {
  AiChatMessage,
  AiGenerateOptions,
  AiProvider,
  AiProviderResult,
} from '../interfaces/ai-provider.interface';

import { AiAgentRegistryService } from './ai-agent-registry.service';

import { AiExecutionContextService } from './ai-execution-context.service';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from './ai-permission-guard.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from './ai-tool-registry.service';

export type AiApprovalStatus =
  'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface AiOrchestratorPolicyContext extends AiPermissionContext {
  approvalStatus?: AiApprovalStatus;
}

export interface AiOrchestratorGenerateInput {
  messages: AiChatMessage[];
  options?: AiGenerateOptions;
  toolName?: string;
  context?: AiOrchestratorPolicyContext;
}

export interface AiOrchestratorPolicyResult {
  tool: AiToolDefinition | null;
  approvalRequired: boolean;
  approved: boolean;
}

@Injectable()
export class AiOrchestratorService {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
    @Optional()
    private readonly agentRegistry?: AiAgentRegistryService,
    @Optional()
    private readonly executionContext?: AiExecutionContextService,
  ) {}

  generate(
    messages: AiChatMessage[],
    options?: AiGenerateOptions,
  ): Promise<AiProviderResult> {
    return this.aiProvider.generate(messages, this.withAgentMetadata(options));
  }

  async generateWithPolicy(
    input: AiOrchestratorGenerateInput,
  ): Promise<AiProviderResult> {
    const policy = this.assertPolicy(input);

    return this.aiProvider.generate(
      input.messages,
      this.withAgentMetadata({
        ...input.options,
        metadata: {
          ...(input.options?.metadata ?? {}),
          toolName: policy.tool?.name ?? null,
          toolRiskLevel: policy.tool?.riskLevel ?? null,
          toolExecutionMode: policy.tool?.executionMode ?? null,
          approvalRequired: policy.approvalRequired,
          approved: policy.approved,
        },
      }),
    );
  }

  assertPolicy(input: AiOrchestratorGenerateInput): AiOrchestratorPolicyResult {
    if (!input.toolName) {
      return {
        tool: null,
        approvalRequired: false,
        approved: true,
      };
    }

    const tool = this.toolRegistry.assertToolEnabled(input.toolName);

    const context = input.context ?? {};

    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      tool.title,
    );

    if (!tool.requiresApproval) {
      return {
        tool,
        approvalRequired: false,
        approved: true,
      };
    }

    const approved = context.approvalStatus === 'APPROVED';

    if (!approved) {
      throw new ForbiddenException(
        'این ابزار هوشمند عملیات حساس انجام می‌دهد و قبل از اجرا به تأیید ادمین نیاز دارد.',
      );
    }

    this.permissionGuard.assertApprovalAllowed(context, tool.title);

    return {
      tool,
      approvalRequired: true,
      approved: true,
    };
  }

  private withAgentMetadata(
    options?: AiGenerateOptions,
  ): AiGenerateOptions | undefined {
    if (this.executionContext) {
      return this.executionContext.prepare(options).options;
    }

    if (!this.agentRegistry) {
      return options;
    }

    const resolution = this.agentRegistry.resolveForTask(
      options?.task ?? 'PUBLIC_CHAT',
    );

    return {
      ...(options ?? {}),
      metadata: {
        ...(options?.metadata ?? {}),
        agentId: resolution.agent.id,
        agentVersion: resolution.agent.version,
        agentExecutionMode: resolution.agent.executionMode,
        agentCapabilities: resolution.agent.capabilities,
        agentSupportsHumanHandoff: resolution.agent.supportsHumanHandoff,
        agentTaskType: resolution.normalizedTaskType,
        agentModelRequirements: resolution.agent.modelRequirements,
      },
    };
  }
}
