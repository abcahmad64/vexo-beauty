import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import type { QueryAiModelRolloutReportDto } from '../dto/admin-ai-model-rollout.dto';
import type {
  AiModelRolloutDecision,
  AiModelRolloutRecord,
} from '../interfaces/ai-model-rollout-canary.interface';
import { AiModelRolloutCanaryService } from './ai-model-rollout-canary.service';

type Run = {
  status: string;
  latencyMs: number | null;
  tokenUsageJson: unknown;
};

@Injectable()
export class AiModelRolloutReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rollouts: AiModelRolloutCanaryService,
  ) {}

  async getReport(id: string, query: QueryAiModelRolloutReportDto = {}) {
    const rollout = await this.rollouts.findRollout(id);
    const rows = await this.prisma.aiRunLog.findMany({
      where: {
        deletedAt: null,
        ...(rollout.taskType ? { taskType: rollout.taskType } : {}),
        ...(query.createdFrom || query.createdTo
          ? {
              createdAt: {
                ...(query.createdFrom
                  ? { gte: new Date(query.createdFrom) }
                  : {}),
                ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
              },
            }
          : {}),
        OR: [
          { provider: rollout.baselineProvider, model: rollout.baselineModel },
          {
            provider: rollout.candidateProvider,
            model: rollout.candidateModel,
          },
        ],
      },
      select: {
        provider: true,
        model: true,
        status: true,
        latencyMs: true,
        tokenUsageJson: true,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 5000,
    });

    const baselineRows = rows.filter(
      (r) =>
        r.provider === rollout.baselineProvider &&
        r.model === rollout.baselineModel,
    );
    const candidateRows = rows.filter(
      (r) =>
        r.provider === rollout.candidateProvider &&
        r.model === rollout.candidateModel,
    );
    const baseline = this.metrics(baselineRows);
    const candidate = this.metrics(candidateRows);
    const comparison = this.compare(rollout, baseline, candidate);
    return {
      version: '1.0.0',
      rolloutId: rollout.id,
      mode: 'OBSERVABILITY_AND_RECOMMENDATION_ONLY',
      routingMutation: false,
      automaticRollback: false,
      baseline,
      candidate,
      comparison,
    };
  }

  private metrics(rows: Run[]) {
    const terminal = rows.filter((r) =>
      ['SUCCESS', 'FAILED', 'CANCELLED'].includes(r.status),
    );
    const failed = terminal.filter((r) => r.status !== 'SUCCESS').length;
    const latencies = terminal
      .map((r) => r.latencyMs)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const costs = terminal
      .map((r) => this.costMicros(r.tokenUsageJson))
      .filter((v): v is bigint => v != null);
    return {
      sampleSize: terminal.length,
      successCount: terminal.length - failed,
      failureCount: failed,
      failureRatePercent: terminal.length
        ? (failed / terminal.length) * 100
        : null,
      p95LatencyMs: latencies.length
        ? latencies[Math.ceil(latencies.length * 0.95) - 1]
        : null,
      averageCostMicros: costs.length
        ? (costs.reduce((a, b) => a + b, 0n) / BigInt(costs.length)).toString()
        : null,
    };
  }

  private compare(
    rollout: AiModelRolloutRecord,
    baseline: ReturnType<typeof this.metrics>,
    candidate: ReturnType<typeof this.metrics>,
  ) {
    if (
      baseline.sampleSize < rollout.minimumSampleSize ||
      candidate.sampleSize < rollout.minimumSampleSize
    ) {
      return this.decision('INSUFFICIENT_DATA', [
        'minimum_sample_size_not_met',
      ]);
    }
    const reasons: string[] = [];
    const failureIncrease = this.relativeIncrease(
      baseline.failureRatePercent,
      candidate.failureRatePercent,
    );
    const latencyIncrease = this.relativeIncrease(
      baseline.p95LatencyMs,
      candidate.p95LatencyMs,
    );
    const costIncrease = this.relativeBigIntIncrease(
      baseline.averageCostMicros,
      candidate.averageCostMicros,
    );
    if (
      failureIncrease != null &&
      failureIncrease > rollout.maxFailureRateIncreasePercent
    )
      reasons.push('failure_rate_regression');
    if (
      latencyIncrease != null &&
      latencyIncrease > rollout.maxP95LatencyIncreasePercent
    )
      reasons.push('p95_latency_regression');
    if (
      rollout.maxCostIncreasePercent != null &&
      costIncrease != null &&
      costIncrease > rollout.maxCostIncreasePercent
    )
      reasons.push('cost_regression');
    const decision: AiModelRolloutDecision =
      reasons.length >= 2
        ? 'ROLLBACK_RECOMMENDED'
        : reasons.length === 1
          ? 'HOLD'
          : 'CONTINUE';
    return {
      ...this.decision(decision, reasons),
      failureRateIncreasePercent: failureIncrease,
      p95LatencyIncreasePercent: latencyIncrease,
      costIncreasePercent: costIncrease,
    };
  }

  private decision(decision: AiModelRolloutDecision, reasons: string[]) {
    return {
      decision,
      reasons,
      trafficChangeRecommended:
        decision === 'CONTINUE' ? 'REVIEW_FOR_INCREMENT' : 'NO_CHANGE',
      automaticTrafficChange: false,
      automaticRollback: false,
      incidentCreation: false,
    };
  }
  private relativeIncrease(base: number | null, candidate: number | null) {
    if (base == null || candidate == null) return null;
    if (base === 0) return candidate === 0 ? 0 : 1000;
    return ((candidate - base) / base) * 100;
  }
  private relativeBigIntIncrease(
    base: string | null,
    candidate: string | null,
  ) {
    if (base == null || candidate == null) return null;
    const b = BigInt(base),
      c = BigInt(candidate);
    if (b === 0n) return c === 0n ? 0 : 1000;
    return Number(((c - b) * 10000n) / b) / 100;
  }
  private costMicros(value: unknown): bigint | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const raw = (value as Record<string, unknown>).aggregateCostMicros;
    return typeof raw === 'string' && /^\d+$/.test(raw) ? BigInt(raw) : null;
  }
}
