import { CouponStatus, CouponType } from '../../../generated/prisma';

export interface CouponBaseEventPayload {
  couponId: string;
  code: string;
  actorId?: string;
  occurredAt: Date;
}

export interface CouponCreatedEventPayload extends CouponBaseEventPayload {
  type: CouponType;
  value: string;
  status: CouponStatus;
}

export interface CouponUpdatedEventPayload extends CouponBaseEventPayload {
  changedFields: string[];
}

export type CouponDeletedEventPayload = CouponBaseEventPayload;

export type CouponActivatedEventPayload = CouponBaseEventPayload;

export type CouponDeactivatedEventPayload = CouponBaseEventPayload;

export type CouponExpiredEventPayload = CouponBaseEventPayload;

export interface CouponValidatedEventPayload extends CouponBaseEventPayload {
  userId?: string;
  orderAmount: string;
  discountAmount: string;
}

export interface CouponValidationFailedEventPayload {
  code: string;
  userId?: string;
  reason: string;
  occurredAt: Date;
}

export interface CouponAppliedEventPayload extends CouponBaseEventPayload {
  userId?: string;
  subtotal: string;
  discountAmount: string;
  shippingDiscountAmount: string;
  finalAmount: string;
}

export interface CouponUsageRecordedEventPayload extends CouponBaseEventPayload {
  userId: string;
  orderId: string;
}
