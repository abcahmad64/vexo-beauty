import { IsBoolean, IsOptional } from 'class-validator';

import { Transform } from 'class-transformer';

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

export class QueryProductImageDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  primaryOnly?: boolean;
}
