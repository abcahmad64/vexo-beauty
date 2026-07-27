import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { trimOptionalString } from '../../../core/utils/transformer.util';

export class QueryAiProviderCostReportDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  provider?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  model?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  taskType?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsIn(['RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
