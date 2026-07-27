import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';
import type {
  AdminCreateAiAlertRunbookDto,
  AdminUpdateAiAlertRunbookDto,
  QueryAiAlertRunbooksDto,
} from '../dto/admin-ai-alert-runbook.dto';
import {
  AI_ALERT_RUNBOOK_RULE_TYPE,
  type AiAlertRunbookDocument,
  type AiAlertRunbookRecord,
} from '../interfaces/ai-alert-runbook.interface';
import {
  AiAlertRunbookUtil,
  type AiAlertRunbookDatabaseRow,
} from './ai-alert-runbook.util';

const RUNBOOK_SELECT = {
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
export class AiAlertRunbookService {
  constructor(private readonly prisma: PrismaService) {}

  async findRunbooks(
    query: QueryAiAlertRunbooksDto = {},
  ): Promise<AiAlertRunbookRecord[]> {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_ALERT_RUNBOOK_RULE_TYPE,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      },
      select: RUNBOOK_SELECT,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rows
      .map((row) => this.parse(row))
      .filter((item) => (query.source ? item.source === query.source : true))
      .filter((item) =>
        query.decision ? item.decision === query.decision : true,
      )
      .filter((item) =>
        query.severity ? item.severity === query.severity : true,
      )
      .filter((item) =>
        query.scope
          ? item.scope?.toLowerCase() === query.scope.toLowerCase()
          : true,
      )
      .filter((item) =>
        query.scopeValue
          ? item.scopeValue?.toLowerCase() === query.scopeValue.toLowerCase()
          : true,
      );
  }

  async findRunbook(
    id: string,
    includeDeleted = false,
  ): Promise<AiAlertRunbookRecord> {
    const row = await this.prisma.aiGuardrailRule.findFirst({
      where: {
        id,
        ruleType: AI_ALERT_RUNBOOK_RULE_TYPE,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      select: RUNBOOK_SELECT,
    });
    if (!row) throw new NotFoundException('Runbook هشدار هوش مصنوعی یافت نشد.');
    return this.parse(row);
  }

  async createRunbook(
    dto: AdminCreateAiAlertRunbookDto,
    actorId: string,
  ): Promise<AiAlertRunbookRecord> {
    const document = this.createDocument({
      policyVersion: 1,
      source: dto.source,
      decision: dto.decision,
      severity: dto.severity,
      scope: dto.scope,
      scopeValue: dto.scopeValue,
      title: dto.title,
      url: dto.url,
      owner: dto.owner,
      summary: dto.summary,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
      updatedById: actorId,
    });
    await this.assertNoDuplicate(document);
    const row = await this.prisma.aiGuardrailRule.create({
      data: {
        name: dto.name,
        ruleType: AI_ALERT_RUNBOOK_RULE_TYPE,
        pattern: AiAlertRunbookUtil.serializeDocument(document),
        action: 'RUNBOOK',
        message: 'Versioned operational runbook mapping for AI alerts.',
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 100,
        createdById: actorId,
      },
      select: RUNBOOK_SELECT,
    });
    return this.parse(row);
  }

  async updateRunbook(
    id: string,
    dto: AdminUpdateAiAlertRunbookDto,
    actorId: string,
  ): Promise<AiAlertRunbookRecord> {
    const existing = await this.findRunbook(id, true);
    if (existing.deletedAt)
      throw new ConflictException('Runbook حذف‌شده قابل ویرایش نیست.');
    const document = this.createDocument({
      policyVersion: existing.policyVersion + 1,
      source: dto.source ?? existing.source,
      decision: dto.decision ?? existing.decision,
      severity: dto.severity ?? existing.severity,
      scope: dto.scope === undefined ? existing.scope : dto.scope,
      scopeValue:
        dto.scopeValue === undefined ? existing.scopeValue : dto.scopeValue,
      title: dto.title ?? existing.title,
      url: dto.url ?? existing.url,
      owner: dto.owner ?? existing.owner,
      summary: dto.summary === undefined ? existing.summary : dto.summary,
      effectiveFrom:
        dto.effectiveFrom === undefined
          ? existing.effectiveFrom
          : dto.effectiveFrom,
      effectiveTo:
        dto.effectiveTo === undefined ? existing.effectiveTo : dto.effectiveTo,
      updatedById: actorId,
    });
    await this.assertNoDuplicate(document, id);
    const row = await this.prisma.aiGuardrailRule.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        pattern: AiAlertRunbookUtil.serializeDocument(document),
        isActive: dto.isActive ?? existing.isActive,
        priority: dto.priority ?? existing.priority,
      },
      select: RUNBOOK_SELECT,
    });
    return this.parse(row);
  }

  async deleteRunbook(
    id: string,
    actorId: string,
  ): Promise<AiAlertRunbookRecord> {
    const existing = await this.findRunbook(id);
    const document = this.createDocument({
      ...existing,
      policyVersion: existing.policyVersion + 1,
      updatedById: actorId,
    });
    const row = await this.prisma.aiGuardrailRule.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        pattern: AiAlertRunbookUtil.serializeDocument(document),
      },
      select: RUNBOOK_SELECT,
    });
    return this.parse(row);
  }

  private async assertNoDuplicate(
    document: AiAlertRunbookDocument,
    excludedId?: string,
  ): Promise<void> {
    const rows = await this.prisma.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_ALERT_RUNBOOK_RULE_TYPE,
        deletedAt: null,
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      select: RUNBOOK_SELECT,
    });
    const duplicate = rows
      .map((row) => this.parse(row))
      .find(
        (item) =>
          item.source === document.source &&
          item.decision === document.decision &&
          item.severity === document.severity &&
          (item.scope ?? '').toLowerCase() ===
            (document.scope ?? '').toLowerCase() &&
          (item.scopeValue ?? '').toLowerCase() ===
            (document.scopeValue ?? '').toLowerCase(),
      );
    if (duplicate)
      throw new ConflictException(
        'برای همین Alert mapping یک Runbook دیگر وجود دارد.',
      );
  }

  private createDocument(
    input: Parameters<typeof AiAlertRunbookUtil.createDocument>[0],
  ): AiAlertRunbookDocument {
    try {
      return AiAlertRunbookUtil.createDocument(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'سند Runbook نامعتبر است.',
      );
    }
  }

  private parse(row: AiAlertRunbookDatabaseRow): AiAlertRunbookRecord {
    let document: AiAlertRunbookDocument;
    try {
      document = AiAlertRunbookUtil.parseDocument(row.pattern);
    } catch (error) {
      throw new BadRequestException(
        `Runbook ${row.id} قابل خواندن نیست: ${error instanceof Error ? error.message : 'invalid document'}`,
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
