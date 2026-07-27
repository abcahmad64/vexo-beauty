import {
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
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

export class MarkPaymentRefundedDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'refundedAmount must be a decimal string with up to 2 decimal places',
  })
  refundedAmount?: string;

  @IsOptional()
  @IsBoolean()
  isPartial?: boolean;

  @IsOptional()
  @IsDateString()
  refundedAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
