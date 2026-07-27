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

export class UpdateAttributeValueDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(1, 160)
  @MaxLength(160)
  value?: string;
}
