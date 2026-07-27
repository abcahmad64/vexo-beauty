import { IsDateString, IsEnum, IsOptional } from 'class-validator';

import { RefundStatus } from '../../../generated/prisma';

export class UpdateRefundStatusDto {
  @IsEnum(RefundStatus)
  status!: RefundStatus;

  @IsOptional()
  @IsDateString()
  processedAt?: string;
}
