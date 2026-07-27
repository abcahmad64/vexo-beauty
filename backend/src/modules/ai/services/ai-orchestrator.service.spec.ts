import { ForbiddenException } from '@nestjs/common';

import type {
  AiChatMessage,
  AiGenerateOptions,
  AiProviderResult,
} from '../interfaces/ai-provider.interface';

import type {
  AiPermissionContext,
  AiPermissionGuardService,
} from './ai-permission-guard.service';

import { AiOrchestratorService } from './ai-orchestrator.service';

import type {
  AiToolDefinition,
  AiToolRegistryService,
} from './ai-tool-registry.service';

type AiProviderMock = {
  generate: jest.Mock<
    Promise<AiProviderResult>,
    [AiChatMessage[], AiGenerateOptions?]
  >;
};

type ToolRegistryMock = {
  assertToolEnabled: jest.Mock<AiToolDefinition, [string]>;
};

type PermissionGuardMock = {
  assertAllowed: jest.Mock<void, [AiPermissionContext, string[], string?]>;
  assertApprovalAllowed: jest.Mock<void, [AiPermissionContext, string?]>;
};

describe('AiOrchestratorService', () => {
  let aiProvider: AiProviderMock;
  let toolRegistry: ToolRegistryMock;
  let permissionGuard: PermissionGuardMock;
  let service: AiOrchestratorService;

  const messages: AiChatMessage[] = [
    {
      role: 'user',
      content: 'یک پیشنهاد مناسب ارائه بده.',
    },
  ];

  const providerResult: AiProviderResult = {
    content: 'پیشنهاد آماده شد.',
    model: 'primary-model',
    provider: 'ollama',
  };

  const readOnlyTool: AiToolDefinition = {
    name: 'catalog.read',
    title: 'خواندن کاتالوگ',
    description: 'اطلاعات کاتالوگ را می‌خواند.',
    module: 'catalog',
    riskLevel: 'READ_ONLY',
    executionMode: 'READ',
    requiredPermissions: ['catalog:read'],
    requiresApproval: false,
    enabled: true,
  };

  const sensitiveTool: AiToolDefinition = {
    name: 'discount.apply',
    title: 'اعمال تخفیف',
    description: 'تخفیف تأییدشده را اعمال می‌کند.',
    module: 'discount',
    riskLevel: 'SENSITIVE',
    executionMode: 'APPROVAL_REQUIRED',
    requiredPermissions: ['discount:manage'],
    requiresApproval: true,
    enabled: true,
  };

  beforeEach(() => {
    aiProvider = {
      generate: jest
        .fn<Promise<AiProviderResult>, [AiChatMessage[], AiGenerateOptions?]>()
        .mockResolvedValue(providerResult),
    };

    toolRegistry = {
      assertToolEnabled: jest.fn<AiToolDefinition, [string]>(),
    };

    permissionGuard = {
      assertAllowed: jest.fn<void, [AiPermissionContext, string[], string?]>(),
      assertApprovalAllowed: jest.fn<void, [AiPermissionContext, string?]>(),
    };

    service = new AiOrchestratorService(
      aiProvider,
      toolRegistry as unknown as AiToolRegistryService,
      permissionGuard as unknown as AiPermissionGuardService,
    );
  });

  it('delegates basic generation to the configured provider', async () => {
    const options: AiGenerateOptions = {
      task: 'SALES',
      temperature: 0.4,
      userId: 'user-1',
    };

    const result = await service.generate(messages, options);

    expect(aiProvider.generate).toHaveBeenCalledWith(messages, options);

    expect(result).toBe(providerResult);
  });

  it('propagates provider generation errors', async () => {
    const providerError = new Error('provider unavailable');

    aiProvider.generate.mockRejectedValue(providerError);

    await expect(service.generate(messages)).rejects.toBe(providerError);
  });

  it('returns an approved policy when no tool is requested', () => {
    const result = service.assertPolicy({
      messages,
      context: {
        userId: 'user-1',
      },
    });

    expect(result).toEqual({
      tool: null,
      approvalRequired: false,
      approved: true,
    });

    expect(toolRegistry.assertToolEnabled).not.toHaveBeenCalled();

    expect(permissionGuard.assertAllowed).not.toHaveBeenCalled();

    expect(permissionGuard.assertApprovalAllowed).not.toHaveBeenCalled();
  });

  it('authorizes an enabled tool that does not require approval', () => {
    toolRegistry.assertToolEnabled.mockReturnValue(readOnlyTool);

    const context: AiPermissionContext = {
      userId: 'user-1',
      permissions: ['catalog:read'],
    };

    const result = service.assertPolicy({
      messages,
      toolName: readOnlyTool.name,
      context,
    });

    expect(toolRegistry.assertToolEnabled).toHaveBeenCalledWith(
      readOnlyTool.name,
    );

    expect(permissionGuard.assertAllowed).toHaveBeenCalledWith(
      context,
      readOnlyTool.requiredPermissions,
      readOnlyTool.title,
    );

    expect(permissionGuard.assertApprovalAllowed).not.toHaveBeenCalled();

    expect(result).toEqual({
      tool: readOnlyTool,
      approvalRequired: false,
      approved: true,
    });
  });

  it('rejects an approval-required tool when approval is absent', () => {
    toolRegistry.assertToolEnabled.mockReturnValue(sensitiveTool);

    const context: AiPermissionContext = {
      userId: 'admin-1',
      permissions: ['discount:manage'],
    };

    expect(() =>
      service.assertPolicy({
        messages,
        toolName: sensitiveTool.name,
        context,
      }),
    ).toThrow(
      new ForbiddenException(
        'این ابزار هوشمند عملیات حساس انجام می‌دهد و قبل از اجرا به تأیید ادمین نیاز دارد.',
      ),
    );

    expect(permissionGuard.assertAllowed).toHaveBeenCalledWith(
      context,
      sensitiveTool.requiredPermissions,
      sensitiveTool.title,
    );

    expect(permissionGuard.assertApprovalAllowed).not.toHaveBeenCalled();
  });

  it('validates approval permission for an approved sensitive tool', () => {
    toolRegistry.assertToolEnabled.mockReturnValue(sensitiveTool);

    const context = {
      userId: 'admin-1',
      permissions: ['discount:manage', 'ai:approve'],
      approvalStatus: 'APPROVED' as const,
    };

    const result = service.assertPolicy({
      messages,
      toolName: sensitiveTool.name,
      context,
    });

    expect(permissionGuard.assertAllowed).toHaveBeenCalledWith(
      context,
      sensitiveTool.requiredPermissions,
      sensitiveTool.title,
    );

    expect(permissionGuard.assertApprovalAllowed).toHaveBeenCalledWith(
      context,
      sensitiveTool.title,
    );

    expect(result).toEqual({
      tool: sensitiveTool,
      approvalRequired: true,
      approved: true,
    });
  });

  it('adds neutral policy metadata when generation has no tool', async () => {
    const result = await service.generateWithPolicy({
      messages,
      options: {
        task: 'PUBLIC_CHAT',
        temperature: 0.2,
        metadata: {
          channel: 'web',
          requestId: 'request-1',
        },
      },
    });

    expect(aiProvider.generate).toHaveBeenCalledWith(messages, {
      task: 'PUBLIC_CHAT',
      temperature: 0.2,
      metadata: {
        channel: 'web',
        requestId: 'request-1',
        toolName: null,
        toolRiskLevel: null,
        toolExecutionMode: null,
        approvalRequired: false,
        approved: true,
      },
    });

    expect(result).toBe(providerResult);
  });

  it('adds tool policy metadata for an approved sensitive generation', async () => {
    toolRegistry.assertToolEnabled.mockReturnValue(sensitiveTool);

    const context = {
      userId: 'admin-1',
      roleName: 'admin',
      permissions: ['discount:manage', 'ai:approve'],
      approvalStatus: 'APPROVED' as const,
    };

    const result = await service.generateWithPolicy({
      messages,
      toolName: sensitiveTool.name,
      context,
      options: {
        task: 'DISCOUNT',
        maxTokens: 600,
        metadata: {
          campaignId: 'campaign-1',
        },
      },
    });

    expect(aiProvider.generate).toHaveBeenCalledWith(messages, {
      task: 'DISCOUNT',
      maxTokens: 600,
      metadata: {
        campaignId: 'campaign-1',
        toolName: sensitiveTool.name,
        toolRiskLevel: sensitiveTool.riskLevel,
        toolExecutionMode: sensitiveTool.executionMode,
        approvalRequired: true,
        approved: true,
      },
    });

    expect(result).toBe(providerResult);
  });
});
