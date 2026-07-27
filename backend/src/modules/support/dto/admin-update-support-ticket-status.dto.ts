import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminSupportTicketStatus } from './admin-query-support-ticket.dto';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

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

export class AdminUpdateSupportTicketStatusDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['OPEN', 'PENDING', 'ANSWERED', 'CLOSED'])
  status!: AdminSupportTicketStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
