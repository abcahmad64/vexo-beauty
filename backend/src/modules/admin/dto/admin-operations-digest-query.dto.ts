import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { trimOptionalString } from '../../../core/utils/transformer.util';

export class AdminOperationsDigestQueryDto {
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
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['compact', 'full'])
  mode?: 'compact' | 'full';
}
