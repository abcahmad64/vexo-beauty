import {
  IsArray,
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

export class AdminCreateSupportTicketDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(250)
  subject!: string;

  @IsString()
  @Transform(trimRequiredString)
  body!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

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
  @IsString()
  @Transform(trimOptionalString)
  assignedAgentId?: string;

  @IsOptional()
  @IsArray()
  attachmentUrls?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
