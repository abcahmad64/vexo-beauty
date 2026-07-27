import { Logger } from '@nestjs/common';

import type { PrismaService } from '../../../core/prisma/prisma.service';

import { AiRunLogService } from './ai-run-log.service';

jest.mock('../../../core/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type AiRunLogCreateMock = jest.Mock<Promise<{ id: string }>, [unknown]>;

type AiRunLogUpdateMock = jest.Mock<Promise<unknown>, [unknown]>;

type PrismaMock = {
  aiRunLog: {
    create: AiRunLogCreateMock;
    update: AiRunLogUpdateMock;
  };
};

describe('AiRunLogService', () => {
  let prisma: PrismaMock;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;
  let service: AiRunLogService;

  beforeEach(() => {
    prisma = {
      aiRunLog: {
        create: jest.fn<Promise<{ id: string }>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };

    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    service = new AiRunLogService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a running log and returns its identifier', async () => {
    prisma.aiRunLog.create.mockResolvedValue({
      id: 'run-1',
    });

    const inputJson = {
      messages: [
        {
          role: 'user',
          content: 'Recommend a product.',
        },
      ],
      metadata: {
        channel: 'web',
      },
    };

    const result = await service.startRun({
      taskType: 'SALES',
      promptKey: 'sales.prompt',
      userId: 'user-1',
      provider: 'ollama',
      model: 'primary-model',
      inputJson,
    });

    expect(prisma.aiRunLog.create).toHaveBeenCalledWith({
      data: {
        taskType: 'SALES',
        promptKey: 'sales.prompt',
        userId: 'user-1',
        provider: 'ollama',
        model: 'primary-model',
        inputJson,
        outputJson: {},
        status: 'RUNNING',
      },
      select: {
        id: true,
      },
    });

    expect(result).toBe('run-1');
  });

  it('uses null defaults and protects against unserializable input', async () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;

    prisma.aiRunLog.create.mockResolvedValue({
      id: 'run-2',
    });

    const result = await service.startRun({
      taskType: 'CONTENT',
      inputJson: circular,
    });

    expect(prisma.aiRunLog.create).toHaveBeenCalledWith({
      data: {
        taskType: 'CONTENT',
        promptKey: null,
        userId: null,
        provider: null,
        model: null,
        inputJson: {
          unserializable: true,
        },
        outputJson: {},
        status: 'RUNNING',
      },
      select: {
        id: true,
      },
    });

    expect(result).toBe('run-2');
  });

  it('returns null and logs when creating the run log fails', async () => {
    prisma.aiRunLog.create.mockRejectedValue('database unavailable');

    const result = await service.startRun({
      taskType: 'PUBLIC_CHAT',
    });

    expect(result).toBeNull();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to create AI run log.',
      'database unavailable',
    );
  });

  it('skips success and failure updates when the identifier is null', async () => {
    await service.markSuccess(null, {
      latencyMs: 10,
    });

    await service.markFailure(null, {
      latencyMs: 20,
      errorMessage: 'failed',
    });

    expect(prisma.aiRunLog.update).not.toHaveBeenCalled();
  });

  it('marks a run as successful with normalized output and token usage', async () => {
    prisma.aiRunLog.update.mockResolvedValue({
      id: 'run-1',
    });

    await service.markSuccess('run-1', {
      outputJson: {
        content: 'completed',
      },
      latencyMs: 50.9,
      tokenUsageJson: {
        promptEvalCount: 10,
        evalCount: 20,
      },
      model: 'resolved-model',
    });

    expect(prisma.aiRunLog.update).toHaveBeenCalledWith({
      where: {
        id: 'run-1',
      },
      data: {
        status: 'SUCCESS',
        outputJson: {
          content: 'completed',
        },
        latencyMs: 50,
        tokenUsageJson: {
          promptEvalCount: 10,
          evalCount: 20,
        },
        model: 'resolved-model',
        errorMessage: null,
      },
    });
  });

  it('uses success defaults when optional output fields are absent', async () => {
    prisma.aiRunLog.update.mockResolvedValue({
      id: 'run-2',
    });

    await service.markSuccess('run-2', {
      latencyMs: 9.8,
    });

    expect(prisma.aiRunLog.update).toHaveBeenCalledWith({
      where: {
        id: 'run-2',
      },
      data: {
        status: 'SUCCESS',
        outputJson: {},
        latencyMs: 9,
        tokenUsageJson: undefined,
        model: undefined,
        errorMessage: null,
      },
    });
  });

  it('marks a run as failed and limits the stored error message', async () => {
    prisma.aiRunLog.update.mockResolvedValue({
      id: 'run-3',
    });

    const longError = 'x'.repeat(2100);

    await service.markFailure('run-3', {
      outputJson: {
        failedModel: 'primary-model',
      },
      latencyMs: 12.99,
      errorMessage: longError,
      model: 'primary-model',
    });

    expect(prisma.aiRunLog.update).toHaveBeenCalledWith({
      where: {
        id: 'run-3',
      },
      data: {
        status: 'FAILED',
        outputJson: {
          failedModel: 'primary-model',
        },
        latencyMs: 12,
        tokenUsageJson: undefined,
        model: 'primary-model',
        errorMessage: 'x'.repeat(2000),
      },
    });
  });

  it('prefers canonical provider accounting over legacy token usage on success', async () => {
    prisma.aiRunLog.update.mockResolvedValue({
      id: 'run-success-accounting',
    });

    const providerAccounting = {
      accountingVersion: '1.0.0',
      pricingCatalogVersion: '2026-07-23.v1',
      currency: 'USD' as const,
      lineage: {
        executionId: null,
        correlationId: null,
        requestId: null,
        source: null,
        toolName: null,
        agentId: null,
        taskType: 'CONTENT',
        retryOrdinal: null,
      },
      attempts: [],
      aggregateUsage: {
        inputTokens: 2,
        outputTokens: 3,
        totalTokens: 5,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        reported: true,
        source: 'PROVIDER_RESPONSE' as const,
      },
      aggregateCostMicros: '0',
      pricedAttemptCount: 1,
      unpricedAttemptCount: 0,
      fallbackUsed: false,
      cancelledAttemptCount: 0,
      partialUsageAttemptCount: 0,
    };

    await service.markSuccess('run-success-accounting', {
      latencyMs: 11,
      tokenUsageJson: { legacy: true },
      providerAccounting,
      model: 'primary-model',
    });

    expect(prisma.aiRunLog.update).toHaveBeenCalledWith({
      where: {
        id: 'run-success-accounting',
      },
      data: {
        status: 'SUCCESS',
        outputJson: {},
        latencyMs: 11,
        tokenUsageJson: providerAccounting,
        model: 'primary-model',
        errorMessage: null,
      },
    });
  });

  it('persists canonical provider accounting and a cancelled terminal status', async () => {
    prisma.aiRunLog.update.mockResolvedValue({
      id: 'run-accounting',
    });

    const providerAccounting = {
      accountingVersion: '1.0.0',
      pricingCatalogVersion: '2026-07-23.v1',
      currency: 'USD' as const,
      lineage: {
        executionId: 'execution-1',
        correlationId: 'correlation-1',
        requestId: 'request-1',
        source: 'queue',
        toolName: null,
        agentId: null,
        taskType: 'SALES',
        retryOrdinal: 1,
      },
      attempts: [],
      aggregateUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        reported: false,
        source: 'UNREPORTED' as const,
      },
      aggregateCostMicros: '0',
      pricedAttemptCount: 0,
      unpricedAttemptCount: 0,
      fallbackUsed: false,
      cancelledAttemptCount: 1,
      partialUsageAttemptCount: 0,
    };

    await service.markFailure('run-accounting', {
      latencyMs: 18.8,
      errorMessage: 'cancelled by admin',
      status: 'CANCELLED',
      providerAccounting,
      model: 'primary-model',
    });

    expect(prisma.aiRunLog.update).toHaveBeenCalledWith({
      where: {
        id: 'run-accounting',
      },
      data: {
        status: 'CANCELLED',
        outputJson: {},
        latencyMs: 18,
        tokenUsageJson: providerAccounting,
        model: 'primary-model',
        errorMessage: 'cancelled by admin',
      },
    });
  });

  it('swallows and logs success and failure update errors', async () => {
    prisma.aiRunLog.update
      .mockRejectedValueOnce(new Error('success update failed'))
      .mockRejectedValueOnce('failure update failed');

    await expect(
      service.markSuccess('run-4', {
        latencyMs: 30,
      }),
    ).resolves.toBeUndefined();

    await expect(
      service.markFailure('run-5', {
        latencyMs: 40,
        errorMessage: 'generation failed',
      }),
    ).resolves.toBeUndefined();

    expect(loggerErrorSpy).toHaveBeenNthCalledWith(
      1,
      'Failed to update successful AI run log.',
      expect.stringContaining('success update failed'),
    );

    expect(loggerErrorSpy).toHaveBeenNthCalledWith(
      2,
      'Failed to update failed AI run log.',
      'failure update failed',
    );
  });
});
