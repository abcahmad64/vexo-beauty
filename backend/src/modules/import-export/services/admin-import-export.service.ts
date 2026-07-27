import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCreateExportJobDto } from '../dto/admin-create-export-job.dto';

import { AdminCreateImportJobDto } from '../dto/admin-create-import-job.dto';

import { AdminImportExportNoteDto } from '../dto/admin-import-export-note.dto';

import {
  AdminExportEntity,
  AdminImportEntity,
  AdminImportExportFormat,
  AdminImportExportQueryDto,
  AdminImportMode,
} from '../dto/admin-import-export-query.dto';

type CountRow = {
  count: number | bigint;
};

type AdminImportJobRow = {
  id: string;
  entity: string;
  mode: string;
  sourceFormat: string;
  status: string;
  title: string | null;
  rowCount: number;
  successCount: number;
  failureCount: number;
  rowsJson: unknown;
  previewJson: unknown;
  resultJson: unknown;
  errorMessage: string | null;
  createdById: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AdminExportJobRow = {
  id: string;
  entity: string;
  format: string;
  status: string;
  title: string | null;
  filtersJson: unknown;
  resultJson: unknown;
  rowCount: number;
  fileName: string | null;
  mimeType: string | null;
  content: string | null;
  errorMessage: string | null;
  createdById: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
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

type ImportValidationItem = {
  rowIndex: number;
  valid: boolean;
  errors: string[];
};

type ImportRunItem = {
  rowIndex: number;
  success: boolean;
  id?: string;
  action?: string;
  errors?: string[];
};

@Injectable()
export class AdminImportExportService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [importRows, exportRows] = await Promise.all([
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
            FROM "AdminImportJob"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
            GROUP BY "status"
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
              "status",
              COUNT(*)::int AS "count"
            FROM "AdminExportJob"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
            GROUP BY "status"
          `,
      ),
    ]);

    return {
      importsLast30Days: importRows.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
      })),
      exportsLast30Days: exportRows.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
      })),
    };
  }

  async createImportJob(dto: AdminCreateImportJobDto, actorId?: string) {
    if (dto.rows.length === 0) {
      throw new BadRequestException('حداقل یک ردیف برای واردسازی لازم است.');
    }

    const jobId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminImportJob" (
          "id",
          "entity",
          "mode",
          "sourceFormat",
          "status",
          "title",
          "rowCount",
          "rowsJson",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${jobId},
          ${dto.entity},
          ${dto.mode ?? 'UPSERT'},
          ${dto.sourceFormat ?? 'JSON'},
          'PENDING',
          ${dto.title ?? null},
          ${dto.rows.length},
          ${JSON.stringify(dto.rows)}::jsonb,
          ${actorId ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'import_export.import.created',
      'Job واردسازی مدیریتی ایجاد شد.',
      jobId,
      actorId,
      {
        jobId,
        entity: dto.entity,
        rowCount: dto.rows.length,
      },
    );

    return {
      importJob: await this.findImportJob(jobId, true),
    };
  }

  async previewImportJob(jobId: string, actorId?: string) {
    const job = await this.findImportJobRow(jobId, false);

    this.assertImportJobRunnable(job.status);

    const rows = this.toRecordArray(job.rowsJson);

    const validation = rows.map((row, index) =>
      this.validateImportRow(job.entity as AdminImportEntity, row, index),
    );

    const validCount = validation.filter((item) => item.valid).length;

    const invalidCount = validation.length - validCount;

    const preview = {
      validCount,
      invalidCount,
      items: validation,
    };

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminImportJob"
        SET
          "status" = 'PREVIEWED',
          "previewJson" = ${JSON.stringify(preview)}::jsonb,
          "successCount" = 0,
          "failureCount" = ${invalidCount},
          "updatedAt" = NOW()
        WHERE
          "id" = ${jobId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'import_export.import.previewed',
      'پیش‌نمایش واردسازی مدیریتی انجام شد.',
      jobId,
      actorId,
      {
        jobId,
        validCount,
        invalidCount,
      },
    );

    return {
      importJob: await this.findImportJob(jobId, true),
    };
  }

  async runImportJob(jobId: string, actorId?: string) {
    const job = await this.findImportJobRow(jobId, false);

    this.assertImportJobRunnable(job.status);

    const rows = this.toRecordArray(job.rowsJson);

    const validation = rows.map((row, index) =>
      this.validateImportRow(job.entity as AdminImportEntity, row, index),
    );

    const invalidItems = validation.filter((item) => !item.valid);

    if (invalidItems.length > 0) {
      const result = {
        success: false,
        message: 'اجرای واردسازی به دلیل وجود ردیف نامعتبر متوقف شد.',
        invalidItems,
      };

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "AdminImportJob"
          SET
            "status" = 'FAILED',
            "failureCount" = ${invalidItems.length},
            "resultJson" = ${JSON.stringify(result)}::jsonb,
            "errorMessage" = 'داده‌های واردسازی معتبر نیستند.',
            "finishedAt" = NOW(),
            "updatedAt" = NOW()
          WHERE
            "id" = ${jobId}
            AND "deleted_at" IS NULL
        `,
      );

      return {
        importJob: await this.findImportJob(jobId, true),
      };
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminImportJob"
        SET
          "status" = 'RUNNING',
          "startedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${jobId}
          AND "deleted_at" IS NULL
      `,
    );

    const results: ImportRunItem[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      try {
        const result = await this.importRow(
          job.entity as AdminImportEntity,
          job.mode as AdminImportMode,
          rows[index],
        );

        results.push({
          rowIndex: index,
          success: true,
          id: result.id,
          action: result.action,
        });
      } catch (error) {
        results.push({
          rowIndex: index,
          success: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'خطای نامشخص در واردسازی ردیف',
          ],
        });
      }
    }

    const successCount = results.filter((item) => item.success).length;

    const failureCount = results.length - successCount;

    const finalStatus = failureCount > 0 ? 'FAILED' : 'SUCCESS';

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminImportJob"
        SET
          "status" = ${finalStatus},
          "successCount" = ${successCount},
          "failureCount" = ${failureCount},
          "resultJson" = ${JSON.stringify({ items: results })}::jsonb,
          "errorMessage" = ${failureCount > 0 ? 'برخی ردیف‌ها با خطا مواجه شدند.' : null},
          "finishedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${jobId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'import_export.import.completed',
      'Job واردسازی مدیریتی اجرا شد.',
      jobId,
      actorId,
      {
        jobId,
        status: finalStatus,
        successCount,
        failureCount,
      },
    );

    return {
      importJob: await this.findImportJob(jobId, true),
    };
  }

  async cancelImportJob(jobId: string, actorId?: string) {
    const job = await this.findImportJobRow(jobId, false);

    if (job.status === 'RUNNING') {
      throw new ConflictException('Job در حال اجرا قابل لغو مستقیم نیست.');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminImportJob"
        SET
          "status" = 'CANCELLED',
          "updatedAt" = NOW()
        WHERE
          "id" = ${jobId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'import_export.import.cancelled',
      'Job واردسازی مدیریتی لغو شد.',
      jobId,
      actorId,
      {
        jobId,
      },
    );

    return {
      importJob: await this.findImportJob(jobId, true),
    };
  }

  async findImportJobs(query: AdminImportExportQueryDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildImportWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminImportJobRow[]>(
        Prisma.sql`
            ${this.importSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              j."createdAt" DESC,
              j."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminImportJob" j
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapImportJob(row, false)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findImportJob(jobId: string, includeDeleted = true) {
    const job = await this.findImportJobRow(jobId, includeDeleted);

    const notes = await this.findNotes(
      'import_export.import.note.created',
      'jobId',
      jobId,
      30,
    );

    return {
      ...this.mapImportJob(job, true),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async createExportJob(dto: AdminCreateExportJobDto, actorId?: string) {
    const jobId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminExportJob" (
          "id",
          "entity",
          "format",
          "status",
          "title",
          "filtersJson",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${jobId},
          ${dto.entity},
          ${dto.format ?? 'CSV'},
          'PENDING',
          ${dto.title ?? null},
          ${JSON.stringify(dto.filters ?? {})}::jsonb,
          ${actorId ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'import_export.export.created',
      'Job خروجی مدیریتی ایجاد شد.',
      jobId,
      actorId,
      {
        jobId,
        entity: dto.entity,
        format: dto.format ?? 'CSV',
      },
    );

    return {
      exportJob: await this.findExportJob(jobId, true),
    };
  }

  async runExportJob(jobId: string, actorId?: string) {
    const job = await this.findExportJobRow(jobId, false);

    if (job.status !== 'PENDING' && job.status !== 'FAILED') {
      throw new ConflictException('این Job خروجی در وضعیت قابل اجرا نیست.');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminExportJob"
        SET
          "status" = 'RUNNING',
          "startedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${jobId}
          AND "deleted_at" IS NULL
      `,
    );

    try {
      const rows = this.normalizeRows(
        await this.buildExportRows(
          job.entity as AdminExportEntity,
          this.toRecord(job.filtersJson),
        ),
      );

      const format = job.format as AdminImportExportFormat;

      const content =
        format === 'JSON' ? JSON.stringify(rows, null, 2) : this.toCsv(rows);

      const fileName = this.exportFileName(job.entity, format);

      const mimeType =
        format === 'JSON'
          ? 'application/json; charset=utf-8'
          : 'text/csv; charset=utf-8';

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "AdminExportJob"
          SET
            "status" = 'SUCCESS',
            "rowCount" = ${rows.length},
            "fileName" = ${fileName},
            "mimeType" = ${mimeType},
            "content" = ${content},
            "resultJson" = ${JSON.stringify({ rowCount: rows.length })}::jsonb,
            "finishedAt" = NOW(),
            "updatedAt" = NOW()
          WHERE
            "id" = ${jobId}
            AND "deleted_at" IS NULL
        `,
      );

      await this.createSystemEvent(
        'import_export.export.completed',
        'Job خروجی مدیریتی اجرا شد.',
        jobId,
        actorId,
        {
          jobId,
          entity: job.entity,
          rowCount: rows.length,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'خطای نامشخص در اجرای خروجی';

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "AdminExportJob"
          SET
            "status" = 'FAILED',
            "errorMessage" = ${message},
            "finishedAt" = NOW(),
            "updatedAt" = NOW()
          WHERE
            "id" = ${jobId}
            AND "deleted_at" IS NULL
        `,
      );
    }

    return {
      exportJob: await this.findExportJob(jobId, true),
    };
  }

  async cancelExportJob(jobId: string, actorId?: string) {
    const job = await this.findExportJobRow(jobId, false);

    if (job.status === 'RUNNING') {
      throw new ConflictException(
        'Job خروجی در حال اجرا قابل لغو مستقیم نیست.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminExportJob"
        SET
          "status" = 'CANCELLED',
          "updatedAt" = NOW()
        WHERE
          "id" = ${jobId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'import_export.export.cancelled',
      'Job خروجی مدیریتی لغو شد.',
      jobId,
      actorId,
      {
        jobId,
      },
    );

    return {
      exportJob: await this.findExportJob(jobId, true),
    };
  }

  async findExportJobs(query: AdminImportExportQueryDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildExportWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminExportJobRow[]>(
        Prisma.sql`
            ${this.exportSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              j."createdAt" DESC,
              j."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminExportJob" j
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapExportJob(row, false)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findExportJob(jobId: string, includeDeleted = true) {
    const job = await this.findExportJobRow(jobId, includeDeleted);

    const notes = await this.findNotes(
      'import_export.export.note.created',
      'jobId',
      jobId,
      30,
    );

    return {
      ...this.mapExportJob(job, true),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async downloadExportJob(jobId: string) {
    const job = await this.findExportJobRow(jobId, false);

    if (job.status !== 'SUCCESS') {
      throw new BadRequestException('فایل خروجی هنوز آماده دانلود نیست.');
    }

    if (!job.content || !job.fileName || !job.mimeType) {
      throw new NotFoundException('محتوای خروجی یافت نشد.');
    }

    return {
      fileName: job.fileName,
      mimeType: job.mimeType,
      content: job.content,
    };
  }

  async deleteImportJob(jobId: string, actorId?: string) {
    await this.findImportJobRow(jobId, false);

    await this.softDelete('AdminImportJob', jobId);

    await this.createSystemEvent(
      'import_export.import.deleted',
      'Job واردسازی مدیریتی حذف نرم شد.',
      jobId,
      actorId,
      {
        jobId,
      },
    );

    return {
      success: true,
      message: 'Job واردسازی با موفقیت حذف شد.',
    };
  }

  async restoreImportJob(jobId: string, actorId?: string) {
    await this.findImportJobRow(jobId, true);

    await this.restore('AdminImportJob', jobId);

    await this.createSystemEvent(
      'import_export.import.restored',
      'Job واردسازی مدیریتی بازگردانی شد.',
      jobId,
      actorId,
      {
        jobId,
      },
    );

    return {
      importJob: await this.findImportJob(jobId, true),
    };
  }

  async deleteExportJob(jobId: string, actorId?: string) {
    await this.findExportJobRow(jobId, false);

    await this.softDelete('AdminExportJob', jobId);

    await this.createSystemEvent(
      'import_export.export.deleted',
      'Job خروجی مدیریتی حذف نرم شد.',
      jobId,
      actorId,
      {
        jobId,
      },
    );

    return {
      success: true,
      message: 'Job خروجی با موفقیت حذف شد.',
    };
  }

  async restoreExportJob(jobId: string, actorId?: string) {
    await this.findExportJobRow(jobId, true);

    await this.restore('AdminExportJob', jobId);

    await this.createSystemEvent(
      'import_export.export.restored',
      'Job خروجی مدیریتی بازگردانی شد.',
      jobId,
      actorId,
      {
        jobId,
      },
    );

    return {
      exportJob: await this.findExportJob(jobId, true),
    };
  }

  async createImportNote(
    jobId: string,
    dto: AdminImportExportNoteDto,
    actorId?: string,
  ) {
    await this.findImportJobRow(jobId, true);

    const noteId = await this.createSystemEvent(
      'import_export.import.note.created',
      'یادداشت مدیریتی برای Job واردسازی ثبت شد.',
      jobId,
      actorId,
      {
        jobId,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت واردسازی با موفقیت ثبت شد.',
    };
  }

  async createExportNote(
    jobId: string,
    dto: AdminImportExportNoteDto,
    actorId?: string,
  ) {
    await this.findExportJobRow(jobId, true);

    const noteId = await this.createSystemEvent(
      'import_export.export.note.created',
      'یادداشت مدیریتی برای Job خروجی ثبت شد.',
      jobId,
      actorId,
      {
        jobId,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت خروجی با موفقیت ثبت شد.',
    };
  }

  private async importRow(
    entity: AdminImportEntity,
    mode: AdminImportMode,
    row: Record<string, unknown>,
  ): Promise<{
    id: string;
    action: string;
  }> {
    if (entity === 'BRAND') {
      return this.importBrand(row, mode);
    }

    if (entity === 'CATEGORY') {
      return this.importCategory(row, mode);
    }

    return this.importCoupon(row, mode);
  }

  private async importBrand(
    row: Record<string, unknown>,
    mode: AdminImportMode,
  ) {
    const name = this.requiredString(row.name, 'نام برند الزامی است.');

    const slug = this.requiredString(row.slug, 'اسلاگ برند الزامی است.');

    const existingId = await this.findIdByUniqueText('Brand', 'slug', slug);

    if (mode === 'CREATE' && existingId) {
      throw new ConflictException('برند با این اسلاگ از قبل وجود دارد.');
    }

    if (mode === 'UPDATE' && !existingId) {
      throw new NotFoundException('برند برای به‌روزرسانی یافت نشد.');
    }

    if (existingId) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "Brand"
          SET
            "name" = ${name},
            "description" = ${this.optionalString(row.description)},
            "logoUrl" = ${this.optionalString(row.logoUrl)},
            "website" = ${this.optionalString(row.website)},
            "isActive" = ${this.optionalBoolean(row.isActive, true)},
            "updatedAt" = NOW()
          WHERE
            "id" = ${existingId}
            AND "deleted_at" IS NULL
        `,
      );

      return {
        id: existingId,
        action: 'UPDATED',
      };
    }

    const id = this.optionalString(row.id) ?? randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Brand" (
          "id",
          "name",
          "slug",
          "description",
          "logoUrl",
          "website",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${id},
          ${name},
          ${slug},
          ${this.optionalString(row.description)},
          ${this.optionalString(row.logoUrl)},
          ${this.optionalString(row.website)},
          ${this.optionalBoolean(row.isActive, true)},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      id,
      action: 'CREATED',
    };
  }

  private async importCategory(
    row: Record<string, unknown>,
    mode: AdminImportMode,
  ) {
    const name = this.requiredString(row.name, 'نام دسته‌بندی الزامی است.');

    const slug = this.requiredString(row.slug, 'اسلاگ دسته‌بندی الزامی است.');

    const existingId = await this.findIdByUniqueText('Category', 'slug', slug);

    if (mode === 'CREATE' && existingId) {
      throw new ConflictException('دسته‌بندی با این اسلاگ از قبل وجود دارد.');
    }

    if (mode === 'UPDATE' && !existingId) {
      throw new NotFoundException('دسته‌بندی برای به‌روزرسانی یافت نشد.');
    }

    if (existingId) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "Category"
          SET
            "name" = ${name},
            "description" = ${this.optionalString(row.description)},
            "parentId" = ${this.optionalString(row.parentId)},
            "sortOrder" = ${this.optionalNumber(row.sortOrder, 0)},
            "isActive" = ${this.optionalBoolean(row.isActive, true)},
            "updatedAt" = NOW()
          WHERE
            "id" = ${existingId}
            AND "deleted_at" IS NULL
        `,
      );

      return {
        id: existingId,
        action: 'UPDATED',
      };
    }

    const id = this.optionalString(row.id) ?? randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Category" (
          "id",
          "name",
          "slug",
          "description",
          "parentId",
          "sortOrder",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${id},
          ${name},
          ${slug},
          ${this.optionalString(row.description)},
          ${this.optionalString(row.parentId)},
          ${this.optionalNumber(row.sortOrder, 0)},
          ${this.optionalBoolean(row.isActive, true)},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      id,
      action: 'CREATED',
    };
  }

  private async importCoupon(
    row: Record<string, unknown>,
    mode: AdminImportMode,
  ) {
    const code = this.requiredString(
      row.code,
      'کد کوپن الزامی است.',
    ).toUpperCase();

    const type = this.requiredCouponType(row.type);

    const value = this.decimal(row.value, 'مقدار کوپن معتبر نیست.');

    const startDate = this.optionalDate(row.startDate) ?? new Date();

    const existingId = await this.findIdByUniqueText('Coupon', 'code', code);

    if (mode === 'CREATE' && existingId) {
      throw new ConflictException('کوپن با این کد از قبل وجود دارد.');
    }

    if (mode === 'UPDATE' && !existingId) {
      throw new NotFoundException('کوپن برای به‌روزرسانی یافت نشد.');
    }

    const status = this.requiredCouponStatus(row.status ?? 'ACTIVE');

    if (existingId) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "Coupon"
          SET
            "type" = ${type}::"CouponType",
            "value" = ${value},
            "description" = ${this.optionalString(row.description)},
            "usageLimit" = ${this.optionalNumberOrNull(row.usageLimit)},
            "status" = ${status}::"CouponStatus",
            "startDate" = ${startDate},
            "endDate" = ${this.optionalDate(row.endDate)},
            "minAmount" = ${this.optionalDecimal(row.minAmount)},
            "isActive" = ${this.optionalBoolean(row.isActive, true)},
            "updatedAt" = NOW()
          WHERE
            "id" = ${existingId}
            AND "deleted_at" IS NULL
        `,
      );

      return {
        id: existingId,
        action: 'UPDATED',
      };
    }

    const id = this.optionalString(row.id) ?? randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Coupon" (
          "id",
          "code",
          "type",
          "value",
          "description",
          "usageLimit",
          "usedCount",
          "status",
          "startDate",
          "endDate",
          "minAmount",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${id},
          ${code},
          ${type}::"CouponType",
          ${value},
          ${this.optionalString(row.description)},
          ${this.optionalNumberOrNull(row.usageLimit)},
          0,
          ${status}::"CouponStatus",
          ${startDate},
          ${this.optionalDate(row.endDate)},
          ${this.optionalDecimal(row.minAmount)},
          ${this.optionalBoolean(row.isActive, true)},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      id,
      action: 'CREATED',
    };
  }

  private validateImportRow(
    entity: AdminImportEntity,
    row: Record<string, unknown>,
    rowIndex: number,
  ): ImportValidationItem {
    const errors: string[] = [];

    if (entity === 'BRAND') {
      if (!this.optionalString(row.name)) {
        errors.push('نام برند الزامی است.');
      }

      if (!this.optionalString(row.slug)) {
        errors.push('اسلاگ برند الزامی است.');
      }
    }

    if (entity === 'CATEGORY') {
      if (!this.optionalString(row.name)) {
        errors.push('نام دسته‌بندی الزامی است.');
      }

      if (!this.optionalString(row.slug)) {
        errors.push('اسلاگ دسته‌بندی الزامی است.');
      }
    }

    if (entity === 'COUPON') {
      if (!this.optionalString(row.code)) {
        errors.push('کد کوپن الزامی است.');
      }

      if (
        !this.optionalString(row.type) ||
        !['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'].includes(
          String(row.type),
        )
      ) {
        errors.push('نوع کوپن معتبر نیست.');
      }

      if (!this.canParseDecimal(row.value)) {
        errors.push('مقدار کوپن معتبر نیست.');
      }
    }

    return {
      rowIndex,
      valid: errors.length === 0,
      errors,
    };
  }

  private async buildExportRows(
    entity: AdminExportEntity,
    filters: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    if (entity === 'BRAND') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "name",
            "slug",
            "description",
            "logoUrl",
            "website",
            "isActive",
            "createdAt",
            "updatedAt"
          FROM "Brand"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['name', 'slug', 'description'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'CATEGORY') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "name",
            "slug",
            "description",
            "parentId",
            "sortOrder",
            "isActive",
            "createdAt",
            "updatedAt"
          FROM "Category"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['name', 'slug', 'description'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'COUPON') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "code",
            "type"::text AS "type",
            "value",
            "description",
            "usageLimit",
            "usedCount",
            "status"::text AS "status",
            "startDate",
            "endDate",
            "minAmount",
            "isActive",
            "createdAt",
            "updatedAt"
          FROM "Coupon"
          WHERE
            "deletedAt" IS NULL
            ${this.qFilter(filters, ['code', 'description'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'PRODUCT') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "name",
            "slug",
            "sku",
            "status"::text AS "status",
            "createdAt",
            "updatedAt"
          FROM "Product"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['name', 'slug', 'sku'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'ORDER') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "orderNumber",
            "userId",
            "status"::text AS "status",
            "paymentStatus"::text AS "paymentStatus",
            "paymentMethod"::text AS "paymentMethod",
            "subtotal",
            "taxAmount",
            "shippingAmount",
            "discountAmount",
            "totalAmount",
            "currency",
            "createdAt",
            "updatedAt"
          FROM "Order"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['orderNumber', 'notes'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'USER') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "email",
            "phone",
            "firstName",
            "lastName",
            "status"::text AS "status",
            "roleId",
            "createdAt",
            "updatedAt"
          FROM "User"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['email', 'phone', 'firstName', 'lastName'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'PAYMENT') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "orderId",
            "userId",
            "amount",
            "currency",
            "paymentMethod"::text AS "paymentMethod",
            "paymentStatus"::text AS "paymentStatus",
            "transactionId",
            "gateway",
            "paidAt",
            "refundedAt",
            "createdAt",
            "updatedAt"
          FROM "Payment"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['transactionId', 'gateway'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'REFUND') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "paymentId",
            "amount",
            "reason",
            "status"::text AS "status",
            "processedAt",
            "createdAt",
            "updatedAt"
          FROM "Refund"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['reason'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'INVOICE') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "orderId",
            "paymentId",
            "userId",
            "status"::text AS "status",
            "createdAt",
            "updatedAt"
          FROM "Invoice"
          WHERE
            "deleted_at" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'SUPPORT_TICKET') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "ticketNumber",
            "userId",
            "guestName",
            "guestEmail",
            "guestPhone",
            "subject",
            "category",
            "priority",
            "status",
            "channel",
            "assignedAgentId",
            "lastMessageAt",
            "closedAt",
            "createdAt",
            "updatedAt"
          FROM "SupportTicket"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['ticketNumber', 'subject', 'guestEmail', 'guestPhone'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'SEARCH_LOG') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "query",
            "normalizedQuery",
            "language",
            "userId",
            "sessionId",
            "source",
            "resultCount",
            "clickedEntityType",
            "clickedEntityId",
            "createdAt"
          FROM "SearchQueryLog"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['query', 'normalizedQuery'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    if (entity === 'AI_RECOMMENDATION') {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
        Prisma.sql`
          SELECT
            "id",
            "targetType",
            "targetId",
            "title",
            "message",
            "severity",
            "status",
            "createdByRunId",
            "resolvedById",
            "resolvedAt",
            "createdAt",
            "updatedAt"
          FROM "AiRecommendation"
          WHERE
            "deleted_at" IS NULL
            ${this.qFilter(filters, ['title', 'message', 'targetType'])}
          ORDER BY "createdAt" DESC
          LIMIT 5000
        `,
      );
    }

    return this.prisma.$queryRaw<Array<Record<string, unknown>>>(
      Prisma.sql`
        SELECT
          "id",
          "incidentNumber",
          "title",
          "description",
          "severity",
          "status",
          "source",
          "targetType",
          "targetId",
          "ipAddress",
          "assignedAdminId",
          "resolvedById",
          "resolvedAt",
          "createdAt",
          "updatedAt"
        FROM "AdminSecurityIncident"
        WHERE
          "deleted_at" IS NULL
          ${this.qFilter(filters, ['incidentNumber', 'title', 'description', 'ipAddress'])}
        ORDER BY "createdAt" DESC
        LIMIT 5000
      `,
    );
  }

  private qFilter(
    filters: Record<string, unknown>,
    columns: string[],
  ): Prisma.Sql {
    const q = this.optionalString(filters.q);

    if (!q) {
      return Prisma.empty;
    }

    return Prisma.sql`
      AND (
        ${Prisma.join(
          columns.map(
            (column) =>
              Prisma.sql`${Prisma.raw(`"${column}"`)} ILIKE ${`%${q}%`}`,
          ),
          ' OR ',
        )}
      )
    `;
  }

  private importSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        j."id",
        j."entity",
        j."mode",
        j."sourceFormat",
        j."status",
        j."title",
        j."rowCount",
        j."successCount",
        j."failureCount",
        j."rowsJson",
        j."previewJson",
        j."resultJson",
        j."errorMessage",
        j."createdById",
        j."startedAt",
        j."finishedAt",
        j."createdAt",
        j."updatedAt",
        j."deleted_at" AS "deletedAt"
      FROM "AdminImportJob" j
    `;
  }

  private exportSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        j."id",
        j."entity",
        j."format",
        j."status",
        j."title",
        j."filtersJson",
        j."resultJson",
        j."rowCount",
        j."fileName",
        j."mimeType",
        j."content",
        j."errorMessage",
        j."createdById",
        j."startedAt",
        j."finishedAt",
        j."createdAt",
        j."updatedAt",
        j."deleted_at" AS "deletedAt"
      FROM "AdminExportJob" j
    `;
  }

  private buildImportWhere(query: AdminImportExportQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`j."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          j."id" ILIKE ${`%${query.q}%`}
          OR j."entity" ILIKE ${`%${query.q}%`}
          OR j."title" ILIKE ${`%${query.q}%`}
          OR j."errorMessage" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.jobId) {
      where.push(Prisma.sql`j."id" = ${query.jobId}`);
    }

    if (
      query.entity === 'BRAND' ||
      query.entity === 'CATEGORY' ||
      query.entity === 'COUPON'
    ) {
      where.push(Prisma.sql`j."entity" = ${query.entity}`);
    }

    if (query.importStatus) {
      where.push(Prisma.sql`j."status" = ${query.importStatus}`);
    }

    if (query.createdById) {
      where.push(Prisma.sql`j."createdById" = ${query.createdById}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`j."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`j."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildExportWhere(query: AdminImportExportQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`j."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          j."id" ILIKE ${`%${query.q}%`}
          OR j."entity" ILIKE ${`%${query.q}%`}
          OR j."title" ILIKE ${`%${query.q}%`}
          OR j."fileName" ILIKE ${`%${query.q}%`}
          OR j."errorMessage" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.jobId) {
      where.push(Prisma.sql`j."id" = ${query.jobId}`);
    }

    if (query.entity) {
      where.push(Prisma.sql`j."entity" = ${query.entity}`);
    }

    if (query.exportStatus) {
      where.push(Prisma.sql`j."status" = ${query.exportStatus}`);
    }

    if (query.createdById) {
      where.push(Prisma.sql`j."createdById" = ${query.createdById}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`j."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`j."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private async findImportJobRow(
    jobId: string,
    includeDeleted: boolean,
  ): Promise<AdminImportJobRow> {
    const where: Prisma.Sql[] = [Prisma.sql`j."id" = ${jobId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`j."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminImportJobRow[]>(
      Prisma.sql`
          ${this.importSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const job = rows[0];

    if (!job) {
      throw new NotFoundException('Job واردسازی موردنظر یافت نشد.');
    }

    return job;
  }

  private async findExportJobRow(
    jobId: string,
    includeDeleted: boolean,
  ): Promise<AdminExportJobRow> {
    const where: Prisma.Sql[] = [Prisma.sql`j."id" = ${jobId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`j."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminExportJobRow[]>(
      Prisma.sql`
          ${this.exportSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const job = rows[0];

    if (!job) {
      throw new NotFoundException('Job خروجی موردنظر یافت نشد.');
    }

    return job;
  }

  private assertImportJobRunnable(status: string): void {
    if (status === 'PENDING' || status === 'PREVIEWED' || status === 'FAILED') {
      return;
    }

    throw new ConflictException('این Job واردسازی در وضعیت قابل اجرا نیست.');
  }

  private async findIdByUniqueText(
    tableName: string,
    columnName: string,
    value: string,
  ): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          SELECT "id"
          FROM ${Prisma.raw(`"${tableName}"`)}
          WHERE
            LOWER(${Prisma.raw(`"${columnName}"`)}) = LOWER(${value})
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
    );

    return rows[0]?.id ?? null;
  }

  private async softDelete(tableName: string, id: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${id}
          AND "deleted_at" IS NULL
      `,
    );
  }

  private async restore(tableName: string, id: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${id}
      `,
    );
  }

  private findNotes(
    eventName: string,
    dataKey: string,
    entityId: string,
    limit: number,
  ): Promise<EventRow[]> {
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
        WHERE
          "deleted_at" IS NULL
          AND "name" = ${eventName}
          AND "data" #>> ARRAY[${dataKey}] = ${entityId}
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
          'import-export',
          NOW(),
          ${actorId ?? null},
          ${JSON.stringify({
            entityId,
            ...data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    return eventId;
  }

  private mapImportJob(row: AdminImportJobRow, includeRows: boolean) {
    return {
      id: row.id,
      entity: row.entity,
      mode: row.mode,
      sourceFormat: row.sourceFormat,
      status: row.status,
      title: row.title,
      rowCount: row.rowCount,
      successCount: row.successCount,
      failureCount: row.failureCount,
      rows: includeRows ? row.rowsJson : undefined,
      preview: row.previewJson,
      result: row.resultJson,
      errorMessage: row.errorMessage,
      createdById: row.createdById,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapExportJob(row: AdminExportJobRow, includeContent: boolean) {
    return {
      id: row.id,
      entity: row.entity,
      format: row.format,
      status: row.status,
      title: row.title,
      filters: row.filtersJson,
      result: row.resultJson,
      rowCount: row.rowCount,
      fileName: row.fileName,
      mimeType: row.mimeType,
      content: includeContent ? row.content : undefined,
      errorMessage: row.errorMessage,
      createdById: row.createdById,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
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
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = Array.from(
      rows.reduce<Set<string>>((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));

        return set;
      }, new Set<string>()),
    );

    if (headers.length === 0) {
      return '\uFEFFid\n';
    }

    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => this.csvCell(row[header])).join(','),
      ),
    ];

    return `\uFEFF${lines.join('\n')}`;
  }

  private csvCell(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'object') {
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    }

    let text: string;

    switch (typeof value) {
      case 'string':
        text = value;
        break;
      case 'number':
        text = String(value);
        break;
      case 'bigint':
        text = String(value);
        break;
      case 'boolean':
        text = String(value);
        break;
      case 'symbol':
        text = String(value);
        break;
      case 'function':
        throw new TypeError('CSV cell value cannot be a function.');
      default:
        throw new TypeError('Unsupported CSV cell value.');
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  private exportFileName(
    entity: string,
    format: AdminImportExportFormat,
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return `admin-export-${entity.toLowerCase()}-${timestamp}.${format === 'JSON' ? 'json' : 'csv'}`;
  }

  private normalizeRows(
    rows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
          normalized[key] = value.toISOString();
          continue;
        }

        if (typeof value === 'bigint') {
          normalized[key] = Number(value);
          continue;
        }

        if (value instanceof Prisma.Decimal) {
          normalized[key] = value.toFixed(2);
          continue;
        }

        normalized[key] = value;
      }

      return normalized;
    });
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

  private toNumber(value: number | bigint | undefined): number {
    if (value === undefined) {
      return 0;
    }

    return Number(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private toRecordArray(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    );
  }

  private requiredString(value: unknown, message: string): string {
    const text = this.optionalString(value);

    if (!text) {
      throw new BadRequestException(message);
    }

    return text;
  }

  private optionalString(value: unknown): string | null {
    const text = this.primitiveString(value)?.trim();

    return text ? text : null;
  }

  private primitiveString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
        return String(value);
      case 'bigint':
        return String(value);
      case 'boolean':
        return String(value);
      case 'symbol':
        return String(value);
      default:
        return null;
    }
  }

  private optionalBoolean(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private optionalNumber(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }

  private optionalNumberOrNull(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  private optionalDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const text = this.primitiveString(value)?.trim();

    if (!text) {
      return null;
    }

    const date = new Date(text);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private decimal(value: unknown, message: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(String(value));
    } catch {
      throw new BadRequestException(message);
    }
  }

  private optionalDecimal(value: unknown): Prisma.Decimal | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return this.decimal(value, 'مقدار عددی معتبر نیست.');
  }

  private canParseDecimal(value: unknown): boolean {
    try {
      new Prisma.Decimal(String(value));

      return true;
    } catch {
      return false;
    }
  }

  private requiredCouponType(value: unknown): string {
    const type = this.optionalString(value)?.toUpperCase();

    if (
      type === 'PERCENTAGE' ||
      type === 'FIXED_AMOUNT' ||
      type === 'FREE_SHIPPING'
    ) {
      return type;
    }

    throw new BadRequestException('نوع کوپن معتبر نیست.');
  }

  private requiredCouponStatus(value: unknown): string {
    const status = this.optionalString(value)?.toUpperCase();

    if (status === 'ACTIVE' || status === 'INACTIVE' || status === 'EXPIRED') {
      return status;
    }

    throw new BadRequestException('وضعیت کوپن معتبر نیست.');
  }
}
