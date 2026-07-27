import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  trimOptionalString,
  toOptionalBoolean,
} from '../../../core/utils/transformer.util';

export class AdminDashboardQueryDto {
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
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
