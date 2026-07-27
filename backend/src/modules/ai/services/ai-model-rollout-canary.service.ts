import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import type {
  AdminCreateAiModelRolloutDto,
  AdminUpdateAiModelRolloutDto,
  QueryAiModelRolloutsDto,
} from '../dto/admin-ai-model-rollout.dto';
import {
  AI_MODEL_ROLLOUT_RULE_TYPE,
  type AiModelRolloutDocument,
  type AiModelRolloutRecord,
} from '../interfaces/ai-model-rollout-canary.interface';
import { AiModelRolloutCanaryUtil } from './ai-model-rollout-canary.util';

const SELECT = {
  id: true,
  name: true,
  pattern: true,
  isActive: true,
  priority: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class AiModelRolloutCanaryService {
  constructor(private readonly prisma: PrismaService) {}

  async findRollouts(query: QueryAiModelRolloutsDto = {}) {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_MODEL_ROLLOUT_RULE_TYPE,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      },
      select: SELECT,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rows
      .map((row) => this.parse(row))
      .filter((item) => !query.taskType || item.taskType === query.taskType)
      .filter(
        (item) =>
          !query.candidateModel || item.candidateModel === query.candidateModel,
      );
  }

  async findApplicableRollout(input: {
    taskType: string;
    baselineProvider: string;
    baselineModel: string;
    at?: Date;
  }): Promise<AiModelRolloutRecord | null> {
    const at = input.at ?? new Date();
    const rollouts = await this.findRollouts({ isActive: true });

    return (
      rollouts.find(
        (rollout) =>
          (rollout.taskType === null || rollout.taskType === input.taskType) &&
          rollout.baselineProvider === input.baselineProvider &&
          rollout.baselineModel === input.baselineModel &&
          (rollout.effectiveFrom === null ||
            new Date(rollout.effectiveFrom) <= at) &&
          (rollout.effectiveTo === null || new Date(rollout.effectiveTo) > at),
      ) ?? null
    );
  }

  async findRollout(id: string, includeDeleted = false) {
    const row = await this.prisma.aiGuardrailRule.findFirst({
      where: {
        id,
        ruleType: AI_MODEL_ROLLOUT_RULE_TYPE,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      select: SELECT,
    });
    if (!row) throw new NotFoundException('Rollout مدل یافت نشد.');
    return this.parse(row);
  }

  async createRollout(dto: AdminCreateAiModelRolloutDto, actorId: string) {
    const document = this.document({
      policyVersion: 1,
      baselineProvider: dto.baselineProvider,
      baselineModel: dto.baselineModel,
      candidateProvider: dto.candidateProvider,
      candidateModel: dto.candidateModel,
      taskType: dto.taskType ?? null,
      trafficPercent: dto.trafficPercent,
      cohortSalt: dto.cohortSalt,
      minimumSampleSize: dto.minimumSampleSize,
      maxFailureRateIncreasePercent: dto.maxFailureRateIncreasePercent,
      maxP95LatencyIncreasePercent: dto.maxP95LatencyIncreasePercent,
      maxCostIncreasePercent: dto.maxCostIncreasePercent ?? null,
      effectiveFrom: dto.effectiveFrom ?? null,
      effectiveTo: dto.effectiveTo ?? null,
      updatedById: actorId,
    });
    await this.assertNoDuplicate(document);
    return this.parse(
      await this.prisma.aiGuardrailRule.create({
        data: {
          name: dto.name,
          ruleType: AI_MODEL_ROLLOUT_RULE_TYPE,
          pattern: AiModelRolloutCanaryUtil.serializeDocument(document),
          action: 'ROLLOUT',
          message: 'Observation-only model rollout canary policy.',
          isActive: dto.isActive ?? true,
          priority: dto.priority ?? 100,
          createdById: actorId,
        },
        select: SELECT,
      }),
    );
  }

  async updateRollout(
    id: string,
    dto: AdminUpdateAiModelRolloutDto,
    actorId: string,
  ) {
    const existing = await this.findRollout(id, true);
    if (existing.deletedAt)
      throw new ConflictException('Rollout حذف‌شده قابل ویرایش نیست.');
    const document = this.document({
      ...existing,
      policyVersion: existing.policyVersion + 1,
      trafficPercent: dto.trafficPercent ?? existing.trafficPercent,
      minimumSampleSize: dto.minimumSampleSize ?? existing.minimumSampleSize,
      maxFailureRateIncreasePercent:
        dto.maxFailureRateIncreasePercent ??
        existing.maxFailureRateIncreasePercent,
      maxP95LatencyIncreasePercent:
        dto.maxP95LatencyIncreasePercent ??
        existing.maxP95LatencyIncreasePercent,
      maxCostIncreasePercent:
        dto.maxCostIncreasePercent === undefined
          ? existing.maxCostIncreasePercent
          : dto.maxCostIncreasePercent,
      effectiveFrom:
        dto.effectiveFrom === undefined
          ? existing.effectiveFrom
          : dto.effectiveFrom,
      effectiveTo:
        dto.effectiveTo === undefined ? existing.effectiveTo : dto.effectiveTo,
      updatedById: actorId,
    });
    return this.parse(
      await this.prisma.aiGuardrailRule.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          pattern: AiModelRolloutCanaryUtil.serializeDocument(document),
          isActive: dto.isActive ?? existing.isActive,
          priority: dto.priority ?? existing.priority,
        },
        select: SELECT,
      }),
    );
  }

  async deleteRollout(id: string, actorId: string) {
    const existing = await this.findRollout(id);
    const document = this.document({
      ...existing,
      policyVersion: existing.policyVersion + 1,
      updatedById: actorId,
    });
    return this.parse(
      await this.prisma.aiGuardrailRule.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          pattern: AiModelRolloutCanaryUtil.serializeDocument(document),
        },
        select: SELECT,
      }),
    );
  }

  resolveCohort(record: AiModelRolloutRecord, subjectKey: string) {
    return {
      rolloutId: record.id,
      baseline: {
        provider: record.baselineProvider,
        model: record.baselineModel,
      },
      candidate: {
        provider: record.candidateProvider,
        model: record.candidateModel,
      },
      trafficPercent: record.trafficPercent,
      ...AiModelRolloutCanaryUtil.resolveCohort(
        subjectKey,
        record.cohortSalt,
        record.trafficPercent,
      ),
      mode: 'OBSERVABILITY_AND_RECOMMENDATION_ONLY',
      routingMutation: false,
    };
  }

  private async assertNoDuplicate(document: AiModelRolloutDocument) {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: { ruleType: AI_MODEL_ROLLOUT_RULE_TYPE, deletedAt: null },
      select: SELECT,
    });
    const duplicate = rows
      .map((row) => this.parse(row))
      .find(
        (item) =>
          item.candidateProvider === document.candidateProvider &&
          item.candidateModel === document.candidateModel &&
          item.taskType === document.taskType,
      );
    if (duplicate)
      throw new ConflictException(
        'برای این Candidate و Task یک Rollout دیگر وجود دارد.',
      );
  }

  private document(
    input: Parameters<typeof AiModelRolloutCanaryUtil.createDocument>[0],
  ) {
    try {
      return AiModelRolloutCanaryUtil.createDocument(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'سند Rollout نامعتبر است.',
      );
    }
  }

  private parse(row: {
    id: string;
    name: string;
    pattern: string | null;
    isActive: boolean;
    priority: number;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): AiModelRolloutRecord {
    return {
      id: row.id,
      name: row.name,
      ...AiModelRolloutCanaryUtil.parseDocument(row.pattern),
      isActive: row.isActive,
      priority: row.priority,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      databaseUpdatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }
}
