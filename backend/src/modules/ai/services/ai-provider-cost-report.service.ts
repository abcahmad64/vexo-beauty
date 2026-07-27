import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { QueryAiProviderCostReportDto } from '../../admin/dto/query-ai-provider-cost-report.dto';

import { AI_PROVIDER_COST_ACCOUNTING_VERSION } from '../interfaces/ai-provider-cost-accounting.interface';

import type { AiProviderCostAccountingSummary } from '../interfaces/ai-provider-cost-accounting.interface';

export const AI_PROVIDER_COST_REPORT_VERSION = '1.0.0';

interface CostAccumulator {
  runCount: number;
  attemptCount: number;
  pricedAttemptCount: number;
  unpricedAttemptCount: number;
  cancelledAttemptCount: number;
  fallbackRunCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalCostMicros: bigint;
}

interface ProviderModelAccumulator extends CostAccumulator {
  provider: string;
  model: string;
}

interface CorrelationAccumulator extends CostAccumulator {
  correlationId: string;
}

@Injectable()
export class AiProviderCostReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(query: QueryAiProviderCostReportDto) {
    const rows = await this.prisma.aiRunLog.findMany({
      where: {
        deletedAt: null,
        ...(query.createdFrom || query.createdTo
          ? {
              createdAt: {
                ...(query.createdFrom
                  ? {
                      gte: new Date(query.createdFrom),
                    }
                  : {}),
                ...(query.createdTo
                  ? {
                      lte: new Date(query.createdTo),
                    }
                  : {}),
              },
            }
          : {}),
        ...(query.provider
          ? {
              provider: query.provider,
            }
          : {}),
        ...(query.model
          ? {
              model: query.model,
            }
          : {}),
        ...(query.taskType
          ? {
              taskType: query.taskType,
            }
          : {}),
        ...(query.status
          ? {
              status: query.status,
            }
          : {}),
      },
      select: {
        id: true,
        taskType: true,
        promptKey: true,
        userId: true,
        provider: true,
        model: true,
        status: true,
        latencyMs: true,
        tokenUsageJson: true,
        inputJson: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 500,
    });

    const totals = this.createAccumulator();
    const byProviderModel = new Map<string, ProviderModelAccumulator>();
    const byCorrelation = new Map<string, CorrelationAccumulator>();
    const recentRuns: Array<Record<string, unknown>> = [];
    let accountingRunCount = 0;
    let legacyOrUnaccountedRunCount = 0;

    for (const row of rows) {
      const summary = this.parseSummary(row.tokenUsageJson);

      if (!summary) {
        legacyOrUnaccountedRunCount += 1;
        continue;
      }

      accountingRunCount += 1;
      this.addSummary(totals, summary);

      const provider =
        row.provider ?? summary.attempts[0]?.provider ?? 'unknown';
      const model = row.model ?? summary.attempts[0]?.model ?? 'unknown';
      const providerModelKey = `${provider}\u0000${model}`;
      const providerModel = byProviderModel.get(providerModelKey) ?? {
        provider,
        model,
        ...this.createAccumulator(),
      };

      this.addSummary(providerModel, summary);
      byProviderModel.set(providerModelKey, providerModel);

      const correlationId =
        summary.lineage.correlationId ??
        this.readMetadataString(row.inputJson, 'correlationId') ??
        'unattributed';
      const correlation = byCorrelation.get(correlationId) ?? {
        correlationId,
        ...this.createAccumulator(),
      };

      this.addSummary(correlation, summary);
      byCorrelation.set(correlationId, correlation);

      if (recentRuns.length < 100) {
        recentRuns.push({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          taskType: row.taskType,
          promptKey: row.promptKey,
          userId: row.userId,
          provider,
          model,
          status: row.status,
          latencyMs: row.latencyMs,
          accountingVersion: summary.accountingVersion,
          pricingCatalogVersion: summary.pricingCatalogVersion,
          lineage: summary.lineage,
          attemptCount: summary.attempts.length,
          fallbackUsed: summary.fallbackUsed,
          aggregateUsage: summary.aggregateUsage,
          aggregateCostMicros: summary.aggregateCostMicros,
          aggregateCostUsd: this.formatUsd(BigInt(summary.aggregateCostMicros)),
          unpricedAttemptCount: summary.unpricedAttemptCount,
        });
      }
    }

    return {
      version: AI_PROVIDER_COST_REPORT_VERSION,
      accountingVersion: AI_PROVIDER_COST_ACCOUNTING_VERSION,
      currency: 'USD',
      costBasis: 'PROVIDER_TOKEN_FEE_ONLY',
      readOnly: true,
      filters: {
        createdFrom: query.createdFrom ?? null,
        createdTo: query.createdTo ?? null,
        provider: query.provider ?? null,
        model: query.model ?? null,
        taskType: query.taskType ?? null,
        status: query.status ?? null,
        limit: query.limit ?? 500,
      },
      metrics: {
        queriedRunCount: rows.length,
        accountingRunCount,
        legacyOrUnaccountedRunCount,
        ...this.serializeAccumulator(totals),
      },
      byProviderModel: [...byProviderModel.values()]
        .map((item) => ({
          provider: item.provider,
          model: item.model,
          ...this.serializeAccumulator(item),
        }))
        .sort((left, right) =>
          this.compareMicrosDescending(
            left.totalCostMicros,
            right.totalCostMicros,
          ),
        ),
      byCorrelation: [...byCorrelation.values()]
        .map((item) => ({
          correlationId: item.correlationId,
          ...this.serializeAccumulator(item),
        }))
        .sort((left, right) => right.runCount - left.runCount),
      recentRuns,
    };
  }

  private parseSummary(value: unknown): AiProviderCostAccountingSummary | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Partial<AiProviderCostAccountingSummary>;

    if (
      candidate.accountingVersion !== AI_PROVIDER_COST_ACCOUNTING_VERSION ||
      !Array.isArray(candidate.attempts) ||
      !candidate.aggregateUsage ||
      typeof candidate.aggregateCostMicros !== 'string' ||
      !candidate.lineage
    ) {
      return null;
    }

    return candidate as AiProviderCostAccountingSummary;
  }

  private addSummary(
    target: CostAccumulator,
    summary: AiProviderCostAccountingSummary,
  ): void {
    target.runCount += 1;
    target.attemptCount += summary.attempts.length;
    target.pricedAttemptCount += summary.pricedAttemptCount;
    target.unpricedAttemptCount += summary.unpricedAttemptCount;
    target.cancelledAttemptCount += summary.cancelledAttemptCount;
    target.fallbackRunCount += summary.fallbackUsed ? 1 : 0;
    target.inputTokens += summary.aggregateUsage.inputTokens;
    target.outputTokens += summary.aggregateUsage.outputTokens;
    target.totalTokens += summary.aggregateUsage.totalTokens;
    target.cachedInputTokens += summary.aggregateUsage.cachedInputTokens;
    target.cacheWriteTokens += summary.aggregateUsage.cacheWriteTokens;
    target.reasoningTokens += summary.aggregateUsage.reasoningTokens;
    target.totalCostMicros += BigInt(summary.aggregateCostMicros);
  }

  private createAccumulator(): CostAccumulator {
    return {
      runCount: 0,
      attemptCount: 0,
      pricedAttemptCount: 0,
      unpricedAttemptCount: 0,
      cancelledAttemptCount: 0,
      fallbackRunCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      totalCostMicros: 0n,
    };
  }

  private serializeAccumulator(accumulator: CostAccumulator) {
    return {
      runCount: accumulator.runCount,
      attemptCount: accumulator.attemptCount,
      pricedAttemptCount: accumulator.pricedAttemptCount,
      unpricedAttemptCount: accumulator.unpricedAttemptCount,
      cancelledAttemptCount: accumulator.cancelledAttemptCount,
      fallbackRunCount: accumulator.fallbackRunCount,
      inputTokens: accumulator.inputTokens,
      outputTokens: accumulator.outputTokens,
      totalTokens: accumulator.totalTokens,
      cachedInputTokens: accumulator.cachedInputTokens,
      cacheWriteTokens: accumulator.cacheWriteTokens,
      reasoningTokens: accumulator.reasoningTokens,
      totalCostMicros: accumulator.totalCostMicros.toString(),
      totalCostUsd: this.formatUsd(accumulator.totalCostMicros),
    };
  }

  private compareMicrosDescending(left: string, right: string): number {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);

    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue > rightValue ? -1 : 1;
  }

  private formatUsd(micros: bigint): string {
    const whole = micros / 1_000_000n;
    const fraction = (micros % 1_000_000n).toString().padStart(6, '0');

    return `${whole.toString()}.${fraction}`;
  }

  private readMetadataString(value: unknown, key: string): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const metadata = (value as Record<string, unknown>).metadata;

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const candidate = (metadata as Record<string, unknown>)[key];

    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim()
      : null;
  }
}
