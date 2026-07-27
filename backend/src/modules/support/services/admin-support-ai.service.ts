import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminSupportAiSummaryDto } from '../dto/admin-support-ai.dto';

type SupportActorContext = {
  userId: string;
  role?: string | null;
  permissions?: string[];
};

type TicketRow = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  channel: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  userEmail: string | null;
  userPhone: string | null;
  orderNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TicketMessageRow = {
  id: string;
  senderType: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
};

type ChatRow = {
  id: string;
  conversationKey: string;
  status: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  userEmail: string | null;
  userPhone: string | null;
  lastMessageAt: Date | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type ChatMessageRow = {
  id: string;
  senderType: string;
  body: string;
  createdAt: Date;
};

type NormalizedMessage = {
  id: string;
  senderType: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
};

@Injectable()
export class AdminSupportAiService {
  private readonly modelName = 'backend-deterministic-support-summary';

  private readonly guardrails = [
    'این خروجی فقط خلاصه یا پیش‌نویس مدیریتی است و هیچ پیام یا تیکتی را تغییر نمی‌دهد.',
    'پاسخ نهایی به مشتری باید قبل از ارسال توسط ادمین بازبینی شود.',
    'در موضوعات پزشکی، حقوقی، مالی یا امنیتی باید از قطعیت و تشخیص قطعی پرهیز شود.',
    'اطلاعات حساس مشتری نباید در خروجی عمومی یا خارج از پنل ادمین منتشر شود.',
  ];

  constructor(private readonly prisma: PrismaService) {}

  async summarize(dto: AdminSupportAiSummaryDto, context: SupportActorContext) {
    const mode = this.resolveMode(dto);

    if (mode === 'text') {
      const messages = this.messagesFromText(dto.text ?? '');

      return this.buildResult({
        mode,
        entity: null,
        messages,
        context,
      });
    }

    if (mode === 'ticket') {
      const ticketId = dto.ticketId;

      if (!ticketId) {
        throw new BadRequestException(
          'برای خلاصه‌سازی تیکت باید ticketId ارسال شود.',
        );
      }

      const [ticket, messages] = await Promise.all([
        this.findTicket(ticketId),
        this.findTicketMessages(
          ticketId,
          dto.includeInternal === true,
          dto.maxMessages ?? 50,
        ),
      ]);

      return this.buildResult({
        mode,
        entity: ticket,
        messages,
        context,
      });
    }

    const conversationId = dto.conversationId;

    if (!conversationId) {
      throw new BadRequestException(
        'برای خلاصه‌سازی گفت‌وگو باید conversationId ارسال شود.',
      );
    }

    const [chat, messages] = await Promise.all([
      this.findChat(conversationId),
      this.findChatMessages(conversationId, dto.maxMessages ?? 50),
    ]);

    return this.buildResult({
      mode,
      entity: chat,
      messages,
      context,
    });
  }

  private resolveMode(
    dto: AdminSupportAiSummaryDto,
  ): 'ticket' | 'chat' | 'text' {
    if (dto.entityType === 'ticket' || dto.ticketId) {
      return 'ticket';
    }

    if (dto.entityType === 'chat' || dto.conversationId) {
      return 'chat';
    }

    if (dto.entityType === 'text' || dto.text) {
      return 'text';
    }

    throw new BadRequestException(
      'برای خلاصه‌سازی باید ticketId، conversationId یا text ارسال شود.',
    );
  }

  private async findTicket(ticketId: string): Promise<TicketRow> {
    const rows = await this.prisma.$queryRaw<TicketRow[]>(
      Prisma.sql`
          SELECT
            t."id",
            t."ticketNumber",
            t."subject",
            t."category",
            t."priority",
            t."status",
            t."channel",
            t."guestName",
            t."guestEmail",
            t."guestPhone",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            o."orderNumber",
            t."createdAt",
            t."updatedAt"
          FROM "SupportTicket" t
          LEFT JOIN "User" u
            ON u."id" = t."userId"
          LEFT JOIN "Order" o
            ON o."id" = t."orderId"
          WHERE
            t."id" = ${ticketId}
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

  private async findTicketMessages(
    ticketId: string,
    includeInternal: boolean,
    limit: number,
  ): Promise<NormalizedMessage[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`m."ticketId" = ${ticketId}`,
      Prisma.sql`m."deleted_at" IS NULL`,
    ];

    if (!includeInternal) {
      where.push(Prisma.sql`m."isInternal" = FALSE`);
    }

    const rows = await this.prisma.$queryRaw<TicketMessageRow[]>(
      Prisma.sql`
          SELECT
            m."id",
            m."senderType",
            m."message" AS "body",
            m."isInternal",
            m."createdAt"
          FROM "SupportTicketMessage" m
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            m."createdAt" DESC,
            m."id" DESC
          LIMIT ${Math.min(Math.max(limit, 1), 100)}
        `,
    );

    return rows.reverse().map((row) => ({
      id: row.id,
      senderType: row.senderType,
      body: this.cleanText(row.body),
      isInternal: row.isInternal,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async findChat(conversationId: string): Promise<ChatRow> {
    const rows = await this.prisma.$queryRaw<ChatRow[]>(
      Prisma.sql`
          SELECT
            c."id",
            c."conversationKey",
            c."status",
            c."guestName",
            c."guestEmail",
            c."guestPhone",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            c."lastMessageAt",
            c."metadata",
            c."createdAt",
            c."updatedAt"
          FROM "SupportChatConversation" c
          LEFT JOIN "User" u
            ON u."id" = c."userId"
          WHERE
            c."id" = ${conversationId}
            AND c."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const chat = rows[0];

    if (!chat) {
      throw new NotFoundException('گفت‌وگوی پشتیبانی موردنظر یافت نشد.');
    }

    return chat;
  }

  private async findChatMessages(
    conversationId: string,
    limit: number,
  ): Promise<NormalizedMessage[]> {
    const rows = await this.prisma.$queryRaw<ChatMessageRow[]>(
      Prisma.sql`
          SELECT
            m."id",
            m."senderType",
            m."message" AS "body",
            m."createdAt"
          FROM "SupportChatMessage" m
          WHERE
            m."conversationId" = ${conversationId}
          ORDER BY
            m."createdAt" DESC,
            m."id" DESC
          LIMIT ${Math.min(Math.max(limit, 1), 100)}
        `,
    );

    return rows.reverse().map((row) => ({
      id: row.id,
      senderType: row.senderType,
      body: this.cleanText(row.body),
      isInternal: false,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private messagesFromText(text: string): NormalizedMessage[] {
    const cleaned = this.cleanText(text);

    if (!cleaned) {
      throw new BadRequestException(
        'برای خلاصه‌سازی متن آزاد باید text ارسال شود.',
      );
    }

    return [
      {
        id: 'manual-text',
        senderType: 'TEXT',
        body: cleaned,
        isInternal: false,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private buildResult(params: {
    mode: 'ticket' | 'chat' | 'text';
    entity: TicketRow | ChatRow | null;
    messages: NormalizedMessage[];
    context: SupportActorContext;
  }) {
    const customerMessages = params.messages.filter((message) =>
      ['CUSTOMER', 'USER', 'GUEST', 'TEXT'].includes(message.senderType),
    );

    const agentMessages = params.messages.filter((message) =>
      ['AGENT', 'ADMIN', 'SUPPORT'].includes(message.senderType),
    );

    const latestMessage = params.messages[params.messages.length - 1] ?? null;

    const issue = this.extractIssue(params.messages);

    const urgency = this.detectUrgency(params.messages, params.entity);

    return {
      mode: params.mode,
      summary: {
        title: this.buildTitle(params.mode, params.entity),
        issue,
        currentState: this.buildCurrentState(params.entity, params.messages),
        customerMessageCount: customerMessages.length,
        agentMessageCount: agentMessages.length,
        totalMessages: params.messages.length,
        urgency,
        latestMessage: latestMessage
          ? {
              senderType: latestMessage.senderType,
              body: this.shorten(latestMessage.body, 240),
              createdAt: latestMessage.createdAt,
            }
          : null,
        recommendedNextActions: this.buildNextActions(urgency, params.mode),
        replyDraft: this.buildReplyDraft(issue, params.mode),
        guardrails: this.guardrails,
      },
      entity: params.entity,
      messages: params.messages.map((message) => ({
        ...message,
        body: this.shorten(message.body, 500),
      })),
      model: this.modelName,
      applied: false,
      tool: {
        name: 'support.summary',
        title: 'خلاصه پشتیبانی',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiresApproval: false,
      },
      audit: {
        actorId: params.context.userId,
        action: 'support.ai_summary_generated',
      },
    };
  }

  private buildTitle(mode: string, entity: TicketRow | ChatRow | null): string {
    if (!entity) {
      return 'خلاصه متن پشتیبانی';
    }

    if ('ticketNumber' in entity) {
      return `خلاصه تیکت ${entity.ticketNumber}`;
    }

    return `خلاصه گفت‌وگوی ${entity.conversationKey ?? entity.id}`;
  }

  private buildCurrentState(
    entity: TicketRow | ChatRow | null,
    messages: NormalizedMessage[],
  ): string {
    if (!entity) {
      return `${messages.length} پیام/متن برای خلاصه‌سازی بررسی شد.`;
    }

    if ('ticketNumber' in entity) {
      return `تیکت با وضعیت ${entity.status}، اولویت ${entity.priority} و موضوع «${entity.subject}» بررسی شد.`;
    }

    return `گفت‌وگو با وضعیت ${entity.status} و ${messages.length} پیام بررسی شد.`;
  }

  private extractIssue(messages: NormalizedMessage[]): string {
    const customerMessage =
      messages.find((message) =>
        ['CUSTOMER', 'USER', 'GUEST', 'TEXT'].includes(message.senderType),
      ) ??
      messages[0] ??
      null;

    if (!customerMessage) {
      return 'پیام قابل خلاصه‌سازی پیدا نشد.';
    }

    return this.shorten(customerMessage.body, 300);
  }

  private detectUrgency(
    messages: NormalizedMessage[],
    entity: TicketRow | ChatRow | null,
  ): 'low' | 'medium' | 'high' {
    if (entity && 'priority' in entity && entity.priority === 'URGENT') {
      return 'high';
    }

    const combined = messages.map((message) => message.body).join(' ');

    if (
      /فوری|خراب|پرداخت|برگشت وجه|refund|urgent|شکایت|ارسال نشده|ارسال نشد/i.test(
        combined,
      )
    ) {
      return 'high';
    }

    if (/پیگیری|سفارش|تاخیر|تأخیر|مشکل|خطا/i.test(combined)) {
      return 'medium';
    }

    return 'low';
  }

  private buildNextActions(
    urgency: 'low' | 'medium' | 'high',
    mode: string,
  ): string[] {
    const actions = [
      'قبل از پاسخ نهایی، اطلاعات سفارش/پرداخت/محصول مرتبط را از پنل بررسی کن.',
      'پاسخ را کوتاه، محترمانه و بدون وعده غیرقطعی ارسال کن.',
    ];

    if (urgency === 'high') {
      actions.unshift(
        'این مورد نیازمند پیگیری سریع توسط ادمین یا پشتیبان است.',
      );
    }

    if (mode === 'chat') {
      actions.push(
        'اگر پیام مشتری خوانده نشده است، پس از بررسی می‌توان وضعیت گفت‌وگو را read کرد.',
      );
    }

    return actions;
  }

  private buildReplyDraft(
    issue: string,
    mode: 'ticket' | 'chat' | 'text',
  ): string {
    const sourceLabel =
      mode === 'ticket'
        ? 'تیکت شما'
        : mode === 'chat'
          ? 'گفت‌وگوی شما'
          : 'پیام شما';

    return `سلام، ${sourceLabel} درباره «${this.shorten(issue, 120)}» دریافت شد. موضوع توسط تیم پشتیبانی بررسی می‌شود و پس از کنترل اطلاعات ثبت‌شده، نتیجه به شما اطلاع داده خواهد شد.`;
  }

  private cleanText(value: string): string {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private shorten(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 1)}…`;
  }
}
