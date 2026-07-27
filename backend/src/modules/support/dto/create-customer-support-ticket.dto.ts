import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimRequiredString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

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

export const CUSTOMER_SUPPORT_CATEGORIES = [
  'general',
  'order',
  'payment',
  'shipping',
  'refund',
  'product',
  'account',
] as const;

export type CustomerSupportCategory =
  (typeof CUSTOMER_SUPPORT_CATEGORIES)[number];

export class CreateCustomerSupportTicketDto {
  @IsString()
  @Transform(trimRequiredString)
  @MinLength(4)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(CUSTOMER_SUPPORT_CATEGORIES)
  category?: CustomerSupportCategory;

  @IsOptional()
  @IsUUID()
  @Transform(trimOptionalString)
  orderId?: string;
}
