import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  trimOptionalString,
  toOptionalInteger,
} from '../../../core/utils/transformer.util';

export class AdminLowStockQueryDto {
  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(0)
  @Max(100000)
  threshold?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  productId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  variantId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  q?: string;
}
