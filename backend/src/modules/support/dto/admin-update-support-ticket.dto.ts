import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminSupportTicketChannel,
  AdminSupportTicketPriority,
} from './admin-query-support-ticket.dto';

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

export class AdminUpdateSupportTicketDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  subject?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestName?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestEmail?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  orderId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: AdminSupportTicketPriority;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['WEB', 'CHAT', 'EMAIL', 'PHONE', 'ADMIN'])
  channel?: AdminSupportTicketChannel;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
