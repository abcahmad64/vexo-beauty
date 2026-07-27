import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  trimOptionalString,
  toOptionalBoolean,
  toOptionalInteger,
} from '../../../core/utils/transformer.util';

export class QueryAddressDto {
  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  country?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  city?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isDefault?: boolean;
}
