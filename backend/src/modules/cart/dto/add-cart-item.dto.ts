import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import { Transform, Type } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
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

export class AddCartItemDto {
  @IsString()
  @Transform(trimString)
  @Length(1, 128)
  productId!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(1, 128)
  variantId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}
