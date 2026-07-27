import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import {
  AdminCreateAiGuardrailDto,
  AdminUpdateAiGuardrailDto,
} from '../dto/admin-ai-guardrail.dto';

import {
  AdminCreateAiKnowledgeDto,
  AdminUpdateAiKnowledgeDto,
} from '../dto/admin-ai-knowledge.dto';

import { AdminAiNoteDto } from '../dto/admin-ai-note.dto';

import {
  AdminCreateAiRecommendationDto,
  AdminUpdateAiRecommendationStatusDto,
} from '../dto/admin-ai-recommendation.dto';

import {
  AdminCreateAiTemplateDto,
  AdminUpdateAiTemplateDto,
} from '../dto/admin-ai-template.dto';

import { AdminAiExportQueryDto } from '../dto/admin-ai-export-query.dto';

import { AdminQueryAiDto } from '../dto/admin-query-ai.dto';

import { AdminRunAiTaskDto } from '../dto/admin-run-ai-task.dto';

type CountRow = {
  count: number | bigint;
};

type MetricRow = {
  count: number | bigint;
  amount: unknown;
};

type AiPromptTemplateRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  variablesJson: unknown;
  model: string | null;
  temperature: unknown;
  maxTokens: number | null;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AiKnowledgeDocumentRow = {
  id: string;
  key: string;
  title: string;
  sourceType: string;
  language: string;
  content: string;
  tagsJson: unknown;
  metadata: unknown;
  isActive: boolean;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AiGuardrailRuleRow = {
  id: string;
  key: string;
  title: string;
  pattern: string | null;
  severity: string;
  action: string;
  message: string | null;
  isActive: boolean;
  ruleType: string;
  priority: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AiRunLogRow = {
  id: string;
  taskType: string;
  status: string;
  promptTemplateId: string | null;
  promptKey: string | null;
  provider: string | null;
  model: string | null;
  inputJson: unknown;
  outputJson: unknown;
  guardrailResultJson: unknown;
  tokenUsageJson: unknown;
  errorMessage: string | null;
  durationMs: number | null;
  createdById: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AiRecommendationRow = {
  id: string;
  targetType: string;
  targetId: string | null;
  title: string;
  message: string;
  severity: string;
  status: string;
  metadata: unknown;
  createdByRunId: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  userId: string | null;
  data: unknown;
  timestamp: Date;
  createdAt: Date;
};

type GuardrailMatch = {
  ruleId: string;
  key: string;
  title: string;
  severity: string;
  action: string;
  message: string;
};

@Injectable()
export class AdminAiService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [runs, templates, knowledge, guardrails, recommendations] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            status: string;
            count: number | bigint;
          }>
        >(
          Prisma.sql`
            SELECT
              "status",
              COUNT(*)::int AS "count"
            FROM "AiRunLog"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
            GROUP BY "status"
          `,
        ),
        this.prisma.$queryRaw<CountRow[]>(
          Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AiPromptTemplate"
            WHERE
              "deleted_at" IS NULL
              AND "status" = 'ACTIVE'
          `,
        ),
        this.prisma.$queryRaw<CountRow[]>(
          Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AiKnowledgeDocument"
            WHERE
              "deleted_at" IS NULL
              AND "status" = 'ACTIVE'
          `,
        ),
        this.prisma.$queryRaw<CountRow[]>(
          Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AiGuardrailRule"
            WHERE
              "deleted_at" IS NULL
              AND "isActive" = TRUE
          `,
        ),
        this.prisma.$queryRaw<
          Array<{
            status: string;
            count: number | bigint;
          }>
        >(
          Prisma.sql`
            SELECT
              COALESCE(
                "metadata" ->> 'adminStatus',
                CASE
                  WHEN "expiresAt" IS NOT NULL AND "expiresAt" < NOW() THEN 'EXPIRED'
                  ELSE 'OPEN'
                END
              ) AS "status",
              COUNT(*)::int AS "count"
            FROM "AiRecommendation"
            WHERE "deleted_at" IS NULL
            GROUP BY
              COALESCE(
                "metadata" ->> 'adminStatus',
                CASE
                  WHEN "expiresAt" IS NOT NULL AND "expiresAt" < NOW() THEN 'EXPIRED'
                  ELSE 'OPEN'
                END
              )
          `,
        ),
      ]);

    return {
      runsLast30Days: runs.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
      })),
      activeTemplates: this.toNumber(templates[0]?.count),
      activeKnowledgeDocuments: this.toNumber(knowledge[0]?.count),
      activeGuardrails: this.toNumber(guardrails[0]?.count),
      recommendations: recommendations.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
      })),
    };
  }

  async runTask(dto: AdminRunAiTaskDto, actorId?: string) {
    const now = new Date();

    const runId = randomUUID();

    const startedAt = Date.now();

    const inputJson = {
      input: dto.input ?? {},
      promptTemplateId: dto.promptTemplateId ?? null,
      reason: dto.reason ?? null,
    };

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AiRunLog" (
          "id",
          "taskType",
          "status",
          "model",
          "inputJson",
          "outputJson",
          "errorMessage",
          "createdAt",
          "latencyMs",
          "promptKey",
          "provider",
          "tokenUsageJson",
          "userId"
        )
        VALUES (
          ${runId},
          ${dto.taskType},
          'RUNNING',
          ${dto.model ?? null},
          ${JSON.stringify(inputJson)}::jsonb,
          '{}'::jsonb,
          NULL,
          ${now},
          NULL,
          ${dto.promptTemplateId ?? dto.taskType},
          'backend',
          NULL,
          ${actorId ?? null}
        )
      `,
    );

    const guardrails = await this.evaluateGuardrails(dto.input ?? {});

    const blocked = guardrails.some((item) => item.action === 'BLOCK');

    if (blocked) {
      await this.finishRun(
        runId,
        'BLOCKED',
        {
          message: 'اجرای وظیفه هوشمند به دلیل قانون امنیتی متوقف شد.',
        },
        guardrails,
        'اجرای وظیفه توسط Guardrail مسدود شد.',
        Date.now() - startedAt,
      );

      return this.findRun(runId, true);
    }

    try {
      const output = await this.executeTask(dto, runId);

      await this.finishRun(
        runId,
        'SUCCESS',
        output,
        guardrails,
        null,
        Date.now() - startedAt,
      );

      await this.createSystemEvent(
        'ai.run.completed',
        'وظیفه هوشمند مدیریتی با موفقیت اجرا شد.',
        runId,
        actorId,
        {
          runId,
          taskType: dto.taskType,
          reason: dto.reason ?? null,
        },
      );

      return this.findRun(runId, true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'خطای نامشخص در اجرای وظیفه هوشمند';

      await this.finishRun(
        runId,
        'FAILED',
        {},
        guardrails,
        message,
        Date.now() - startedAt,
      );

      return this.findRun(runId, true);
    }
  }

  async findRuns(query: AdminQueryAiDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildRunWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AiRunLogRow[]>(
        Prisma.sql`
            ${this.runSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              r."createdAt" DESC,
              r."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AiRunLog" r
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapRun(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    };
  }

  async findRun(runId: string, includeDeleted = true) {
    const where: Prisma.Sql[] = [Prisma.sql`r."id" = ${runId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AiRunLogRow[]>(
      Prisma.sql`
          ${this.runSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const run = rows[0];

    if (!run) {
      throw new NotFoundException('اجرای هوشمند موردنظر یافت نشد.');
    }

    const notes = await this.findNotes(runId, 30);

    return {
      ...this.mapRun(run),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async findTemplates(query: AdminQueryAiDto) {
    const where = this.buildTemplateWhere(query);

    const rows = await this.prisma.$queryRaw<AiPromptTemplateRow[]>(
      Prisma.sql`
          ${this.templateSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            t."taskType" ASC,
            t."key" ASC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapTemplate(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createTemplate(dto: AdminCreateAiTemplateDto, actorId?: string) {
    const now = new Date();

    const key = this.normalizeKey(dto.key);

    await this.assertTemplateKeyUnique(key);

    const templateId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AiPromptTemplate" (
          "id",
          "key",
          "title",
          "description",
          "taskType",
          "systemPrompt",
          "userPrompt",
          "variablesJson",
          "model",
          "temperature",
          "maxTokens",
          "status",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${templateId},
          ${key},
          ${dto.title},
          ${dto.description ?? null},
          ${dto.taskType},
          ${dto.systemPrompt},
          ${dto.userPrompt},
          ${JSON.stringify(this.normalizeStringArray(dto.variables ?? []))}::jsonb,
          ${dto.model ?? null},
          ${dto.temperature ? this.toDecimal(dto.temperature) : null},
          ${dto.maxTokens ?? null},
          ${dto.status ?? 'DRAFT'},
          ${actorId ?? null},
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'ai.template.created',
      'قالب پرامپت هوشمند توسط ادمین ایجاد شد.',
      templateId,
      actorId,
      {
        templateId,
        key,
        taskType: dto.taskType,
      },
    );

    return {
      template: await this.findTemplate(templateId, true),
    };
  }

  async findTemplate(templateId: string, includeDeleted = true) {
    const row = await this.findTemplateRow(templateId, includeDeleted);

    return this.mapTemplate(row);
  }

  async updateTemplate(
    templateId: string,
    dto: AdminUpdateAiTemplateDto,
    actorId?: string,
  ) {
    const now = new Date();

    const current = await this.findTemplateRow(templateId, false);

    const assignments: Prisma.Sql[] = [];

    if (dto.key !== undefined) {
      const key = this.normalizeKey(dto.key);

      if (key !== current.key) {
        await this.assertTemplateKeyUnique(key, templateId);
      }

      assignments.push(Prisma.sql`"key" = ${key}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.taskType !== undefined) {
      assignments.push(Prisma.sql`"taskType" = ${dto.taskType}`);
    }

    if (dto.systemPrompt !== undefined) {
      assignments.push(Prisma.sql`"systemPrompt" = ${dto.systemPrompt}`);
    }

    if (dto.userPrompt !== undefined) {
      assignments.push(Prisma.sql`"userPrompt" = ${dto.userPrompt}`);
    }

    if (dto.variables !== undefined) {
      assignments.push(
        Prisma.sql`"variablesJson" = ${JSON.stringify(this.normalizeStringArray(dto.variables))}::jsonb`,
      );
    }

    if (dto.model !== undefined) {
      assignments.push(Prisma.sql`"model" = ${dto.model}`);
    }

    if (dto.temperature !== undefined) {
      assignments.push(
        Prisma.sql`"temperature" = ${this.toDecimal(dto.temperature)}`,
      );
    }

    if (dto.maxTokens !== undefined) {
      assignments.push(Prisma.sql`"maxTokens" = ${dto.maxTokens}`);
    }

    if (dto.status !== undefined) {
      assignments.push(Prisma.sql`"status" = ${dto.status}`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی قالب پرامپت ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AiPromptTemplate"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${templateId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'ai.template.updated',
      'قالب پرامپت هوشمند توسط ادمین به‌روزرسانی شد.',
      templateId,
      actorId,
      {
        templateId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      template: await this.findTemplate(templateId, true),
    };
  }

  async deleteTemplate(templateId: string, actorId?: string) {
    await this.findTemplateRow(templateId, false);
    await this.softDelete('AiPromptTemplate', templateId);

    await this.createSystemEvent(
      'ai.template.deleted',
      'قالب پرامپت هوشمند توسط ادمین حذف نرم شد.',
      templateId,
      actorId,
      {
        templateId,
      },
    );

    return {
      success: true,
      message: 'قالب پرامپت با موفقیت حذف شد.',
    };
  }

  async restoreTemplate(templateId: string, actorId?: string) {
    await this.findTemplateRow(templateId, true);
    await this.restore('AiPromptTemplate', templateId);

    await this.createSystemEvent(
      'ai.template.restored',
      'قالب پرامپت هوشمند توسط ادمین بازگردانی شد.',
      templateId,
      actorId,
      {
        templateId,
      },
    );

    return {
      template: await this.findTemplate(templateId, true),
    };
  }

  async findKnowledge(query: AdminQueryAiDto) {
    const where = this.buildKnowledgeWhere(query);

    const rows = await this.prisma.$queryRaw<AiKnowledgeDocumentRow[]>(
      Prisma.sql`
          ${this.knowledgeSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            k."language" ASC,
            k."key" ASC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapKnowledge(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createKnowledge(dto: AdminCreateAiKnowledgeDto, actorId?: string) {
    const now = new Date();

    const key = this.normalizeKey(dto.key);

    await this.assertKnowledgeKeyUnique(key);

    const documentId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AiKnowledgeDocument" (
          "id",
          "key",
          "title",
          "sourceType",
          "language",
          "content",
          "tagsJson",
          "status",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${documentId},
          ${key},
          ${dto.title},
          ${dto.sourceType ?? 'MANUAL'},
          ${this.normalizeLanguage(dto.language)},
          ${dto.content},
          ${JSON.stringify(this.normalizeStringArray(dto.tags ?? []))}::jsonb,
          ${dto.isActive === false ? 'DRAFT' : 'ACTIVE'},
          ${actorId ?? null},
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'ai.knowledge.created',
      'سند دانش هوشمند توسط ادمین ایجاد شد.',
      documentId,
      actorId,
      {
        documentId,
        key,
        metadata: dto.metadata ?? {},
      },
    );

    return {
      knowledge: await this.findKnowledgeDocument(documentId, true),
    };
  }

  async findKnowledgeDocument(documentId: string, includeDeleted = true) {
    const row = await this.findKnowledgeRow(documentId, includeDeleted);

    return this.mapKnowledge(row);
  }

  async updateKnowledge(
    documentId: string,
    dto: AdminUpdateAiKnowledgeDto,
    actorId?: string,
  ) {
    const now = new Date();

    const current = await this.findKnowledgeRow(documentId, false);

    const assignments: Prisma.Sql[] = [];

    if (dto.key !== undefined) {
      const key = this.normalizeKey(dto.key);

      if (key !== current.key) {
        await this.assertKnowledgeKeyUnique(key, documentId);
      }

      assignments.push(Prisma.sql`"key" = ${key}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.sourceType !== undefined) {
      assignments.push(Prisma.sql`"sourceType" = ${dto.sourceType}`);
    }

    if (dto.language !== undefined) {
      assignments.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(dto.language)}`,
      );
    }

    if (dto.content !== undefined) {
      assignments.push(Prisma.sql`"content" = ${dto.content}`);
    }

    if (dto.tags !== undefined) {
      assignments.push(
        Prisma.sql`"tagsJson" = ${JSON.stringify(this.normalizeStringArray(dto.tags))}::jsonb`,
      );
    }

    if (dto.isActive !== undefined) {
      assignments.push(
        Prisma.sql`"status" = ${dto.isActive ? 'ACTIVE' : 'DRAFT'}`,
      );
    }

    if (assignments.length === 0 && dto.metadata === undefined) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی سند دانش ارسال نشده است.',
      );
    }

    if (assignments.length > 0) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "AiKnowledgeDocument"
          SET
            ${Prisma.join(assignments, ', ')},
            "updatedAt" = ${now}
          WHERE
            "id" = ${documentId}
            AND "deleted_at" IS NULL
        `,
      );
    }

    if (dto.metadata !== undefined) {
      await this.createSystemEvent(
        'ai.knowledge.metadata.updated',
        'متادیتای سند دانش هوشمند توسط ادمین ثبت شد.',
        documentId,
        actorId,
        {
          documentId,
          metadata: dto.metadata,
        },
      );
    }

    await this.createSystemEvent(
      'ai.knowledge.updated',
      'سند دانش هوشمند توسط ادمین به‌روزرسانی شد.',
      documentId,
      actorId,
      {
        documentId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      knowledge: await this.findKnowledgeDocument(documentId, true),
    };
  }

  async deleteKnowledge(documentId: string, actorId?: string) {
    await this.findKnowledgeRow(documentId, false);
    await this.softDelete('AiKnowledgeDocument', documentId);

    await this.createSystemEvent(
      'ai.knowledge.deleted',
      'سند دانش هوشمند توسط ادمین حذف نرم شد.',
      documentId,
      actorId,
      {
        documentId,
      },
    );

    return {
      success: true,
      message: 'سند دانش با موفقیت حذف شد.',
    };
  }

  async restoreKnowledge(documentId: string, actorId?: string) {
    await this.findKnowledgeRow(documentId, true);
    await this.restore('AiKnowledgeDocument', documentId);

    await this.createSystemEvent(
      'ai.knowledge.restored',
      'سند دانش هوشمند توسط ادمین بازگردانی شد.',
      documentId,
      actorId,
      {
        documentId,
      },
    );

    return {
      knowledge: await this.findKnowledgeDocument(documentId, true),
    };
  }

  async findGuardrails(query: AdminQueryAiDto) {
    const where = this.buildGuardrailWhere(query);

    const rows = await this.prisma.$queryRaw<AiGuardrailRuleRow[]>(
      Prisma.sql`
          ${this.guardrailSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            g."priority" DESC,
            g."ruleType" ASC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapGuardrail(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createGuardrail(dto: AdminCreateAiGuardrailDto, actorId?: string) {
    const now = new Date();

    const key = this.normalizeKey(dto.key);

    this.assertRegex(dto.pattern);
    await this.assertGuardrailKeyUnique(key);

    const ruleId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AiGuardrailRule" (
          "id",
          "name",
          "ruleType",
          "pattern",
          "action",
          "message",
          "isActive",
          "priority",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${ruleId},
          ${dto.title ?? key},
          ${key},
          ${dto.pattern},
          ${dto.action ?? 'WARN'},
          ${dto.message ?? null},
          ${dto.isActive ?? true},
          ${this.priorityFromSeverity(dto.severity ?? 'MEDIUM')},
          ${actorId ?? null},
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'ai.guardrail.created',
      'قانون محافظ هوشمند توسط ادمین ایجاد شد.',
      ruleId,
      actorId,
      {
        ruleId,
        key,
      },
    );

    return {
      guardrail: await this.findGuardrail(ruleId, true),
    };
  }

  async findGuardrail(ruleId: string, includeDeleted = true) {
    const row = await this.findGuardrailRow(ruleId, includeDeleted);

    return this.mapGuardrail(row);
  }

  async updateGuardrail(
    ruleId: string,
    dto: AdminUpdateAiGuardrailDto,
    actorId?: string,
  ) {
    const now = new Date();

    const current = await this.findGuardrailRow(ruleId, false);

    const assignments: Prisma.Sql[] = [];

    if (dto.key !== undefined) {
      const key = this.normalizeKey(dto.key);

      if (key !== current.key) {
        await this.assertGuardrailKeyUnique(key, ruleId);
      }

      assignments.push(Prisma.sql`"ruleType" = ${key}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"name" = ${dto.title}`);
    }

    if (dto.pattern !== undefined) {
      this.assertRegex(dto.pattern);

      assignments.push(Prisma.sql`"pattern" = ${dto.pattern}`);
    }

    if (dto.severity !== undefined) {
      assignments.push(
        Prisma.sql`"priority" = ${this.priorityFromSeverity(dto.severity)}`,
      );
    }

    if (dto.action !== undefined) {
      assignments.push(Prisma.sql`"action" = ${dto.action}`);
    }

    if (dto.message !== undefined) {
      assignments.push(Prisma.sql`"message" = ${dto.message}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی قانون محافظ ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AiGuardrailRule"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${ruleId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'ai.guardrail.updated',
      'قانون محافظ هوشمند توسط ادمین به‌روزرسانی شد.',
      ruleId,
      actorId,
      {
        ruleId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      guardrail: await this.findGuardrail(ruleId, true),
    };
  }

  async deleteGuardrail(ruleId: string, actorId?: string) {
    await this.findGuardrailRow(ruleId, false);
    await this.softDelete('AiGuardrailRule', ruleId);

    await this.createSystemEvent(
      'ai.guardrail.deleted',
      'قانون محافظ هوشمند توسط ادمین حذف نرم شد.',
      ruleId,
      actorId,
      {
        ruleId,
      },
    );

    return {
      success: true,
      message: 'قانون محافظ با موفقیت حذف شد.',
    };
  }

  async restoreGuardrail(ruleId: string, actorId?: string) {
    await this.findGuardrailRow(ruleId, true);
    await this.restore('AiGuardrailRule', ruleId);

    await this.createSystemEvent(
      'ai.guardrail.restored',
      'قانون محافظ هوشمند توسط ادمین بازگردانی شد.',
      ruleId,
      actorId,
      {
        ruleId,
      },
    );

    return {
      guardrail: await this.findGuardrail(ruleId, true),
    };
  }

  async findRecommendations(query: AdminQueryAiDto) {
    const where = this.buildRecommendationWhere(query);

    const rows = await this.prisma.$queryRaw<AiRecommendationRow[]>(
      Prisma.sql`
          ${this.recommendationSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            rec."score" DESC,
            rec."createdAt" DESC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapRecommendation(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createRecommendation(
    dto: AdminCreateAiRecommendationDto,
    actorId?: string,
  ) {
    const now = new Date();

    const recommendationId = randomUUID();

    const targetType = String(dto.targetType);

    const targetId = dto.targetId ?? null;

    const productId = targetType === 'PRODUCT' ? targetId : null;

    const userId =
      targetType === 'USER' || targetType === 'CUSTOMER' ? targetId : null;

    const metadata = {
      title: dto.title,
      message: dto.message,
      severity: dto.severity ?? 'MEDIUM',
      adminStatus: 'OPEN',
      actorId: actorId ?? null,
      targetType,
      targetId,
      ...this.toRecord(dto.metadata),
    };

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AiRecommendation" (
          "id",
          "type",
          "productId",
          "userId",
          "reason",
          "score",
          "metadata",
          "expiresAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${recommendationId},
          ${targetType},
          ${productId},
          ${userId},
          ${dto.message},
          ${this.scoreFromSeverity(dto.severity ?? 'MEDIUM')},
          ${JSON.stringify(metadata)}::jsonb,
          NULL,
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'ai.recommendation.created',
      'پیشنهاد هوشمند توسط ادمین ایجاد شد.',
      recommendationId,
      actorId,
      {
        recommendationId,
        targetType: dto.targetType,
      },
    );

    return {
      recommendation: await this.findRecommendation(recommendationId, true),
    };
  }

  async findRecommendation(recommendationId: string, includeDeleted = true) {
    const row = await this.findRecommendationRow(
      recommendationId,
      includeDeleted,
    );

    return this.mapRecommendation(row);
  }

  async updateRecommendationStatus(
    recommendationId: string,
    dto: AdminUpdateAiRecommendationStatusDto,
    actorId?: string,
  ) {
    const now = new Date();

    await this.findRecommendationRow(recommendationId, false);

    const patch = {
      adminStatus: dto.status,
      statusReason: dto.reason ?? null,
      resolvedById: ['RESOLVED', 'DISMISSED'].includes(dto.status)
        ? (actorId ?? null)
        : null,
      resolvedAt: ['RESOLVED', 'DISMISSED'].includes(dto.status)
        ? now.toISOString()
        : null,
    };

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AiRecommendation"
        SET
          "metadata" = COALESCE("metadata", '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
          "updatedAt" = ${now}
        WHERE
          "id" = ${recommendationId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'ai.recommendation.status.updated',
      'وضعیت پیشنهاد هوشمند توسط ادمین تغییر کرد.',
      recommendationId,
      actorId,
      {
        recommendationId,
        status: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      recommendation: await this.findRecommendation(recommendationId, true),
    };
  }

  async deleteRecommendation(recommendationId: string, actorId?: string) {
    await this.findRecommendationRow(recommendationId, false);
    await this.softDelete('AiRecommendation', recommendationId);

    await this.createSystemEvent(
      'ai.recommendation.deleted',
      'پیشنهاد هوشمند توسط ادمین حذف نرم شد.',
      recommendationId,
      actorId,
      {
        recommendationId,
      },
    );

    return {
      success: true,
      message: 'پیشنهاد هوشمند با موفقیت حذف شد.',
    };
  }

  async createNote(entityKey: string, dto: AdminAiNoteDto, actorId?: string) {
    const noteId = await this.createSystemEvent(
      'ai.note.created',
      'یادداشت مدیریتی برای هوشمندی ثبت شد.',
      entityKey,
      actorId,
      {
        entityKey,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت هوشمندی با موفقیت ثبت شد.',
    };
  }

  async getNotes(entityKey: string, limit = 50) {
    const notes = await this.findNotes(entityKey, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        entityKey,
        total: notes.length,
      },
    };
  }

  async getAllNotes(limit = 50) {
    const notes = await this.findNotes(null, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        total: notes.length,
      },
    };
  }

  async findForExport(query: AdminAiExportQueryDto) {
    const entity = query.entity ?? 'runs';

    if (entity === 'templates') {
      return (
        await this.findTemplates({
          q: query.q,
          taskType: query.taskType,
        })
      ).data;
    }

    if (entity === 'knowledge') {
      return (
        await this.findKnowledge({
          q: query.q,
        })
      ).data;
    }

    if (entity === 'guardrails') {
      return (
        await this.findGuardrails({
          q: query.q,
        })
      ).data;
    }

    if (entity === 'recommendations') {
      return (
        await this.findRecommendations({
          q: query.q,
        })
      ).data;
    }

    return (
      await this.findRuns({
        page: 1,
        limit: 200,
        q: query.q,
        taskType: query.taskType,
      })
    ).data;
  }

  private async executeTask(dto: AdminRunAiTaskDto, runId: string) {
    if (dto.taskType === 'STORE_HEALTH_SUMMARY') {
      return this.generateStoreHealthSummary();
    }

    if (dto.taskType === 'SALES_INSIGHT') {
      return this.generateSalesInsight();
    }

    if (dto.taskType === 'SEO_REVIEW') {
      return this.generateSeoReview(runId);
    }

    if (dto.taskType === 'SUPPORT_SUMMARY') {
      return this.generateSupportSummary();
    }

    if (dto.taskType === 'SEARCH_INSIGHT') {
      return this.generateSearchInsight();
    }

    return this.generateCustomPrompt(dto);
  }

  private async generateStoreHealthSummary() {
    const [orders, payments, users, products, support] = await Promise.all([
      this.prisma.$queryRaw<MetricRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count",
              COALESCE(SUM("totalAmount"), 0)::numeric AS "amount"
            FROM "Order"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
          `,
      ),
      this.prisma.$queryRaw<MetricRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count",
              COALESCE(SUM("amount"), 0)::numeric AS "amount"
            FROM "Payment"
            WHERE
              "deleted_at" IS NULL
              AND "paymentStatus"::text = 'COMPLETED'
              AND "createdAt" >= NOW() - INTERVAL '30 days'
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "User"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
          `,
      ),
      this.prisma.$queryRaw<
        Array<{
          active: number | bigint;
          inactive: number | bigint;
        }>
      >(
        Prisma.sql`
            SELECT
              COUNT(*) FILTER (
                WHERE "deleted_at" IS NULL AND "status"::text <> 'INACTIVE'
              )::int AS "active",
              COUNT(*) FILTER (
                WHERE "deleted_at" IS NULL AND "status"::text = 'INACTIVE'
              )::int AS "inactive"
            FROM "Product"
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "SupportTicket"
            WHERE
              "deleted_at" IS NULL
              AND "status" IN ('OPEN', 'PENDING')
          `,
      ),
    ]);

    const warnings: string[] = [];

    if (this.toNumber(support[0]?.count) > 20) {
      warnings.push(
        'تعداد تیکت‌های باز یا در انتظار زیاد است و نیاز به بررسی تیم پشتیبانی دارد.',
      );
    }

    if (this.toNumber(products[0]?.inactive) > 0) {
      warnings.push(
        'برخی محصولات غیرفعال هستند و ممکن است روی فروش اثر بگذارند.',
      );
    }

    return {
      title: 'خلاصه سلامت فروشگاه',
      period: '۳۰ روز اخیر',
      metrics: {
        orderCount: this.toNumber(orders[0]?.count),
        grossRevenue: this.toDecimalString(orders[0]?.amount),
        successfulPaymentCount: this.toNumber(payments[0]?.count),
        paidRevenue: this.toDecimalString(payments[0]?.amount),
        newCustomers: this.toNumber(users[0]?.count),
        activeProducts: this.toNumber(products[0]?.active),
        inactiveProducts: this.toNumber(products[0]?.inactive),
        openSupportTickets: this.toNumber(support[0]?.count),
      },
      warnings,
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateSalesInsight() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        period: Date;
        orderCount: number | bigint;
        revenue: unknown;
      }>
    >(
      Prisma.sql`
          SELECT
            DATE_TRUNC('day', "createdAt") AS "period",
            COUNT(*)::int AS "orderCount",
            COALESCE(SUM("totalAmount"), 0)::numeric AS "revenue"
          FROM "Order"
          WHERE
            "deleted_at" IS NULL
            AND "createdAt" >= NOW() - INTERVAL '14 days'
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY "period" ASC
        `,
    );

    return {
      title: 'تحلیل فروش',
      period: '۱۴ روز اخیر',
      rows: rows.map((row) => ({
        period: row.period.toISOString(),
        orderCount: this.toNumber(row.orderCount),
        revenue: this.toDecimalString(row.revenue),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateSeoReview(runId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        total: number | bigint;
        missingMetaTitle: number | bigint;
        missingMetaDescription: number | bigint;
        noIndexCount: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "total",
            COUNT(*) FILTER (
              WHERE "metaTitle" IS NULL OR "metaTitle" = ''
            )::int AS "missingMetaTitle",
            COUNT(*) FILTER (
              WHERE "metaDescription" IS NULL OR "metaDescription" = ''
            )::int AS "missingMetaDescription",
            COUNT(*) FILTER (
              WHERE "noIndex" = TRUE
            )::int AS "noIndexCount"
          FROM "CmsPage"
          WHERE "deleted_at" IS NULL
        `,
    );

    const row = rows[0];

    if (this.toNumber(row?.missingMetaTitle) > 0) {
      await this.createRecommendationFromRun(
        runId,
        'SEO',
        null,
        'صفحات بدون Meta Title',
        'برخی صفحات محتوایی عنوان سئو ندارند. بهتر است برای افزایش کیفیت نتایج جست‌وجو تکمیل شوند.',
        'HIGH',
        {
          missingMetaTitle: this.toNumber(row?.missingMetaTitle),
        },
      );
    }

    return {
      title: 'بازبینی سئو',
      metrics: {
        totalPages: this.toNumber(row?.total),
        missingMetaTitle: this.toNumber(row?.missingMetaTitle),
        missingMetaDescription: this.toNumber(row?.missingMetaDescription),
        noIndexCount: this.toNumber(row?.noIndexCount),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateSupportSummary() {
    const ticketRows = await this.prisma.$queryRaw<
      Array<{
        status: string;
        count: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            "status",
            COUNT(*)::int AS "count"
          FROM "SupportTicket"
          WHERE
            "deleted_at" IS NULL
            AND "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY "status"
          ORDER BY "count" DESC
        `,
    );

    const chatRows = await this.prisma.$queryRaw<
      Array<{
        status: string;
        count: number | bigint;
        unreadByAdmin: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            "status",
            COUNT(*)::int AS "count",
            COALESCE(SUM("unreadByAdmin"), 0)::int AS "unreadByAdmin"
          FROM "SupportChatConversation"
          WHERE
            "deleted_at" IS NULL
            AND "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY "status"
          ORDER BY "count" DESC
        `,
    );

    return {
      title: 'خلاصه پشتیبانی',
      period: '۳۰ روز اخیر',
      tickets: ticketRows.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
      })),
      chats: chatRows.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
        unreadByAdmin: this.toNumber(row.unreadByAdmin),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateSearchInsight() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        normalizedQuery: string;
        count: number | bigint;
        averageResultCount: unknown;
      }>
    >(
      Prisma.sql`
          SELECT
            "normalizedQuery",
            COUNT(*)::int AS "count",
            COALESCE(AVG("resultCount"), 0)::numeric AS "averageResultCount"
          FROM "SearchQueryLog"
          WHERE
            "deleted_at" IS NULL
            AND "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY "normalizedQuery"
          ORDER BY "count" DESC
          LIMIT 20
        `,
    );

    return {
      title: 'تحلیل جست‌وجوی کاربران',
      period: '۳۰ روز اخیر',
      topQueries: rows.map((row) => ({
        query: row.normalizedQuery,
        count: this.toNumber(row.count),
        averageResultCount: this.toDecimalString(row.averageResultCount),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateCustomPrompt(dto: AdminRunAiTaskDto) {
    if (!dto.promptTemplateId) {
      throw new BadRequestException(
        'برای اجرای پرامپت سفارشی، شناسه قالب پرامپت الزامی است.',
      );
    }

    const template = await this.findTemplateRow(dto.promptTemplateId, false);

    if (template.status !== 'ACTIVE') {
      throw new BadRequestException('قالب پرامپت انتخاب‌شده فعال نیست.');
    }

    const input = this.toRecord(dto.input);

    const variables = this.toRecord(input.variables);

    return {
      title: 'پرامپت سفارشی آماده اجرا',
      template: {
        id: template.id,
        key: template.key,
        title: template.title,
        model: dto.model ?? template.model,
      },
      renderedPrompt: {
        system: this.renderTemplate(template.systemPrompt, variables),
        user: this.renderTemplate(template.userPrompt, variables),
      },
      variables,
      status: 'READY_FOR_PROVIDER',
      generatedAt: new Date().toISOString(),
    };
  }

  private async finishRun(
    runId: string,
    status: string,
    output: Record<string, unknown>,
    guardrails: GuardrailMatch[],
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void> {
    const outputJson = {
      ...output,
      _guardrails: guardrails,
    };

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AiRunLog"
        SET
          "status" = ${status},
          "outputJson" = ${JSON.stringify(outputJson)}::jsonb,
          "errorMessage" = ${errorMessage},
          "latencyMs" = ${durationMs}
        WHERE "id" = ${runId}
      `,
    );
  }

  private async evaluateGuardrails(
    input: Record<string, unknown>,
  ): Promise<GuardrailMatch[]> {
    const text = JSON.stringify(input);

    const rules = await this.prisma.$queryRaw<AiGuardrailRuleRow[]>(
      Prisma.sql`
          ${this.guardrailSelectSql()}
          WHERE
            g."deleted_at" IS NULL
            AND g."isActive" = TRUE
            AND g."pattern" IS NOT NULL
        `,
    );

    const matches: GuardrailMatch[] = [];

    for (const rule of rules) {
      if (!rule.pattern) {
        continue;
      }

      const regex = new RegExp(rule.pattern, 'iu');

      if (!regex.test(text)) {
        continue;
      }

      matches.push({
        ruleId: rule.id,
        key: rule.key,
        title: rule.title,
        severity: rule.severity,
        action: rule.action,
        message: rule.message ?? 'درخواست با قانون محافظ هوشمند تطبیق دارد.',
      });
    }

    return matches;
  }

  private async createRecommendationFromRun(
    runId: string,
    targetType: string,
    targetId: string | null,
    title: string,
    message: string,
    severity: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();

    const recommendationMetadata = {
      ...metadata,
      title,
      message,
      severity,
      adminStatus: 'OPEN',
      createdByRunId: runId,
    };

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AiRecommendation" (
          "id",
          "type",
          "productId",
          "userId",
          "reason",
          "score",
          "metadata",
          "expiresAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${targetType},
          ${targetType === 'PRODUCT' ? targetId : null},
          ${targetType === 'USER' ? targetId : null},
          ${message},
          ${this.scoreFromSeverity(severity)},
          ${JSON.stringify(recommendationMetadata)}::jsonb,
          NULL,
          ${now},
          ${now}
        )
      `,
    );
  }

  private runSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        r."id",
        r."taskType",
        r."status",
        NULL::text AS "promptTemplateId",
        r."promptKey",
        r."provider",
        r."model",
        r."inputJson",
        r."outputJson",
        COALESCE(r."outputJson" -> '_guardrails', '[]'::jsonb) AS "guardrailResultJson",
        r."tokenUsageJson",
        r."errorMessage",
        r."latencyMs" AS "durationMs",
        r."userId" AS "createdById",
        r."createdAt" AS "startedAt",
        CASE
          WHEN r."latencyMs" IS NULL THEN NULL
          ELSE r."createdAt" + (r."latencyMs" * INTERVAL '1 millisecond')
        END AS "finishedAt",
        r."createdAt",
        CASE
          WHEN r."latencyMs" IS NULL THEN r."createdAt"
          ELSE r."createdAt" + (r."latencyMs" * INTERVAL '1 millisecond')
        END AS "updatedAt",
        r."deleted_at" AS "deletedAt"
      FROM "AiRunLog" r
    `;
  }

  private templateSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        t."id",
        t."key",
        t."title",
        t."description",
        t."taskType",
        t."systemPrompt",
        t."userPrompt",
        t."variablesJson",
        t."model",
        t."temperature",
        t."maxTokens",
        t."status",
        t."createdById",
        t."createdAt",
        t."updatedAt",
        t."deleted_at" AS "deletedAt"
      FROM "AiPromptTemplate" t
    `;
  }

  private knowledgeSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        k."id",
        k."key",
        k."title",
        k."sourceType",
        k."language",
        k."content",
        k."tagsJson",
        '{}'::jsonb AS "metadata",
        (k."status" = 'ACTIVE') AS "isActive",
        k."status",
        k."createdById",
        k."createdAt",
        k."updatedAt",
        k."deleted_at" AS "deletedAt"
      FROM "AiKnowledgeDocument" k
    `;
  }

  private guardrailSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        g."id",
        g."ruleType" AS "key",
        g."name" AS "title",
        g."pattern",
        CASE
          WHEN g."priority" >= 80 THEN 'HIGH'
          WHEN g."priority" >= 50 THEN 'MEDIUM'
          ELSE 'LOW'
        END AS "severity",
        g."action",
        g."message",
        g."isActive",
        g."ruleType",
        g."priority",
        g."createdById",
        g."createdAt",
        g."updatedAt",
        g."deleted_at" AS "deletedAt"
      FROM "AiGuardrailRule" g
    `;
  }

  private recommendationSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        rec."id",
        rec."type" AS "targetType",
        COALESCE(rec."productId", rec."userId") AS "targetId",
        COALESCE(rec."metadata" ->> 'title', rec."type") AS "title",
        COALESCE(rec."reason", rec."metadata" ->> 'message', '') AS "message",
        COALESCE(
          rec."metadata" ->> 'severity',
          CASE
            WHEN rec."score" >= 0.8 THEN 'HIGH'
            WHEN rec."score" >= 0.5 THEN 'MEDIUM'
            ELSE 'LOW'
          END
        ) AS "severity",
        COALESCE(
          rec."metadata" ->> 'adminStatus',
          CASE
            WHEN rec."expiresAt" IS NOT NULL AND rec."expiresAt" < NOW() THEN 'EXPIRED'
            ELSE 'OPEN'
          END
        ) AS "status",
        rec."metadata",
        rec."metadata" ->> 'createdByRunId' AS "createdByRunId",
        rec."metadata" ->> 'resolvedById' AS "resolvedById",
        NULL::timestamp AS "resolvedAt",
        rec."createdAt",
        rec."updatedAt",
        rec."deleted_at" AS "deletedAt"
      FROM "AiRecommendation" rec
    `;
  }

  private buildRunWhere(query: AdminQueryAiDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          r."taskType" ILIKE ${`%${query.q}%`}
          OR r."status" ILIKE ${`%${query.q}%`}
          OR r."promptKey" ILIKE ${`%${query.q}%`}
          OR r."provider" ILIKE ${`%${query.q}%`}
          OR r."model" ILIKE ${`%${query.q}%`}
          OR r."errorMessage" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.taskType) {
      where.push(Prisma.sql`r."taskType" = ${query.taskType}`);
    }

    if (query.runStatus) {
      where.push(Prisma.sql`r."status" = ${query.runStatus}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`r."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`r."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildTemplateWhere(query: AdminQueryAiDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`t."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          t."key" ILIKE ${`%${query.q}%`}
          OR t."title" ILIKE ${`%${query.q}%`}
          OR t."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.key) {
      where.push(
        Prisma.sql`t."key" ILIKE ${`%${this.normalizeKey(query.key)}%`}`,
      );
    }

    if (query.taskType) {
      where.push(Prisma.sql`t."taskType" = ${query.taskType}`);
    }

    if (query.templateStatus) {
      where.push(Prisma.sql`t."status" = ${query.templateStatus}`);
    }

    return where;
  }

  private buildKnowledgeWhere(query: AdminQueryAiDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`k."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          k."key" ILIKE ${`%${query.q}%`}
          OR k."title" ILIKE ${`%${query.q}%`}
          OR k."content" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.key) {
      where.push(
        Prisma.sql`k."key" ILIKE ${`%${this.normalizeKey(query.key)}%`}`,
      );
    }

    if (query.language) {
      where.push(
        Prisma.sql`k."language" = ${this.normalizeLanguage(query.language)}`,
      );
    }

    if (query.isActive !== undefined) {
      where.push(
        Prisma.sql`k."status" = ${query.isActive ? 'ACTIVE' : 'DRAFT'}`,
      );
    }

    return where;
  }

  private buildGuardrailWhere(query: AdminQueryAiDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`g."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          g."ruleType" ILIKE ${`%${query.q}%`}
          OR g."name" ILIKE ${`%${query.q}%`}
          OR g."message" ILIKE ${`%${query.q}%`}
          OR g."pattern" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.severity) {
      where.push(
        Prisma.sql`(
          CASE
            WHEN g."priority" >= 80 THEN 'HIGH'
            WHEN g."priority" >= 50 THEN 'MEDIUM'
            ELSE 'LOW'
          END
        ) = ${query.severity}`,
      );
    }

    if (query.action) {
      where.push(Prisma.sql`g."action" = ${query.action}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`g."isActive" = ${query.isActive}`);
    }

    return where;
  }

  private buildRecommendationWhere(query: AdminQueryAiDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`rec."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          rec."type" ILIKE ${`%${query.q}%`}
          OR rec."reason" ILIKE ${`%${query.q}%`}
          OR rec."metadata"::text ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.entityId) {
      where.push(
        Prisma.sql`(
          rec."id" = ${query.entityId}
          OR rec."productId" = ${query.entityId}
          OR rec."userId" = ${query.entityId}
        )`,
      );
    }

    if (query.severity) {
      where.push(
        Prisma.sql`COALESCE(
          rec."metadata" ->> 'severity',
          CASE
            WHEN rec."score" >= 0.8 THEN 'HIGH'
            WHEN rec."score" >= 0.5 THEN 'MEDIUM'
            ELSE 'LOW'
          END
        ) = ${query.severity}`,
      );
    }

    if (query.recommendationStatus) {
      where.push(
        Prisma.sql`COALESCE(
          rec."metadata" ->> 'adminStatus',
          CASE
            WHEN rec."expiresAt" IS NOT NULL AND rec."expiresAt" < NOW() THEN 'EXPIRED'
            ELSE 'OPEN'
          END
        ) = ${query.recommendationStatus}`,
      );
    }

    return where;
  }

  private async findTemplateRow(
    templateId: string,
    includeDeleted: boolean,
  ): Promise<AiPromptTemplateRow> {
    const where: Prisma.Sql[] = [Prisma.sql`t."id" = ${templateId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`t."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AiPromptTemplateRow[]>(
      Prisma.sql`
          ${this.templateSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('قالب پرامپت هوشمند یافت نشد.');
    }

    return row;
  }

  private async findKnowledgeRow(
    documentId: string,
    includeDeleted: boolean,
  ): Promise<AiKnowledgeDocumentRow> {
    const where: Prisma.Sql[] = [Prisma.sql`k."id" = ${documentId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`k."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AiKnowledgeDocumentRow[]>(
      Prisma.sql`
          ${this.knowledgeSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('سند دانش هوشمند یافت نشد.');
    }

    return row;
  }

  private async findGuardrailRow(
    ruleId: string,
    includeDeleted: boolean,
  ): Promise<AiGuardrailRuleRow> {
    const where: Prisma.Sql[] = [Prisma.sql`g."id" = ${ruleId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`g."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AiGuardrailRuleRow[]>(
      Prisma.sql`
          ${this.guardrailSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('قانون محافظ هوشمند یافت نشد.');
    }

    return row;
  }

  private async findRecommendationRow(
    recommendationId: string,
    includeDeleted: boolean,
  ): Promise<AiRecommendationRow> {
    const where: Prisma.Sql[] = [Prisma.sql`rec."id" = ${recommendationId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`rec."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AiRecommendationRow[]>(
      Prisma.sql`
          ${this.recommendationSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('پیشنهاد هوشمند یافت نشد.');
    }

    return row;
  }

  private async assertTemplateKeyUnique(
    key: string,
    exceptId?: string,
  ): Promise<void> {
    await this.assertKeyUnique(
      'AiPromptTemplate',
      'key',
      key,
      exceptId,
      'کلید قالب پرامپت تکراری است.',
    );
  }

  private async assertKnowledgeKeyUnique(
    key: string,
    exceptId?: string,
  ): Promise<void> {
    await this.assertKeyUnique(
      'AiKnowledgeDocument',
      'key',
      key,
      exceptId,
      'کلید سند دانش تکراری است.',
    );
  }

  private async assertGuardrailKeyUnique(
    key: string,
    exceptId?: string,
  ): Promise<void> {
    await this.assertKeyUnique(
      'AiGuardrailRule',
      'ruleType',
      key,
      exceptId,
      'کلید قانون محافظ تکراری است.',
    );
  }

  private async assertKeyUnique(
    tableName: string,
    columnName: string,
    key: string,
    exceptId: string | undefined,
    message: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER(${Prisma.raw(`"${columnName}"`)}) = LOWER(${key})`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptId) {
      where.push(Prisma.sql`"id" <> ${exceptId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM ${Prisma.raw(`"${tableName}"`)}
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(message);
    }
  }

  private async softDelete(tableName: string, id: string): Promise<void> {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${id}
          AND "deleted_at" IS NULL
      `,
    );
  }

  private async restore(tableName: string, id: string): Promise<void> {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${id}
      `,
    );
  }

  private findNotes(
    entityKey: string | null,
    limit: number,
  ): Promise<EventRow[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`"deleted_at" IS NULL`,
      Prisma.sql`"name" = 'ai.note.created'`,
    ];

    if (entityKey) {
      where.push(Prisma.sql`"data" #>> '{entityKey}' = ${entityKey}`);
    }

    return this.prisma.$queryRaw<EventRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "name",
          "description",
          "category",
          "userId",
          "data",
          "timestamp",
          "createdAt"
        FROM "Event"
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private async createSystemEvent(
    name: string,
    description: string,
    entityId: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<string> {
    const now = new Date();

    const eventId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Event" (
          "id",
          "name",
          "description",
          "category",
          "timestamp",
          "userId",
          "data",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${eventId},
          ${name},
          ${description},
          'ai',
          ${now},
          ${actorId ?? null},
          ${JSON.stringify({
            entityId,
            ...data,
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return eventId;
  }

  private mapRun(row: AiRunLogRow) {
    return {
      id: row.id,
      taskType: row.taskType,
      status: row.status,
      promptTemplateId: row.promptTemplateId,
      promptKey: row.promptKey,
      provider: row.provider,
      model: row.model,
      input: row.inputJson,
      output: row.outputJson,
      guardrails: row.guardrailResultJson,
      tokenUsage: row.tokenUsageJson,
      errorMessage: row.errorMessage,
      durationMs: row.durationMs,
      latencyMs: row.durationMs,
      createdById: row.createdById,
      startedAt: row.startedAt.toISOString(),
      startedAtFa: formatPersianDateTime(row.startedAt),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      finishedAtFa: formatPersianDateTime(row.finishedAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: formatPersianDateTime(row.deletedAt),
    };
  }

  private mapTemplate(row: AiPromptTemplateRow) {
    return {
      id: row.id,
      key: row.key,
      title: row.title,
      description: row.description,
      taskType: row.taskType,
      systemPrompt: row.systemPrompt,
      userPrompt: row.userPrompt,
      variables: this.toStringArray(row.variablesJson),
      model: row.model,
      temperature:
        row.temperature === null ? null : this.toDecimalString(row.temperature),
      maxTokens: row.maxTokens,
      status: row.status,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: formatPersianDateTime(row.deletedAt),
    };
  }

  private mapKnowledge(row: AiKnowledgeDocumentRow) {
    return {
      id: row.id,
      key: row.key,
      title: row.title,
      sourceType: row.sourceType,
      language: row.language,
      content: row.content,
      tags: this.toStringArray(row.tagsJson),
      metadata: row.metadata,
      isActive: row.isActive,
      status: row.status,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: formatPersianDateTime(row.deletedAt),
    };
  }

  private mapGuardrail(row: AiGuardrailRuleRow) {
    return {
      id: row.id,
      key: row.key,
      title: row.title,
      name: row.title,
      ruleType: row.ruleType,
      pattern: row.pattern,
      severity: row.severity,
      priority: row.priority,
      action: row.action,
      message: row.message,
      isActive: row.isActive,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: formatPersianDateTime(row.deletedAt),
    };
  }

  private mapRecommendation(row: AiRecommendationRow) {
    const metadata = this.toRecord(row.metadata);

    const metadataResolvedAt = metadata.resolvedAt;

    const resolvedAtFromMetadata =
      typeof metadataResolvedAt === 'string'
        ? new Date(metadataResolvedAt)
        : null;

    const resolvedAt =
      row.resolvedAt ??
      (resolvedAtFromMetadata && !Number.isNaN(resolvedAtFromMetadata.getTime())
        ? resolvedAtFromMetadata
        : null);

    const metadataResolvedById = metadata.resolvedById;

    const resolvedById =
      row.resolvedById ??
      (typeof metadataResolvedById === 'string' ? metadataResolvedById : null);

    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      title: row.title,
      message: row.message,
      severity: row.severity,
      status: row.status,
      metadata: row.metadata,
      createdByRunId: row.createdByRunId,
      resolvedById,
      resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
      resolvedAtFa: formatPersianDateTime(resolvedAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: formatPersianDateTime(row.deletedAt),
    };
  }
  private mapNote(row: EventRow) {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      note: data.note ?? null,
      isImportant: data.isImportant ?? false,
      visibility: data.visibility ?? 'admin',
      actorId: row.userId,
      createdAt: row.timestamp.toISOString(),
      createdAtFa: formatPersianDateTime(row.timestamp),
    };
  }

  private priorityFromSeverity(severity: string): number {
    const normalized = severity.toUpperCase();

    if (normalized === 'CRITICAL') {
      return 100;
    }

    if (normalized === 'HIGH') {
      return 80;
    }

    if (normalized === 'LOW') {
      return 30;
    }

    return 50;
  }

  private scoreFromSeverity(severity: string): Prisma.Decimal {
    const normalized = severity.toUpperCase();

    if (normalized === 'CRITICAL') {
      return new Prisma.Decimal(1);
    }

    if (normalized === 'HIGH') {
      return new Prisma.Decimal(0.85);
    }

    if (normalized === 'LOW') {
      return new Prisma.Decimal(0.35);
    }

    return new Prisma.Decimal(0.6);
  }

  private normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
  }

  private normalizeLanguage(language?: string): string {
    return language?.trim().toLowerCase() || 'fa';
  }

  private normalizeStringArray(values: string[]): string[] {
    return Array.from(
      new Set(
        values.map((item) => item.trim()).filter((item) => item.length > 0),
      ),
    );
  }

  private normalizePage(page?: number): number {
    if (!page || page < 1) {
      return this.defaultPage;
    }

    return page;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit < 1) {
      return this.defaultLimit;
    }

    return Math.min(limit, this.maxLimit);
  }

  private renderTemplate(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    return template.replace(
      /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
      (_match, key: string) => {
        const value = variables[key];

        if (value === undefined || value === null) {
          return '';
        }

        switch (typeof value) {
          case 'string':
            return value;
          case 'number':
          case 'bigint':
          case 'boolean':
            return String(value);
          default:
            return '';
        }
      },
    );
  }

  private assertRegex(pattern: string): void {
    try {
      new RegExp(pattern, 'iu');
    } catch {
      throw new BadRequestException('الگوی قانون محافظ معتبر نیست.');
    }
  }

  private toDecimal(value: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('مقدار عددی معتبر نیست.');
    }
  }

  private toDecimalString(value: unknown): string {
    if (value === undefined || value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'bigint':
        return this.toDecimal(String(value)).toFixed(2);
      default:
        throw new BadRequestException('مقدار عددی معتبر نیست.');
    }
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (
      typeof value === 'object' &&
      typeof (
        value as {
          toString?: unknown;
        }
      ).toString === 'function'
    ) {
      return Number(
        (
          value as {
            toString: () => string;
          }
        ).toString(),
      );
    }

    switch (typeof value) {
      case 'number':
        return value;
      case 'bigint':
      case 'string':
      case 'boolean':
        return Number(value);
      default:
        return 0;
    }
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
