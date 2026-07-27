import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';
import type {
  AdminCreateAiSloPolicyDto,
  AdminUpdateAiSloPolicyDto,
  QueryAiSloPoliciesDto,
} from '../dto/admin-ai-slo-policy.dto';
import {
  AI_SLO_POLICY_RULE_TYPE,
  type AiSloPolicyDocument,
  type AiSloPolicyRecord,
} from '../interfaces/ai-slo-error-budget.interface';
import {
  AiSloPolicyUtil,
  type AiSloPolicyDatabaseRow,
} from './ai-slo-policy.util';

const POLICY_SELECT = {
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
export class AiSloPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async findPolicies(
    query: QueryAiSloPoliciesDto = {},
  ): Promise<AiSloPolicyRecord[]> {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_SLO_POLICY_RULE_TYPE,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      },
      select: POLICY_SELECT,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return rows
      .map((row) => this.parsePolicy(row))
      .filter((policy) => (query.scope ? policy.scope === query.scope : true))
      .filter((policy) =>
        query.scopeValue
          ? policy.scopeValue?.toLowerCase() === query.scopeValue.toLowerCase()
          : true,
      )
      .filter((policy) =>
        query.window ? policy.window === query.window : true,
      );
  }

  async findPolicy(
    policyId: string,
    includeDeleted = false,
  ): Promise<AiSloPolicyRecord> {
    const row = await this.prisma.aiGuardrailRule.findFirst({
      where: {
        id: policyId,
        ruleType: AI_SLO_POLICY_RULE_TYPE,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      select: POLICY_SELECT,
    });
    if (!row) throw new NotFoundException('سیاست SLO هوش مصنوعی یافت نشد.');
    return this.parsePolicy(row);
  }

  async createPolicy(
    dto: AdminCreateAiSloPolicyDto,
    actorId: string,
  ): Promise<AiSloPolicyRecord> {
    const document = this.createDocument({
      policyVersion: 1,
      scope: dto.scope,
      scopeValue: dto.scopeValue,
      window: dto.window,
      availabilityTargetPercent: dto.availabilityTargetPercent,
      latencyTargetMs: dto.latencyTargetMs,
      minimumSampleSize: dto.minimumSampleSize,
      warningBurnRate: dto.warningBurnRate,
      criticalBurnRate: dto.criticalBurnRate,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
      updatedById: actorId,
    });
    await this.assertNoExactDuplicate(document);

    const row = await this.prisma.aiGuardrailRule.create({
      data: {
        name: dto.name,
        ruleType: AI_SLO_POLICY_RULE_TYPE,
        pattern: AiSloPolicyUtil.serializeDocument(document),
        action: 'SLO',
        message: 'Versioned AI operational SLO and error-budget policy.',
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 100,
        createdById: actorId,
      },
      select: POLICY_SELECT,
    });
    return this.parsePolicy(row);
  }

  async updatePolicy(
    policyId: string,
    dto: AdminUpdateAiSloPolicyDto,
    actorId: string,
  ): Promise<AiSloPolicyRecord> {
    const existing = await this.findPolicy(policyId, true);
    if (existing.deletedAt) {
      throw new ConflictException('سیاست حذف‌شده SLO قابل ویرایش نیست.');
    }

    const document = this.createDocument({
      policyVersion: existing.policyVersion + 1,
      scope: dto.scope ?? existing.scope,
      scopeValue:
        dto.scope === 'GLOBAL' ? null : (dto.scopeValue ?? existing.scopeValue),
      window: dto.window ?? existing.window,
      availabilityTargetPercent:
        dto.availabilityTargetPercent ?? existing.availabilityTargetPercent,
      latencyTargetMs:
        dto.latencyTargetMs === undefined
          ? existing.latencyTargetMs
          : dto.latencyTargetMs,
      minimumSampleSize: dto.minimumSampleSize ?? existing.minimumSampleSize,
      warningBurnRate: dto.warningBurnRate ?? existing.warningBurnRate,
      criticalBurnRate: dto.criticalBurnRate ?? existing.criticalBurnRate,
      effectiveFrom:
        dto.effectiveFrom === undefined
          ? existing.effectiveFrom
          : dto.effectiveFrom,
      effectiveTo:
        dto.effectiveTo === undefined ? existing.effectiveTo : dto.effectiveTo,
      updatedById: actorId,
    });
    await this.assertNoExactDuplicate(document, policyId);

    const row = await this.prisma.aiGuardrailRule.update({
      where: { id: policyId },
      data: {
        name: dto.name ?? existing.name,
        pattern: AiSloPolicyUtil.serializeDocument(document),
        isActive: dto.isActive ?? existing.isActive,
        priority: dto.priority ?? existing.priority,
      },
      select: POLICY_SELECT,
    });
    return this.parsePolicy(row);
  }

  async deletePolicy(
    policyId: string,
    actorId: string,
  ): Promise<AiSloPolicyRecord> {
    const existing = await this.findPolicy(policyId);
    const document = this.createDocument({
      ...existing,
      policyVersion: existing.policyVersion + 1,
      updatedById: actorId,
    });
    const row = await this.prisma.aiGuardrailRule.update({
      where: { id: policyId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        pattern: AiSloPolicyUtil.serializeDocument(document),
      },
      select: POLICY_SELECT,
    });
    return this.parsePolicy(row);
  }

  private async assertNoExactDuplicate(
    document: AiSloPolicyDocument,
    excludedPolicyId?: string,
  ): Promise<void> {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_SLO_POLICY_RULE_TYPE,
        deletedAt: null,
        ...(excludedPolicyId ? { id: { not: excludedPolicyId } } : {}),
      },
      select: POLICY_SELECT,
    });
    const duplicate = rows
      .map((row) => this.parsePolicy(row))
      .find(
        (policy) =>
          policy.scope === document.scope &&
          (policy.scopeValue ?? '').toLowerCase() ===
            (document.scopeValue ?? '').toLowerCase() &&
          policy.window === document.window,
      );
    if (duplicate) {
      throw new ConflictException(
        'برای همین Scope و Window یک سیاست SLO دیگر وجود دارد.',
      );
    }
  }

  private createDocument(
    input: Parameters<typeof AiSloPolicyUtil.createDocument>[0],
  ): AiSloPolicyDocument {
    try {
      return AiSloPolicyUtil.createDocument(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'سند سیاست SLO نامعتبر است.',
      );
    }
  }

  private parsePolicy(row: AiSloPolicyDatabaseRow): AiSloPolicyRecord {
    let document: AiSloPolicyDocument;
    try {
      document = AiSloPolicyUtil.parseDocument(row.pattern);
    } catch (error) {
      throw new BadRequestException(
        `سیاست SLO ${row.id} قابل خواندن نیست: ${
          error instanceof Error ? error.message : 'invalid document'
        }`,
      );
    }
    return {
      id: row.id,
      name: row.name,
      ...document,
      isActive: row.isActive,
      priority: row.priority,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      databaseUpdatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }
}
