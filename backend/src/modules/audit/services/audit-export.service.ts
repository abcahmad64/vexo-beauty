import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { ExportAuditLogDto } from '../dto/export-audit-log.dto';

type AuditExportRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  timestamp: Date;
  userId: string | null;
  data: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AuditExportResult = {
  filename: string;
  contentType: string;
  content: string;
};

@Injectable()
export class AuditExportService {
  private readonly maxExportRows = 5000;

  constructor(private readonly prisma: PrismaService) {}

  async exportForAdmin(query: ExportAuditLogDto): Promise<AuditExportResult> {
    const format = query.format ?? 'csv';

    const rows = await this.findRows(query);

    if (format === 'json') {
      return {
        filename: this.buildFilename('json'),
        contentType: 'application/json; charset=utf-8',
        content: JSON.stringify(
          rows.map((row) => this.mapRow(row)),
          null,
          2,
        ),
      };
    }

    return {
      filename: this.buildFilename('csv'),
      contentType: 'text/csv; charset=utf-8',
      content: this.toCsv(rows),
    };
  }

  private async findRows(query: ExportAuditLogDto): Promise<AuditExportRow[]> {
    const where = this.buildWhere(query);

    return this.prisma.$queryRaw<AuditExportRow[]>(
      Prisma.sql`
        SELECT
          e."id",
          e."name",
          e."description",
          e."category",
          e."timestamp",
          e."userId",
          e."data",
          e."createdAt",
          e."updatedAt",
          e."deleted_at" AS "deletedAt"
        FROM "Event" e
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY
          e."timestamp" DESC,
          e."createdAt" DESC,
          e."id" DESC
        LIMIT ${this.maxExportRows}
      `,
    );
  }

  private buildWhere(query: ExportAuditLogDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      query.includeDeleted === true
        ? Prisma.sql`TRUE`
        : Prisma.sql`e."deleted_at" IS NULL`,
    ];

    if (query.action) {
      where.push(Prisma.sql`e."name" ILIKE ${`%${query.action}%`}`);
    }

    if (query.category) {
      where.push(Prisma.sql`e."category" ILIKE ${`%${query.category}%`}`);
    }

    if (query.actorId) {
      where.push(Prisma.sql`e."userId" = ${query.actorId}`);
    }

    if (query.entityType) {
      where.push(Prisma.sql`e."data" #>> '{entityType}' = ${query.entityType}`);
    }

    if (query.entityId) {
      where.push(Prisma.sql`e."data" #>> '{entityId}' = ${query.entityId}`);
    }

    if (query.severity) {
      where.push(
        Prisma.sql`COALESCE(e."data" #>> '{severity}', 'info') = ${query.severity}`,
      );
    }

    if (query.q) {
      where.push(
        Prisma.sql`
          (
            e."name" ILIKE ${`%${query.q}%`}
            OR e."description" ILIKE ${`%${query.q}%`}
            OR e."category" ILIKE ${`%${query.q}%`}
            OR e."data"::text ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`e."timestamp" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`e."timestamp" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    return where;
  }

  private mapRow(row: AuditExportRow) {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      action: row.name,
      title: this.readString(data.title),
      description: row.description,
      category: row.category,
      severity: this.readString(data.severity) ?? 'info',
      entityType: this.readString(data.entityType),
      entityId: this.readString(data.entityId),
      actorId: row.userId ?? this.readString(data.actorId),
      metadata: data.metadata ?? null,
      occurredAt: row.timestamp.toISOString(),
      occurredAtFa: this.toPersianDateTimeString(row.timestamp),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
    };
  }

  private toCsv(rows: AuditExportRow[]): string {
    const header = [
      'id',
      'action',
      'title',
      'description',
      'category',
      'severity',
      'entityType',
      'entityId',
      'actorId',
      'occurredAt',
      'occurredAtFa',
      'createdAt',
      'createdAtFa',
      'updatedAt',
      'updatedAtFa',
      'deletedAt',
      'deletedAtFa',
      'metadata',
    ];

    const lines = [header.join(',')];

    for (const row of rows) {
      const mapped = this.mapRow(row);

      lines.push(
        [
          mapped.id,
          mapped.action,
          mapped.title,
          mapped.description,
          mapped.category,
          mapped.severity,
          mapped.entityType,
          mapped.entityId,
          mapped.actorId,
          mapped.occurredAt,
          mapped.occurredAtFa,
          mapped.createdAt,
          mapped.createdAtFa,
          mapped.updatedAt,
          mapped.updatedAtFa,
          mapped.deletedAt,
          mapped.deletedAtFa,
          JSON.stringify(mapped.metadata),
        ]
          .map((value) => this.csvCell(value))
          .join(','),
      );
    }

    return `\uFEFF${lines.join('\n')}`;
  }

  private csvCell(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '""';
    }

    const text = value.replace(/"/g, '""').replace(/\r?\n|\r/g, ' ');

    return `"${text}"`;
  }

  private buildFilename(extension: 'csv' | 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return `audit-logs-${timestamp}.${extension}`;
  }

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }

    return {};
  }

  private readString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return null;
  }
}
