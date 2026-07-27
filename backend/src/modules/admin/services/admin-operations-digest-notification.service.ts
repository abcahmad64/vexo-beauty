import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationService } from '../../notification/services/notification.service';

import { AdminOperationsDigestService } from './admin-operations-digest.service';

import {
  AdminOperationsDigestNotificationChannel,
  NotifyAdminOperationsDigestDto,
} from '../dto/notify-admin-operations-digest.dto';

type AdminRecipientRow = {
  id: string;
  email: string | null;
};

type DigestNotificationResponse = {
  generatedAt: string;
  requestedBy: string;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  channels: AdminOperationsDigestNotificationChannel[];
  digest: {
    level: string;
    score: number;
    title: string;
    message: string;
  };
  failures: Array<{
    userId: string;
    reason: string;
  }>;
};

@Injectable()
export class AdminOperationsDigestNotificationService {
  private readonly logger = new Logger(
    AdminOperationsDigestNotificationService.name,
  );

  private readonly defaultChannels: AdminOperationsDigestNotificationChannel[] =
    ['database', 'websocket', 'push'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationsDigestService: AdminOperationsDigestService,
    private readonly notificationService: NotificationService,
  ) {}

  async notifyAdmins(
    dto: NotifyAdminOperationsDigestDto,
    actorId: string,
  ): Promise<DigestNotificationResponse> {
    const channels =
      dto.channels && dto.channels.length > 0
        ? dto.channels
        : this.defaultChannels;

    const digest = await this.operationsDigestService.getDigest(
      {
        createdFrom: dto.createdFrom,
        createdTo: dto.createdTo,
        currency: dto.currency,
        mode: dto.mode ?? 'compact',
      },
      actorId,
    );

    const recipients = await this.findAdminRecipients();

    const message = this.buildMessage(digest);

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.notificationService.sendNotification(
          {
            userId: recipient.id,
            title: `خلاصه مدیریتی فروشگاه: ${digest.status.title}`,
            message,
            type: 'SYSTEM',
            actionUrl: '/admin/operations-digest',
            channels,
            saveToDatabase: true,
            metadata: {
              source: 'admin.operations_digest',
              digestLevel: digest.status.level,
              digestScore: digest.status.score,
              digestTitle: digest.status.title,
              digestMessage: digest.status.message,
              currency: digest.meta.currency,
              createdFrom: digest.meta.createdFrom,
              createdTo: digest.meta.createdTo,
              mode: digest.meta.mode,
              requestedBy: actorId,
              generatedAt: digest.meta.generatedAt,
            },
          },
          {
            actorId,
          },
        ),
      ),
    );

    const failures = results
      .map((result, index) => ({
        result,
        recipient: recipients[index],
      }))
      .filter(
        (
          item,
        ): item is {
          result: PromiseRejectedResult;
          recipient: AdminRecipientRow;
        } => item.result.status === 'rejected',
      )
      .map((item) => ({
        userId: item.recipient.id,
        reason:
          item.result.reason instanceof Error
            ? item.result.reason.message
            : String(item.result.reason),
      }));

    if (failures.length > 0) {
      this.logger.warn(
        `Admin operations digest notification failed for ${failures.length} recipient(s).`,
      );
    }

    return {
      generatedAt: new Date().toISOString(),
      requestedBy: actorId,
      recipientsCount: recipients.length,
      sentCount: results.filter((result) => result.status === 'fulfilled')
        .length,
      failedCount: failures.length,
      channels,
      digest: {
        level: digest.status.level,
        score: digest.status.score,
        title: digest.status.title,
        message: digest.status.message,
      },
      failures,
    };
  }

  private findAdminRecipients(): Promise<AdminRecipientRow[]> {
    return this.prisma.$queryRaw<AdminRecipientRow[]>(
      Prisma.sql`
        SELECT DISTINCT
          u."id",
          u."email"
        FROM "User" u
        LEFT JOIN "Role" r
          ON r."id" = u."roleId"
          AND r."deleted_at" IS NULL
        LEFT JOIN "RolePermission" rp
          ON rp."roleId" = r."id"
        LEFT JOIN "Permission" p
          ON p."id" = rp."permissionId"
          AND p."deleted_at" IS NULL
        WHERE
          u."deleted_at" IS NULL
          AND u."status"::text = 'ACTIVE'
          AND (
            r."name" IN (
              'ADMIN',
              'SUPER_ADMIN'
            )
            OR p."name" IN (
              'admin:*',
              'admin:read',
              'dashboard:*',
              'dashboard:read',
              'analytics:*',
              'analytics:read',
              'reports:*',
              'reports:read',
              'audit:*',
              'audit:read',
              'audits:*',
              'audits:read',
              'activity:*',
              'activity:read'
            )
          )
      `,
    );
  }

  private buildMessage(
    digest: Awaited<ReturnType<AdminOperationsDigestService['getDigest']>>,
  ): string {
    const priorities = digest.priorities
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.title}: ${item.description}`)
      .join('\n');

    const recommendations = digest.recommendations
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n');

    return [
      `وضعیت کلی: ${digest.status.title}`,
      `امتیاز ریسک: ${digest.status.score}`,
      `پیام: ${digest.status.message}`,
      '',
      'خلاصه:',
      `سفارش‌ها: ${digest.summary.orders}`,
      `پرداخت‌ها: ${digest.summary.payments}`,
      `بازگشت وجه: ${digest.summary.refunds}`,
      `موجودی: ${digest.summary.inventory}`,
      `امنیت: ${digest.summary.security}`,
      '',
      'اولویت‌ها:',
      priorities || 'مورد فوری شناسایی نشد.',
      '',
      'پیشنهادها:',
      recommendations || 'مانیتورینگ روزانه را ادامه بده.',
    ].join('\n');
  }
}
