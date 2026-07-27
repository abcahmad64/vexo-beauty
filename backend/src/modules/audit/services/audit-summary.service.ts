import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDate } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AuditSummaryQueryDto } from '../dto/audit-summary-query.dto';

type AuditSummaryAggregateRow = {
  totalCount: number | bigint;
  infoCount: number | bigint;
  successCount: number | bigint;
  warningCount: number | bigint;
  errorCount: number | bigint;
  criticalCount: number | bigint;
  uniqueActors: number | bigint;
  uniqueEntities: number | bigint;
};

type AuditGroupRow = {
  key: string | null;
  count: number | bigint;
};

type AuditDailyRow = {
  day: Date;
  count: number | bigint;
};

type AuditSummaryResponse = {
  totals: {
    totalCount: number;
    infoCount: number;
    successCount: number;
    warningCount: number;
    errorCount: number;
    criticalCount: number;
    uniqueActors: number;
    uniqueEntities: number;
  };
  ratios: {
    infoRate: string;
    successRate: string;
    warningRate: string;
    errorRate: string;
    criticalRate: string;
  };
  byCategory: Array<{
    category: string;
    count: number;
  }>;
  bySeverity: Array<{
    severity: string;
    count: number;
  }>;
  byEntityType: Array<{
    entityType: string;
    count: number;
  }>;
  topActors: Array<{
    actorId: string;
    count: number;
  }>;
  dailyActivity: Array<{
    day: string;
    dayFa: string | null;
    count: number;
  }>;
};

@Injectable()
export class AuditSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminSummary(
    query: AuditSummaryQueryDto,
  ): Promise<AuditSummaryResponse> {
    const where = this.buildWhere(query);

    const [
      aggregateRows,
      categoryRows,
      severityRows,
      entityTypeRows,
      topActorRows,
      dailyRows,
    ] = await Promise.all([
      this.prisma.$queryRaw<AuditSummaryAggregateRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "totalCount",

              COUNT(*) FILTER (
                WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'info'
              )::int AS "infoCount",

              COUNT(*) FILTER (
                WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'success'
              )::int AS "successCount",

              COUNT(*) FILTER (
                WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'warning'
              )::int AS "warningCount",

              COUNT(*) FILTER (
                WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'error'
              )::int AS "errorCount",

              COUNT(*) FILTER (
                WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'critical'
              )::int AS "criticalCount",

              COUNT(DISTINCT e."userId")::int AS "uniqueActors",
              COUNT(DISTINCT CONCAT(
                COALESCE(e."data" #>> '{entityType}', ''),
                ':',
                COALESCE(e."data" #>> '{entityId}', '')
              )) FILTER (
                WHERE e."data" #>> '{entityId}' IS NOT NULL
              )::int AS "uniqueEntities"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),

      this.prisma.$queryRaw<AuditGroupRow[]>(
        Prisma.sql`
            SELECT
              COALESCE(e."category", 'general') AS "key",
              COUNT(*)::int AS "count"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY
              COALESCE(e."category", 'general')
            ORDER BY
              "count" DESC,
              "key" ASC
            LIMIT 20
          `,
      ),

      this.prisma.$queryRaw<AuditGroupRow[]>(
        Prisma.sql`
            SELECT
              COALESCE(e."data" #>> '{severity}', 'info') AS "key",
              COUNT(*)::int AS "count"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY
              COALESCE(e."data" #>> '{severity}', 'info')
            ORDER BY
              "count" DESC,
              "key" ASC
          `,
      ),

      this.prisma.$queryRaw<AuditGroupRow[]>(
        Prisma.sql`
            SELECT
              COALESCE(e."data" #>> '{entityType}', 'unknown') AS "key",
              COUNT(*)::int AS "count"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY
              COALESCE(e."data" #>> '{entityType}', 'unknown')
            ORDER BY
              "count" DESC,
              "key" ASC
            LIMIT 20
          `,
      ),

      this.prisma.$queryRaw<AuditGroupRow[]>(
        Prisma.sql`
            SELECT
              e."userId" AS "key",
              COUNT(*)::int AS "count"
            FROM "Event" e
            WHERE
              ${Prisma.join(where, ' AND ')}
              AND e."userId" IS NOT NULL
            GROUP BY
              e."userId"
            ORDER BY
              "count" DESC
            LIMIT 20
          `,
      ),

      this.prisma.$queryRaw<AuditDailyRow[]>(
        Prisma.sql`
            SELECT
              DATE_TRUNC('day', e."timestamp") AS "day",
              COUNT(*)::int AS "count"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY
              DATE_TRUNC('day', e."timestamp")
            ORDER BY
              "day" DESC
            LIMIT 30
          `,
      ),
    ]);

    const aggregate = aggregateRows[0] ?? this.emptyAggregate();

    return {
      totals: {
        totalCount: this.toNumber(aggregate.totalCount),
        infoCount: this.toNumber(aggregate.infoCount),
        successCount: this.toNumber(aggregate.successCount),
        warningCount: this.toNumber(aggregate.warningCount),
        errorCount: this.toNumber(aggregate.errorCount),
        criticalCount: this.toNumber(aggregate.criticalCount),
        uniqueActors: this.toNumber(aggregate.uniqueActors),
        uniqueEntities: this.toNumber(aggregate.uniqueEntities),
      },
      ratios: this.buildRatios(aggregate),
      byCategory: categoryRows.map((row) => ({
        category: row.key ?? 'general',
        count: this.toNumber(row.count),
      })),
      bySeverity: severityRows.map((row) => ({
        severity: row.key ?? 'info',
        count: this.toNumber(row.count),
      })),
      byEntityType: entityTypeRows.map((row) => ({
        entityType: row.key ?? 'unknown',
        count: this.toNumber(row.count),
      })),
      topActors: topActorRows.map((row) => ({
        actorId: row.key ?? '',
        count: this.toNumber(row.count),
      })),
      dailyActivity: dailyRows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        dayFa: this.toPersianDateString(row.day),
        count: this.toNumber(row.count),
      })),
    };
  }

  private buildWhere(query: AuditSummaryQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      query.includeDeleted === true
        ? Prisma.sql`TRUE`
        : Prisma.sql`e."deleted_at" IS NULL`,
    ];

    if (query.actorId) {
      where.push(Prisma.sql`e."userId" = ${query.actorId}`);
    }

    if (query.category) {
      where.push(Prisma.sql`e."category" = ${query.category}`);
    }

    if (query.entityType) {
      where.push(Prisma.sql`e."data" #>> '{entityType}' = ${query.entityType}`);
    }

    if (query.severity) {
      where.push(
        Prisma.sql`COALESCE(e."data" #>> '{severity}', 'info') = ${query.severity}`,
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

  private buildRatios(
    aggregate: AuditSummaryAggregateRow,
  ): AuditSummaryResponse['ratios'] {
    const total = this.toNumber(aggregate.totalCount);

    if (total === 0) {
      return {
        infoRate: '0.00',
        successRate: '0.00',
        warningRate: '0.00',
        errorRate: '0.00',
        criticalRate: '0.00',
      };
    }

    return {
      infoRate: this.toPercent(this.toNumber(aggregate.infoCount), total),
      successRate: this.toPercent(this.toNumber(aggregate.successCount), total),
      warningRate: this.toPercent(this.toNumber(aggregate.warningCount), total),
      errorRate: this.toPercent(this.toNumber(aggregate.errorCount), total),
      criticalRate: this.toPercent(
        this.toNumber(aggregate.criticalCount),
        total,
      ),
    };
  }

  private toPersianDateString(value: Date | null): string | null {
    return formatPersianDate(value);
  }

  private emptyAggregate(): AuditSummaryAggregateRow {
    return {
      totalCount: 0,
      infoCount: 0,
      successCount: 0,
      warningCount: 0,
      errorCount: 0,
      criticalCount: 0,
      uniqueActors: 0,
      uniqueEntities: 0,
    };
  }

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private toPercent(value: number, total: number): string {
    return ((value / total) * 100).toFixed(2);
  }

  private toNumber(value: number | bigint | undefined): number {
    if (value === undefined) {
      return 0;
    }

    return Number(value);
  }
}
