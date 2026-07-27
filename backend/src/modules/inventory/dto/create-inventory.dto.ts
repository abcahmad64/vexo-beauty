import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

import { Transform, Type } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class CreateInventoryDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(1, 128)
  variantId!: string;

  @Transform(trimRequiredString)
  @IsString()
  @Length(1, 128)
  warehouseId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reservedQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
