import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

const toInt = ({ value }: { value: unknown }) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
};

export class AdminLowStockRuleDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  inventoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  variantId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  warehouseId?: string;

  @Transform(toInt)
  @IsInt()
  @Min(0)
  lowStockThreshold!: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
