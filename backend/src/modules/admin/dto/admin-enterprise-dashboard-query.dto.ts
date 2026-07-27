import { Transform } from 'class-transformer';
import {
  IsDateString,
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

export class AdminEnterpriseDashboardQueryDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(7)
  @Max(90)
  chartDays?: number;
}
