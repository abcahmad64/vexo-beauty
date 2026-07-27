import { Injectable, Optional } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  QueueMonitorService,
  type QueueStatusReport,
} from '../../../core/queue/services/queue-monitor.service';
import type { QueryAiSloReportDto } from '../dto/admin-ai-slo-policy.dto';
import {
  AI_SLO_ERROR_BUDGET_VERSION,
  type AiSloDecision,
  type AiSloPolicyRecord,
} from '../interfaces/ai-slo-error-budget.interface';
import { AiAlertRunbookResolverService } from './ai-alert-runbook-resolver.service';
import { AiSloPolicyService } from './ai-slo-policy.service';
import { AiSloPolicyUtil } from './ai-slo-policy.util';

interface AiSloRunRow {
  readonly id: string;
  readonly taskType: string;
  readonly userId: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly status: string;
  readonly latencyMs: number | null;
  readonly inputJson: unknown;
  readonly createdAt: Date;
}

@Injectable()
export class AiSloErrorBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: AiSloPolicyService,
    @Optional() private readonly queueMonitor?: QueueMonitorService,
    @Optional()
    private readonly runbookResolver?: AiAlertRunbookResolverService,
  ) {}

  async getReport(query: QueryAiSloReportDto = {}) {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const policies = await this.policyService.findPolicies({
      scope: query.scope,
      scopeValue: query.scopeValue,
      window: query.window,
      isActive: query.isActive ?? true,
      includeDeleted: false,
    });
    const evaluations = await Promise.all(
      policies.map(async (policy) => {
        const evaluation = await this.evaluatePolicy(policy, asOf);
        const runbooks = await this.resolveRunbooks(
          evaluation.decision,
          policy,
          asOf,
        );
        return { ...evaluation, runbooks };
      }),
    );
    const queueOperationalHealth = await this.resolveQueueHealth();
    const overallDecision = this.summarizeDecision(
      evaluations.map((item) => item.decision),
    );

    return {
      version: AI_SLO_ERROR_BUDGET_VERSION,
      readOnly: true,
      asOf: asOf.toISOString(),
      policyCount: policies.length,
      overallDecision,
      queueOperationalHealth,
      evaluations,
      semantics: {
        availabilityNumerator: 'SUCCESS terminal AiRunLog rows',
        availabilityDenominator:
          'SUCCESS + FAILED + CANCELLED terminal AiRunLog rows',
        runningRowsExcluded: true,
        latencyPopulation: 'SUCCESS rows with non-null latencyMs',
        burnRateFormula: 'observed_failure_rate / allowed_failure_rate',
        errorBudgetUnit: 'RUN_COUNT',
        enforcementMode: 'OBSERVABILITY_ONLY',
      },
    };
  }

  private async evaluatePolicy(policy: AiSloPolicyRecord, asOf: Date) {
    const windowStart = AiSloPolicyUtil.windowStart(policy.window, asOf);
    const where: Prisma.AiRunLogWhereInput = {
      deletedAt: null,
      createdAt: { gte: windowStart, lte: asOf },
      status: { in: ['SUCCESS', 'FAILED', 'CANCELLED'] },
      ...this.buildDatabaseScopeWhere(policy),
    };
    const rows = await this.prisma.aiRunLog.findMany({
      where,
      select: {
        id: true,
        taskType: true,
        userId: true,
        provider: true,
        model: true,
        status: true,
        latencyMs: true,
        inputJson: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const scopedRows = rows.filter((row) =>
      this.matchesMetadataScope(policy, row),
    );
    const successRows = scopedRows.filter((row) => row.status === 'SUCCESS');
    const failureRows = scopedRows.filter((row) => row.status !== 'SUCCESS');
    const total = scopedRows.length;
    const successCount = successRows.length;
    const failureCount = failureRows.length;
    const availabilityPercent =
      total === 0 ? null : (successCount / total) * 100;
    const allowedFailureRate = (100 - policy.availabilityTargetPercent) / 100;
    const observedFailureRate = total === 0 ? 0 : failureCount / total;
    const burnRate =
      allowedFailureRate <= 0
        ? failureCount > 0
          ? Number.POSITIVE_INFINITY
          : 0
        : observedFailureRate / allowedFailureRate;
    const allowedFailureCount = total * allowedFailureRate;
    const remainingFailureCount = Math.max(
      0,
      allowedFailureCount - failureCount,
    );
    const latencyValues = successRows
      .map((row) => row.latencyMs)
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right);
    const p95LatencyMs = this.percentile(latencyValues, 0.95);
    const latencyTargetMs = policy.latencyTargetMs;
    const latencyCompliantCount =
      latencyTargetMs === null
        ? null
        : latencyValues.filter((value) => value <= latencyTargetMs).length;
    const latencyCompliancePercent =
      latencyCompliantCount === null || latencyValues.length === 0
        ? null
        : (latencyCompliantCount / latencyValues.length) * 100;
    const decision = this.decide(
      policy,
      total,
      availabilityPercent,
      burnRate,
      p95LatencyMs,
    );

    return {
      policy,
      window: { start: windowStart.toISOString(), end: asOf.toISOString() },
      decision,
      sample: {
        totalTerminalRuns: total,
        successCount,
        failureCount,
        minimumSampleSize: policy.minimumSampleSize,
        sufficient: total >= policy.minimumSampleSize,
      },
      availability: {
        targetPercent: policy.availabilityTargetPercent,
        actualPercent: this.roundNullable(availabilityPercent, 5),
        allowedFailureRate: this.round(allowedFailureRate, 8),
        observedFailureRate: this.round(observedFailureRate, 8),
      },
      errorBudget: {
        unit: 'RUN_COUNT',
        allowedFailureCount: this.round(allowedFailureCount, 5),
        consumedFailureCount: failureCount,
        remainingFailureCount: this.round(remainingFailureCount, 5),
        consumedPercent:
          allowedFailureCount <= 0
            ? failureCount > 0
              ? null
              : 0
            : this.round((failureCount / allowedFailureCount) * 100, 5),
        burnRate: Number.isFinite(burnRate) ? this.round(burnRate, 5) : null,
        infiniteBurnRate: !Number.isFinite(burnRate),
        warningBurnRate: policy.warningBurnRate,
        criticalBurnRate: policy.criticalBurnRate,
      },
      latency: {
        targetMs: policy.latencyTargetMs,
        measuredSuccessCount: latencyValues.length,
        p95Ms: p95LatencyMs,
        compliantCount: latencyCompliantCount,
        compliancePercent: this.roundNullable(latencyCompliancePercent, 5),
      },
    };
  }

  private async resolveRunbooks(
    decision: AiSloDecision,
    policy: AiSloPolicyRecord,
    asOf: Date,
  ) {
    if (!this.runbookResolver || !['WARN', 'BREACHED'].includes(decision)) {
      return [];
    }
    try {
      const resolved = await this.runbookResolver.resolve({
        source: 'SLO',
        decision,
        severity: this.runbookResolver.severityForSloDecision(decision),
        scope: policy.scope,
        scopeValue: policy.scopeValue,
        asOf: asOf.toISOString(),
      });
      return resolved.runbooks;
    } catch {
      return [];
    }
  }

  private buildDatabaseScopeWhere(
    policy: AiSloPolicyRecord,
  ): Prisma.AiRunLogWhereInput {
    if (policy.scope === 'GLOBAL' || policy.scope === 'AGENT') return {};
    const scopeValue = policy.scopeValue;
    if (scopeValue === null) {
      throw new Error(`scopeValue is required for ${policy.scope}.`);
    }
    switch (policy.scope) {
      case 'USER':
        return { userId: scopeValue };
      case 'PROVIDER':
        return { provider: scopeValue };
      case 'MODEL':
        return { model: scopeValue };
      case 'TASK':
        return { taskType: scopeValue };
    }
  }

  private matchesMetadataScope(
    policy: AiSloPolicyRecord,
    row: AiSloRunRow,
  ): boolean {
    if (policy.scope !== 'AGENT') return true;
    return (
      this.readMetadataString(row.inputJson, 'agentName') === policy.scopeValue
    );
  }

  private readMetadataString(value: unknown, key: string): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const direct = (value as Record<string, unknown>)[key];
    if (typeof direct === 'string') return direct;
    const metadata = (value as Record<string, unknown>).metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
      return null;
    const nested = (metadata as Record<string, unknown>)[key];
    return typeof nested === 'string' ? nested : null;
  }

  private decide(
    policy: AiSloPolicyRecord,
    total: number,
    availabilityPercent: number | null,
    burnRate: number,
    p95LatencyMs: number | null,
  ): AiSloDecision {
    if (total < policy.minimumSampleSize) return 'INSUFFICIENT_DATA';
    const latencyBreached =
      policy.latencyTargetMs !== null &&
      p95LatencyMs !== null &&
      p95LatencyMs > policy.latencyTargetMs;
    if (
      availabilityPercent === null ||
      availabilityPercent < policy.availabilityTargetPercent ||
      burnRate >= policy.criticalBurnRate ||
      latencyBreached
    )
      return 'BREACHED';
    if (burnRate >= policy.warningBurnRate) return 'WARN';
    return 'HEALTHY';
  }

  private summarizeDecision(
    decisions: readonly AiSloDecision[],
  ): AiSloDecision {
    if (decisions.includes('BREACHED')) return 'BREACHED';
    if (decisions.includes('WARN')) return 'WARN';
    if (decisions.includes('HEALTHY')) return 'HEALTHY';
    return 'INSUFFICIENT_DATA';
  }

  private percentile(
    values: readonly number[],
    quantile: number,
  ): number | null {
    if (values.length === 0) return null;
    const index = Math.max(0, Math.ceil(values.length * quantile) - 1);
    return values[index] ?? null;
  }

  private async resolveQueueHealth(): Promise<
    QueueStatusReport['health'] | null
  > {
    if (!this.queueMonitor) return null;
    try {
      return (await this.queueMonitor.getStatus()).health;
    } catch {
      return null;
    }
  }

  private round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  private roundNullable(value: number | null, digits: number): number | null {
    return value === null ? null : this.round(value, digits);
  }
}
