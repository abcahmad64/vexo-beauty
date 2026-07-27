import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type {
  AdminCreateAiBudgetPolicyDto,
  AdminUpdateAiBudgetPolicyDto,
  QueryAiBudgetPoliciesDto,
} from '../dto/admin-ai-budget-policy.dto';

import { AI_BUDGET_POLICY_RULE_TYPE } from '../interfaces/ai-budget-enforcement.interface';

import type {
  AiBudgetPolicyDocument,
  AiBudgetPolicyRecord,
} from '../interfaces/ai-budget-enforcement.interface';

import { AiBudgetPolicyUtil } from './ai-budget-policy.util';

import type { AiBudgetPolicyDatabaseRow } from './ai-budget-policy.util';

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
export class AiBudgetPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async findPolicies(
    query: QueryAiBudgetPoliciesDto = {},
  ): Promise<AiBudgetPolicyRecord[]> {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_BUDGET_POLICY_RULE_TYPE,
        ...(query.includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
        ...(query.isActive === undefined
          ? {}
          : {
              isActive: query.isActive,
            }),
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
  ): Promise<AiBudgetPolicyRecord> {
    const row = await this.prisma.aiGuardrailRule.findFirst({
      where: {
        id: policyId,
        ruleType: AI_BUDGET_POLICY_RULE_TYPE,
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: POLICY_SELECT,
    });

    if (!row) {
      throw new NotFoundException('سیاست بودجه هوش مصنوعی یافت نشد.');
    }

    return this.parsePolicy(row);
  }

  async createPolicy(
    dto: AdminCreateAiBudgetPolicyDto,
    actorId: string,
  ): Promise<AiBudgetPolicyRecord> {
    const document = this.createDocument({
      policyVersion: 1,
      scope: dto.scope,
      scopeValue: dto.scopeValue,
      window: dto.window,
      softLimitMicros: dto.softLimitMicros,
      hardLimitMicros: dto.hardLimitMicros,
      unknownPricingMode: dto.unknownPricingMode,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
      updatedById: actorId,
    });

    await this.assertNoExactDuplicate(document);

    const row = await this.prisma.aiGuardrailRule.create({
      data: {
        name: dto.name,
        ruleType: AI_BUDGET_POLICY_RULE_TYPE,
        pattern: AiBudgetPolicyUtil.serializeDocument(document),
        action: 'BUDGET',
        message: 'Versioned AI provider-spend budget policy.',
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
    dto: AdminUpdateAiBudgetPolicyDto,
    actorId: string,
  ): Promise<AiBudgetPolicyRecord> {
    const existing = await this.findPolicy(policyId, true);

    if (existing.deletedAt) {
      throw new ConflictException(
        'سیاست حذف‌شده بودجه باید پیش از ویرایش بازیابی شود.',
      );
    }

    const document = this.createDocument({
      policyVersion: existing.policyVersion + 1,
      scope: dto.scope ?? existing.scope,
      scopeValue:
        dto.scope === 'GLOBAL' ? null : (dto.scopeValue ?? existing.scopeValue),
      window: dto.window ?? existing.window,
      softLimitMicros: dto.softLimitMicros ?? existing.softLimitMicros,
      hardLimitMicros: dto.hardLimitMicros ?? existing.hardLimitMicros,
      unknownPricingMode: dto.unknownPricingMode ?? existing.unknownPricingMode,
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
      where: {
        id: policyId,
      },
      data: {
        name: dto.name ?? existing.name,
        pattern: AiBudgetPolicyUtil.serializeDocument(document),
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
  ): Promise<AiBudgetPolicyRecord> {
    const existing = await this.findPolicy(policyId);
    const document = this.createDocument({
      ...existing,
      policyVersion: existing.policyVersion + 1,
      updatedById: actorId,
    });

    const row = await this.prisma.aiGuardrailRule.update({
      where: {
        id: policyId,
      },
      data: {
        isActive: false,
        deletedAt: new Date(),
        pattern: AiBudgetPolicyUtil.serializeDocument(document),
      },
      select: POLICY_SELECT,
    });

    return this.parsePolicy(row);
  }

  private async assertNoExactDuplicate(
    document: AiBudgetPolicyDocument,
    excludedPolicyId?: string,
  ): Promise<void> {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_BUDGET_POLICY_RULE_TYPE,
        deletedAt: null,
        ...(excludedPolicyId
          ? {
              id: {
                not: excludedPolicyId,
              },
            }
          : {}),
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
        'برای همین Scope و Window یک سیاست بودجه دیگر وجود دارد.',
      );
    }
  }

  private createDocument(
    input: Parameters<typeof AiBudgetPolicyUtil.createDocument>[0],
  ): AiBudgetPolicyDocument {
    try {
      return AiBudgetPolicyUtil.createDocument(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'سیاست بودجه معتبر نیست.',
      );
    }
  }

  private parsePolicy(row: AiBudgetPolicyDatabaseRow): AiBudgetPolicyRecord {
    try {
      return AiBudgetPolicyUtil.parsePolicy(row);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'سند سیاست بودجه هوش مصنوعی معتبر نیست.',
      );
    }
  }
}
