import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminOperationsAlertAnalyticsQueryDto } from '../dto/admin-operations-alert-analytics-query.dto';

import { AdminOperationsAlertSource } from '../dto/admin-operations-alert-query.dto';

type AnalyticsRow = {
  totalAlerts: number | bigint;
  unreadAlerts: number | bigint;
  readAlerts: number | bigint;
  watchdogAlerts: number | bigint;
  digestAlerts: number | bigint;
  escalationAlerts: number | bigint;
  queueHealthAlerts: number | bigint;
  criticalAlerts: number | bigint;
  errorAlerts: number | bigint;
  warningAlerts: number | bigint;
  infoAlerts: number | bigint;
  oldestUnreadAt: Date | null;
  latestAlertAt: Date | null;
};

type DailyAlertRow = {
  day: Date;
  total: number | bigint;
  unread: number | bigint;
  critical: number | bigint;
  error: number | bigint;
  warning: number | bigint;
  info: number | bigint;
};

type AlertAnalyticsResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    source: AdminOperationsAlertSource | null;
    createdFrom: string | null;
    createdTo: string | null;
  };
  summary: {
    total: number;
    unread: number;
    read: number;
    readRate: string;
    unreadRate: string;
    escalationRate: string;
    oldestUnreadAt: string | null;
    latestAlertAt: string | null;
  };
  bySource: {
    watchdog: number;
    digest: number;
    escalation: number;
    queueHealth: number;
  };
  bySeverity: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  daily: Array<{
    day: string;
    total: number;
    unread: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
  }>;
};

@Injectable()
export class AdminOperationsAlertAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(
    query: AdminOperationsAlertAnalyticsQueryDto,
    actorId: string,
  ): Promise<AlertAnalyticsResponse> {
    const createdFrom = this.parseOptionalDate(query.createdFrom);

    const createdTo = this.parseOptionalDate(query.createdTo);

    this.assertValidDateRange(createdFrom, createdTo);

    const [analyticsRows, dailyRows] = await Promise.all([
      this.getAnalyticsRows(query.source, createdFrom, createdTo),
      this.getDailyRows(query.source, createdFrom, createdTo),
    ]);

    const row = analyticsRows[0] ?? this.emptyAnalyticsRow();

    const total = this.toNumber(row.totalAlerts);

    const read = this.toNumber(row.readAlerts);

    const unread = this.toNumber(row.unreadAlerts);

    const escalation = this.toNumber(row.escalationAlerts);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        source: query.source ?? null,
        createdFrom: createdFrom ? createdFrom.toISOString() : null,
        createdTo: createdTo ? createdTo.toISOString() : null,
      },
      summary: {
        total,
        unread,
        read,
        readRate: this.percent(read, total),
        unreadRate: this.percent(unread, total),
        escalationRate: this.percent(escalation, total),
        oldestUnreadAt: row.oldestUnreadAt
          ? row.oldestUnreadAt.toISOString()
          : null,
        latestAlertAt: row.latestAlertAt
          ? row.latestAlertAt.toISOString()
          : null,
      },
      bySource: {
        watchdog: this.toNumber(row.watchdogAlerts),
        digest: this.toNumber(row.digestAlerts),
        escalation: escalation,
        queueHealth: this.toNumber(row.queueHealthAlerts),
      },
      bySeverity: {
        critical: this.toNumber(row.criticalAlerts),
        error: this.toNumber(row.errorAlerts),
        warning: this.toNumber(row.warningAlerts),
        info: this.toNumber(row.infoAlerts),
      },
      daily: dailyRows.map((item) => ({
        day: item.day.toISOString().slice(0, 10),
        total: this.toNumber(item.total),
        unread: this.toNumber(item.unread),
        critical: this.toNumber(item.critical),
        error: this.toNumber(item.error),
        warning: this.toNumber(item.warning),
        info: this.toNumber(item.info),
      })),
    };
  }

  private getAnalyticsRows(
    source: AdminOperationsAlertSource | undefined,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<AnalyticsRow[]> {
    const where = this.buildAlertWhere(source, createdFrom, createdTo);

    return this.prisma.$queryRaw<AnalyticsRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalAlerts",
          COUNT(*) FILTER (
            WHERE t."isRead" = FALSE
          )::int AS "unreadAlerts",
          COUNT(*) FILTER (
            WHERE t."isRead" = TRUE
          )::int AS "readAlerts",
          COUNT(*) FILTER (
            WHERE t."source" = 'operations_watchdog'
          )::int AS "watchdogAlerts",
          COUNT(*) FILTER (
            WHERE t."source" = 'operations_digest'
          )::int AS "digestAlerts",
          COUNT(*) FILTER (
            WHERE t."source" = 'operations_alert_escalation'
          )::int AS "escalationAlerts",
          COUNT(*) FILTER (
            WHERE t."source" = 'operations_queue_health'
          )::int AS "queueHealthAlerts",
          COUNT(*) FILTER (
            WHERE t."severity" = 'critical'
          )::int AS "criticalAlerts",
          COUNT(*) FILTER (
            WHERE t."severity" = 'error'
          )::int AS "errorAlerts",
          COUNT(*) FILTER (
            WHERE t."severity" = 'warning'
          )::int AS "warningAlerts",
          COUNT(*) FILTER (
            WHERE t."severity" = 'info'
          )::int AS "infoAlerts",
          MIN(t."createdAt") FILTER (
            WHERE t."isRead" = FALSE
          ) AS "oldestUnreadAt",
          MAX(t."createdAt") AS "latestAlertAt"
        FROM (
          ${this.alertSubquery()}
        ) t
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getDailyRows(
    source: AdminOperationsAlertSource | undefined,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<DailyAlertRow[]> {
    const where = this.buildAlertWhere(source, createdFrom, createdTo);

    return this.prisma.$queryRaw<DailyAlertRow[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC('day', t."createdAt") AS "day",
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (
            WHERE t."isRead" = FALSE
          )::int AS "unread",
          COUNT(*) FILTER (
            WHERE t."severity" = 'critical'
          )::int AS "critical",
          COUNT(*) FILTER (
            WHERE t."severity" = 'error'
          )::int AS "error",
          COUNT(*) FILTER (
            WHERE t."severity" = 'warning'
          )::int AS "warning",
          COUNT(*) FILTER (
            WHERE t."severity" = 'info'
          )::int AS "info"
        FROM (
          ${this.alertSubquery()}
        ) t
        WHERE ${Prisma.join(where, ' AND ')}
        GROUP BY DATE_TRUNC('day', t."createdAt")
        ORDER BY "day" ASC
      `,
    );
  }

  private alertSubquery(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        n."id",
        n."isRead",
        CASE
          WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
            THEN n."updatedAt"
          ELSE n."createdAt"
        END AS "createdAt",
        CASE
          WHEN n."metadata" #>> '{source}' = 'admin.operations_watchdog'
            THEN 'operations_watchdog'
          WHEN n."metadata" #>> '{source}' = 'admin.operations_digest'
            THEN 'operations_digest'
          WHEN n."metadata" #>> '{source}' = 'admin.operations_alert_escalation'
            THEN 'operations_alert_escalation'
          WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
            THEN 'operations_queue_health'
          ELSE 'operations_digest'
        END AS "source",
        CASE
          WHEN n."metadata" #>> '{source}' = 'admin.operations_watchdog'
            THEN
              CASE
                WHEN n."metadata" #>> '{healthLevel}' = 'critical'
                  THEN 'critical'
                WHEN n."metadata" #>> '{healthLevel}' = 'degraded'
                  THEN 'error'
                WHEN n."metadata" #>> '{healthLevel}' = 'warning'
                  THEN 'warning'
                ELSE 'info'
              END
          WHEN n."metadata" #>> '{source}' = 'admin.operations_digest'
            THEN
              CASE
                WHEN n."metadata" #>> '{digestLevel}' = 'critical'
                  THEN 'critical'
                WHEN n."metadata" #>> '{digestLevel}' = 'high_risk'
                  THEN 'error'
                WHEN n."metadata" #>> '{digestLevel}' = 'attention_required'
                  THEN 'warning'
                ELSE 'info'
              END
          WHEN n."metadata" #>> '{source}' = 'admin.operations_alert_escalation'
            THEN
              CASE
                WHEN n."metadata" #>> '{highestSeverity}' = 'critical'
                  THEN 'critical'
                WHEN n."metadata" #>> '{highestSeverity}' = 'error'
                  THEN 'error'
                WHEN n."metadata" #>> '{highestSeverity}' = 'warning'
                  THEN 'warning'
                ELSE 'info'
              END
          WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
            THEN
              CASE
                WHEN n."metadata" #>> '{lifecycleStatus}' = 'RECOVERED'
                  THEN 'info'
                WHEN n."metadata" #>> '{healthLevel}' = 'critical'
                  THEN 'critical'
                WHEN n."metadata" #>> '{healthLevel}' = 'degraded'
                  THEN 'error'
                WHEN n."metadata" #>> '{healthLevel}' = 'warning'
                  THEN 'warning'
                ELSE 'info'
              END
          ELSE 'info'
        END AS "severity"
      FROM "Notification" n
      WHERE
        n."deleted_at" IS NULL
        AND n."isActive" = TRUE
        AND n."metadata" #>> '{source}' IN (
          'admin.operations_watchdog',
          'admin.operations_digest',
          'admin.operations_alert_escalation',
          'admin.operations_queue_health'
        )
    `;
  }

  private buildAlertWhere(
    source: AdminOperationsAlertSource | undefined,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (source) {
      where.push(Prisma.sql`t."source" = ${source}`);
    }

    if (createdFrom) {
      where.push(Prisma.sql`t."createdAt" >= ${createdFrom}`);
    }

    if (createdTo) {
      where.push(Prisma.sql`t."createdAt" <= ${createdTo}`);
    }

    return where;
  }

  private parseOptionalDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private assertValidDateRange(
    createdFrom: Date | null,
    createdTo: Date | null,
  ): void {
    if (
      createdFrom &&
      createdTo &&
      createdFrom.getTime() > createdTo.getTime()
    ) {
      throw new BadRequestException(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }
  }

  private percent(value: number, total: number): string {
    if (total <= 0) {
      return '0.00';
    }

    return ((value / total) * 100).toFixed(2);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'bigint' || typeof value === 'string') {
      const normalized = Number(value);

      return Number.isFinite(normalized) ? normalized : 0;
    }

    return 0;
  }

  private emptyAnalyticsRow(): AnalyticsRow {
    return {
      totalAlerts: 0,
      unreadAlerts: 0,
      readAlerts: 0,
      watchdogAlerts: 0,
      digestAlerts: 0,
      escalationAlerts: 0,
      queueHealthAlerts: 0,
      criticalAlerts: 0,
      errorAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
      oldestUnreadAt: null,
      latestAlertAt: null,
    };
  }
}
