import { BadRequestException, Injectable } from '@nestjs/common';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import {
  AdminNotificationAiSmsDraftDto,
  AdminNotificationAiSmsSendDto,
} from '../dto/admin-notification-ai.dto';

import { NotificationService } from './notification.service';

type JsonRecord = Record<string, unknown>;

type NotificationChannel = 'database' | 'email' | 'sms' | 'push' | 'websocket';

type SmsDraft = {
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  metadata: JsonRecord;
  estimatedLength: number;
  guardrails: string[];
};

@Injectable()
export class AdminNotificationAiService {
  private readonly defaultSmsMaxLength = 280;

  private readonly maxSmsLength = 500;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
  ) {}

  generateSmsDraft(
    dto: AdminNotificationAiSmsDraftDto,
    context: AiPermissionContext,
  ) {
    return Promise.resolve().then(() => {
      const tool = this.assertToolAccess(
        'notification.sms.draft',
        context,
        'تولید پیشنویس پیامک هوشمند',
      );

      const draft = this.buildSmsDraft(dto);

      return {
        draft,
        applied: false,
        tool: this.toPublicTool(tool),
        audit: {
          actorId: context.userId ?? null,
          action: 'notification.ai_sms_draft_generated',
        },
      };
    });
  }

  async sendApprovedSms(
    dto: AdminNotificationAiSmsSendDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'notification.sms.send.approved',
      context,
      'ارسال پیامک هوشمند با تأیید ادمین',
    );

    this.assertApproved(
      dto.approved,
      'برای ارسال واقعی پیامک هوشمند باید approved=true ارسال شود.',
    );

    const draft = this.buildSmsDraft(dto);

    const channels = this.normalizeSendChannels(dto.channels);

    const metadata = {
      ...draft.metadata,
      ...(dto.metadata ?? {}),
      aiGenerated: true,
      aiTool: tool.name,
      approvalReason: dto.approvalReason ?? null,
      recipientPhone: dto.recipientPhone ?? null,
    };

    const sent = await this.notificationService.sendNotification(
      {
        userId: dto.userId,
        title: draft.title,
        message: draft.message,
        type: draft.type,
        metadata,
        actionUrl: draft.actionUrl ?? undefined,
        channels,
        saveToDatabase: dto.saveToDatabase ?? true,
      },
      {
        actorId: context.userId ?? undefined,
      },
    );

    return {
      draft,
      sent,
      applied: true,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'notification.ai_sms_sent',
        approvalReason: dto.approvalReason ?? null,
      },
    };
  }

  private assertToolAccess(
    toolName: string,
    context: AiPermissionContext,
    operationTitle: string,
  ): AiToolDefinition {
    const tool = this.toolRegistry.assertToolEnabled(toolName);

    this.permissionGuard.assertAuthenticated(context);

    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      operationTitle,
    );

    if (tool.requiresApproval) {
      this.permissionGuard.assertApprovalAllowed(context, operationTitle);
    }

    return tool;
  }

  private buildSmsDraft(dto: AdminNotificationAiSmsDraftDto): SmsDraft {
    this.assertSafeInput(dto);

    const maxLength = this.normalizeSmsMaxLength(dto.maxLength);

    const title = this.truncateText(dto.title ?? this.resolveTitle(dto), 120);

    const type = this.normalizeNotificationType(dto.type);

    const rawMessage = this.composeSmsMessage(dto);

    const message = this.truncateText(rawMessage, maxLength);

    if (message.length < 10) {
      throw new BadRequestException('متن پیامک تولیدشده معتبر نیست.');
    }

    const metadata: JsonRecord = {
      campaignGoal: dto.campaignGoal,
      audience: dto.audience ?? null,
      productName: dto.productName ?? null,
      couponCode: dto.couponCode ?? null,
      source: 'ai-notification',
      generator: 'backend-deterministic-sms-builder',
    };

    if (dto.recipientPhone) {
      metadata.recipientPhone = dto.recipientPhone;
    }

    return {
      title,
      message,
      type,
      actionUrl: dto.actionUrl ?? null,
      metadata,
      estimatedLength: message.length,
      guardrails: [
        `حداکثر طول پیامک اعمال شد: ${maxLength} کاراکتر`,
        'ارسال واقعی فقط با approved=true انجام می‌شود.',
        'متن بدون ادعای درمانی، تضمینی یا فشار فروش تولید شد.',
      ],
    };
  }

  private composeSmsMessage(dto: AdminNotificationAiSmsDraftDto): string {
    const goal = this.normalizeWhitespace(dto.campaignGoal);

    const productName = dto.productName
      ? this.normalizeWhitespace(dto.productName)
      : null;

    const couponCode = dto.couponCode
      ? this.normalizeCouponCode(dto.couponCode)
      : null;

    const actionUrl = dto.actionUrl
      ? this.normalizeWhitespace(dto.actionUrl)
      : null;

    const parts: string[] = [];

    parts.push('VEXO Beauty:');

    if (this.containsAny(goal, ['سبد', 'رها', 'بازگرداندن'])) {
      parts.push(
        'اگر هنوز قصد تکمیل خریدتان را دارید، پیشنهاد ویژه شما آماده است.',
      );
    } else if (this.containsAny(goal, ['وفادار', 'بازگشت', 'فعال'])) {
      parts.push('برای همراهان فروشگاه، یک پیشنهاد خرید محدود آماده شده است.');
    } else if (this.containsAny(goal, ['فروش', 'کمپین', 'افزایش'])) {
      parts.push('پیشنهاد ویژه فروشگاه برای خرید بعدی شما فعال است.');
    } else {
      parts.push('یک پیام اطلاع‌رسانی فروشگاهی برای شما آماده شده است.');
    }

    if (productName) {
      parts.push(`محصول: ${productName}`);
    }

    if (couponCode) {
      parts.push(`کد تخفیف: ${couponCode}`);
    }

    if (actionUrl) {
      parts.push(`مشاهده: ${actionUrl}`);
    }

    parts.push('لغو دریافت پیامک طبق تنظیمات حساب کاربری امکان‌پذیر است.');

    return parts.join(' ');
  }

  private resolveTitle(dto: AdminNotificationAiSmsDraftDto): string {
    const goal = dto.campaignGoal;

    if (this.containsAny(goal, ['سبد', 'رها'])) {
      return 'یادآوری سبد خرید';
    }

    if (dto.couponCode) {
      return 'کد تخفیف ویژه';
    }

    if (dto.productName) {
      return 'پیشنهاد محصول';
    }

    return 'پیام فروشگاهی VEXO Beauty';
  }

  private assertSafeInput(dto: AdminNotificationAiSmsDraftDto): void {
    const text = [
      dto.campaignGoal,
      dto.audience,
      dto.title,
      dto.productName,
      dto.extraInstruction,
    ]
      .filter(Boolean)
      .join(' ');

    const normalized = this.normalizeWhitespace(text).toLowerCase();

    const blockedPatterns = [
      'درمان قطعی',
      'تضمین نتیجه',
      'رفع قطعی',
      'حذف قطعی',
      'بدون عوارض',
      'جایگزین پزشک',
      'فقط امروز وگرنه',
      'اجبار',
      'تهدید',
    ];

    for (const pattern of blockedPatterns) {
      if (normalized.includes(pattern)) {
        throw new BadRequestException(
          `متن ورودی برای پیامک ایمن نیست: ${pattern}`,
        );
      }
    }
  }

  private assertApproved(approved: boolean | undefined, message: string): void {
    if (approved !== true) {
      throw new BadRequestException(message);
    }
  }

  private normalizeSendChannels(
    channels?: NotificationChannel[],
  ): NotificationChannel[] {
    const fallbackChannels: NotificationChannel[] = ['sms', 'database'];

    const normalized: NotificationChannel[] =
      channels && channels.length > 0 ? channels : fallbackChannels;

    const unique = new Set<NotificationChannel>();

    for (const channel of normalized) {
      unique.add(channel);
    }

    return [...unique];
  }

  private normalizeNotificationType(type?: string): string {
    const normalized = type?.trim().toUpperCase();

    return normalized && normalized.length > 0 ? normalized : 'SYSTEM';
  }

  private normalizeSmsMaxLength(value?: number): number {
    if (!value) {
      return this.defaultSmsMaxLength;
    }

    return Math.min(this.maxSmsLength, Math.max(60, Math.trunc(value)));
  }

  private normalizeCouponCode(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '').slice(0, 80);
  }

  private containsAny(value: string, candidates: string[]): boolean {
    const normalized = value.toLowerCase();

    return candidates.some((candidate) =>
      normalized.includes(candidate.toLowerCase()),
    );
  }

  private toPublicTool(tool: AiToolDefinition) {
    return {
      name: tool.name,
      title: tool.title,
      riskLevel: tool.riskLevel,
      executionMode: tool.executionMode,
      requiresApproval: tool.requiresApproval,
    };
  }

  private truncateText(value: string, maxLength: number): string {
    const normalized = this.normalizeWhitespace(value);

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return normalized.slice(0, maxLength - 1).trimEnd();
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }
}
