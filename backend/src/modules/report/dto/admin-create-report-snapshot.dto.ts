import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { AdminReportRequestDto } from './admin-report-request.dto';

export class AdminCreateReportSnapshotDto {
  @IsString()
  @MaxLength(250)
  title!: string;

  @ValidateNested()
  @Type(() => AdminReportRequestDto)
  report!: AdminReportRequestDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
