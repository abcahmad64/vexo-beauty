import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminTimelineQueryDto } from '../dto/admin-timeline-query.dto';

type AdminTimelineSeverity =
  'info' | 'success' | 'warning' | 'error' | 'critical';

type AdminTimelineRow = {
  source: string;
  eventType: string;
  severity: string;
  title: string;
  description: string | null;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actionUrl: string;
  occurredAt: Date;
  metadata: Prisma.JsonValue | null;
};

type AdminTimelineItem = {
  source: string;
  eventType: string;
  severity: AdminTimelineSeverity;
  title: string;
  description: string | null;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actionUrl: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

type AdminTimelineResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    limit: number;
    source: string | null;
    severity: string | null;
    entityType: string | null;
    createdFrom: string | null;
    createdTo: string | null;
  };
  summary: {
    total: number;
    info: number;
    success: number;
    warning: number;
    error: number;
    critical: number;
  };
  items: AdminTimelineItem[];
};

@Injectable()
export class AdminTimelineService {
  private readonly defaultLimit = 50;

  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(
    query: AdminTimelineQueryDto,
    actorId: string,
  ): Promise<AdminTimelineResponse> {
    const createdFrom = this.parseOptionalDate(query.createdFrom);

    const createdTo = this.parseOptionalDate(query.createdTo);

    if (
      createdFrom &&
      createdTo &&
      createdFrom.getTime() > createdTo.getTime()
    ) {
      throw new BadRequestException(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }

    const limit = query.limit ?? this.defaultLimit;

    const rows = await this.findTimelineRows(
      query,
      createdFrom,
      createdTo,
      limit,
    );

    const items = rows.map((row) => this.mapRow(row));

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        limit,
        source: query.source ?? null,
        severity: query.severity ?? null,
        entityType: query.entityType ?? null,
        createdFrom: createdFrom ? createdFrom.toISOString() : null,
        createdTo: createdTo ? createdTo.toISOString() : null,
      },
      summary: this.buildSummary(items),
      items,
    };
  }

  private findTimelineRows(
    query: AdminTimelineQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
    limit: number,
  ): Promise<AdminTimelineRow[]> {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.source) {
      where.push(Prisma.sql`t."source" = ${query.source}`);
    }

    if (query.severity) {
      where.push(Prisma.sql`t."severity" = ${query.severity}`);
    }

    if (query.entityType) {
      where.push(Prisma.sql`t."entityType" = ${query.entityType}`);
    }

    if (createdFrom) {
      where.push(Prisma.sql`t."occurredAt" >= ${createdFrom}`);
    }

    if (createdTo) {
      where.push(Prisma.sql`t."occurredAt" <= ${createdTo}`);
    }

    return this.prisma.$queryRaw<AdminTimelineRow[]>(
      Prisma.sql`
        SELECT
          t."source",
          t."eventType",
          t."severity",
          t."title",
          t."description",
          t."entityType",
          t."entityId",
          t."actorId",
          t."actionUrl",
          t."occurredAt",
          t."metadata"
        FROM (
          SELECT
            'order'::text AS "source",
            'order.current_status'::text AS "eventType",
            CASE
              WHEN o."status"::text IN ('CANCELLED', 'REFUNDED') THEN 'warning'
              WHEN o."status"::text IN ('DELIVERED', 'SHIPPED') THEN 'success'
              ELSE 'info'
            END AS "severity",
            CONCAT('وضعیت سفارش ', o."orderNumber") AS "title",
            CONCAT(
              'سفارش ',
              o."orderNumber",
              ' در وضعیت ',
              o."status"::text,
              ' قرار دارد.'
            ) AS "description",
            'order'::text AS "entityType",
            o."id" AS "entityId",
            o."userId" AS "actorId",
            CONCAT('/admin/orders/', o."id") AS "actionUrl",
            o."updatedAt" AS "occurredAt",
            jsonb_build_object(
              'orderId', o."id",
              'orderNumber', o."orderNumber",
              'userId', o."userId",
              'status', o."status"::text,
              'paymentStatus', o."paymentStatus"::text,
              'paymentMethod', o."paymentMethod"::text,
              'totalAmount', o."totalAmount",
              'currency', o."currency",
              'createdAt', o."createdAt",
              'updatedAt', o."updatedAt"
            ) AS "metadata"
          FROM "Order" o
          WHERE o."deleted_at" IS NULL

          UNION ALL

          SELECT
            'payment'::text AS "source",
            'payment.current_status'::text AS "eventType",
            CASE
              WHEN p."paymentStatus"::text = 'FAILED' THEN 'error'
              WHEN p."paymentStatus"::text IN ('REFUNDED', 'PARTIAL_REFUNDED') THEN 'warning'
              WHEN p."paymentStatus"::text = 'COMPLETED' THEN 'success'
              ELSE 'info'
            END AS "severity",
            CONCAT('وضعیت پرداخت ', p."id") AS "title",
            CONCAT(
              'پرداخت با مبلغ ',
              p."amount",
              ' ',
              p."currency",
              ' در وضعیت ',
              p."paymentStatus"::text,
              ' قرار دارد.'
            ) AS "description",
            'payment'::text AS "entityType",
            p."id" AS "entityId",
            p."userId" AS "actorId",
            CONCAT('/admin/payments/', p."id") AS "actionUrl",
            p."updatedAt" AS "occurredAt",
            jsonb_build_object(
              'paymentId', p."id",
              'orderId', p."orderId",
              'userId', p."userId",
              'amount', p."amount",
              'currency', p."currency",
              'paymentMethod', p."paymentMethod"::text,
              'paymentStatus', p."paymentStatus"::text,
              'transactionId', p."transactionId",
              'gateway', p."gateway",
              'paidAt', p."paidAt",
              'refundedAt', p."refundedAt",
              'createdAt', p."createdAt",
              'updatedAt', p."updatedAt"
            ) AS "metadata"
          FROM "Payment" p
          WHERE p."deleted_at" IS NULL

          UNION ALL

          SELECT
            'refund'::text AS "source",
            'refund.current_status'::text AS "eventType",
            CASE
              WHEN r."status"::text = 'FAILED' THEN 'error'
              WHEN r."status"::text = 'COMPLETED' THEN 'success'
              WHEN r."status"::text = 'PROCESSING' THEN 'warning'
              ELSE 'info'
            END AS "severity",
            CONCAT('وضعیت بازگشت وجه ', r."id") AS "title",
            CONCAT(
              'بازگشت وجه با مبلغ ',
              r."amount",
              ' در وضعیت ',
              r."status"::text,
              ' قرار دارد.'
            ) AS "description",
            'refund'::text AS "entityType",
            r."id" AS "entityId",
            p."userId" AS "actorId",
            CONCAT('/admin/refunds/', r."id") AS "actionUrl",
            r."updatedAt" AS "occurredAt",
            jsonb_build_object(
              'refundId', r."id",
              'paymentId', r."paymentId",
              'orderId', p."orderId",
              'userId', p."userId",
              'amount', r."amount",
              'currency', p."currency",
              'status', r."status"::text,
              'reason', r."reason",
              'processedAt', r."processedAt",
              'createdAt', r."createdAt",
              'updatedAt', r."updatedAt"
            ) AS "metadata"
          FROM "Refund" r
          LEFT JOIN "Payment" p
            ON p."id" = r."paymentId"
            AND p."deleted_at" IS NULL
          WHERE r."deleted_at" IS NULL

          UNION ALL

          SELECT
            'invoice'::text AS "source",
            'invoice.current_status'::text AS "eventType",
            CASE
              WHEN i."status"::text = 'OVERDUE' THEN 'warning'
              WHEN i."status"::text = 'CANCELLED' THEN 'warning'
              WHEN i."status"::text = 'PAID' THEN 'success'
              ELSE 'info'
            END AS "severity",
            CONCAT('وضعیت فاکتور ', i."invoiceNumber") AS "title",
            CONCAT(
              'فاکتور ',
              i."invoiceNumber",
              ' با مبلغ ',
              i."amount",
              ' ',
              i."currency",
              ' در وضعیت ',
              i."status"::text,
              ' قرار دارد.'
            ) AS "description",
            'invoice'::text AS "entityType",
            i."id" AS "entityId",
            NULL::text AS "actorId",
            CONCAT('/admin/invoices/', i."id") AS "actionUrl",
            i."updatedAt" AS "occurredAt",
            jsonb_build_object(
              'invoiceId', i."id",
              'invoiceNumber', i."invoiceNumber",
              'orderId', i."orderId",
              'paymentId', i."paymentId",
              'amount', i."amount",
              'currency', i."currency",
              'status', i."status"::text,
              'pdfUrl', i."pdfUrl",
              'issuedAt', i."issuedAt",
              'dueDate', i."dueDate",
              'createdAt', i."createdAt",
              'updatedAt', i."updatedAt"
            ) AS "metadata"
          FROM "Invoice" i
          WHERE i."deleted_at" IS NULL

          UNION ALL

          SELECT
            'notification'::text AS "source",
            'notification.created'::text AS "eventType",
            CASE
              WHEN n."type"::text = 'SYSTEM' AND n."isRead" = FALSE THEN 'warning'
              ELSE 'info'
            END AS "severity",
            n."title" AS "title",
            n."message" AS "description",
            'notification'::text AS "entityType",
            n."id" AS "entityId",
            n."userId" AS "actorId",
            COALESCE(
              n."linkUrl",
              CONCAT('/admin/notifications/', n."id")
            ) AS "actionUrl",
            n."createdAt" AS "occurredAt",
            jsonb_build_object(
              'notificationId', n."id",
              'userId', n."userId",
              'type', n."type"::text,
              'title', n."title",
              'message', n."message",
              'isRead', n."isRead",
              'readAt', n."readAt",
              'linkUrl', n."linkUrl",
              'metadata', n."metadata",
              'createdAt', n."createdAt"
            ) AS "metadata"
          FROM "Notification" n
          WHERE
            n."deleted_at" IS NULL
            AND n."isActive" = TRUE

          UNION ALL

          SELECT
            'audit'::text AS "source",
            e."name" AS "eventType",
            COALESCE(
              e."data" #>> '{severity}',
              'info'
            ) AS "severity",
            COALESCE(
              e."data" #>> '{title}',
              e."name"
            ) AS "title",
            e."description" AS "description",
            COALESCE(
              e."data" #>> '{entityType}',
              'audit'
            ) AS "entityType",
            COALESCE(
              e."data" #>> '{entityId}',
              e."id"
            ) AS "entityId",
            e."userId" AS "actorId",
            CONCAT('/admin/audit-logs/', e."id") AS "actionUrl",
            e."timestamp" AS "occurredAt",
            jsonb_build_object(
              'auditLogId', e."id",
              'action', e."name",
              'category', e."category",
              'severity', COALESCE(e."data" #>> '{severity}', 'info'),
              'entityType', e."data" #>> '{entityType}',
              'entityId', e."data" #>> '{entityId}',
              'actorId', e."userId",
              'data', e."data",
              'timestamp', e."timestamp",
              'createdAt', e."createdAt"
            ) AS "metadata"
          FROM "Event" e
          WHERE e."deleted_at" IS NULL
        ) t
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY
          t."occurredAt" DESC,
          t."entityId" DESC
        LIMIT ${limit}
      `,
    );
  }

  private mapRow(row: AdminTimelineRow): AdminTimelineItem {
    return {
      source: row.source,
      eventType: row.eventType,
      severity: this.normalizeSeverity(row.severity),
      title: row.title,
      description: row.description,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      actionUrl: row.actionUrl,
      occurredAt: row.occurredAt.toISOString(),
      metadata: this.toRecord(row.metadata),
    };
  }

  private buildSummary(
    items: AdminTimelineItem[],
  ): AdminTimelineResponse['summary'] {
    return {
      total: items.length,
      info: items.filter((item) => item.severity === 'info').length,
      success: items.filter((item) => item.severity === 'success').length,
      warning: items.filter((item) => item.severity === 'warning').length,
      error: items.filter((item) => item.severity === 'error').length,
      critical: items.filter((item) => item.severity === 'critical').length,
    };
  }

  private normalizeSeverity(value: string): AdminTimelineSeverity {
    if (
      value === 'success' ||
      value === 'warning' ||
      value === 'error' ||
      value === 'critical' ||
      value === 'info'
    ) {
      return value;
    }

    return 'info';
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

  private toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }

    return {};
  }
}
