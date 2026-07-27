import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import * as webPush from 'web-push';

import type { PushSubscription } from 'web-push';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationDeliveryChannel } from './notification-delivery.channel';

import { NotificationDeliveryPort } from './notification-delivery.port';

import {
  NotificationDeliveryPayload,
  NotificationDeliveryResult,
} from './notification-delivery.types';

type WebPushRuntimeClient = {
  sendNotification(subscription: unknown, payload: string): Promise<unknown>;
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
};

const resolveWebPushRuntimeClient = (value: unknown): WebPushRuntimeClient => {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('sendNotification' in value) ||
    typeof value.sendNotification !== 'function' ||
    !('setVapidDetails' in value) ||
    typeof value.setVapidDetails !== 'function'
  ) {
    throw new TypeError('Invalid web-push module contract.');
  }

  return value as WebPushRuntimeClient;
};

const webPushModule: unknown = webPush;

const webPushClient = resolveWebPushRuntimeClient(webPushModule);

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type WebPushError = {
  readonly statusCode?: number;
  readonly message?: string;
  readonly body?: string;
};

@Injectable()
export class PushNotificationDelivery implements NotificationDeliveryPort {
  readonly channel = NotificationDeliveryChannel.PUSH;

  private readonly logger = new Logger(PushNotificationDelivery.name);

  private configured = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async deliver(
    payload: NotificationDeliveryPayload,
  ): Promise<NotificationDeliveryResult> {
    if (!this.isEnabled()) {
      return {
        channel: this.channel,
        delivered: false,
        provider: 'web-push',
        messageId: payload.notificationId,
        error: 'ارسال Push Notification غیرفعال است.',
      };
    }

    this.configureWebPush();

    const subscriptions = await this.findActiveSubscriptions(payload.userId);

    if (subscriptions.length < 1) {
      return {
        channel: this.channel,
        delivered: false,
        provider: 'web-push',
        messageId: payload.notificationId,
        error: 'هیچ Push Subscription فعالی برای کاربر یافت نشد.',
      };
    }

    const body = JSON.stringify({
      notificationId: payload.notificationId,
      title: payload.title,
      body: payload.message,
      type: payload.type,
      metadata: payload.metadata ?? {},
      occurredAt: payload.occurredAt.toISOString(),
    });

    let successCount = 0;

    const errors: string[] = [];

    for (const subscription of subscriptions) {
      try {
        await webPushClient.sendNotification(
          this.toWebPushSubscription(subscription),
          body,
        );

        successCount += 1;

        await this.markSubscriptionUsed(subscription.id);
      } catch (error) {
        const normalized = this.normalizeWebPushError(error);

        if (normalized.statusCode === 404 || normalized.statusCode === 410) {
          await this.deactivateSubscription(subscription.id);
        }

        errors.push(
          normalized.message ??
            normalized.body ??
            'خطای نامشخص در ارسال Push Notification',
        );

        this.logger.warn(
          `Push delivery failed for subscription ${subscription.id}: ${errors[errors.length - 1]}`,
        );
      }
    }

    return {
      channel: this.channel,
      delivered: successCount > 0,
      provider: 'web-push',
      messageId: payload.notificationId,
      error:
        successCount > 0
          ? null
          : (errors[0] ?? 'ارسال Push Notification ناموفق بود.'),
    };
  }

  private configureWebPush(): void {
    if (this.configured) {
      return;
    }

    const publicKey = this.getRequiredString('VAPID_PUBLIC_KEY');

    const privateKey = this.getRequiredString('VAPID_PRIVATE_KEY');

    const subject = this.getString(
      'VAPID_SUBJECT',
      'mailto:no-reply@vexo-beauty.local',
    );

    webPushClient.setVapidDetails(subject, publicKey, privateKey);

    this.configured = true;
  }

  private async findActiveSubscriptions(
    userId: string,
  ): Promise<PushSubscriptionRow[]> {
    return this.prisma.$queryRaw<PushSubscriptionRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "endpoint",
          "p256dh",
          "auth"
        FROM "PushSubscription"
        WHERE
          "userId" = ${userId}
          AND "isActive" = TRUE
          AND "deleted_at" IS NULL
      `,
    );
  }

  private async markSubscriptionUsed(id: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "PushSubscription"
        SET
          "lastUsedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${id}
      `,
    );
  }

  private async deactivateSubscription(id: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "PushSubscription"
        SET
          "isActive" = FALSE,
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${id}
      `,
    );
  }

  private toWebPushSubscription(row: PushSubscriptionRow): PushSubscription {
    return {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    };
  }

  private normalizeWebPushError(error: unknown): WebPushError {
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;

      return {
        statusCode:
          typeof record.statusCode === 'number' ? record.statusCode : undefined,
        message:
          typeof record.message === 'string' ? record.message : undefined,
        body: typeof record.body === 'string' ? record.body : undefined,
      };
    }

    return {
      message: String(error),
    };
  }

  private isEnabled(): boolean {
    return this.getBoolean('PUSH_ENABLED', false);
  }

  private getRequiredString(key: string): string {
    const value = this.getString(key, '');

    if (value.length < 1) {
      throw new Error(`Missing required push config: ${key}`);
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
}
