import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import axios from 'axios';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { SmsQueueJobData } from '../../../core/queue/types/queue.types';

import { NotificationDeliveryChannel } from './notification-delivery.channel';

import { NotificationDeliveryPort } from './notification-delivery.port';

import {
  NotificationDeliveryPayload,
  NotificationDeliveryResult,
} from './notification-delivery.types';

type ContactRow = {
  value: string | null;
};

type SmsSendInput = {
  readonly to: string;
  readonly template: string;
  readonly message: string;
  readonly payload: Record<string, unknown>;
};

@Injectable()
export class SmsNotificationDelivery implements NotificationDeliveryPort {
  readonly channel = NotificationDeliveryChannel.SMS;

  private readonly logger = new Logger(SmsNotificationDelivery.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async deliver(
    payload: NotificationDeliveryPayload,
  ): Promise<NotificationDeliveryResult> {
    const recipient =
      this.resolvePhoneFromMetadata(payload.metadata) ??
      (await this.findUserPhone(payload.userId));

    if (!recipient) {
      return {
        channel: this.channel,
        delivered: false,
        provider: this.getProviderName(),
        messageId: payload.notificationId,
        error: 'شماره موبایل کاربر برای ارسال پیامک یافت نشد.',
      };
    }

    return this.sendSms({
      to: recipient,
      template: 'notification',
      message: payload.message,
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

  async sendQueuedSms(
    data: SmsQueueJobData,
  ): Promise<NotificationDeliveryResult> {
    return this.sendSms({
      to: data.to,
      template: data.template,
      message: this.resolvePayloadMessage(data.payload),
      payload: data.payload,
    });
  }

  private async sendSms(
    input: SmsSendInput,
  ): Promise<NotificationDeliveryResult> {
    if (!this.isEnabled()) {
      return {
        channel: this.channel,
        delivered: false,
        provider: this.getProviderName(),
        messageId: null,
        error: 'ارسال پیامک غیرفعال است.',
      };
    }

    const url = this.getRequiredString('SMS_PROVIDER_URL');

    const timeoutMs = this.getNumber('SMS_HTTP_TIMEOUT_MS', 10_000);

    const headers = this.buildHeaders();

    const body = this.buildRequestBody(input);

    try {
      const response = await axios.post(url, body, {
        headers,
        timeout: timeoutMs,
        validateStatus: () => true,
      });

      const delivered = response.status >= 200 && response.status < 300;

      return {
        channel: this.channel,
        delivered,
        provider: this.getProviderName(),
        messageId: this.extractMessageId(response.data) ?? null,
        error: delivered
          ? null
          : `SMS provider returned status ${response.status}`,
      };
    } catch (error) {
      this.logger.error(
        `SMS delivery failed: ${input.to}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        channel: this.channel,
        delivered: false,
        provider: this.getProviderName(),
        messageId: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildRequestBody(input: SmsSendInput): Record<string, unknown> {
    const recipientField = this.getString('SMS_PROVIDER_RECIPIENT_FIELD', 'to');

    const messageField = this.getString(
      'SMS_PROVIDER_MESSAGE_FIELD',
      'message',
    );

    const templateField = this.getString(
      'SMS_PROVIDER_TEMPLATE_FIELD',
      'template',
    );

    const senderField = this.getString('SMS_PROVIDER_SENDER_FIELD', 'sender');

    const sender = this.getString('SMS_SENDER', '');

    return {
      [recipientField]: input.to,
      [messageField]: input.message,
      [templateField]: input.template,
      ...(sender.length > 0
        ? {
            [senderField]: sender,
          }
        : {}),
      payload: input.payload,
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const token = this.getString('SMS_PROVIDER_TOKEN', '');

    if (token.length < 1) {
      return headers;
    }

    const headerName = this.getString(
      'SMS_PROVIDER_TOKEN_HEADER',
      'Authorization',
    );

    const prefix = this.getOptionalString(
      'SMS_PROVIDER_TOKEN_PREFIX',
      'Bearer',
    );

    headers[headerName] = prefix.length > 0 ? `${prefix} ${token}` : token;

    return headers;
  }

  private async findUserPhone(userId: string): Promise<string | null> {
    const column = this.getSafeColumnName(
      this.getString('NOTIFICATION_USER_PHONE_COLUMN', 'phone'),
      'phone',
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

  private resolvePhoneFromMetadata(
    metadata?: Record<string, unknown> | null,
  ): string | null {
    if (!metadata) {
      return null;
    }

    const candidates = [
      metadata.phone,
      metadata.phoneNumber,
      metadata.mobile,
      metadata.recipientPhone,
      metadata.toPhone,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private resolvePayloadMessage(payload: Record<string, unknown>): string {
    const candidates = [payload.message, payload.text, payload.body];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return '';
  }

  private extractMessageId(data: unknown): string | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return undefined;
    }

    const record = data as Record<string, unknown>;

    const candidates = [
      record.messageId,
      record.id,
      record.referenceId,
      record.trackingCode,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }

      if (typeof candidate === 'number') {
        return String(candidate);
      }
    }

    return undefined;
  }

  private isEnabled(): boolean {
    return this.getBoolean('SMS_ENABLED', false);
  }

  private getProviderName(): string {
    return this.getString('SMS_PROVIDER_NAME', 'generic-http');
  }

  private getRequiredString(key: string): string {
    const value = this.getString(key, '');

    if (value.length < 1) {
      throw new Error(`Missing required SMS config: ${key}`);
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

  private getOptionalString(key: string, fallback: string): string {
    const value = this.configService.get<string | number | boolean>(key);

    if (value === undefined || value === null) {
      return fallback;
    }

    return String(value).trim();
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
}
