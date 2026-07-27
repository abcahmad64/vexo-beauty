import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { OrderStatus } from '../../../generated/prisma';

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

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

export class QueryShipmentDto {
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  orderNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  shippingMethod?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasTrackingNumber?: boolean;

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
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
