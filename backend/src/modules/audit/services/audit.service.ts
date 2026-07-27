import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

import { QueryAuditLogDto } from '../dto/query-audit-log.dto';

import { AuditEventPublisher } from '../events/audit.event.publisher';

type CountRow = {
  count: number | bigint;
};

type AuditLogRow = {
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

type AuditLogResponse = {
  id: string;
  action: string;
  title: string | null;
  description: string | null;
  category: string | null;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  severity: string;
  metadata: Prisma.JsonValue | null;
  occurredAt: Date;
  occurredAtFa: string | null;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  deletedAt: Date | null;
  deletedAtFa: string | null;
};

type AuditLogListResponse = {
  data: AuditLogResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

type AuditLogMutationOptions = {
  actorId?: string;
};

@Injectable()
export class AuditService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: AuditEventPublisher,
  ) {}

  async createAuditLog(
    dto: CreateAuditLogDto,
    options: AuditLogMutationOptions = {},
  ): Promise<AuditLogResponse> {
    const actorId = dto.actorId ?? options.actorId ?? null;

    const severity = dto.severity ?? 'info';

    const occurredAt = new Date();

    const now = occurredAt;

    const data: Record<string, unknown> = {
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId ?? null,
      title: dto.title ?? null,
      severity,
      actorId,
      metadata: dto.metadata ?? null,
      occurredAt: occurredAt.toISOString(),
    };

    const rows = await this.prisma.$queryRaw<AuditLogRow[]>(
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
            ${randomUUID()},
            ${dto.action},
            ${dto.description ?? dto.title ?? null},
            ${dto.category ?? dto.entityType},
            ${occurredAt},
            ${actorId},
            ${this.toJsonb(data)},
            ${now},
            ${now}
          )
          RETURNING
            "id",
            "name",
            "description",
            "category",
            "timestamp",
            "userId",
            "data",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
        `,
    );

    const auditLog = this.requireAuditLog(rows);

    this.eventPublisher.publishCreated({
      auditLogId: auditLog.id,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId ?? null,
      actorId,
      category: dto.category ?? dto.entityType,
      severity,
      occurredAt,
    });

    return this.mapAuditLog(auditLog);
  }

  async findAllForAdmin(
    query: QueryAuditLogDto,
  ): Promise<AuditLogListResponse> {
    const { page, limit, skip } = this.buildPagination(query);

    const where = this.buildWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AuditLogRow[]>(
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
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapAuditLog(row)),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  async findOneForAdmin(
    auditLogId: string,
    includeDeleted = false,
  ): Promise<AuditLogResponse> {
    const deletedCondition = includeDeleted
      ? Prisma.sql`TRUE`
      : Prisma.sql`e."deleted_at" IS NULL`;

    const rows = await this.prisma.$queryRaw<AuditLogRow[]>(
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
          WHERE
            e."id" = ${auditLogId}
            AND ${deletedCondition}
          LIMIT 1
        `,
    );

    const auditLog = this.requireAuditLog(rows);

    return this.mapAuditLog(auditLog);
  }

  async deleteForAdmin(
    auditLogId: string,
    options: AuditLogMutationOptions = {},
  ): Promise<{
    success: true;
  }> {
    await this.findOneForAdmin(auditLogId, false);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Event"
        SET
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${auditLogId}
          AND "deleted_at" IS NULL
      `,
    );

    this.eventPublisher.publishDeleted({
      auditLogId,
      actorId: options.actorId,
      occurredAt: now,
    });

    return {
      success: true,
    };
  }

  private buildWhere(query: QueryAuditLogDto): Prisma.Sql[] {
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
      where.push(Prisma.sql`e."data" #>> '{severity}' = ${query.severity}`);
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

  private mapAuditLog(row: AuditLogRow): AuditLogResponse {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      action: row.name,
      title: this.readString(data.title),
      description: row.description,
      category: row.category,
      entityType: this.readString(data.entityType),
      entityId: this.readString(data.entityId),
      actorId: row.userId ?? this.readString(data.actorId),
      severity: this.readString(data.severity) ?? 'info',
      metadata: this.readJsonValue(data.metadata),
      occurredAt: row.timestamp,
      occurredAtFa: this.toPersianDateTimeString(row.timestamp),
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
    };
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private buildPagination(query: QueryAuditLogDto): {
    page: number;
    limit: number;
    skip: number;
  } {
    const page = Math.max(1, Number(query.page ?? this.defaultPage));

    const limit = Math.min(
      this.maxLimit,
      Math.max(1, Number(query.limit ?? this.defaultLimit)),
    );

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private requireAuditLog(rows: AuditLogRow[]): AuditLogRow {
    const auditLog = rows[0];

    if (!auditLog) {
      throw new NotFoundException('گزارش فعالیت یافت نشد.');
    }

    return auditLog;
  }

  private toJsonb(value: unknown): Prisma.Sql {
    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
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

  private readJsonValue(value: unknown): Prisma.JsonValue | null {
    if (value === null || value === undefined) {
      return null;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }
}
