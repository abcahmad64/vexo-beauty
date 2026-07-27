import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  QueueExecutionCancellationUtil,
  QueueExecutionCancelledError,
} from '../../../core/queue/utils/queue-execution-cancellation.util';

import { AiBudgetEnforcementException } from '../errors/ai-budget-enforcement.exception';

import type {
  AiChatMessage,
  AiGenerateOptions,
} from '../interfaces/ai-provider.interface';
import type { AiBudgetEnforcementService } from '../services/ai-budget-enforcement.service';
import type { AiGuardrailService } from '../services/ai-guardrail.service';
import type {
  AiModelRoute,
  AiModelRouterService,
} from '../services/ai-model-router.service';
import type { AiResponseValidatorService } from '../services/ai-response-validator.service';
import type { AiRunLogService } from '../services/ai-run-log.service';
import type {
  OllamaChatResult,
  OllamaClientService,
} from '../services/ollama-client.service';

import { OllamaAiProvider } from './ollama-ai.provider';

const objectContaining = <T extends object>(value: T): T =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Jest asymmetric matcher types expose any; this boundary is test-only.
  expect.objectContaining(value) as unknown as T;

const arrayContaining = <T>(value: readonly T[]): T[] =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Jest asymmetric matcher types expose any; this boundary is test-only.
  expect.arrayContaining([...value]) as unknown as T[];

type ModelRouterMock = jest.Mocked<
  Pick<AiModelRouterService, 'resolve' | 'getFallbackModel'>
>;

type BudgetEnforcementMock = jest.Mocked<
  Pick<AiBudgetEnforcementService, 'estimateChat' | 'reserve' | 'reconcile'>
>;

type OllamaClientMock = jest.Mocked<Pick<OllamaClientService, 'chat'>>;

type GuardrailMock = jest.Mocked<
  Pick<AiGuardrailService, 'assertInputAllowed' | 'assertOutputAllowed'>
>;

type ResponseValidatorMock = jest.Mocked<
  Pick<AiResponseValidatorService, 'validateAndNormalize'>
>;

type RunLogMock = jest.Mocked<
  Pick<AiRunLogService, 'startRun' | 'markSuccess' | 'markFailure'>
>;

const messages: AiChatMessage[] = [
  {
    role: 'system',
    content: 'You are a sales assistant.',
  },
  {
    role: 'user',
    content: 'Recommend a product.',
  },
];

const primaryRoute: AiModelRoute = {
  provider: 'ollama',
  taskType: 'SALES',
  model: 'primary-model',
  temperature: 0.25,
  numPredict: 700,
  numCtx: 4096,
  timeoutMs: 180000,
  keepAlive: '30m',
  think: false,
};

const fallbackRoute: AiModelRoute = {
  provider: 'ollama',
  taskType: 'FALLBACK',
  model: 'fallback-route-model',
  temperature: 0.2,
  numPredict: 500,
  numCtx: 4096,
  timeoutMs: 180000,
  keepAlive: '30m',
  think: false,
};

const primaryResult: OllamaChatResult = {
  content: 'raw primary response',
  model: 'primary-model',
  raw: {
    source: 'primary',
  },
  tokenUsage: {
    promptEvalCount: 10,
    evalCount: 20,
  },
};

const fallbackResult: OllamaChatResult = {
  content: 'raw fallback response',
  model: 'fallback-model',
  raw: {
    source: 'fallback',
  },
  tokenUsage: {
    promptEvalCount: 11,
    evalCount: 21,
  },
};

describe('OllamaAiProvider', () => {
  let modelRouter: ModelRouterMock;
  let budgetEnforcement: BudgetEnforcementMock;
  let ollamaClient: OllamaClientMock;
  let guardrail: GuardrailMock;
  let responseValidator: ResponseValidatorMock;
  let runLog: RunLogMock;
  let provider: OllamaAiProvider;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(1050);

    modelRouter = {
      resolve: jest.fn().mockReturnValue(primaryRoute),
      getFallbackModel: jest.fn().mockReturnValue('fallback-model'),
    };

    budgetEnforcement = {
      estimateChat: jest.fn().mockReturnValue({
        pricingStatus: 'CALCULATED',
        estimatedCostMicros: '0',
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
      }),
      reserve: jest.fn().mockResolvedValue({
        version: '1.0.0',
        decision: 'ALLOW',
        reservationId: 'reservation-1',
        policyDecisions: [],
        estimate: {
          pricingStatus: 'CALCULATED',
          estimatedCostMicros: '0',
          estimatedInputTokens: 10,
          estimatedOutputTokens: 20,
        },
      }),
      reconcile: jest.fn().mockResolvedValue(undefined),
    };

    ollamaClient = {
      chat: jest.fn().mockResolvedValue(primaryResult),
    };

    guardrail = {
      assertInputAllowed: jest.fn().mockResolvedValue(undefined),
      assertOutputAllowed: jest.fn().mockResolvedValue(undefined),
    };

    responseValidator = {
      validateAndNormalize: jest
        .fn()
        .mockReturnValue('normalized primary response'),
    };

    runLog = {
      startRun: jest.fn().mockResolvedValue('run-1'),
      markSuccess: jest.fn().mockResolvedValue(undefined),
      markFailure: jest.fn().mockResolvedValue(undefined),
    };

    provider = new OllamaAiProvider(
      modelRouter as unknown as AiModelRouterService,
      budgetEnforcement as unknown as AiBudgetEnforcementService,
      ollamaClient as unknown as OllamaClientService,
      guardrail as unknown as AiGuardrailService,
      responseValidator as unknown as AiResponseValidatorService,
      runLog as unknown as AiRunLogService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('orchestrates and logs a successful primary-model response', async () => {
    const options: AiGenerateOptions = {
      task: 'sales',
      json: true,
      userId: 'user-1',
      promptKey: 'sales.prompt',
      metadata: {
        channel: 'web',
      },
    };

    const result = await provider.generate(messages, options);

    expect(modelRouter.resolve).toHaveBeenCalledWith(options);

    expect(runLog.startRun).toHaveBeenCalledWith({
      taskType: 'SALES',
      promptKey: 'sales.prompt',
      userId: 'user-1',
      provider: 'ollama',
      model: 'primary-model',
      inputJson: {
        task: 'sales',
        taskType: 'SALES',
        model: 'primary-model',
        json: true,
        structuredOutput: false,
        temperature: 0.25,
        think: false,
        numPredict: 700,
        numCtx: 4096,
        timeoutMs: 180000,
        keepAlive: '30m',
        metadata: {
          channel: 'web',
        },
        messages,
      },
    });

    expect(guardrail.assertInputAllowed).toHaveBeenCalledWith(
      messages,
      'SALES',
    );

    expect(ollamaClient.chat).toHaveBeenCalledWith({
      route: primaryRoute,
      messages,
      json: true,
      jsonSchema: undefined,
      signal: undefined,
    });

    expect(responseValidator.validateAndNormalize).toHaveBeenCalledWith({
      content: 'raw primary response',
      json: true,
      taskType: 'SALES',
    });

    expect(guardrail.assertOutputAllowed).toHaveBeenCalledWith(
      'normalized primary response',
      'SALES',
    );

    expect(runLog.markSuccess).toHaveBeenCalledWith('run-1', {
      outputJson: {
        content: 'normalized primary response',
        model: 'primary-model',
        fallbackUsed: false,
      },
      latencyMs: 50,
      providerAccounting: objectContaining({
        accountingVersion: '1.0.0',
        fallbackUsed: false,
        aggregateUsage: objectContaining({
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        }),
        aggregateCostMicros: '0',
      }),
      model: 'primary-model',
    });

    expect(result).toEqual(
      objectContaining({
        content: 'normalized primary response',
        model: 'primary-model',
        provider: 'ollama',
        taskType: 'SALES',
        latencyMs: 50,
        runLogId: 'run-1',
        usage: objectContaining({
          inputTokens: 10,
          outputTokens: 20,
        }),
        costAccounting: objectContaining({
          fallbackUsed: false,
          aggregateCostMicros: '0',
        }),
        raw: primaryResult.raw,
      }),
    );
  });

  it('truncates long message content only in the run log', async () => {
    const originalContent = 'x'.repeat(6001);

    const longMessages: AiChatMessage[] = [
      {
        role: 'user',
        content: originalContent,
      },
    ];

    await provider.generate(longMessages);

    const startInput = runLog.startRun.mock.calls[0][0];

    expect(startInput.inputJson).toEqual(
      objectContaining({
        messages: [
          {
            role: 'user',
            content: `${'x'.repeat(6000)}...`,
          },
        ],
      }),
    );

    expect(ollamaClient.chat).toHaveBeenCalledWith({
      route: primaryRoute,
      messages: longMessages,
      json: undefined,
      jsonSchema: undefined,
      signal: undefined,
    });

    expect(longMessages[0].content).toBe(originalContent);
  });

  it('does not retry input validation failures', async () => {
    const error = new BadRequestException('invalid prompt');

    guardrail.assertInputAllowed.mockRejectedValue(error);

    const request = provider.generate(messages);

    await expect(request).rejects.toBe(error);

    expect(ollamaClient.chat).not.toHaveBeenCalled();
    expect(modelRouter.getFallbackModel).not.toHaveBeenCalled();

    expect(runLog.markFailure).toHaveBeenCalledWith('run-1', {
      outputJson: {
        failedBeforeFallback: true,
        failedModel: 'primary-model',
        primaryError: 'invalid prompt',
      },
      latencyMs: 50,
      errorMessage: 'invalid prompt',
      providerAccounting: objectContaining({
        unpricedAttemptCount: 0,
        aggregateUsage: objectContaining({
          reported: false,
        }),
      }),
      status: 'FAILED',
      model: 'primary-model',
    });
  });

  it('does not retry forbidden guardrail failures', async () => {
    const error = new ForbiddenException('blocked output');

    guardrail.assertOutputAllowed.mockRejectedValue(error);

    const request = provider.generate(messages);

    await expect(request).rejects.toBe(error);

    expect(ollamaClient.chat).toHaveBeenCalledTimes(1);
    expect(modelRouter.getFallbackModel).not.toHaveBeenCalled();

    expect(runLog.markFailure).toHaveBeenCalledWith('run-1', {
      outputJson: {
        failedBeforeFallback: true,
        failedModel: 'primary-model',
        primaryError: 'blocked output',
      },
      latencyMs: 50,
      errorMessage: 'blocked output',
      providerAccounting: objectContaining({
        partialUsageAttemptCount: 1,
        aggregateUsage: objectContaining({
          inputTokens: 10,
          outputTokens: 20,
        }),
      }),
      status: 'FAILED',
      model: 'primary-model',
    });
  });

  it('blocks before the primary provider call without recording a fake attempt', async () => {
    const budgetError = new AiBudgetEnforcementException(
      'HARD_LIMIT_EXCEEDED',
      'budget blocked',
      {
        policyId: 'policy-1',
      },
    );

    budgetEnforcement.reserve.mockRejectedValueOnce(budgetError);

    const request = provider.generate(messages);

    await expect(request).rejects.toBe(budgetError);
    expect(ollamaClient.chat).not.toHaveBeenCalled();
    expect(budgetEnforcement.reconcile).not.toHaveBeenCalled();
    expect(runLog.markFailure).toHaveBeenCalledWith('run-1', {
      outputJson: {
        budgetBlocked: true,
        failedBeforeProviderCall: true,
        failedModel: 'primary-model',
        reason: 'HARD_LIMIT_EXCEEDED',
        details: {
          policyId: 'policy-1',
        },
      },
      latencyMs: 50,
      errorMessage: 'budget blocked',
      status: 'FAILED',
      model: 'primary-model',
    });
  });

  it('does not retry non-server HTTP failures', async () => {
    const error = new HttpException('rate limited', 429);

    ollamaClient.chat.mockRejectedValue(error);

    const request = provider.generate(messages);

    await expect(request).rejects.toBe(error);

    expect(modelRouter.resolve).toHaveBeenCalledTimes(1);
    expect(modelRouter.getFallbackModel).not.toHaveBeenCalled();

    expect(runLog.markFailure).toHaveBeenCalledWith('run-1', {
      outputJson: {
        failedBeforeFallback: true,
        failedModel: 'primary-model',
        primaryError: 'rate limited',
      },
      latencyMs: 50,
      errorMessage: 'rate limited',
      providerAccounting: objectContaining({
        aggregateUsage: objectContaining({
          reported: false,
        }),
      }),
      status: 'FAILED',
      model: 'primary-model',
    });
  });

  it('uses and logs the fallback model after a retryable failure', async () => {
    const options: AiGenerateOptions = {
      task: 'sales',
      json: true,
    };

    const primaryError = new HttpException('primary unavailable', 503);

    modelRouter.resolve
      .mockReturnValueOnce(primaryRoute)
      .mockReturnValueOnce(fallbackRoute);

    ollamaClient.chat
      .mockRejectedValueOnce(primaryError)
      .mockResolvedValueOnce(fallbackResult);

    responseValidator.validateAndNormalize.mockReturnValue(
      'normalized fallback response',
    );

    const result = await provider.generate(messages, options);

    expect(modelRouter.resolve).toHaveBeenNthCalledWith(1, options);
    expect(modelRouter.resolve).toHaveBeenNthCalledWith(2, {
      ...options,
      task: 'FALLBACK',
    });

    expect(modelRouter.getFallbackModel).toHaveBeenCalledTimes(1);

    expect(ollamaClient.chat).toHaveBeenNthCalledWith(1, {
      route: primaryRoute,
      messages,
      json: true,
      jsonSchema: undefined,
      signal: undefined,
    });

    expect(ollamaClient.chat).toHaveBeenNthCalledWith(2, {
      route: fallbackRoute,
      messages,
      json: true,
      jsonSchema: undefined,
      modelOverride: 'fallback-model',
      signal: undefined,
    });

    expect(responseValidator.validateAndNormalize).toHaveBeenCalledWith({
      content: 'raw fallback response',
      json: true,
      taskType: 'FALLBACK',
    });

    expect(guardrail.assertOutputAllowed).toHaveBeenCalledWith(
      'normalized fallback response',
      'FALLBACK',
    );

    expect(runLog.markSuccess).toHaveBeenCalledWith('run-1', {
      outputJson: {
        content: 'normalized fallback response',
        model: 'fallback-model',
        failedModel: 'primary-model',
        fallbackUsed: true,
        primaryError: 'primary unavailable',
      },
      latencyMs: 50,
      providerAccounting: objectContaining({
        fallbackUsed: true,
        aggregateUsage: objectContaining({
          inputTokens: 11,
          outputTokens: 21,
          totalTokens: 32,
        }),
        aggregateCostMicros: '0',
        attempts: arrayContaining([
          objectContaining({
            kind: 'PRIMARY',
            status: 'FAILED',
          }),
          objectContaining({
            kind: 'FALLBACK',
            status: 'SUCCESS',
          }),
        ]),
      }),
      model: 'fallback-model',
    });

    expect(runLog.markFailure).not.toHaveBeenCalled();

    expect(result).toEqual(
      objectContaining({
        content: 'normalized fallback response',
        model: 'fallback-model',
        provider: 'ollama',
        taskType: 'FALLBACK',
        latencyMs: 50,
        runLogId: 'run-1',
        usage: objectContaining({
          inputTokens: 11,
          outputTokens: 21,
        }),
        costAccounting: objectContaining({
          fallbackUsed: true,
          aggregateCostMicros: '0',
        }),
        raw: fallbackResult.raw,
      }),
    );
  });

  it('blocks fallback before its provider call and preserves only the real primary attempt', async () => {
    const primaryError = new HttpException('primary unavailable', 503);
    const budgetError = new AiBudgetEnforcementException(
      'HARD_LIMIT_EXCEEDED',
      'fallback budget blocked',
      {
        policyId: 'policy-fallback',
      },
    );
    const allowedReservation = {
      version: '1.0.0' as const,
      decision: 'ALLOW' as const,
      reservationId: 'reservation-primary',
      policyDecisions: [],
      estimate: {
        pricingStatus: 'CALCULATED' as const,
        estimatedCostMicros: '0',
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
      },
    };

    modelRouter.resolve
      .mockReturnValueOnce(primaryRoute)
      .mockReturnValueOnce(fallbackRoute);
    ollamaClient.chat.mockRejectedValueOnce(primaryError);
    budgetEnforcement.reserve
      .mockResolvedValueOnce(allowedReservation)
      .mockRejectedValueOnce(budgetError);

    const request = provider.generate(messages);

    await expect(request).rejects.toBe(budgetError);
    expect(ollamaClient.chat).toHaveBeenCalledTimes(1);
    expect(runLog.markFailure).toHaveBeenCalledWith('run-1', {
      outputJson: {
        budgetBlocked: true,
        failedBeforeFallbackProviderCall: true,
        failedModel: 'primary-model',
        fallbackModel: 'fallback-model',
        primaryError: 'primary unavailable',
        fallbackError: 'fallback budget blocked',
        reason: 'HARD_LIMIT_EXCEEDED',
        details: {
          policyId: 'policy-fallback',
        },
      },
      latencyMs: 50,
      errorMessage: 'fallback budget blocked',
      providerAccounting: objectContaining({
        fallbackUsed: false,
        attempts: [
          objectContaining({
            kind: 'PRIMARY',
            status: 'FAILED',
          }),
        ],
      }),
      status: 'FAILED',
      model: 'fallback-model',
    });
  });

  it('fails when the fallback model equals the failed model', async () => {
    ollamaClient.chat.mockRejectedValue(new Error('primary network error'));

    modelRouter.resolve
      .mockReturnValueOnce(primaryRoute)
      .mockReturnValueOnce(fallbackRoute);

    modelRouter.getFallbackModel.mockReturnValue('primary-model');

    const request = provider.generate(messages);

    await expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);

    await expect(request).rejects.toThrow(
      'سرویس هوش مصنوعی در حال حاضر در دسترس نیست.',
    );

    expect(ollamaClient.chat).toHaveBeenCalledTimes(1);

    expect(runLog.markFailure).toHaveBeenCalledWith('run-1', {
      outputJson: {
        fallbackAvailable: false,
        failedModel: 'primary-model',
        primaryError: 'primary network error',
      },
      latencyMs: 50,
      errorMessage:
        'Fallback model is not configured or equals the failed model.',
      providerAccounting: objectContaining({
        fallbackUsed: false,
      }),
      status: 'FAILED',
      model: 'primary-model',
    });
  });

  it('records cancellation accounting without fallback or dead-letter semantics', async () => {
    const controller = new AbortController();
    const cancellation = QueueExecutionCancellationUtil.createRequest({
      jobId: 'ai-job-cancelled',
      actorId: 'admin-1',
      reason: 'cancelled by admin',
      stateAtRequest: 'active',
      data: {
        task: 'provider.generate',
        metadata: {
          createdAt: '2026-07-23T00:00:00.000Z',
          executionId: 'execution-cancelled',
          correlationId: 'correlation-cancelled',
          requestId: 'request-cancelled',
        },
      },
    });
    const cancellationError = new QueueExecutionCancelledError(cancellation);

    controller.abort(
      QueueExecutionCancellationUtil.serializeSignalReason(cancellation),
    );
    ollamaClient.chat.mockRejectedValue(cancellationError);

    const request = provider.generate(messages, {
      signal: controller.signal,
      metadata: {
        executionId: 'execution-cancelled',
        correlationId: 'correlation-cancelled',
        requestId: 'request-cancelled',
      },
    });

    await expect(request).rejects.toBe(cancellationError);
    expect(modelRouter.getFallbackModel).not.toHaveBeenCalled();
    expect(runLog.markFailure).toHaveBeenCalledWith(
      'run-1',
      objectContaining({
        status: 'CANCELLED',
        providerAccounting: objectContaining({
          cancelledAttemptCount: 1,
          fallbackUsed: false,
        }),
      }),
    );
  });

  it('logs both errors when the fallback request also fails', async () => {
    modelRouter.resolve
      .mockReturnValueOnce(primaryRoute)
      .mockReturnValueOnce(fallbackRoute);

    ollamaClient.chat
      .mockRejectedValueOnce(new Error('primary network error'))
      .mockRejectedValueOnce(new Error('fallback network error'));

    const request = provider.generate(messages);

    await expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);

    await expect(request).rejects.toThrow(
      'سرویس هوش مصنوعی در حال حاضر در دسترس نیست.',
    );

    expect(runLog.markSuccess).not.toHaveBeenCalled();

    expect(runLog.markFailure).toHaveBeenCalledWith('run-1', {
      outputJson: {
        failedModel: 'primary-model',
        fallbackModel: 'fallback-model',
        primaryError: 'primary network error',
        fallbackError: 'fallback network error',
      },
      latencyMs: 50,
      errorMessage: 'fallback network error',
      providerAccounting: objectContaining({
        fallbackUsed: true,
        attempts: arrayContaining([
          objectContaining({
            kind: 'PRIMARY',
            status: 'FAILED',
          }),
          objectContaining({
            kind: 'FALLBACK',
            status: 'FAILED',
          }),
        ]),
      }),
      status: 'FAILED',
      model: 'fallback-model',
    });
  });
});
