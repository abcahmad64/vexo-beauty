import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminShipmentPaymentStatus,
  AdminShipmentStatus,
} from './admin-query-shipment.dto';

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

export type AdminShipmentExportFormat = 'csv' | 'json';

export class AdminShipmentExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  orderId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  orderNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ])
  status?: AdminShipmentStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
  paymentStatus?: AdminShipmentPaymentStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  trackingNumber?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  shippedFrom?: string;

  @IsOptional()
  @IsDateString()
  shippedTo?: string;

  @IsOptional()
  @IsDateString()
  deliveredFrom?: string;

  @IsOptional()
  @IsDateString()
  deliveredTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminShipmentExportFormat;
}
