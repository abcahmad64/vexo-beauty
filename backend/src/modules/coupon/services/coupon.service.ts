import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Coupon,
  CouponStatus,
  CouponType,
  Prisma,
} from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { ApplyCouponDto } from '../dto/apply-coupon.dto';

import { CreateCouponDto } from '../dto/create-coupon.dto';

import { QueryCouponDto } from '../dto/query-coupon.dto';

import { UpdateCouponDto } from '../dto/update-coupon.dto';

import { ValidateCouponDto } from '../dto/validate-coupon.dto';

import { CouponEventPublisher } from '../events/coupon.event.publisher';

import { CouponCalculatorUtil } from '../utils/coupon-calculator.util';

type CouponWithUsageInfo = Coupon & {
  userAlreadyUsed?: boolean;
};

type QueryCouponWithExpired = QueryCouponDto & {
  expired?: boolean;
};

@Injectable()
export class CouponService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: CouponEventPublisher,
  ) {}

  private readonly couponSelect = {
    id: true,
    code: true,
    type: true,
    value: true,
    description: true,
    minAmount: true,
    usageLimit: true,
    usedCount: true,
    startDate: true,
    endDate: true,
    isActive: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  } satisfies Prisma.CouponSelect;

  async create(dto: CreateCouponDto, actorId?: string) {
    this.assertCouponValue(dto.type, dto.value);

    this.assertDateRange(dto.startDate, dto.endDate);

    const code = this.normalizeCode(dto.code);

    await this.assertCodeUnique(code);

    const now = new Date();

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: dto.type,
        value: this.resolveCouponValue(dto.type, dto.value),
        description: dto.description ?? null,
        minAmount: new Prisma.Decimal(dto.minAmount ?? 0),
        usageLimit: dto.usageLimit ?? null,
        usedCount: 0,
        startDate: dto.startDate ? this.parseDate(dto.startDate) : now,
        endDate: dto.endDate ? this.parseDate(dto.endDate) : null,
        isActive: dto.isActive ?? true,
        status: dto.status ?? CouponStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      },
      select: this.couponSelect,
    });

    this.eventPublisher.publishCreated({
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toString(),
      status: coupon.status,
      actorId,
      occurredAt: now,
    });

    return this.mapCoupon(coupon);
  }

  async findAllForAdmin(query: QueryCouponDto) {
    const { page, limit, skip } = this.buildPagination(query);

    const where = this.buildWhere(query);

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        select: this.couponSelect,
        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        skip,
        take: limit,
      }),

      this.prisma.coupon.count({
        where,
      }),
    ]);

    return this.buildPaginatedResult(
      coupons.map((coupon) => this.mapCoupon(coupon)),
      total,
      page,
      limit,
    );
  }

  async findOneForAdmin(couponId: string) {
    const coupon = await this.findCouponById(couponId);

    return this.mapCoupon(coupon);
  }

  async findByCodeForAdmin(code: string) {
    const coupon = await this.findCouponByCode(code, true);

    return this.mapCoupon(coupon);
  }

  async update(couponId: string, dto: UpdateCouponDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی کد تخفیف ارسال نشده است.',
      );
    }

    const current = await this.findCouponById(couponId);

    const nextType = dto.type ?? current.type;

    const nextValue =
      dto.value === undefined
        ? current.value.toString()
        : (dto.value ?? undefined);

    this.assertCouponValue(nextType, nextValue);

    this.assertDateRange(
      dto.startDate === undefined
        ? current.startDate.toISOString()
        : (dto.startDate ?? undefined),
      dto.endDate === undefined
        ? current.endDate?.toISOString()
        : (dto.endDate ?? undefined),
    );

    if (dto.code) {
      const code = this.normalizeCode(dto.code);

      await this.assertCodeUnique(code, couponId);
    }

    const now = new Date();

    const data: Prisma.CouponUpdateInput = {};

    if (dto.code !== undefined) {
      data.code = dto.code ? this.normalizeCode(dto.code) : current.code;
    }

    if (dto.type !== undefined) {
      data.type = dto.type;
    }

    if (dto.value !== undefined) {
      data.value = this.resolveCouponValue(nextType, dto.value ?? undefined);
    }

    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    if (dto.minAmount !== undefined) {
      data.minAmount = new Prisma.Decimal(dto.minAmount ?? 0);
    }

    if (dto.usageLimit !== undefined) {
      if (dto.usageLimit !== null && dto.usageLimit < current.usedCount) {
        throw new BadRequestException(
          'محدودیت استفاده نمی‌تواند کمتر از تعداد استفاده‌شده باشد.',
        );
      }

      data.usageLimit = dto.usageLimit;
    }

    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate
        ? this.parseDate(dto.startDate)
        : current.startDate;
    }

    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? this.parseDate(dto.endDate) : null;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    data.updatedAt = now;

    const updated = await this.prisma.coupon.update({
      where: {
        id: couponId,
      },
      data,
      select: this.couponSelect,
    });

    this.eventPublisher.publishUpdated({
      couponId: updated.id,
      code: updated.code,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: now,
    });

    return this.mapCoupon(updated);
  }

  async activate(couponId: string, actorId?: string) {
    const now = new Date();

    const coupon = await this.findCouponById(couponId);

    const updated = await this.prisma.coupon.update({
      where: {
        id: coupon.id,
      },
      data: {
        isActive: true,
        status: CouponStatus.ACTIVE,
        updatedAt: now,
      },
      select: this.couponSelect,
    });

    this.eventPublisher.publishActivated({
      couponId: updated.id,
      code: updated.code,
      actorId,
      occurredAt: now,
    });

    return this.mapCoupon(updated);
  }

  async deactivate(couponId: string, actorId?: string) {
    const now = new Date();

    const coupon = await this.findCouponById(couponId);

    const updated = await this.prisma.coupon.update({
      where: {
        id: coupon.id,
      },
      data: {
        isActive: false,
        status: CouponStatus.INACTIVE,
        updatedAt: now,
      },
      select: this.couponSelect,
    });

    this.eventPublisher.publishDeactivated({
      couponId: updated.id,
      code: updated.code,
      actorId,
      occurredAt: now,
    });

    return this.mapCoupon(updated);
  }

  async expire(couponId: string, actorId?: string) {
    const now = new Date();

    const coupon = await this.findCouponById(couponId);

    const updated = await this.prisma.coupon.update({
      where: {
        id: coupon.id,
      },
      data: {
        isActive: false,
        status: CouponStatus.EXPIRED,
        endDate: coupon.endDate ?? now,
        updatedAt: now,
      },
      select: this.couponSelect,
    });

    this.eventPublisher.publishExpired({
      couponId: updated.id,
      code: updated.code,
      actorId,
      occurredAt: now,
    });

    return this.mapCoupon(updated);
  }

  async remove(couponId: string, actorId?: string) {
    const now = new Date();

    const coupon = await this.findCouponById(couponId);

    await this.prisma.coupon.update({
      where: {
        id: coupon.id,
      },
      data: {
        deletedAt: now,
        isActive: false,
        status: CouponStatus.INACTIVE,
        updatedAt: now,
      },
    });

    this.eventPublisher.publishDeleted({
      couponId: coupon.id,
      code: coupon.code,
      actorId,
      occurredAt: now,
    });

    return {
      success: true,
      message: 'کد تخفیف با موفقیت حذف شد.',
    };
  }

  async validate(dto: ValidateCouponDto, authenticatedUserId?: string) {
    const userId = authenticatedUserId ?? dto.userId;

    const coupon = await this.findCouponByCode(dto.code, false);

    const orderAmount = new Prisma.Decimal(dto.orderAmount);

    const shippingAmount = new Prisma.Decimal(dto.shippingAmount ?? 0);

    const validation = await this.validateCouponRules(coupon, {
      userId,
      orderAmount,
    });

    if (!validation.valid) {
      this.eventPublisher.publishValidationFailed({
        code: this.normalizeCode(dto.code),
        userId,
        reason: validation.reason,
        occurredAt: new Date(),
      });

      return validation;
    }

    const calculation = CouponCalculatorUtil.calculate({
      type: coupon.type,
      value: coupon.value,
      subtotal: orderAmount,
      shippingAmount,
    });

    this.eventPublisher.publishValidated({
      couponId: coupon.id,
      code: coupon.code,
      userId,
      orderAmount: orderAmount.toString(),
      discountAmount: calculation.discountAmount.toString(),
      actorId: userId,
      occurredAt: new Date(),
    });

    return {
      valid: true,
      coupon: this.mapCoupon(coupon),
      calculation: this.mapCalculation(calculation),
    };
  }

  async applyPreview(dto: ApplyCouponDto, authenticatedUserId?: string) {
    const userId = authenticatedUserId ?? dto.userId;

    const coupon = await this.findCouponByCode(dto.code, false);

    const subtotal = new Prisma.Decimal(dto.subtotal);

    const shippingAmount = new Prisma.Decimal(dto.shippingAmount ?? 0);

    const validation = await this.validateCouponRules(coupon, {
      userId,
      orderAmount: subtotal,
    });

    if (!validation.valid) {
      this.eventPublisher.publishValidationFailed({
        code: this.normalizeCode(dto.code),
        userId,
        reason: validation.reason,
        occurredAt: new Date(),
      });

      return validation;
    }

    const calculation = CouponCalculatorUtil.calculate({
      type: coupon.type,
      value: coupon.value,
      subtotal,
      shippingAmount,
    });

    this.eventPublisher.publishApplied({
      couponId: coupon.id,
      code: coupon.code,
      userId,
      subtotal: subtotal.toString(),
      discountAmount: calculation.discountAmount.toString(),
      shippingDiscountAmount: calculation.shippingDiscountAmount.toString(),
      finalAmount: calculation.finalAmount.toString(),
      actorId: userId,
      occurredAt: new Date(),
    });

    return {
      valid: true,
      coupon: this.mapCoupon(coupon),
      calculation: this.mapCalculation(calculation),
    };
  }

  async recordUsage(payload: {
    couponId: string;
    userId: string;
    orderId: string;
    actorId?: string;
  }) {
    const coupon = await this.findCouponById(payload.couponId);

    const existing = await this.prisma.couponUsage.findFirst({
      where: {
        couponId: payload.couponId,
        userId: payload.userId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        'این کاربر قبلاً از این کد تخفیف استفاده کرده است.',
      );
    }

    const now = new Date();

    const usage = await this.prisma.$transaction(async (tx) => {
      const created = await tx.couponUsage.create({
        data: {
          couponId: payload.couponId,
          userId: payload.userId,
          orderId: payload.orderId,
          usedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        select: {
          id: true,
          couponId: true,
          userId: true,
          orderId: true,
          usedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.coupon.update({
        where: {
          id: payload.couponId,
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

      return created;
    });

    this.eventPublisher.publishUsageRecorded({
      couponId: coupon.id,
      code: coupon.code,
      userId: payload.userId,
      orderId: payload.orderId,
      actorId: payload.actorId,
      occurredAt: now,
    });

    return {
      ...usage,
      usedAtFa: this.toPersianDateTimeString(usage.usedAt),
      createdAtFa: this.toPersianDateTimeString(usage.createdAt),
      updatedAtFa: this.toPersianDateTimeString(usage.updatedAt),
    };
  }

  private async validateCouponRules(
    coupon: CouponWithUsageInfo,
    input: {
      userId?: string;
      orderAmount: Prisma.Decimal;
    },
  ): Promise<
    | {
        valid: true;
      }
    | {
        valid: false;
        reason: string;
      }
  > {
    const now = new Date();

    if (coupon.deletedAt) {
      return {
        valid: false,
        reason: 'کد تخفیف حذف شده است.',
      };
    }

    if (!coupon.isActive || coupon.status !== CouponStatus.ACTIVE) {
      return {
        valid: false,
        reason: 'کد تخفیف فعال نیست.',
      };
    }

    if (coupon.startDate.getTime() > now.getTime()) {
      return {
        valid: false,
        reason: 'زمان استفاده از این کد تخفیف هنوز شروع نشده است.',
      };
    }

    if (coupon.endDate && coupon.endDate.getTime() < now.getTime()) {
      await this.markExpiredIfNeeded(coupon);

      return {
        valid: false,
        reason: 'کد تخفیف منقضی شده است.',
      };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return {
        valid: false,
        reason: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.',
      };
    }

    const minAmount = coupon.minAmount ?? new Prisma.Decimal(0);

    if (input.orderAmount.lessThan(minAmount)) {
      return {
        valid: false,
        reason: 'مبلغ سفارش کمتر از حداقل مبلغ مجاز برای این کد تخفیف است.',
      };
    }

    if (input.userId) {
      const alreadyUsed = await this.prisma.couponUsage.findFirst({
        where: {
          couponId: coupon.id,
          userId: input.userId,
        },
        select: {
          id: true,
        },
      });

      if (alreadyUsed) {
        return {
          valid: false,
          reason: 'این کاربر قبلاً از این کد تخفیف استفاده کرده است.',
        };
      }
    }

    return {
      valid: true,
    };
  }

  private async markExpiredIfNeeded(coupon: Coupon) {
    const now = new Date();

    if (coupon.status === CouponStatus.EXPIRED) {
      return;
    }

    await this.prisma.coupon.update({
      where: {
        id: coupon.id,
      },
      data: {
        status: CouponStatus.EXPIRED,
        isActive: false,
        updatedAt: now,
      },
    });

    this.eventPublisher.publishExpired({
      couponId: coupon.id,
      code: coupon.code,
      occurredAt: now,
    });
  }

  private async findCouponById(couponId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        id: couponId,
        deletedAt: null,
      },
      select: this.couponSelect,
    });

    if (!coupon) {
      throw new NotFoundException('کد تخفیف موردنظر یافت نشد.');
    }

    return coupon;
  }

  private async findCouponByCode(code: string, includeDeleted: boolean) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: this.normalizeCode(code),
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.couponSelect,
    });

    if (!coupon) {
      throw new NotFoundException('کد تخفیف موردنظر یافت نشد.');
    }

    return coupon;
  }

  private async assertCodeUnique(code: string, excludeCouponId?: string) {
    const existing = await this.prisma.coupon.findFirst({
      where: {
        code: this.normalizeCode(code),
        deletedAt: null,
        ...(excludeCouponId
          ? {
              id: {
                not: excludeCouponId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('این کد تخفیف قبلاً ثبت شده است.');
    }
  }

  private assertCouponValue(type: CouponType, value?: string) {
    if (type === CouponType.FREE_SHIPPING) {
      return;
    }

    if (!value) {
      throw new BadRequestException('مقدار کد تخفیف الزامی است.');
    }

    const decimal = new Prisma.Decimal(value);

    if (decimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException('مقدار کد تخفیف باید بزرگ‌تر از صفر باشد.');
    }

    if (type === CouponType.PERCENTAGE && decimal.greaterThan(100)) {
      throw new BadRequestException(
        'مقدار درصدی کد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.',
      );
    }
  }

  private resolveCouponValue(type: CouponType, value?: string | null) {
    if (type === CouponType.FREE_SHIPPING) {
      return new Prisma.Decimal(0);
    }

    if (!value) {
      throw new BadRequestException('مقدار کد تخفیف الزامی است.');
    }

    return new Prisma.Decimal(value);
  }

  private assertDateRange(startDate?: string, endDate?: string | null) {
    if (!startDate || !endDate) {
      return;
    }

    const start = this.parseDate(startDate);

    const end = this.parseDate(endDate);

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }
  }

  private buildWhere(query: QueryCouponWithExpired): Prisma.CouponWhereInput {
    const where: Prisma.CouponWhereInput = {};

    if (query.includeDeleted !== true) {
      where.deletedAt = null;
    }

    if (query.code) {
      where.code = {
        contains: this.normalizeCode(query.code),
        mode: 'insensitive',
      };
    }

    if (query.q) {
      where.OR = [
        {
          code: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.expired === true) {
      where.OR = [
        ...(where.OR ?? []),
        {
          status: CouponStatus.EXPIRED,
        },
        {
          endDate: {
            lt: new Date(),
          },
        },
      ];
    }

    if (query.expired === false) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          status: {
            not: CouponStatus.EXPIRED,
          },
        },
        {
          OR: [
            {
              endDate: null,
            },
            {
              endDate: {
                gte: new Date(),
              },
            },
          ],
        },
      ];
    }

    if (query.createdFrom) {
      where.createdAt = {
        ...(typeof where.createdAt === 'object' ? where.createdAt : {}),
        gte: this.parseDate(query.createdFrom),
      };
    }

    if (query.createdTo) {
      where.createdAt = {
        ...(typeof where.createdAt === 'object' ? where.createdAt : {}),
        lte: this.parseDate(query.createdTo),
      };
    }

    return where;
  }

  private mapCoupon(coupon: Coupon) {
    return {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toString(),
      description: coupon.description,
      minAmount: coupon.minAmount?.toString() ?? '0',
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      remainingUsage:
        coupon.usageLimit === null
          ? null
          : Math.max(coupon.usageLimit - coupon.usedCount, 0),
      startDate: coupon.startDate,
      startDateFa: this.toPersianDateTimeString(coupon.startDate),
      endDate: coupon.endDate,
      endDateFa: this.toPersianDateTimeString(coupon.endDate),
      isActive: coupon.isActive,
      status: coupon.status,
      isExpired: coupon.endDate ? coupon.endDate.getTime() < Date.now() : false,
      createdAt: coupon.createdAt,
      createdAtFa: this.toPersianDateTimeString(coupon.createdAt),
      updatedAt: coupon.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(coupon.updatedAt),
      deletedAt: coupon.deletedAt,
      deletedAtFa: this.toPersianDateTimeString(coupon.deletedAt),
    };
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private mapCalculation(calculation: {
    subtotal: Prisma.Decimal;
    shippingAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    shippingDiscountAmount: Prisma.Decimal;
    finalAmount: Prisma.Decimal;
  }) {
    return {
      subtotal: calculation.subtotal.toString(),
      shippingAmount: calculation.shippingAmount.toString(),
      discountAmount: calculation.discountAmount.toString(),
      shippingDiscountAmount: calculation.shippingDiscountAmount.toString(),
      finalAmount: calculation.finalAmount.toString(),
    };
  }

  private buildPagination(query: QueryCouponDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
    };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private parseDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }

    return date;
  }
}
