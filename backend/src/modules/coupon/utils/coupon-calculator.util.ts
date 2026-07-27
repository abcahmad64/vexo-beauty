import { BadRequestException } from '@nestjs/common';

import { CouponType, Prisma } from '../../../generated/prisma';

export type CouponCalculationInput = {
  type: CouponType;
  value: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
};

export type CouponCalculationResult = {
  subtotal: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  shippingDiscountAmount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
};

export class CouponCalculatorUtil {
  static calculate(input: CouponCalculationInput): CouponCalculationResult {
    const subtotal = input.subtotal;

    const originalShippingAmount = input.shippingAmount;

    if (subtotal.lessThan(0) || originalShippingAmount.lessThan(0)) {
      throw new BadRequestException('Amount values cannot be negative');
    }

    if (input.type === CouponType.PERCENTAGE) {
      const discountAmount = subtotal
        .mul(input.value)
        .div(100)
        .toDecimalPlaces(2);

      const finalAmount = subtotal
        .plus(originalShippingAmount)
        .minus(discountAmount);

      return {
        subtotal,
        shippingAmount: originalShippingAmount,
        discountAmount,
        shippingDiscountAmount: new Prisma.Decimal(0),
        finalAmount: Prisma.Decimal.max(finalAmount, new Prisma.Decimal(0)),
      };
    }

    if (input.type === CouponType.FIXED_AMOUNT) {
      const discountAmount = Prisma.Decimal.min(
        input.value,
        subtotal,
      ).toDecimalPlaces(2);

      const finalAmount = subtotal
        .plus(originalShippingAmount)
        .minus(discountAmount);

      return {
        subtotal,
        shippingAmount: originalShippingAmount,
        discountAmount,
        shippingDiscountAmount: new Prisma.Decimal(0),
        finalAmount: Prisma.Decimal.max(finalAmount, new Prisma.Decimal(0)),
      };
    }

    if (input.type === CouponType.FREE_SHIPPING) {
      return {
        subtotal,
        shippingAmount: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        shippingDiscountAmount: originalShippingAmount,
        finalAmount: subtotal,
      };
    }

    throw new BadRequestException('Unsupported coupon type');
  }
}
