import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminOrderPaymentMethod,
  AdminOrderPaymentStatus,
} from './admin-query-order.dto';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export class AdminUpdateOrderPaymentStatusDto {
  @IsString()
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
  paymentStatus!: AdminOrderPaymentStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['ZARINPAL', 'IDPAY', 'CASH', 'CARD', 'WALLET'])
  paymentMethod?: AdminOrderPaymentMethod;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
