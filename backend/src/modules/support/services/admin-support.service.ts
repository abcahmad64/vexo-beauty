import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminAssignSupportDto } from '../dto/admin-assign-support.dto';

import { AdminCreateSupportChatDto } from '../dto/admin-create-support-chat.dto';

import { AdminCreateSupportTicketDto } from '../dto/admin-create-support-ticket.dto';

import { AdminQuerySupportChatDto } from '../dto/admin-query-support-chat.dto';

import { AdminQuerySupportTicketDto } from '../dto/admin-query-support-ticket.dto';

import { AdminReplySupportTicketDto } from '../dto/admin-reply-support-ticket.dto';

import { AdminSendSupportChatMessageDto } from '../dto/admin-send-support-chat-message.dto';

import { AdminSupportNoteDto } from '../dto/admin-support-note.dto';

import { AdminUpdateSupportChatStatusDto } from '../dto/admin-update-support-chat-status.dto';

import { AdminUpdateSupportTicketDto } from '../dto/admin-update-support-ticket.dto';

import { AdminUpdateSupportTicketStatusDto } from '../dto/admin-update-support-ticket-status.dto';

type CountRow = {
  count: number | bigint;
};

type SupportTicketRow = {
  id: string;
  ticketNumber: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  orderId: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  channel: string;
  assignedAgentId: string | null;
  lastMessageAt: Date | null;
  closedAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  agentEmail: string | null;
  agentFirstName: string | null;
  agentLastName: string | null;
  orderNumber: string | null;
  messageCount: number | bigint;
  internalMessageCount: number | bigint;
};

type SupportTicketMessageRow = {
  id: string;
  ticketId: string;
  senderType: string;
  senderId: string | null;
  body: string;
  attachmentUrls: unknown;
  isInternal: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  senderEmail: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
};

type SupportChatRow = {
  id: string;
  conversationKey: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  assignedAgentId: string | null;
  lastMessageAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  agentEmail: string | null;
  agentFirstName: string | null;
  agentLastName: string | null;
  messageCount: number | bigint;
  unreadByAdmin: number | bigint;
  unreadByCustomer: number | bigint;
  lastCustomerMessageAt: Date | null;
  lastAgentMessageAt: Date | null;
};

type SupportChatMessageRow = {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string | null;
  body: string;
  attachmentUrls: unknown;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  senderEmail: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
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

@Injectable()
export class AdminSupportService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findTickets(query: AdminQuerySupportTicketDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildTicketWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<SupportTicketRow[]>(
        Prisma.sql`
            ${this.ticketSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveTicketSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              t."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "SupportTicket" t
            LEFT JOIN "User" u
              ON u."id" = t."userId"
            LEFT JOIN "User" a
              ON a."id" = t."assignedAgentId"
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

  async findTicket(ticketId: string, includeDeleted = true) {
    const ticket = await this.findTicketRow(ticketId, includeDeleted);

    const [messages, notes] = await Promise.all([
      this.findTicketMessages(ticketId, true),
      this.findNotes('support.ticket.note.created', 'ticketId', ticketId, 30),
    ]);

    return {
      ...this.mapTicket(ticket),
      messages: messages.map((message) => this.mapTicketMessage(message)),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async createTicket(dto: AdminCreateSupportTicketDto, actorId?: string) {
    const ticketNumber = await this.generateTicketNumber();

    const ticketId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SupportTicket" (
          "id",
          "ticketNumber",
          "userId",
          "guestName",
          "guestEmail",
          "guestPhone",
          "orderId",
          "subject",
          "category",
          "priority",
          "status",
          "channel",
          "assignedAgentId",
          "lastMessageAt",
          "metadata",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${ticketId},
          ${ticketNumber},
          ${dto.userId ?? null},
          ${dto.guestName ?? null},
          ${dto.guestEmail ?? null},
          ${dto.guestPhone ?? null},
          ${dto.orderId ?? null},
          ${dto.subject},
          ${dto.category ?? 'general'},
          ${dto.priority ?? 'NORMAL'},
          'OPEN',
          ${dto.channel ?? 'ADMIN'},
          ${dto.assignedAgentId ?? actorId ?? null},
          NOW(),
          ${JSON.stringify(dto.metadata ?? {})}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    await this.createTicketMessage(
      ticketId,
      'AGENT',
      actorId,
      dto.body,
      dto.attachmentUrls ?? [],
      false,
    );

    await this.createSystemEvent(
      'support.ticket.created',
      'تیکت پشتیبانی توسط ادمین ایجاد شد.',
      ticketId,
      actorId,
      {
        ticketId,
        ticketNumber,
      },
    );

    return {
      ticket: await this.findTicket(ticketId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'support.ticket.created',
      },
    };
  }

  async updateTicket(
    ticketId: string,
    dto: AdminUpdateSupportTicketDto,
    actorId?: string,
  ) {
    await this.findTicketRow(ticketId, false);

    const assignments: Prisma.Sql[] = [];

    if (dto.subject !== undefined) {
      assignments.push(Prisma.sql`"subject" = ${dto.subject}`);
    }

    if (dto.guestName !== undefined) {
      assignments.push(Prisma.sql`"guestName" = ${dto.guestName}`);
    }

    if (dto.guestEmail !== undefined) {
      assignments.push(Prisma.sql`"guestEmail" = ${dto.guestEmail}`);
    }

    if (dto.guestPhone !== undefined) {
      assignments.push(Prisma.sql`"guestPhone" = ${dto.guestPhone}`);
    }

    if (dto.orderId !== undefined) {
      assignments.push(Prisma.sql`"orderId" = ${dto.orderId}`);
    }

    if (dto.category !== undefined) {
      assignments.push(Prisma.sql`"category" = ${dto.category}`);
    }

    if (dto.priority !== undefined) {
      assignments.push(Prisma.sql`"priority" = ${dto.priority}`);
    }

    if (dto.channel !== undefined) {
      assignments.push(Prisma.sql`"channel" = ${dto.channel}`);
    }

    if (dto.metadata !== undefined) {
      assignments.push(
        Prisma.sql`"metadata" = ${JSON.stringify(dto.metadata)}::jsonb`,
      );
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی تیکت ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportTicket"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${ticketId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.ticket.updated',
      'تیکت پشتیبانی توسط ادمین به‌روزرسانی شد.',
      ticketId,
      actorId,
      {
        ticketId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      ticket: await this.findTicket(ticketId, true),
    };
  }

  async updateTicketStatus(
    ticketId: string,
    dto: AdminUpdateSupportTicketStatusDto,
    actorId?: string,
  ) {
    const current = await this.findTicketRow(ticketId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportTicket"
        SET
          "status" = ${dto.status},
          "closedAt" = CASE
            WHEN ${dto.status} = 'CLOSED' THEN NOW()
            ELSE "closedAt"
          END,
          "updatedAt" = NOW()
        WHERE
          "id" = ${ticketId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.ticket.status.updated',
      'وضعیت تیکت پشتیبانی توسط ادمین تغییر کرد.',
      ticketId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      ticket: await this.findTicket(ticketId, true),
    };
  }

  async assignTicket(
    ticketId: string,
    dto: AdminAssignSupportDto,
    actorId?: string,
  ) {
    await this.findTicketRow(ticketId, false);

    const agentId =
      dto.unassign === true ? null : (dto.agentId ?? actorId ?? null);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportTicket"
        SET
          "assignedAgentId" = ${agentId},
          "updatedAt" = NOW()
        WHERE
          "id" = ${ticketId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.ticket.assigned',
      'تیکت پشتیبانی به پشتیبان اختصاص داده شد.',
      ticketId,
      actorId,
      {
        assignedAgentId: agentId,
        reason: dto.reason ?? null,
      },
    );

    return {
      ticket: await this.findTicket(ticketId, true),
    };
  }

  async replyTicket(
    ticketId: string,
    dto: AdminReplySupportTicketDto,
    actorId?: string,
  ) {
    await this.findTicketRow(ticketId, false);

    const messageId = await this.createTicketMessage(
      ticketId,
      'AGENT',
      actorId,
      dto.body,
      dto.attachmentUrls ?? [],
      dto.isInternal === true,
    );

    if (dto.isInternal !== true) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "SupportTicket"
          SET
            "status" = 'ANSWERED',
            "lastMessageAt" = NOW(),
            "updatedAt" = NOW()
          WHERE
            "id" = ${ticketId}
            AND "deleted_at" IS NULL
        `,
      );
    }

    await this.createSystemEvent(
      'support.ticket.replied',
      'پاسخ تیکت پشتیبانی توسط ادمین ثبت شد.',
      ticketId,
      actorId,
      {
        ticketId,
        messageId,
        isInternal: dto.isInternal === true,
      },
    );

    return {
      ticket: await this.findTicket(ticketId, true),
    };
  }

  async deleteTicket(ticketId: string, actorId?: string) {
    await this.findTicketRow(ticketId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportTicket"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${ticketId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.ticket.deleted',
      'تیکت پشتیبانی توسط ادمین حذف نرم شد.',
      ticketId,
      actorId,
      {
        ticketId,
      },
    );

    return {
      success: true,
      message: 'تیکت پشتیبانی با موفقیت حذف شد.',
    };
  }

  async restoreTicket(ticketId: string, actorId?: string) {
    await this.findTicketRow(ticketId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportTicket"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${ticketId}
      `,
    );

    await this.createSystemEvent(
      'support.ticket.restored',
      'تیکت پشتیبانی حذف‌شده توسط ادمین بازگردانی شد.',
      ticketId,
      actorId,
      {
        ticketId,
      },
    );

    return {
      ticket: await this.findTicket(ticketId, true),
    };
  }

  async findChats(query: AdminQuerySupportChatDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildChatWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<SupportChatRow[]>(
        Prisma.sql`
            ${this.chatSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveChatSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              c."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "SupportChatConversation" c
            LEFT JOIN "User" u
              ON u."id" = c."userId"
            LEFT JOIN "User" a
              ON a."id" = c."assignedAgentId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapChat(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findChat(conversationId: string, includeDeleted = true) {
    const chat = await this.findChatRow(conversationId, includeDeleted);

    const messages = await this.findChatMessages(conversationId);

    return {
      ...this.mapChat(chat),
      messages: messages.map((message) => this.mapChatMessage(message)),
    };
  }

  async createChat(dto: AdminCreateSupportChatDto, actorId?: string) {
    const dtoRecord = this.toRecord(dto);

    const conversationKey = this.resolveConversationKey(dtoRecord);

    await this.assertChatConversationKeyUnique(conversationKey);

    const conversationId = randomUUID();

    const metadata = {
      ...this.toRecord(dtoRecord.metadata),
      externalId: dtoRecord.externalId ?? null,
      guestToken: dtoRecord.guestToken ?? null,
      channel: dtoRecord.channel ?? 'ADMIN',
    };

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SupportChatConversation" (
          "id",
          "conversationKey",
          "userId",
          "guestName",
          "guestEmail",
          "guestPhone",
          "status",
          "assignedAgentId",
          "lastMessageAt",
          "metadata",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${conversationId},
          ${conversationKey},
          ${dto.userId ?? null},
          ${dto.guestName ?? null},
          ${dto.guestEmail ?? null},
          ${dto.guestPhone ?? null},
          'OPEN',
          ${dto.assignedAgentId ?? actorId ?? null},
          NULL,
          ${JSON.stringify(metadata)}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'support.chat.created',
      'گفت‌وگوی پشتیبانی توسط ادمین ایجاد شد.',
      conversationId,
      actorId,
      {
        conversationId,
        conversationKey,
      },
    );

    return {
      chat: await this.findChat(conversationId, true),
    };
  }

  async sendChatMessage(
    conversationId: string,
    dto: AdminSendSupportChatMessageDto,
    actorId?: string,
  ) {
    await this.findChatRow(conversationId, false);

    const messageId = await this.createChatMessage(
      conversationId,
      'AGENT',
      actorId,
      dto.body,
      dto.attachmentUrls ?? [],
    );

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportChatConversation"
        SET
          "status" = CASE
            WHEN "status" = 'OPEN' THEN 'ASSIGNED'
            ELSE "status"
          END,
          "lastMessageAt" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${conversationId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.chat.message.sent',
      'پیام گفت‌وگوی پشتیبانی توسط ادمین ارسال شد.',
      conversationId,
      actorId,
      {
        conversationId,
        messageId,
      },
    );

    return {
      chat: await this.findChat(conversationId, true),
    };
  }

  async updateChatStatus(
    conversationId: string,
    dto: AdminUpdateSupportChatStatusDto,
    actorId?: string,
  ) {
    const current = await this.findChatRow(conversationId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportChatConversation"
        SET
          "status" = ${dto.status},
          "updatedAt" = NOW()
        WHERE
          "id" = ${conversationId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.chat.status.updated',
      'وضعیت گفت‌وگوی پشتیبانی توسط ادمین تغییر کرد.',
      conversationId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      chat: await this.findChat(conversationId, true),
    };
  }

  async assignChat(
    conversationId: string,
    dto: AdminAssignSupportDto,
    actorId?: string,
  ) {
    await this.findChatRow(conversationId, false);

    const agentId =
      dto.unassign === true ? null : (dto.agentId ?? actorId ?? null);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportChatConversation"
        SET
          "assignedAgentId" = ${agentId},
          "status" = CASE
            WHEN ${agentId} IS NULL THEN "status"
            ELSE 'ASSIGNED'
          END,
          "updatedAt" = NOW()
        WHERE
          "id" = ${conversationId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.chat.assigned',
      'گفت‌وگوی پشتیبانی به پشتیبان اختصاص داده شد.',
      conversationId,
      actorId,
      {
        assignedAgentId: agentId,
        reason: dto.reason ?? null,
      },
    );

    return {
      chat: await this.findChat(conversationId, true),
    };
  }

  async markChatRead(conversationId: string, actorId?: string) {
    await this.findChatRow(conversationId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportChatMessage"
        SET
          "readAt" = COALESCE("readAt", NOW())
        WHERE
          "conversationId" = ${conversationId}
          AND "senderType" = 'CUSTOMER'
      `,
    );

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportChatConversation"
        SET
          "updatedAt" = NOW()
        WHERE
          "id" = ${conversationId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.chat.read',
      'گفت‌وگوی پشتیبانی توسط ادمین خوانده شد.',
      conversationId,
      actorId,
      {
        conversationId,
      },
    );

    return {
      success: true,
      message: 'گفت‌وگو با موفقیت خوانده شد.',
    };
  }

  async deleteChat(conversationId: string, actorId?: string) {
    await this.findChatRow(conversationId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportChatConversation"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${conversationId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'support.chat.deleted',
      'گفت‌وگوی پشتیبانی توسط ادمین حذف نرم شد.',
      conversationId,
      actorId,
      {
        conversationId,
      },
    );

    return {
      success: true,
      message: 'گفت‌وگوی پشتیبانی با موفقیت حذف شد.',
    };
  }

  async restoreChat(conversationId: string, actorId?: string) {
    await this.findChatRow(conversationId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SupportChatConversation"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${conversationId}
      `,
    );

    await this.createSystemEvent(
      'support.chat.restored',
      'گفت‌وگوی پشتیبانی حذف‌شده توسط ادمین بازگردانی شد.',
      conversationId,
      actorId,
      {
        conversationId,
      },
    );

    return {
      chat: await this.findChat(conversationId, true),
    };
  }

  async getDashboard() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        openTickets: number | bigint;
        pendingTickets: number | bigint;
        closedTickets: number | bigint;
        urgentTickets: number | bigint;
        openChats: number | bigint;
        waitingChats: number | bigint;
        unreadChats: number | bigint;
        unassignedChats: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM "SupportTicket"
              WHERE "deleted_at" IS NULL AND "status" = 'OPEN'
            ) AS "openTickets",
            (
              SELECT COUNT(*)::int
              FROM "SupportTicket"
              WHERE "deleted_at" IS NULL AND "status" = 'PENDING'
            ) AS "pendingTickets",
            (
              SELECT COUNT(*)::int
              FROM "SupportTicket"
              WHERE "deleted_at" IS NULL AND "status" = 'CLOSED'
            ) AS "closedTickets",
            (
              SELECT COUNT(*)::int
              FROM "SupportTicket"
              WHERE "deleted_at" IS NULL AND "priority" = 'URGENT'
            ) AS "urgentTickets",
            (
              SELECT COUNT(*)::int
              FROM "SupportChatConversation"
              WHERE "deleted_at" IS NULL AND "status" IN ('OPEN', 'ASSIGNED')
            ) AS "openChats",
            (
              SELECT COUNT(*)::int
              FROM "SupportChatConversation"
              WHERE "deleted_at" IS NULL AND "status" = 'WAITING'
            ) AS "waitingChats",
            (
              SELECT COUNT(*)::int
              FROM "SupportChatConversation" c
              WHERE
                c."deleted_at" IS NULL
                AND EXISTS (
                  SELECT 1
                  FROM "SupportChatMessage" m
                  WHERE
                    m."conversationId" = c."id"
                    AND m."senderType" = 'CUSTOMER'
                    AND m."readAt" IS NULL
                )
            ) AS "unreadChats",
            (
              SELECT COUNT(*)::int
              FROM "SupportChatConversation"
              WHERE "deleted_at" IS NULL AND "assignedAgentId" IS NULL
            ) AS "unassignedChats"
        `,
    );

    const row = rows[0];

    return {
      tickets: {
        open: this.toNumber(row?.openTickets),
        pending: this.toNumber(row?.pendingTickets),
        closed: this.toNumber(row?.closedTickets),
        urgent: this.toNumber(row?.urgentTickets),
      },
      chats: {
        open: this.toNumber(row?.openChats),
        waiting: this.toNumber(row?.waitingChats),
        unread: this.toNumber(row?.unreadChats),
        unassigned: this.toNumber(row?.unassignedChats),
      },
    };
  }

  async createSupportNote(
    entity: 'ticket' | 'chat',
    entityId: string,
    dto: AdminSupportNoteDto,
    actorId?: string,
  ) {
    const eventName =
      entity === 'ticket'
        ? 'support.ticket.note.created'
        : 'support.chat.note.created';

    await this.createSystemEvent(
      eventName,
      'یادداشت مدیریتی پشتیبانی ثبت شد.',
      entityId,
      actorId,
      {
        [`${entity}Id`]: entityId,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      message: 'یادداشت پشتیبانی با موفقیت ثبت شد.',
    };
  }

  async findTicketsForExport(query: AdminQuerySupportTicketDto) {
    const result = await this.findTickets({
      ...query,
      page: 1,
      limit: 200,
    });

    return result.data;
  }

  async findChatsForExport(query: AdminQuerySupportChatDto) {
    const result = await this.findChats({
      ...query,
      page: 1,
      limit: 200,
    });

    return result.data;
  }

  private ticketSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        t."id",
        t."ticketNumber",
        t."userId",
        t."guestName",
        t."guestEmail",
        t."guestPhone",
        t."orderId",
        t."subject",
        t."category",
        t."priority",
        t."status",
        t."channel",
        t."assignedAgentId",
        t."lastMessageAt",
        t."closedAt",
        t."metadata",
        t."createdAt",
        t."updatedAt",
        t."deleted_at" AS "deletedAt",
        u."email" AS "userEmail",
        u."phone" AS "userPhone",
        u."firstName" AS "userFirstName",
        u."lastName" AS "userLastName",
        a."email" AS "agentEmail",
        a."firstName" AS "agentFirstName",
        a."lastName" AS "agentLastName",
        o."orderNumber",
        COALESCE(stats."messageCount", 0)::int AS "messageCount",
        COALESCE(stats."internalMessageCount", 0)::int AS "internalMessageCount"
      FROM "SupportTicket" t
      LEFT JOIN "User" u
        ON u."id" = t."userId"
      LEFT JOIN "User" a
        ON a."id" = t."assignedAgentId"
      LEFT JOIN "Order" o
        ON o."id" = t."orderId"
      LEFT JOIN LATERAL (
        SELECT
          COUNT(m."id")::int AS "messageCount",
          COUNT(m."id") FILTER (WHERE m."isInternal" = TRUE)::int AS "internalMessageCount"
        FROM "SupportTicketMessage" m
        WHERE
          m."ticketId" = t."id"
      ) stats ON TRUE
    `;
  }

  private chatSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        c."id",
        c."conversationKey",
        c."userId",
        c."guestName",
        c."guestEmail",
        c."guestPhone",
        c."status",
        c."assignedAgentId",
        c."lastMessageAt",
        c."metadata",
        c."createdAt",
        c."updatedAt",
        c."deleted_at" AS "deletedAt",
        u."email" AS "userEmail",
        u."phone" AS "userPhone",
        u."firstName" AS "userFirstName",
        u."lastName" AS "userLastName",
        a."email" AS "agentEmail",
        a."firstName" AS "agentFirstName",
        a."lastName" AS "agentLastName",
        COALESCE(stats."messageCount", 0)::int AS "messageCount",
        COALESCE(stats."unreadByAdmin", 0)::int AS "unreadByAdmin",
        COALESCE(stats."unreadByCustomer", 0)::int AS "unreadByCustomer",
        stats."lastCustomerMessageAt",
        stats."lastAgentMessageAt"
      FROM "SupportChatConversation" c
      LEFT JOIN "User" u
        ON u."id" = c."userId"
      LEFT JOIN "User" a
        ON a."id" = c."assignedAgentId"
      LEFT JOIN LATERAL (
        SELECT
          COUNT(m."id")::int AS "messageCount",
          COUNT(m."id") FILTER (
            WHERE m."senderType" = 'CUSTOMER'
              AND m."readAt" IS NULL
          )::int AS "unreadByAdmin",
          COUNT(m."id") FILTER (
            WHERE m."senderType" = 'AGENT'
              AND m."readAt" IS NULL
          )::int AS "unreadByCustomer",
          MAX(m."createdAt") FILTER (WHERE m."senderType" = 'CUSTOMER') AS "lastCustomerMessageAt",
          MAX(m."createdAt") FILTER (WHERE m."senderType" = 'AGENT') AS "lastAgentMessageAt"
        FROM "SupportChatMessage" m
        WHERE
          m."conversationId" = c."id"
      ) stats ON TRUE
    `;
  }

  private buildTicketWhere(query: AdminQuerySupportTicketDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`t."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          t."ticketNumber" ILIKE ${`%${query.q}%`}
          OR t."subject" ILIKE ${`%${query.q}%`}
          OR t."guestEmail" ILIKE ${`%${query.q}%`}
          OR t."guestPhone" ILIKE ${`%${query.q}%`}
          OR u."email" ILIKE ${`%${query.q}%`}
          OR u."phone" ILIKE ${`%${query.q}%`}
          OR o."orderNumber" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.ticketId) {
      where.push(Prisma.sql`t."id" = ${query.ticketId}`);
    }

    if (query.ticketNumber) {
      where.push(
        Prisma.sql`t."ticketNumber" ILIKE ${`%${query.ticketNumber}%`}`,
      );
    }

    if (query.userId) {
      where.push(Prisma.sql`t."userId" = ${query.userId}`);
    }

    if (query.orderId) {
      where.push(Prisma.sql`t."orderId" = ${query.orderId}`);
    }

    if (query.assignedAgentId) {
      where.push(Prisma.sql`t."assignedAgentId" = ${query.assignedAgentId}`);
    }

    if (query.category) {
      where.push(Prisma.sql`t."category" ILIKE ${`%${query.category}%`}`);
    }

    if (query.priority) {
      where.push(Prisma.sql`t."priority" = ${query.priority}`);
    }

    if (query.status) {
      where.push(Prisma.sql`t."status" = ${query.status}`);
    }

    if (query.channel) {
      where.push(Prisma.sql`t."channel" = ${query.channel}`);
    }

    if (query.unassignedOnly === true) {
      where.push(Prisma.sql`t."assignedAgentId" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`t."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`t."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.lastMessageFrom) {
      where.push(
        Prisma.sql`t."lastMessageAt" >= ${new Date(query.lastMessageFrom)}`,
      );
    }

    if (query.lastMessageTo) {
      where.push(
        Prisma.sql`t."lastMessageAt" <= ${new Date(query.lastMessageTo)}`,
      );
    }

    return where;
  }

  private buildChatWhere(query: AdminQuerySupportChatDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          c."conversationKey" ILIKE ${`%${query.q}%`}
          OR c."guestName" ILIKE ${`%${query.q}%`}
          OR c."guestEmail" ILIKE ${`%${query.q}%`}
          OR c."guestPhone" ILIKE ${`%${query.q}%`}
          OR u."email" ILIKE ${`%${query.q}%`}
          OR u."phone" ILIKE ${`%${query.q}%`}
          OR c."metadata"::text ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.conversationId) {
      where.push(Prisma.sql`c."id" = ${query.conversationId}`);
    }

    if (query.externalId) {
      where.push(
        Prisma.sql`(
          c."conversationKey" = ${query.externalId}
          OR c."metadata" #>> ARRAY['externalId'] = ${query.externalId}
        )`,
      );
    }

    if (query.userId) {
      where.push(Prisma.sql`c."userId" = ${query.userId}`);
    }

    if (query.guestToken) {
      where.push(
        Prisma.sql`(
          c."conversationKey" = ${query.guestToken}
          OR c."metadata" #>> ARRAY['guestToken'] = ${query.guestToken}
        )`,
      );
    }

    if (query.assignedAgentId) {
      where.push(Prisma.sql`c."assignedAgentId" = ${query.assignedAgentId}`);
    }

    if (query.status) {
      where.push(Prisma.sql`c."status" = ${query.status}`);
    }

    if (query.channel) {
      where.push(
        Prisma.sql`COALESCE(c."metadata" #>> ARRAY['channel'], 'WEB') = ${query.channel}`,
      );
    }

    if (query.unreadOnly === true) {
      where.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM "SupportChatMessage" m
          WHERE
            m."conversationId" = c."id"
            AND m."senderType" = 'CUSTOMER'
            AND m."readAt" IS NULL
        )`,
      );
    }

    if (query.unassignedOnly === true) {
      where.push(Prisma.sql`c."assignedAgentId" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`c."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`c."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.lastMessageFrom) {
      where.push(
        Prisma.sql`c."lastMessageAt" >= ${new Date(query.lastMessageFrom)}`,
      );
    }

    if (query.lastMessageTo) {
      where.push(
        Prisma.sql`c."lastMessageAt" <= ${new Date(query.lastMessageTo)}`,
      );
    }

    return where;
  }

  private async findTicketRow(
    ticketId: string,
    includeDeleted: boolean,
  ): Promise<SupportTicketRow> {
    const where: Prisma.Sql[] = [Prisma.sql`t."id" = ${ticketId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`t."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<SupportTicketRow[]>(
      Prisma.sql`
          ${this.ticketSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const ticket = rows[0];

    if (!ticket) {
      throw new NotFoundException('تیکت پشتیبانی موردنظر یافت نشد.');
    }

    return ticket;
  }

  private async findChatRow(
    conversationId: string,
    includeDeleted: boolean,
  ): Promise<SupportChatRow> {
    const where: Prisma.Sql[] = [Prisma.sql`c."id" = ${conversationId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<SupportChatRow[]>(
      Prisma.sql`
          ${this.chatSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const chat = rows[0];

    if (!chat) {
      throw new NotFoundException('گفت‌وگوی پشتیبانی موردنظر یافت نشد.');
    }

    return chat;
  }

  private findTicketMessages(
    ticketId: string,
    includeInternal: boolean,
  ): Promise<SupportTicketMessageRow[]> {
    const where: Prisma.Sql[] = [Prisma.sql`m."ticketId" = ${ticketId}`];

    if (!includeInternal) {
      where.push(Prisma.sql`m."isInternal" = FALSE`);
    }

    return this.prisma.$queryRaw<SupportTicketMessageRow[]>(
      Prisma.sql`
        SELECT
          m."id",
          m."ticketId",
          m."senderType",
          m."senderUserId" AS "senderId",
          m."message" AS "body",
          m."attachments" AS "attachmentUrls",
          m."isInternal",
          NULL::timestamp AS "readAt",
          m."createdAt",
          m."createdAt" AS "updatedAt",
          NULL::timestamp AS "deletedAt",
          u."email" AS "senderEmail",
          u."firstName" AS "senderFirstName",
          u."lastName" AS "senderLastName"
        FROM "SupportTicketMessage" m
        LEFT JOIN "User" u
          ON u."id" = m."senderUserId"
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY
          m."createdAt" ASC,
          m."id" ASC
      `,
    );
  }

  private findChatMessages(
    conversationId: string,
  ): Promise<SupportChatMessageRow[]> {
    return this.prisma.$queryRaw<SupportChatMessageRow[]>(
      Prisma.sql`
        SELECT
          m."id",
          m."conversationId",
          m."senderType",
          m."senderUserId" AS "senderId",
          m."message" AS "body",
          m."attachments" AS "attachmentUrls",
          m."readAt",
          m."createdAt",
          m."createdAt" AS "updatedAt",
          NULL::timestamp AS "deletedAt",
          u."email" AS "senderEmail",
          u."firstName" AS "senderFirstName",
          u."lastName" AS "senderLastName"
        FROM "SupportChatMessage" m
        LEFT JOIN "User" u
          ON u."id" = m."senderUserId"
        WHERE
          m."conversationId" = ${conversationId}
        ORDER BY
          m."createdAt" ASC,
          m."id" ASC
      `,
    );
  }

  private async createTicketMessage(
    ticketId: string,
    senderType: string,
    senderId: string | undefined,
    body: string,
    attachmentUrls: string[],
    isInternal: boolean,
  ): Promise<string> {
    const messageId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SupportTicketMessage" (
          "id",
          "ticketId",
          "senderType",
          "senderUserId",
          "message",
          "attachments",
          "isInternal",
          "createdAt"
        )
        VALUES (
          ${messageId},
          ${ticketId},
          ${senderType},
          ${senderId ?? null},
          ${body},
          ${JSON.stringify(attachmentUrls)}::jsonb,
          ${isInternal},
          NOW()
        )
      `,
    );

    return messageId;
  }

  private async createChatMessage(
    conversationId: string,
    senderType: string,
    senderId: string | undefined,
    body: string,
    attachmentUrls: string[],
  ): Promise<string> {
    const messageId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SupportChatMessage" (
          "id",
          "conversationId",
          "senderType",
          "senderUserId",
          "message",
          "attachments",
          "createdAt"
        )
        VALUES (
          ${messageId},
          ${conversationId},
          ${senderType},
          ${senderId ?? null},
          ${body},
          ${JSON.stringify(attachmentUrls)}::jsonb,
          NOW()
        )
      `,
    );

    return messageId;
  }

  private async generateTicketNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const date = new Date();

      const ticketNumber = `TCK-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${randomUUID()
        .replace(/-/g, '')
        .slice(0, 6)
        .toUpperCase()}`;

      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "SupportTicket"
            WHERE LOWER("ticketNumber") = LOWER(${ticketNumber})
          `,
      );

      if (this.toNumber(rows[0]?.count) === 0) {
        return ticketNumber;
      }
    }

    throw new ConflictException('امکان تولید شماره تیکت یکتا وجود ندارد.');
  }

  private async assertChatConversationKeyUnique(
    conversationKey: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "SupportChatConversation"
          WHERE
            LOWER("conversationKey") = LOWER(${conversationKey})
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('شناسه گفت‌وگو تکراری است.');
    }
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
          'support',
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

  private mapTicket(row: SupportTicketRow) {
    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      subject: row.subject,
      category: row.category,
      priority: row.priority,
      status: row.status,
      channel: row.channel,
      customer: {
        userId: row.userId,
        email: row.userEmail ?? row.guestEmail,
        phone: row.userPhone ?? row.guestPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        guestName: row.guestName,
      },
      assignedAgent: {
        id: row.assignedAgentId,
        email: row.agentEmail,
        firstName: row.agentFirstName,
        lastName: row.agentLastName,
      },
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
      },
      stats: {
        messageCount: this.toNumber(row.messageCount),
        internalMessageCount: this.toNumber(row.internalMessageCount),
      },
      metadata: row.metadata,
      lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapTicketMessage(row: SupportTicketMessageRow) {
    return {
      id: row.id,
      ticketId: row.ticketId,
      senderType: row.senderType,
      sender: {
        id: row.senderId,
        email: row.senderEmail,
        firstName: row.senderFirstName,
        lastName: row.senderLastName,
      },
      body: row.body,
      attachmentUrls: this.toStringArray(row.attachmentUrls),
      isInternal: row.isInternal,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapChat(row: SupportChatRow) {
    const metadata = this.toRecord(row.metadata);

    return {
      id: row.id,
      externalId: metadata.externalId ?? row.conversationKey,
      conversationKey: row.conversationKey,
      guestToken: metadata.guestToken ?? null,
      status: row.status,
      channel: metadata.channel ?? 'WEB',
      customer: {
        userId: row.userId,
        guestToken: metadata.guestToken ?? null,
        email: row.userEmail ?? row.guestEmail,
        phone: row.userPhone ?? row.guestPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        guestName: row.guestName,
      },
      assignedAgent: {
        id: row.assignedAgentId,
        email: row.agentEmail,
        firstName: row.agentFirstName,
        lastName: row.agentLastName,
      },
      unread: {
        byAdmin: this.toNumber(row.unreadByAdmin),
        byCustomer: this.toNumber(row.unreadByCustomer),
      },
      stats: {
        messageCount: this.toNumber(row.messageCount),
      },
      metadata: row.metadata,
      lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
      lastCustomerMessageAt: row.lastCustomerMessageAt
        ? row.lastCustomerMessageAt.toISOString()
        : null,
      lastAgentMessageAt: row.lastAgentMessageAt
        ? row.lastAgentMessageAt.toISOString()
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapChatMessage(row: SupportChatMessageRow) {
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderType: row.senderType,
      sender: {
        id: row.senderId,
        email: row.senderEmail,
        firstName: row.senderFirstName,
        lastName: row.senderLastName,
      },
      body: row.body,
      attachmentUrls: this.toStringArray(row.attachmentUrls),
      readAt: row.readAt ? row.readAt.toISOString() : null,
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

  private resolveTicketSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`t."updatedAt"`;
    }

    if (sortBy === 'lastMessageAt') {
      return Prisma.sql`t."lastMessageAt"`;
    }

    if (sortBy === 'ticketNumber') {
      return Prisma.sql`t."ticketNumber"`;
    }

    if (sortBy === 'priority') {
      return Prisma.sql`t."priority"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`t."status"`;
    }

    if (sortBy === 'channel') {
      return Prisma.sql`t."channel"`;
    }

    if (sortBy === 'category') {
      return Prisma.sql`t."category"`;
    }

    if (sortBy === 'assignedAgentId') {
      return Prisma.sql`t."assignedAgentId"`;
    }

    if (sortBy === 'subject') {
      return Prisma.sql`t."subject"`;
    }

    return Prisma.sql`t."createdAt"`;
  }

  private resolveChatSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`c."updatedAt"`;
    }

    if (sortBy === 'lastMessageAt') {
      return Prisma.sql`c."lastMessageAt"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`c."status"`;
    }

    if (sortBy === 'channel') {
      return Prisma.sql`COALESCE(c."metadata" #>> ARRAY['channel'], 'WEB')`;
    }

    if (sortBy === 'assignedAgentId') {
      return Prisma.sql`c."assignedAgentId"`;
    }

    if (sortBy === 'unreadByAdmin') {
      return Prisma.sql`COALESCE(stats."unreadByAdmin", 0)`;
    }

    if (sortBy === 'unreadByCustomer') {
      return Prisma.sql`COALESCE(stats."unreadByCustomer", 0)`;
    }

    return Prisma.sql`c."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
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

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private resolveConversationKey(dto: Record<string, unknown>): string {
    const externalId = this.toOptionalString(dto.externalId);

    if (externalId) {
      return externalId;
    }

    const guestToken = this.toOptionalString(dto.guestToken);

    if (guestToken) {
      return guestToken;
    }

    return `admin-${randomUUID()}`;
  }

  private toOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }
}
