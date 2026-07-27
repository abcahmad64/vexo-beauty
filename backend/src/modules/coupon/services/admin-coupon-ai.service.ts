import { BadRequestException, Injectable } from '@nestjs/common';

import { AdminCreateCouponDto } from '../dto/admin-create-coupon.dto';

import { AdminCouponType } from '../dto/admin-query-coupon.dto';

import {
  AdminCouponAiCreateDto,
  AdminCouponAiDiscountSuggestDto,
  AdminCouponAiDraftDto,
} from '../dto/admin-coupon-ai.dto';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import { AdminCouponService } from './admin-coupon.service';

type CouponSuggestion = {
  shouldCreateCoupon: boolean;
  type: AdminCouponType;
  value: string;
  discountPercent: number;
  maxDiscountPercent: number;
  daysValid: number;
  usageLimit: number;
  minAmount: string | null;
  reason: string;
  guardrails: string[];
};

@Injectable()
export class AdminCouponAiService {
  private readonly defaultMaxDiscountPercent = 15;

  private readonly hardMaxDiscountPercent = 30;

  private readonly defaultUsageLimit = 100;

  private readonly maxAiUsageLimit = 10_000;

  private readonly defaultDaysValid = 7;

  private readonly maxDaysValid = 30;

  constructor(
    private readonly adminCouponService: AdminCouponService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
  ) {}

  suggestDiscount(
    dto: AdminCouponAiDiscountSuggestDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'coupon.discount.suggest',
      context,
      'پیشنهاد تخفیف هوشمند',
    );

    const suggestion = this.buildDiscountSuggestion(dto);

    return {
      suggestion,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'coupon.ai_discount_suggested',
      },
    };
  }

  generateCouponDraft(
    dto: AdminCouponAiDraftDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'coupon.discount.suggest',
      context,
      'تولید پیشنویس کوپن هوشمند',
    );

    const suggestion = this.buildDiscountSuggestion(dto);

    const coupon = this.buildCouponDraft(dto, suggestion);

    this.assertSafeCouponDraft(coupon);

    return {
      coupon,
      suggestion,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'coupon.ai_coupon_draft_generated',
      },
    };
  }

  async createApprovedCoupon(
    dto: AdminCouponAiCreateDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'coupon.create.approved',
      context,
      'ساخت کوپن هوشمند با تأیید ادمین',
    );

    this.assertApproved(
      dto.approved,
      'برای ساخت واقعی کوپن هوشمند باید approved=true ارسال شود.',
    );

    const suggestion = this.buildDiscountSuggestion(dto);

    const couponDraft = this.buildCouponDraft(dto, suggestion);

    this.assertSafeCouponDraft(couponDraft);

    const created = await this.adminCouponService.create(
      couponDraft,
      context.userId ?? undefined,
    );

    return {
      couponDraft,
      suggestion,
      created,
      applied: true,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'coupon.ai_coupon_created',
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

  private assertApproved(approved: boolean | undefined, message: string): void {
    if (approved !== true) {
      throw new BadRequestException(message);
    }
  }

  private buildDiscountSuggestion(
    dto: AdminCouponAiDiscountSuggestDto,
  ): CouponSuggestion {
    const maxDiscountPercent = this.normalizePercent(
      dto.maxDiscountPercent,
      this.defaultMaxDiscountPercent,
      1,
      this.hardMaxDiscountPercent,
    );

    const daysValid = this.normalizeInteger(
      dto.daysValid,
      this.defaultDaysValid,
      1,
      this.maxDaysValid,
    );

    const usageLimit = this.defaultUsageLimit;

    const goal = this.normalizeText(dto.campaignGoal);

    const audience = this.normalizeText(dto.audience);

    let score = 8;

    const reasons: string[] = ['پیشنهاد تخفیف در محدوده امن فروشگاه تولید شد.'];

    if (this.containsAny(goal, ['سبد', 'رها', 'abandoned', 'cart'])) {
      score += 2;
      reasons.push(
        'هدف کمپین به بازگرداندن سبد خرید یا پیگیری مشتری نزدیک است.',
      );
    }

    if (this.containsAny(goal, ['کمپین', 'فروش', 'campaign', 'sale'])) {
      score += 1;
      reasons.push('هدف کمپین فروش یا فعال‌سازی تقاضا است.');
    }

    if (this.containsAny(audience, ['vip', 'وفادار', 'خریدار', 'loyal'])) {
      score += 2;
      reasons.push(
        'مخاطب کمپین ارزشمند یا دارای احتمال خرید بالاتر تشخیص داده شد.',
      );
    }

    if (dto.productId) {
      score += 1;
      reasons.push('پیشنهاد برای محصول مشخص تولید شده و عمومی نیست.');
    }

    if (dto.minMarginPercent !== undefined) {
      score = Math.min(score, this.marginAwareCap(dto.minMarginPercent));
      reasons.push('سقف تخفیف با توجه به حداقل حاشیه سود درخواستی کنترل شد.');
    }

    const discountPercent = Math.min(
      maxDiscountPercent,
      Math.max(1, Math.trunc(score)),
    );

    const guardrails = [
      `سقف تخفیف اعمال‌شده: ${maxDiscountPercent} درصد`,
      `مدت اعتبار پیشنهادی: ${daysValid} روز`,
      `ظرفیت پیش‌فرض امن: ${usageLimit} استفاده`,
      'ساخت کوپن واقعی بدون approved=true انجام نمی‌شود.',
    ];

    return {
      shouldCreateCoupon: true,
      type: 'PERCENTAGE',
      value: String(discountPercent),
      discountPercent,
      maxDiscountPercent,
      daysValid,
      usageLimit,
      minAmount: this.normalizeMoneyString(dto.subtotal),
      reason: reasons.join(' '),
      guardrails,
    };
  }

  private buildCouponDraft(
    dto: AdminCouponAiDraftDto,
    suggestion: CouponSuggestion,
  ): AdminCreateCouponDto {
    const now = new Date();

    const daysValid = this.normalizeInteger(
      dto.daysValid,
      suggestion.daysValid,
      1,
      this.maxDaysValid,
    );

    const endDate = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);

    const type = dto.type ?? suggestion.type;

    const value = this.resolveDraftValue(type, dto.value, suggestion.value);

    const usageLimit = this.normalizeInteger(
      dto.usageLimit,
      suggestion.usageLimit,
      1,
      this.maxAiUsageLimit,
    );

    const code = this.buildCouponCode(dto.codePrefix);

    return {
      code,
      type,
      value,
      description: this.buildDescription(dto.description, suggestion),
      minAmount:
        this.normalizeMoneyString(dto.minAmount) ??
        suggestion.minAmount ??
        undefined,
      usageLimit,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      status: 'ACTIVE',
    };
  }

  private assertSafeCouponDraft(dto: AdminCreateCouponDto): void {
    if (!dto.usageLimit) {
      throw new BadRequestException(
        'کوپن هوشمند نباید بدون محدودیت استفاده ساخته شود.',
      );
    }

    if (dto.usageLimit > this.maxAiUsageLimit) {
      throw new BadRequestException(
        `سقف مجاز استفاده برای کوپن هوشمند ${this.maxAiUsageLimit} است.`,
      );
    }

    if (!dto.endDate) {
      throw new BadRequestException('کوپن هوشمند باید تاریخ پایان داشته باشد.');
    }

    const now = new Date();

    const endDate = new Date(dto.endDate);

    if (Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('تاریخ پایان کوپن هوشمند معتبر نیست.');
    }

    const maxEndDate = new Date(
      now.getTime() + this.maxDaysValid * 24 * 60 * 60 * 1000,
    );

    if (endDate.getTime() > maxEndDate.getTime()) {
      throw new BadRequestException(
        `اعتبار کوپن هوشمند نمی‌تواند بیشتر از ${this.maxDaysValid} روز باشد.`,
      );
    }

    if (dto.type === 'PERCENTAGE') {
      const value = Number(dto.value);

      if (
        !Number.isFinite(value) ||
        value <= 0 ||
        value > this.hardMaxDiscountPercent
      ) {
        throw new BadRequestException(
          `درصد تخفیف هوشمند باید بین ۱ تا ${this.hardMaxDiscountPercent} باشد.`,
        );
      }
    }

    if (dto.type === 'FIXED_AMOUNT' && !dto.value) {
      throw new BadRequestException(
        'برای کوپن مبلغ ثابت، مقدار تخفیف الزامی است.',
      );
    }
  }

  private resolveDraftValue(
    type: AdminCouponType,
    requestedValue: string | undefined,
    suggestedValue: string,
  ): string | undefined {
    if (type === 'FREE_SHIPPING') {
      return undefined;
    }

    if (type === 'FIXED_AMOUNT') {
      const value = this.normalizeMoneyString(requestedValue);

      if (!value) {
        throw new BadRequestException(
          'برای تولید کوپن مبلغ ثابت، مقدار value باید ارسال شود.',
        );
      }

      return value;
    }

    const percent = this.normalizePercent(
      requestedValue !== undefined
        ? Number(requestedValue)
        : Number(suggestedValue),
      Number(suggestedValue),
      1,
      this.hardMaxDiscountPercent,
    );

    return String(percent);
  }

  private buildDescription(
    requestedDescription: string | undefined,
    suggestion: CouponSuggestion,
  ): string {
    const normalized = this.normalizeText(requestedDescription);

    if (normalized) {
      return normalized;
    }

    return [
      'کوپن هوشمند VEXO Beauty.',
      suggestion.reason,
      'ساخته‌شده فقط پس از تأیید ادمین.',
    ].join(' ');
  }

  private buildCouponCode(prefix?: string): string {
    const normalizedPrefix = this.normalizeCodePrefix(prefix);

    const timestamp = Date.now().toString(36).toUpperCase();

    const random = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `${normalizedPrefix}${timestamp}${random}`.slice(0, 80);
  }

  private normalizeCodePrefix(prefix?: string): string {
    const normalized = this.normalizeText(prefix)
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);

    return normalized && normalized.length > 0 ? normalized : 'VEXOAI';
  }

  private marginAwareCap(minMarginPercent: number): number {
    if (minMarginPercent >= 60) {
      return 8;
    }

    if (minMarginPercent >= 40) {
      return 12;
    }

    if (minMarginPercent >= 25) {
      return 18;
    }

    return this.defaultMaxDiscountPercent;
  }

  private normalizePercent(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsed)) {
      return Math.min(max, Math.max(min, Math.trunc(fallback)));
    }

    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }

  private normalizeInteger(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }

  private normalizeMoneyString(value?: string): string | null {
    const normalized = this.normalizeText(value);

    if (!normalized) {
      return null;
    }

    const numeric = Number(normalized);

    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new BadRequestException(
        'مقدار مبلغی ارسال‌شده برای کوپن معتبر نیست.',
      );
    }

    return numeric.toFixed(2);
  }

  private normalizeText(value?: string): string | null {
    if (value === undefined) {
      return null;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();

    return normalized.length > 0 ? normalized : null;
  }

  private containsAny(value: string | null, needles: string[]): boolean {
    if (!value) {
      return false;
    }

    const normalized = value.toLowerCase();

    return needles.some((needle) => normalized.includes(needle.toLowerCase()));
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
}
