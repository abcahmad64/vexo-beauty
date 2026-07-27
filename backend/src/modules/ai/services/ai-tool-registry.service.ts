import { ForbiddenException, Injectable } from '@nestjs/common';

export type AiToolRiskLevel =
  'READ_ONLY' | 'DRAFT' | 'SENSITIVE' | 'DESTRUCTIVE';

export type AiToolExecutionMode =
  'READ' | 'DRAFT_ONLY' | 'SUGGEST_ONLY' | 'APPROVAL_REQUIRED';

export interface AiToolDefinition {
  name: string;
  title: string;
  description: string;
  module: string;
  riskLevel: AiToolRiskLevel;
  executionMode: AiToolExecutionMode;
  requiredPermissions: string[];
  requiresApproval: boolean;
  enabled: boolean;
}

export interface AiToolCallInput {
  toolName: string;
  userId?: string;
  input?: Record<string, unknown>;
}

@Injectable()
export class AiToolRegistryService {
  private readonly tools = new Map<string, AiToolDefinition>();

  constructor() {
    this.registerDefaultTools();
  }

  registerTool(tool: AiToolDefinition | string): void {
    if (typeof tool === 'string') {
      const normalizedName = this.normalizeToolName(tool);

      this.tools.set(normalizedName, {
        name: normalizedName,
        title: normalizedName,
        description: 'ابزار سفارشی ثبت‌شده برای هوش مصنوعی.',
        module: 'custom',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read'],
        requiresApproval: false,
        enabled: true,
      });

      return;
    }

    const normalizedName = this.normalizeToolName(tool.name);

    this.tools.set(normalizedName, {
      ...tool,
      name: normalizedName,
      module: this.normalizeModuleName(tool.module),
      requiredPermissions: this.normalizePermissionList(
        tool.requiredPermissions,
      ),
    });
  }

  assertToolEnabled(input: AiToolCallInput | string): AiToolDefinition {
    const toolName = typeof input === 'string' ? input : input.toolName;

    const tool = this.getTool(toolName);

    if (!tool || !tool.enabled) {
      throw new ForbiddenException(
        'ابزار درخواستی برای هوش مصنوعی فعال یا ثبت نشده است.',
      );
    }

    return tool;
  }

  getTool(toolName: string): AiToolDefinition | null {
    return this.tools.get(this.normalizeToolName(toolName)) ?? null;
  }

  isToolEnabled(toolName: string): boolean {
    const tool = this.getTool(toolName);

    return Boolean(tool?.enabled);
  }

  listTools(): string[] {
    return this.listToolDefinitions().map((tool) => tool.name);
  }

  listToolDefinitions(): AiToolDefinition[] {
    return [...this.tools.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  listPublicSafeToolDefinitions(): AiToolDefinition[] {
    return this.listToolDefinitions().filter(
      (tool) =>
        tool.enabled &&
        tool.riskLevel === 'READ_ONLY' &&
        !tool.requiresApproval,
    );
  }

  private registerDefaultTools(): void {
    const definitions: AiToolDefinition[] = [
      {
        name: 'product.read',
        title: 'خواندن اطلاعات محصول',
        description:
          'خواندن امن اطلاعات محصول برای مشاوره، مقایسه و تولید محتوا.',
        module: 'product',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'product:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'product.registration.assist',
        title: 'دستیار زمینه‌ای ثبت محصول',
        description:
          'تحلیل منبع‌محور مرحله جاری ثبت محصول و تولید پیشنهاد قابل ویرایش بدون اعمال مستقیم روی داده اصلی.',
        module: 'product',
        riskLevel: 'DRAFT',
        executionMode: 'SUGGEST_ONLY',
        requiredPermissions: ['ai:manage', 'product:read', 'catalog:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'product.content.draft',
        title: 'پیشنویس محتوای محصول',
        description:
          'تولید توضیح، توضیح کوتاه، FAQ و متن تبلیغاتی محصول بدون اعمال مستقیم.',
        module: 'product',
        riskLevel: 'DRAFT',
        executionMode: 'DRAFT_ONLY',
        requiredPermissions: ['ai:manage', 'product:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'product.seo.draft',
        title: 'پیشنویس سئوی محصول',
        description:
          'تولید meta title، meta description و پیشنهادهای سئو برای محصول.',
        module: 'product',
        riskLevel: 'DRAFT',
        executionMode: 'DRAFT_ONLY',
        requiredPermissions: ['ai:manage', 'product:read'],
        requiresApproval: false,
        enabled: true,
      },

      {
        name: 'product.quality.audit',
        title: 'ارزیابی کیفیت محصول',
        description:
          'بررسی کامل بودن اطلاعات، رسانه، سئو، قیمت‌گذاری امن و داده‌های لازم برای انتشار یا مشاوره فروش محصول.',
        module: 'product',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:manage', 'products:read', 'catalog:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'product.content.apply',
        title: 'اعمال محتوای محصول',
        description: 'اعمال محتوای تولیدشده روی محصول؛ فقط پس از تأیید ادمین.',
        module: 'product',
        riskLevel: 'SENSITIVE',
        executionMode: 'APPROVAL_REQUIRED',
        requiredPermissions: ['ai:manage', 'product:update'],
        requiresApproval: true,
        enabled: true,
      },
      {
        name: 'product.seo.apply',
        title: 'اعمال سئوی محصول',
        description: 'اعمال سئوی تولیدشده روی محصول؛ فقط پس از تأیید ادمین.',
        module: 'product',
        riskLevel: 'SENSITIVE',
        executionMode: 'APPROVAL_REQUIRED',
        requiredPermissions: ['ai:manage', 'product:update'],
        requiresApproval: true,
        enabled: true,
      },
      {
        name: 'coupon.discount.suggest',
        title: 'پیشنهاد تخفیف امن',
        description:
          'تحلیل و پیشنهاد درصد تخفیف امن بدون ساخت یا فعال‌سازی کوپن.',
        module: 'coupon',
        riskLevel: 'SENSITIVE',
        executionMode: 'SUGGEST_ONLY',
        requiredPermissions: ['ai:manage', 'coupon:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'coupon.create.approved',
        title: 'ساخت کوپن با تأیید',
        description: 'ساخت کوپن واقعی فقط پس از تأیید ادمین و ثبت audit.',
        module: 'coupon',
        riskLevel: 'SENSITIVE',
        executionMode: 'APPROVAL_REQUIRED',
        requiredPermissions: ['ai:manage', 'coupon:create'],
        requiresApproval: true,
        enabled: true,
      },
      {
        name: 'notification.sms.draft',
        title: 'پیشنویس پیامک',
        description: 'تولید متن پیامک یا اعلان بدون ارسال واقعی.',
        module: 'notification',
        riskLevel: 'DRAFT',
        executionMode: 'DRAFT_ONLY',
        requiredPermissions: ['ai:manage', 'notification:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'notification.sms.send.approved',
        title: 'ارسال پیامک با تأیید',
        description: 'ارسال واقعی پیامک فقط پس از تأیید ادمین و ثبت audit.',
        module: 'notification',
        riskLevel: 'SENSITIVE',
        executionMode: 'APPROVAL_REQUIRED',
        requiredPermissions: ['ai:manage', 'notification:send'],
        requiresApproval: true,
        enabled: true,
      },
      {
        name: 'content.article.draft',
        title: 'پیشنویس مقاله و محتوا',
        description:
          'تولید مقاله، FAQ، بلاک محتوایی و متن کمپین بدون انتشار مستقیم.',
        module: 'content',
        riskLevel: 'DRAFT',
        executionMode: 'DRAFT_ONLY',
        requiredPermissions: ['ai:manage', 'content:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'content.publish.approved',
        title: 'انتشار محتوا با تأیید',
        description: 'انتشار یا تغییر وضعیت محتوای سایت فقط پس از تأیید ادمین.',
        module: 'content',
        riskLevel: 'SENSITIVE',
        executionMode: 'APPROVAL_REQUIRED',
        requiredPermissions: ['ai:manage', 'content:publish'],
        requiresApproval: true,
        enabled: true,
      },
      {
        name: 'report.store.health',
        title: 'گزارش سلامت فروشگاه',
        description:
          'تحلیل خواندنی وضعیت فروشگاه، سفارش، پرداخت، محصول و پشتیبانی.',
        module: 'report',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'reports:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'analytics.sales.insight',
        title: 'تحلیل فروش',
        description: 'تحلیل خواندنی فروش و روندها بدون تغییر داده.',
        module: 'analytics',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'analytics:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'marketing.strategy',
        title: 'استراتژی بازاریابی',
        description:
          'تولید استراتژی خواندنی/پیشنهادی بازاریابی بر اساس داده واقعی فروشگاه بدون اجرای عملیات.',
        module: 'marketing',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'marketing:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'demand.analysis',
        title: 'تحلیل تقاضا',
        description:
          'تحلیل خواندنی تقاضا، فروش، جست‌وجو و موجودی بدون تغییر داده.',
        module: 'marketing',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'analytics:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'recommendation.product',
        title: 'پیشنهاد محصول',
        description:
          'پیشنهاد محصول برای سناریوی فروش یا کاربر، بدون جعل قیمت یا موجودی و بدون تغییر داده.',
        module: 'recommendation',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'product:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'search.insight',
        title: 'تحلیل جست‌وجوی کاربران',
        description: 'تحلیل عبارت‌های جست‌وجو و پیشنهاد بهبود محتوا یا محصول.',
        module: 'search',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'search:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'vision.image.description',
        title: 'توضیح تصویر',
        description:
          'تولید توضیح محتاطانه و خواندنی برای تصویر محصول یا رسانه بدون تغییر داده.',
        module: 'media',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'media:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'alt.text',
        title: 'پیشنویس alt text',
        description: 'تولید alt text امن و سئویی برای تصویر بدون اعمال مستقیم.',
        module: 'media',
        riskLevel: 'DRAFT',
        executionMode: 'DRAFT_ONLY',
        requiredPermissions: ['ai:manage', 'media:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'media.alt_text.apply',
        title: 'اعمال alt text',
        description:
          'اعمال alt text تولیدشده روی تصویر محصول؛ فقط پس از تأیید ادمین.',
        module: 'media',
        riskLevel: 'SENSITIVE',
        executionMode: 'APPROVAL_REQUIRED',
        requiredPermissions: ['ai:manage', 'media:update'],
        requiresApproval: true,
        enabled: true,
      },
      {
        name: 'banner.text',
        title: 'متن بنر',
        description:
          'تولید متن بنر، headline، subtitle و CTA بدون انتشار یا اعمال مستقیم.',
        module: 'media',
        riskLevel: 'DRAFT',
        executionMode: 'DRAFT_ONLY',
        requiredPermissions: ['ai:manage', 'media:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'support.summary',
        title: 'خلاصه پشتیبانی',
        description: 'خلاصه‌سازی تیکت‌ها و مکالمات پشتیبانی برای ادمین.',
        module: 'support',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'support:read'],
        requiresApproval: false,
        enabled: true,
      },
      {
        name: 'order.summary',
        title: 'خلاصه سفارش‌ها',
        description: 'تحلیل خواندنی سفارش‌ها بدون تغییر وضعیت سفارش.',
        module: 'order',
        riskLevel: 'READ_ONLY',
        executionMode: 'READ',
        requiredPermissions: ['ai:read', 'order:read'],
        requiresApproval: false,
        enabled: true,
      },
    ];

    for (const definition of definitions) {
      this.registerTool(definition);
    }
  }

  private normalizeToolName(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeModuleName(value: string): string {
    const normalized = value.trim().toLowerCase();

    return normalized.length > 0 ? normalized : 'custom';
  }

  private normalizePermissionList(permissions: string[]): string[] {
    return [
      ...new Set(
        permissions
          .map((permission) => permission.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }
}
