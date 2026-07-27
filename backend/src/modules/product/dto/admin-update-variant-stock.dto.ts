import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const toInt = ({ value }: { value: unknown }) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
};

export type AdminVariantStockMovementType =
  'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';

export class AdminUpdateVariantStockDto {
  @IsString()
  @Transform(trimRequiredString)
  warehouseId!: string;

  @Transform(toInt)
  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  @IsIn(['IN', 'OUT', 'ADJUSTMENT', 'RETURN'])
  type!: AdminVariantStockMovementType;

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
