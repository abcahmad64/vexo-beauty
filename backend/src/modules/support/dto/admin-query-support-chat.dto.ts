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

export type AdminSupportChatStatus =
  'OPEN' | 'WAITING' | 'ASSIGNED' | 'CLOSED' | 'ARCHIVED';

export type AdminSupportChatChannel = 'WEB' | 'MOBILE' | 'ADMIN';

export type AdminSupportChatSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'lastMessageAt'
  | 'status'
  | 'channel'
  | 'assignedAgentId'
  | 'unreadByAdmin'
  | 'unreadByCustomer';

export class AdminQuerySupportChatDto {
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
  conversationId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  externalId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestToken?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['OPEN', 'WAITING', 'ASSIGNED', 'CLOSED', 'ARCHIVED'])
  status?: AdminSupportChatStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['WEB', 'MOBILE', 'ADMIN'])
  channel?: AdminSupportChatChannel;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  unreadOnly?: boolean;

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
    'status',
    'channel',
    'assignedAgentId',
    'unreadByAdmin',
    'unreadByCustomer',
  ])
  sortBy?: AdminSupportChatSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
