import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { createTransport } from 'nodemailer';

import type { Transporter } from 'nodemailer';

import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { EmailQueueJobData } from '../../../core/queue/types/queue.types';

import { NotificationDeliveryChannel } from './notification-delivery.channel';

import { NotificationDeliveryPort } from './notification-delivery.port';

import {
  NotificationDeliveryPayload,
  NotificationDeliveryResult,
} from './notification-delivery.types';

type ContactRow = {
  value: string | null;
};

type EmailSendInput = {
  readonly to: string;
  readonly subject: string;
  readonly template: string;
  readonly payload: Record<string, unknown>;
};

@Injectable()
export class EmailNotificationDelivery implements NotificationDeliveryPort {
  readonly channel = NotificationDeliveryChannel.EMAIL;

  private readonly logger = new Logger(EmailNotificationDelivery.name);

  private transporter: Transporter<SMTPTransport.SentMessageInfo> | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async deliver(
    payload: NotificationDeliveryPayload,
  ): Promise<NotificationDeliveryResult> {
    const recipient =
      this.resolveEmailFromMetadata(payload.metadata) ??
      (await this.findUserEmail(payload.userId));

    if (!recipient) {
      return {
        channel: this.channel,
        delivered: false,
        provider: 'smtp',
        messageId: payload.notificationId,
        error: 'آدرس ایمیل کاربر برای ارسال اعلان یافت نشد.',
      };
    }

    return this.sendEmail({
      to: recipient,
      subject: payload.title,
      template: 'notification',
      payload: {
        notificationId: payload.notificationId,
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        metadata: payload.metadata ?? {},
        actorId: payload.actorId ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  async sendQueuedEmail(
    data: EmailQueueJobData,
  ): Promise<NotificationDeliveryResult> {
    return this.sendEmail({
      to: data.to,
      subject: data.subject,
      template: data.template,
      payload: data.payload,
    });
  }

  private async sendEmail(
    input: EmailSendInput,
  ): Promise<NotificationDeliveryResult> {
    if (!this.isEnabled()) {
      return {
        channel: this.channel,
        delivered: false,
        provider: 'smtp',
        messageId: null,
        error: 'ارسال ایمیل غیرفعال است.',
      };
    }

    const fromAddress = this.getRequiredString(
      'SMTP_FROM_ADDRESS',
      'EMAIL_FROM_ADDRESS',
    );

    const fromName = this.getString('SMTP_FROM_NAME', 'VEXO Beauty');

    const html = this.renderHtml(input);

    const text = this.renderText(input);

    try {
      const info = await this.getTransporter().sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: input.to,
        subject: input.subject,
        text,
        html,
      });

      return {
        channel: this.channel,
        delivered: true,
        provider: 'smtp',
        messageId: info.messageId ?? null,
        error: null,
      };
    } catch (error) {
      this.logger.error(
        `Email delivery failed: ${input.to}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        channel: this.channel,
        delivered: false,
        provider: 'smtp',
        messageId: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private getTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.getRequiredString('SMTP_HOST', 'EMAIL_SMTP_HOST');

    const port = this.getNumber('SMTP_PORT', 587);

    const secure = this.getBoolean('SMTP_SECURE', false);

    const user = this.getString('SMTP_USER', '');

    const pass = this.getString('SMTP_PASSWORD', '');

    this.transporter = createTransport({
      host,
      port,
      secure,
      auth:
        user.length > 0 || pass.length > 0
          ? {
              user,
              pass,
            }
          : undefined,
    });

    return this.transporter;
  }

  private async findUserEmail(userId: string): Promise<string | null> {
    const column = this.getSafeColumnName(
      this.getString('NOTIFICATION_USER_EMAIL_COLUMN', 'email'),
      'email',
    );

    const rows = await this.prisma.$queryRawUnsafe<ContactRow[]>(
      `
          SELECT
            "${column}"::text AS "value"
          FROM "User"
          WHERE
            "id" = $1
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
      userId,
    );

    const value = rows[0]?.value?.trim();

    return value && value.length > 0 ? value : null;
  }

  private resolveEmailFromMetadata(
    metadata?: Record<string, unknown> | null,
  ): string | null {
    if (!metadata) {
      return null;
    }

    const candidates = [
      metadata.email,
      metadata.recipientEmail,
      metadata.toEmail,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private renderHtml(input: EmailSendInput): string {
    const rawHtml = input.payload.html;

    if (typeof rawHtml === 'string' && rawHtml.trim().length > 0) {
      return rawHtml;
    }

    const title = this.resolvePayloadText(input.payload.title, input.subject);

    const message = this.resolvePayloadText(
      input.payload.message,
      input.payload.body,
      '',
    );

    const actionUrl =
      typeof input.payload.actionUrl === 'string'
        ? input.payload.actionUrl.trim()
        : '';

    const action =
      actionUrl.length > 0
        ? `<p style="margin-top:24px"><a href="${this.escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none">مشاهده جزئیات</a></p>`
        : '';

    return [
      '<!doctype html>',
      '<html lang="fa" dir="rtl">',
      '<head><meta charset="utf-8"></head>',
      '<body style="font-family:Tahoma,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#111827">',
      '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #e5e7eb">',
      `<h1 style="font-size:20px;margin:0 0 16px">${this.escapeHtml(title)}</h1>`,
      `<p style="font-size:15px;line-height:1.9;margin:0">${this.escapeHtml(message)}</p>`,
      action,
      '<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">',
      '<p style="font-size:12px;color:#6b7280;margin:0">VEXO Beauty</p>',
      '</div>',
      '</body>',
      '</html>',
    ].join('');
  }

  private renderText(input: EmailSendInput): string {
    const rawText = input.payload.text;

    if (typeof rawText === 'string' && rawText.trim().length > 0) {
      return rawText.trim();
    }

    const title = this.resolvePayloadText(input.payload.title, input.subject);

    const message = this.resolvePayloadText(
      input.payload.message,
      input.payload.body,
      '',
    );

    return [title, '', message].join('\n');
  }

  private resolvePayloadText(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return '';
  }

  private isEnabled(): boolean {
    return this.getBoolean('EMAIL_ENABLED', false);
  }

  private getRequiredString(primaryKey: string, fallbackKey: string): string {
    const value =
      this.getString(primaryKey, '') || this.getString(fallbackKey, '');

    if (value.length < 1) {
      throw new Error(`Missing required email config: ${primaryKey}`);
    }

    return value;
  }

  private getString(key: string, fallback: string): string {
    const value = this.configService.get<string | number | boolean>(key);

    if (value === undefined || value === null) {
      return fallback;
    }

    const normalized = String(value).trim();

    return normalized.length > 0 ? normalized : fallback;
  }

  private getNumber(key: string, fallback: number): number {
    const value = Number(this.configService.get<string | number>(key));

    return Number.isFinite(value) ? Math.floor(value) : fallback;
  }

  private getBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<string | boolean>(key);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }

  private getSafeColumnName(value: string, fallback: string): string {
    const normalized = value.trim();

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
      return normalized;
    }

    return fallback;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
