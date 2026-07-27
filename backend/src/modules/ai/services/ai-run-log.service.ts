import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { AiProviderCostAccountingSummary } from '../interfaces/ai-provider-cost-accounting.interface';

import { AiCanonicalTaskType } from '../interfaces/ai-provider.interface';

export interface AiRunStartInput {
  taskType: AiCanonicalTaskType;
  promptKey?: string;
  userId?: string;
  provider?: string;
  model?: string;
  inputJson?: unknown;
}

export interface AiRunSuccessInput {
  outputJson?: unknown;
  latencyMs: number;
  tokenUsageJson?: unknown;
  providerAccounting?: AiProviderCostAccountingSummary;
  model?: string;
}

export interface AiRunFailureInput {
  outputJson?: unknown;
  latencyMs: number;
  errorMessage: string;
  tokenUsageJson?: unknown;
  providerAccounting?: AiProviderCostAccountingSummary;
  status?: 'FAILED' | 'CANCELLED';
  model?: string;
}

@Injectable()
export class AiRunLogService {
  private readonly logger = new Logger(AiRunLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startRun(input: AiRunStartInput): Promise<string | null> {
    try {
      const run = await this.prisma.aiRunLog.create({
        data: {
          taskType: input.taskType,
          promptKey: input.promptKey ?? null,
          userId: input.userId ?? null,
          provider: input.provider ?? null,
          model: input.model ?? null,
          inputJson: this.toInputJson(input.inputJson ?? {}),
          outputJson: {},
          status: 'RUNNING',
        },
        select: {
          id: true,
        },
      });

      return run.id;
    } catch (error) {
      this.logger.error(
        'Failed to create AI run log.',
        error instanceof Error ? error.stack : String(error),
      );

      return null;
    }
  }

  async markSuccess(
    runLogId: string | null,
    input: AiRunSuccessInput,
  ): Promise<void> {
    if (!runLogId) {
      return;
    }

    try {
      await this.prisma.aiRunLog.update({
        where: {
          id: runLogId,
        },
        data: {
          status: 'SUCCESS',
          outputJson: this.toInputJson(input.outputJson ?? {}),
          latencyMs: Math.trunc(input.latencyMs),
          tokenUsageJson:
            input.providerAccounting !== undefined
              ? this.toInputJson(input.providerAccounting)
              : input.tokenUsageJson === undefined
                ? undefined
                : this.toInputJson(input.tokenUsageJson),
          model: input.model,
          errorMessage: null,
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to update successful AI run log.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async markFailure(
    runLogId: string | null,
    input: AiRunFailureInput,
  ): Promise<void> {
    if (!runLogId) {
      return;
    }

    try {
      await this.prisma.aiRunLog.update({
        where: {
          id: runLogId,
        },
        data: {
          status: input.status ?? 'FAILED',
          outputJson: this.toInputJson(input.outputJson ?? {}),
          latencyMs: Math.trunc(input.latencyMs),
          tokenUsageJson:
            input.providerAccounting !== undefined
              ? this.toInputJson(input.providerAccounting)
              : input.tokenUsageJson === undefined
                ? undefined
                : this.toInputJson(input.tokenUsageJson),
          model: input.model,
          errorMessage: input.errorMessage.slice(0, 2000),
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to update failed AI run log.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
    } catch {
      return {
        unserializable: true,
      };
    }
  }
}
