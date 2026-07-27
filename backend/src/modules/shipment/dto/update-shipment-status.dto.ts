import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const shipmentStatusValues = [
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type ShipmentStatusValue = (typeof shipmentStatusValues)[number];

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return value;
};

export class UpdateShipmentStatusDto {
  @IsIn(shipmentStatusValues)
  status!: ShipmentStatusValue;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  shippingMethod?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(180)
  trackingNumber?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  shippedAt?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  notifyCustomer?: boolean;
}
