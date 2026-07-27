import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

export class UpdateAttributeDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 120)
  @MaxLength(120)
  name?: string;
}
