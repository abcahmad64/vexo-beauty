import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminInvoiceStatus } from './admin-query-invoice.dto';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export class AdminUpdateInvoiceStatusDto {
  @IsString()
  @IsIn(['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'])
  status!: AdminInvoiceStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
