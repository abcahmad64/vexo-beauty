import { createHash } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../core/prisma/prisma.service';

import type { ResolveAiShadowModelRoutingDto } from '../dto/admin-ai-shadow-model-routing.dto';
import type { QueryAiShadowRoutingDecisionsDto } from '../dto/admin-ai-shadow-routing-observability.dto';
import type { AiShadowRoutingDecision } from '../interfaces/ai-shadow-model-routing.interface';

const DEFAULT_RETENTION_DAYS = 30;

@Injectable()
export class AiShadowRoutingObservabilityService {
  private readonly logger = new Logger(
    AiShadowRoutingObservabilityService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async persistDecision(
    decision: AiShadowRoutingDecision,
    input: ResolveAiShadowModelRoutingDto,
    retentionDays = DEFAULT_RETENTION_DAYS,
  ): Promise<boolean> {
    try {
      await this.prisma.aiShadowRoutingDecision.create({
        data: {
          decisionId: decision.decisionId,
          version: decision.version,
          mode: decision.mode,
          resolvedAt: new Date(decision.resolvedAt),
          expiresAt: this.addDays(new Date(decision.resolvedAt), retentionDays),
          subjectKeySource: decision.subjectKeySource,
          subjectKeyFingerprint: decision.subjectKeyFingerprint,
          requestedTask: decision.requestedTask,
          taskType: decision.taskType,
          actualProvider: decision.actualRoute.provider,
          actualModel: decision.actualRoute.model,
          rolloutId: decision.rollout?.rolloutId ?? null,
          policyVersion: decision.rollout?.policyVersion ?? null,
          trafficPercent: decision.rollout?.trafficPercent ?? null,
          bucket: decision.rollout?.bucket ?? null,
          threshold: decision.rollout?.threshold ?? null,
          cohort: decision.rollout?.cohort ?? 'NO_ROLLOUT',
          shadowProvider: decision.shadowRoute.provider,
          shadowModel: decision.shadowRoute.model,
          routeChanged: false,
          providerInvoked: false,
          modelActivated: false,
          decisionPersisted: true,
          userIdFingerprint: this.optionalFingerprint(input.userId),
          requestIdFingerprint: this.optionalFingerprint(input.requestId),
          traceIdFingerprint: this.optionalFingerprint(input.traceId),
          executionIdFingerprint: this.optionalFingerprint(input.executionId),
          aiRunLogId: input.aiRunLogId ?? null,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.aiShadowRoutingDecision.findUnique({
          where: { decisionId: decision.decisionId },
          select: { decisionId: true },
        });
        return existing?.decisionId === decision.decisionId;
      }

      this.logger.error(
        'Failed to persist shadow routing decision.',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async list(query: QueryAiShadowRoutingDecisionsDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 25;
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aiShadowRoutingDecision.findMany({
        where,
        orderBy: [{ resolvedAt: 'desc' }, { decisionId: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiShadowRoutingDecision.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getDetail(decisionId: string) {
    const item = await this.prisma.aiShadowRoutingDecision.findUnique({
      where: { decisionId },
    });
    if (!item) {
      throw new NotFoundException('تصمیم Shadow Routing پیدا نشد.');
    }
    return item;
  }

  async getSummary(query: QueryAiShadowRoutingDecisionsDto) {
    const where = this.buildWhere(query);
    const [total, candidate, baseline, noRollout, window] =
      await this.prisma.$transaction([
        this.prisma.aiShadowRoutingDecision.count({ where }),
        this.prisma.aiShadowRoutingDecision.count({
          where: { ...where, cohort: 'CANDIDATE' },
        }),
        this.prisma.aiShadowRoutingDecision.count({
          where: { ...where, cohort: 'BASELINE' },
        }),
        this.prisma.aiShadowRoutingDecision.count({
          where: { ...where, cohort: 'NO_ROLLOUT' },
        }),
        this.prisma.aiShadowRoutingDecision.aggregate({
          where,
          _min: { resolvedAt: true },
          _max: { resolvedAt: true },
        }),
      ]);

    return {
      total,
      cohorts: { candidate, baseline, noRollout },
      invariants: {
        routeChanged: false,
        providerInvoked: false,
        modelActivated: false,
      },
      window: {
        from: window._min.resolvedAt?.toISOString() ?? null,
        to: window._max.resolvedAt?.toISOString() ?? null,
      },
    };
  }

  async cleanupExpired(retentionDays = DEFAULT_RETENTION_DAYS) {
    const cutoff = this.addDays(new Date(), -retentionDays);
    const result = await this.prisma.aiShadowRoutingDecision.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          { resolvedAt: { lt: cutoff } },
        ],
      },
    });
    return {
      retentionDays,
      deletedCount: result.count,
      cleanupMode: 'EXPLICIT_ADMIN_CONTROLLED',
    };
  }

  private buildWhere(
    query: QueryAiShadowRoutingDecisionsDto,
  ): Prisma.AiShadowRoutingDecisionWhereInput {
    return {
      decisionId: query.decisionId,
      taskType: query.taskType,
      cohort: query.cohort,
      rolloutId: query.rolloutId,
      aiRunLogId: query.aiRunLogId,
      userIdFingerprint: this.optionalFingerprint(query.userId),
      requestIdFingerprint: this.optionalFingerprint(query.requestId),
      traceIdFingerprint: this.optionalFingerprint(query.traceId),
      executionIdFingerprint: this.optionalFingerprint(query.executionId),
      resolvedAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };
  }

  private optionalFingerprint(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? this.fingerprint(normalized) : undefined;
  }

  private fingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 24);
  }

  private addDays(value: Date, days: number): Date {
    return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
