import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

export type AdminSupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type AdminSupportTicketStatus =
  'OPEN' | 'PENDING' | 'ANSWERED' | 'CLOSED';

export type AdminSupportTicketChannel =
  'WEB' | 'CHAT' | 'EMAIL' | 'PHONE' | 'ADMIN';

export type AdminSupportTicketSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'lastMessageAt'
  | 'ticketNumber'
  | 'priority'
  | 'status'
  | 'channel'
  | 'category'
  | 'assignedAgentId'
  | 'subject';

export type AdminSupportSortDirection = 'asc' | 'desc';

export class AdminQuerySupportTicketDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ticketId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ticketNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  orderId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  assignedAgentId?: string;

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
  @IsIn(['OPEN', 'PENDING', 'ANSWERED', 'CLOSED'])
  status?: AdminSupportTicketStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['WEB', 'CHAT', 'EMAIL', 'PHONE', 'ADMIN'])
  channel?: AdminSupportTicketChannel;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  unassignedOnly?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  lastMessageFrom?: string;

  @IsOptional()
  @IsDateString()
  lastMessageTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'lastMessageAt',
    'ticketNumber',
    'priority',
    'status',
    'channel',
    'category',
    'assignedAgentId',
    'subject',
  ])
  sortBy?: AdminSupportTicketSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminSupportSortDirection;
}
