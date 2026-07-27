import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

const toInt = ({ value }: { value: unknown }) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
};

export type AdminStockAdjustmentType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';

export class AdminAdjustStockDto {
  @IsString()
  @Transform(trimRequiredString)
  variantId!: string;

  @IsString()
  @Transform(trimRequiredString)
  warehouseId!: string;

  @Transform(toInt)
  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  @IsIn(['IN', 'OUT', 'ADJUSTMENT', 'RETURN'])
  type!: AdminStockAdjustmentType;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  reference?: string;
}
