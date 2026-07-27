import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : value;
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

export const CUSTOMER_SUPPORT_STATUSES = [
  'OPEN',
  'PENDING',
  'ANSWERED',
  'CLOSED',
] as const;

export type CustomerSupportStatus = (typeof CUSTOMER_SUPPORT_STATUSES)[number];

export class QueryCustomerSupportTicketDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(CUSTOMER_SUPPORT_STATUSES)
  status?: CustomerSupportStatus;
}
