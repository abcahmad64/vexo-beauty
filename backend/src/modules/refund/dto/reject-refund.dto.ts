import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
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

export class RejectRefundDto {
  @IsString()
  @Transform(trimString)
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  notifyCustomer?: boolean;
}
