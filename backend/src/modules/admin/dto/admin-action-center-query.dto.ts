import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { toOptionalInteger } from '../../../core/utils/transformer.util';

export class AdminActionCenterQueryDto {
  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(5)
  @Max(50)
  limit?: number;
}
