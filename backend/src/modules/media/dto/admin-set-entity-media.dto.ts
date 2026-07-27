import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

export class AdminSetEntityMediaDto {
  @IsString()
  @Transform(trimRequiredString)
  url!: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  deleteOldFile?: boolean;
}
