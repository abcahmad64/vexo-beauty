import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CreateCustomerSupportTicketDto } from '../dto/create-customer-support-ticket.dto';
import { QueryCustomerSupportTicketDto } from '../dto/query-customer-support-ticket.dto';
import { ReplyCustomerSupportTicketDto } from '../dto/reply-customer-support-ticket.dto';

type CountRow = {
  count: number | bigint;
};

type CustomerTicketRow = {
  id: string;
  ticketNumber: string;
  orderId: string | null;
  orderNumber: string | null;
  subject: string;
  category: string;
  status: string;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number | bigint;
};

type CustomerTicketMessageRow = {
  id: string;
  senderType: string;
  message: string;
  attachments: unknown;
  createdAt: Date;
};

type OwnedOrderRow = {
  id: string;
};

@Injectable()
export class CustomerSupportService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 50;

  constructor(private readonly prisma: PrismaService) {}

  async findTickets(userId: string, query: QueryCustomerSupportTicketDto) {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const skip = (page - 1) * limit;
    const where = this.buildTicketWhere(userId, query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CustomerTicketRow[]>(
        Prisma.sql`
          ${this.ticketSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            COALESCE(t."lastMessageAt", t."createdAt") DESC,
            t."id" DESC
          LIMIT ${limit}
          OFFSET ${skip}
        `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "SupportTicket" t
          LEFT JOIN "Order" o
            ON o."id" = t."orderId"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapTicket(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findTicket(userId: string, ticketId: string) {
    const ticket = await this.findOwnedTicketRow(userId, ticketId);
    const messages = await this.prisma.$queryRaw<CustomerTicketMessageRow[]>(
      Prisma.sql`
        SELECT
          m."id",
          m."senderType",
          m."message",
          m."attachments",
          m."createdAt"
        FROM "SupportTicketMessage" m
        WHERE
          m."ticketId" = ${ticketId}
          AND m."isInternal" = FALSE
          AND m."deleted_at" IS NULL
        ORDER BY
          m."createdAt" ASC,
          m."id" ASC
      `,
    );

    return {
      ...this.mapTicket(ticket),
      messages: messages.map((message) => this.mapMessage(message)),
    };
  }

  async createTicket(userId: string, dto: CreateCustomerSupportTicketDto) {
    const ticketId = randomUUID();
    const messageId = randomUUID();
    const ticketNumber = this.generateTicketNumber();

    await this.prisma.$transaction(async (transaction) => {
      if (dto.orderId) {
        await this.assertOwnedOrder(transaction, userId, dto.orderId);
      }

      await transaction.$executeRaw(
        Prisma.sql`
          INSERT INTO "SupportTicket" (
            "id",
            "ticketNumber",
            "userId",
            "orderId",
            "subject",
            "category",
            "priority",
            "status",
            "channel",
            "lastMessageAt",
            "metadata",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${ticketId},
            ${ticketNumber},
            ${userId},
            ${dto.orderId ?? null},
            ${dto.subject},
            ${dto.category ?? 'general'},
            'NORMAL',
            'OPEN',
            'WEB',
            NOW(),
            '{}'::jsonb,
            NOW(),
            NOW()
          )
        `,
      );

      await transaction.$executeRaw(
        Prisma.sql`
          INSERT INTO "SupportTicketMessage" (
            "id",
            "ticketId",
            "senderType",
            "senderUserId",
            "message",
            "attachments",
            "isInternal",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${messageId},
            ${ticketId},
            'CUSTOMER',
            ${userId},
            ${dto.message},
            '[]'::jsonb,
            FALSE,
            NOW(),
            NOW()
          )
        `,
      );

      await this.createEvent(transaction, {
        name: 'support.ticket.created',
        description: 'تیکت پشتیبانی توسط مشتری ایجاد شد.',
        userId,
        ticketId,
        data: {
          ticketNumber,
          orderId: dto.orderId ?? null,
          source: 'customer-storefront',
        },
      });
    });

    return this.findTicket(userId, ticketId);
  }

  async replyTicket(
    userId: string,
    ticketId: string,
    dto: ReplyCustomerSupportTicketDto,
  ) {
    const messageId = randomUUID();

    await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{
          id: string;
          status: string;
        }>
      >(
        Prisma.sql`
          SELECT
            "id",
            "status"
          FROM "SupportTicket"
          WHERE
            "id" = ${ticketId}
            AND "userId" = ${userId}
            AND "deleted_at" IS NULL
          LIMIT 1
          FOR UPDATE
        `,
      );

      const ticket = rows[0];

      if (!ticket) {
        throw new NotFoundException('تیکت پشتیبانی موردنظر یافت نشد.');
      }

      if (ticket.status === 'CLOSED') {
        throw new ConflictException(
          'تیکت بسته‌شده قابل پاسخ نیست. لطفاً تیکت جدیدی ثبت کنید.',
        );
      }

      await transaction.$executeRaw(
        Prisma.sql`
          INSERT INTO "SupportTicketMessage" (
            "id",
            "ticketId",
            "senderType",
            "senderUserId",
            "message",
            "attachments",
            "isInternal",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${messageId},
            ${ticketId},
            'CUSTOMER',
            ${userId},
            ${dto.message},
            '[]'::jsonb,
            FALSE,
            NOW(),
            NOW()
          )
        `,
      );

      await transaction.$executeRaw(
        Prisma.sql`
          UPDATE "SupportTicket"
          SET
            "status" = CASE
              WHEN "status" = 'ANSWERED' THEN 'PENDING'
              ELSE "status"
            END,
            "lastMessageAt" = NOW(),
            "updatedAt" = NOW()
          WHERE
            "id" = ${ticketId}
            AND "userId" = ${userId}
            AND "deleted_at" IS NULL
        `,
      );

      await this.createEvent(transaction, {
        name: 'support.ticket.customer.replied',
        description: 'پاسخ جدید مشتری در تیکت پشتیبانی ثبت شد.',
        userId,
        ticketId,
        data: {
          messageId,
          source: 'customer-storefront',
        },
      });
    });

    return this.findTicket(userId, ticketId);
  }

  async closeTicket(userId: string, ticketId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{
          id: string;
          status: string;
        }>
      >(
        Prisma.sql`
          SELECT
            "id",
            "status"
          FROM "SupportTicket"
          WHERE
            "id" = ${ticketId}
            AND "userId" = ${userId}
            AND "deleted_at" IS NULL
          LIMIT 1
          FOR UPDATE
        `,
      );

      const ticket = rows[0];

      if (!ticket) {
        throw new NotFoundException('تیکت پشتیبانی موردنظر یافت نشد.');
      }

      if (ticket.status !== 'CLOSED') {
        await transaction.$executeRaw(
          Prisma.sql`
            UPDATE "SupportTicket"
            SET
              "status" = 'CLOSED',
              "closedAt" = NOW(),
              "updatedAt" = NOW()
            WHERE
              "id" = ${ticketId}
              AND "userId" = ${userId}
              AND "deleted_at" IS NULL
          `,
        );

        await this.createEvent(transaction, {
          name: 'support.ticket.customer.closed',
          description: 'تیکت پشتیبانی توسط مشتری بسته شد.',
          userId,
          ticketId,
          data: {
            source: 'customer-storefront',
          },
        });
      }
    });

    return this.findTicket(userId, ticketId);
  }

  private ticketSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        t."id",
        t."ticketNumber",
        t."orderId",
        o."orderNumber",
        t."subject",
        t."category",
        t."status",
        t."lastMessageAt",
        t."createdAt",
        t."updatedAt",
        COALESCE(stats."messageCount", 0)::int AS "messageCount"
      FROM "SupportTicket" t
      LEFT JOIN "Order" o
        ON o."id" = t."orderId"
      LEFT JOIN LATERAL (
        SELECT COUNT(m."id")::int AS "messageCount"
        FROM "SupportTicketMessage" m
        WHERE
          m."ticketId" = t."id"
          AND m."isInternal" = FALSE
          AND m."deleted_at" IS NULL
      ) stats ON TRUE
    `;
  }

  private buildTicketWhere(
    userId: string,
    query: QueryCustomerSupportTicketDto,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      Prisma.sql`t."userId" = ${userId}`,
      Prisma.sql`t."deleted_at" IS NULL`,
    ];

    if (query.status) {
      where.push(Prisma.sql`t."status" = ${query.status}`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          t."ticketNumber" ILIKE ${`%${query.q}%`}
          OR t."subject" ILIKE ${`%${query.q}%`}
          OR o."orderNumber" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    return where;
  }

  private async findOwnedTicketRow(
    userId: string,
    ticketId: string,
  ): Promise<CustomerTicketRow> {
    const rows = await this.prisma.$queryRaw<CustomerTicketRow[]>(
      Prisma.sql`
        ${this.ticketSelectSql()}
        WHERE
          t."id" = ${ticketId}
          AND t."userId" = ${userId}
          AND t."deleted_at" IS NULL
        LIMIT 1
      `,
    );

    const ticket = rows[0];

    if (!ticket) {
      throw new NotFoundException('تیکت پشتیبانی موردنظر یافت نشد.');
    }

    return ticket;
  }

  private async assertOwnedOrder(
    transaction: Pick<Prisma.TransactionClient, '$queryRaw'>,
    userId: string,
    orderId: string,
  ) {
    const rows = await transaction.$queryRaw<OwnedOrderRow[]>(
      Prisma.sql`
        SELECT "id"
        FROM "Order"
        WHERE
          "id" = ${orderId}
          AND "userId" = ${userId}
          AND "deleted_at" IS NULL
        LIMIT 1
        FOR SHARE
      `,
    );

    if (!rows[0]) {
      throw new BadRequestException(
        'سفارش انتخاب‌شده برای این حساب کاربری معتبر نیست.',
      );
    }
  }

  private async createEvent(
    transaction: Pick<Prisma.TransactionClient, '$executeRaw'>,
    input: {
      name: string;
      description: string;
      userId: string;
      ticketId: string;
      data: Record<string, unknown>;
    },
  ): Promise<void> {
    await transaction.$executeRaw(
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
          ${input.name},
          ${input.description},
          'support',
          NOW(),
          ${input.userId},
          ${JSON.stringify({
            ticketId: input.ticketId,
            ...input.data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );
  }

  private mapTicket(row: CustomerTicketRow) {
    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      subject: row.subject,
      category: row.category,
      status: row.status,
      messageCount: this.toNumber(row.messageCount),
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapMessage(row: CustomerTicketMessageRow) {
    return {
      id: row.id,
      sender:
        row.senderType === 'AGENT'
          ? 'support'
          : row.senderType === 'SYSTEM'
            ? 'system'
            : 'customer',
      message: row.message,
      attachments: this.toStringArray(row.attachments),
      createdAt: row.createdAt,
    };
  }

  private generateTicketNumber(): string {
    const date = new Date();
    const datePart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
    const randomPart = randomUUID()
      .replace(/-/g, '')
      .slice(0, 10)
      .toUpperCase();

    return `TCK-${datePart}-${randomPart}`;
  }

  private normalizePage(value: number | undefined): number {
    return Number.isInteger(value) && Number(value) > 0
      ? Number(value)
      : this.defaultPage;
  }

  private normalizeLimit(value: number | undefined): number {
    if (!Number.isInteger(value) || Number(value) <= 0) {
      return this.defaultLimit;
    }

    return Math.min(Number(value), this.maxLimit);
  }

  private toNumber(value: number | bigint | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number.isFinite(value) ? Number(value) : 0;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );
  }
}
