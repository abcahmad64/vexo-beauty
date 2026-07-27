import { IsString, Matches, MaxLength, IsOptional } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
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

export class RequestRefundDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(128)
  paymentId!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'مبلغ بازگشت وجه باید عدد معتبر با حداکثر دو رقم اعشار باشد.',
  })
  amount?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
