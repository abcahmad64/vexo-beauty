import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { QueueExecutionCancellationUtil } from '../../../core/queue/utils/queue-execution-cancellation.util';

import { AiBudgetEnforcementException } from '../errors/ai-budget-enforcement.exception';

import type { AiProviderCostAccountingAttempt } from '../interfaces/ai-provider-cost-accounting.interface';

import {
  AiChatMessage,
  AiGenerateOptions,
  AiProvider,
  AiProviderResult,
} from '../interfaces/ai-provider.interface';

import { AiBudgetEnforcementService } from '../services/ai-budget-enforcement.service';

import { AiGuardrailService } from '../services/ai-guardrail.service';

import { AiModelRouterService } from '../services/ai-model-router.service';

import { AiProviderCostAccountingUtil } from '../services/ai-provider-cost-accounting.util';

import { AiResponseValidatorService } from '../services/ai-response-validator.service';

import { AiRunLogService } from '../services/ai-run-log.service';

import { OllamaClientService } from '../services/ollama-client.service';

@Injectable()
export class OllamaAiProvider implements AiProvider {
  constructor(
    private readonly modelRouter: AiModelRouterService,
    private readonly budgetEnforcement: AiBudgetEnforcementService,
    private readonly ollamaClient: OllamaClientService,
    private readonly guardrail: AiGuardrailService,
    private readonly responseValidator: AiResponseValidatorService,
    private readonly runLog: AiRunLogService,
  ) {}

  async generate(
    messages: AiChatMessage[],
    options: AiGenerateOptions = {},
  ): Promise<AiProviderResult> {
    const route = this.modelRouter.resolve(options);
    const startedAt = Date.now();
    let primaryRawUsage: unknown;
    let primaryResolvedModel = route.model;
    let primaryReservationId: string | null = null;

    const runLogId = await this.runLog.startRun({
      taskType: route.taskType,
      promptKey: options.promptKey,
      userId: options.userId,
      provider: route.provider,
      model: route.model,
      inputJson: {
        task: options.task ?? route.taskType,
        taskType: route.taskType,
        model: route.model,
        json: options.json === true || options.jsonSchema !== undefined,
        temperature: route.temperature,
        numPredict: route.numPredict,
        numCtx: route.numCtx,
        timeoutMs: route.timeoutMs,
        keepAlive: route.keepAlive,
        think: route.think,
        structuredOutput: options.jsonSchema !== undefined,
        metadata: options.metadata ?? {},
        messages: this.sanitizeMessagesForLog(messages),
      },
    });

    try {
      await this.guardrail.assertInputAllowed(messages, route.taskType);

      const primaryReservation = await this.budgetEnforcement.reserve({
        runLogId,
        taskType: route.taskType,
        userId: options.userId,
        provider: route.provider,
        model: route.model,
        metadata: options.metadata,
        estimate: this.budgetEnforcement.estimateChat({
          provider: route.provider,
          model: route.model,
          messages,
          maxOutputTokens: route.numPredict,
        }),
        attemptSequence: 1,
        attemptKind: 'PRIMARY',
      });
      primaryReservationId = primaryReservation.reservationId;

      const result = await this.ollamaClient.chat({
        route,
        messages,
        json: options.json,
        jsonSchema: options.jsonSchema,
        signal: options.signal,
      });

      primaryRawUsage = result.tokenUsage;
      primaryResolvedModel = result.model;

      const normalizedContent = this.responseValidator.validateAndNormalize({
        content: result.content,
        json: options.json === true || options.jsonSchema !== undefined,
        taskType: route.taskType,
      });

      await this.guardrail.assertOutputAllowed(
        normalizedContent,
        route.taskType,
      );

      const latencyMs = Date.now() - startedAt;
      const primaryAttempt = this.createAccountingAttempt({
        sequence: 1,
        kind: 'PRIMARY',
        status: 'SUCCESS',
        provider: route.provider,
        model: result.model,
        rawUsage: result.tokenUsage,
        metadata: options.metadata,
        taskType: route.taskType,
      });
      await this.budgetEnforcement.reconcile({
        runLogId,
        reservationId: primaryReservationId,
        providerAttempt: primaryAttempt,
      });
      const providerAccounting = AiProviderCostAccountingUtil.summarize([
        primaryAttempt,
      ]);

      await this.runLog.markSuccess(runLogId, {
        outputJson: {
          content: normalizedContent,
          model: result.model,
          fallbackUsed: false,
        },
        latencyMs,
        providerAccounting,
        model: result.model,
      });

      return {
        content: normalizedContent,
        model: result.model,
        provider: route.provider,
        taskType: route.taskType,
        latencyMs,
        runLogId: runLogId ?? undefined,
        usage: primaryAttempt.usage,
        costAccounting: providerAccounting,
        raw: result.raw,
      };
    } catch (error) {
      const primaryErrorMessage = this.getErrorMessage(error);

      if (AiBudgetEnforcementException.isBudgetEnforcementException(error)) {
        await this.runLog.markFailure(runLogId, {
          outputJson: {
            budgetBlocked: true,
            failedBeforeProviderCall: true,
            failedModel: route.model,
            reason: error.reason,
            details: error.details,
          },
          latencyMs: Date.now() - startedAt,
          errorMessage: primaryErrorMessage,
          status: 'FAILED',
          model: route.model,
        });

        throw error;
      }

      const primaryStatus = this.resolveAccountingStatus(error, options.signal);
      const primaryAttempt = this.createAccountingAttempt({
        sequence: 1,
        kind: 'PRIMARY',
        status: primaryStatus,
        provider: route.provider,
        model: primaryResolvedModel,
        rawUsage: primaryRawUsage,
        metadata: options.metadata,
        taskType: route.taskType,
      });

      await this.budgetEnforcement.reconcile({
        runLogId,
        reservationId: primaryReservationId,
        providerAttempt: primaryAttempt,
      });

      if (this.shouldTryFallback(error, options.signal)) {
        return this.generateWithFallback(
          messages,
          options,
          runLogId,
          startedAt,
          route.model,
          primaryErrorMessage,
          primaryAttempt,
          route.taskType,
        );
      }

      const providerAccounting = AiProviderCostAccountingUtil.summarize([
        primaryAttempt,
      ]);

      await this.runLog.markFailure(runLogId, {
        outputJson: {
          failedBeforeFallback: true,
          failedModel: route.model,
          primaryError: primaryErrorMessage,
        },
        latencyMs: Date.now() - startedAt,
        errorMessage: primaryErrorMessage,
        providerAccounting,
        status: primaryStatus,
        model: route.model,
      });

      throw error;
    }
  }

  private async generateWithFallback(
    messages: AiChatMessage[],
    options: AiGenerateOptions,
    runLogId: string | null,
    startedAt: number,
    failedModel: string,
    primaryErrorMessage: string,
    primaryAttempt: AiProviderCostAccountingAttempt,
    originalTaskType: string,
  ): Promise<AiProviderResult> {
    const route = this.modelRouter.resolve({
      ...options,
      task: 'FALLBACK',
    });

    const fallbackModel = this.modelRouter.getFallbackModel();

    if (!fallbackModel || fallbackModel === failedModel) {
      const providerAccounting = AiProviderCostAccountingUtil.summarize([
        primaryAttempt,
      ]);

      await this.runLog.markFailure(runLogId, {
        outputJson: {
          fallbackAvailable: false,
          failedModel,
          primaryError: primaryErrorMessage,
        },
        latencyMs: Date.now() - startedAt,
        errorMessage:
          'Fallback model is not configured or equals the failed model.',
        providerAccounting,
        status: 'FAILED',
        model: failedModel,
      });

      throw new ServiceUnavailableException(
        'سرویس هوش مصنوعی در حال حاضر در دسترس نیست.',
      );
    }

    let fallbackRawUsage: unknown;
    let fallbackResolvedModel = fallbackModel;
    let fallbackReservationId: string | null = null;

    try {
      const fallbackReservation = await this.budgetEnforcement.reserve({
        runLogId,
        taskType: originalTaskType,
        userId: options.userId,
        provider: route.provider,
        model: fallbackModel,
        metadata: options.metadata,
        estimate: this.budgetEnforcement.estimateChat({
          provider: route.provider,
          model: fallbackModel,
          messages,
          maxOutputTokens: route.numPredict,
        }),
        attemptSequence: 2,
        attemptKind: 'FALLBACK',
      });
      fallbackReservationId = fallbackReservation.reservationId;

      const result = await this.ollamaClient.chat({
        route,
        messages,
        json: options.json,
        jsonSchema: options.jsonSchema,
        modelOverride: fallbackModel,
        signal: options.signal,
      });

      fallbackRawUsage = result.tokenUsage;
      fallbackResolvedModel = result.model;

      const normalizedContent = this.responseValidator.validateAndNormalize({
        content: result.content,
        json: options.json === true || options.jsonSchema !== undefined,
        taskType: 'FALLBACK',
      });

      await this.guardrail.assertOutputAllowed(normalizedContent, 'FALLBACK');

      const latencyMs = Date.now() - startedAt;
      const fallbackAttempt = this.createAccountingAttempt({
        sequence: 2,
        kind: 'FALLBACK',
        status: 'SUCCESS',
        provider: route.provider,
        model: result.model,
        rawUsage: result.tokenUsage,
        metadata: options.metadata,
        taskType: 'FALLBACK',
      });
      await this.budgetEnforcement.reconcile({
        runLogId,
        reservationId: fallbackReservationId,
        providerAttempt: fallbackAttempt,
      });
      const providerAccounting = AiProviderCostAccountingUtil.summarize([
        primaryAttempt,
        fallbackAttempt,
      ]);

      await this.runLog.markSuccess(runLogId, {
        outputJson: {
          content: normalizedContent,
          model: result.model,
          failedModel,
          fallbackUsed: true,
          primaryError: primaryErrorMessage,
        },
        latencyMs,
        providerAccounting,
        model: result.model,
      });

      return {
        content: normalizedContent,
        model: result.model,
        provider: route.provider,
        taskType: 'FALLBACK',
        latencyMs,
        runLogId: runLogId ?? undefined,
        usage: fallbackAttempt.usage,
        costAccounting: providerAccounting,
        raw: result.raw,
      };
    } catch (fallbackError) {
      const fallbackErrorMessage = this.getErrorMessage(fallbackError);

      if (
        AiBudgetEnforcementException.isBudgetEnforcementException(fallbackError)
      ) {
        const providerAccounting = AiProviderCostAccountingUtil.summarize([
          primaryAttempt,
        ]);

        await this.runLog.markFailure(runLogId, {
          outputJson: {
            budgetBlocked: true,
            failedBeforeFallbackProviderCall: true,
            failedModel,
            fallbackModel,
            primaryError: primaryErrorMessage,
            fallbackError: fallbackErrorMessage,
            reason: fallbackError.reason,
            details: fallbackError.details,
          },
          latencyMs: Date.now() - startedAt,
          errorMessage: fallbackErrorMessage,
          providerAccounting,
          status: 'FAILED',
          model: fallbackModel,
        });

        throw fallbackError;
      }

      const fallbackStatus = this.resolveAccountingStatus(
        fallbackError,
        options.signal,
      );
      const fallbackAttempt = this.createAccountingAttempt({
        sequence: 2,
        kind: 'FALLBACK',
        status: fallbackStatus,
        provider: route.provider,
        model: fallbackResolvedModel,
        rawUsage: fallbackRawUsage,
        metadata: options.metadata,
        taskType: 'FALLBACK',
      });
      await this.budgetEnforcement.reconcile({
        runLogId,
        reservationId: fallbackReservationId,
        providerAttempt: fallbackAttempt,
      });
      const providerAccounting = AiProviderCostAccountingUtil.summarize([
        primaryAttempt,
        fallbackAttempt,
      ]);

      await this.runLog.markFailure(runLogId, {
        outputJson: {
          failedModel,
          fallbackModel,
          primaryError: primaryErrorMessage,
          fallbackError: fallbackErrorMessage,
        },
        latencyMs: Date.now() - startedAt,
        errorMessage: fallbackErrorMessage,
        providerAccounting,
        status: fallbackStatus,
        model: fallbackModel,
      });

      if (fallbackStatus === 'CANCELLED') {
        throw fallbackError;
      }

      throw new ServiceUnavailableException(
        'سرویس هوش مصنوعی در حال حاضر در دسترس نیست.',
      );
    }
  }

  private createAccountingAttempt(input: {
    sequence: number;
    kind: 'PRIMARY' | 'FALLBACK';
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
    provider: string;
    model: string;
    rawUsage?: unknown;
    metadata?: Record<string, unknown>;
    taskType: string;
  }): AiProviderCostAccountingAttempt {
    return AiProviderCostAccountingUtil.createAttempt({
      ...input,
      usageSource: 'OLLAMA_CHAT',
    });
  }

  private resolveAccountingStatus(
    error: unknown,
    signal?: AbortSignal,
  ): 'FAILED' | 'CANCELLED' {
    return QueueExecutionCancellationUtil.isCancellation(error, signal)
      ? 'CANCELLED'
      : 'FAILED';
  }

  private shouldTryFallback(error: unknown, signal?: AbortSignal): boolean {
    if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
      return false;
    }
    if (
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      return false;
    }

    if (error instanceof HttpException) {
      return error.getStatus() >= 500;
    }

    return true;
  }

  private sanitizeMessagesForLog(messages: AiChatMessage[]): AiChatMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content:
        message.content.length > 6000
          ? `${message.content.slice(0, 6000)}...`
          : message.content,
    }));
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
