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

export class AdminCommandCenterQueryDto {
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

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(5)
  @Max(50)
  actionLimit?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(10)
  @Max(200)
  timelineLimit?: number;
}
