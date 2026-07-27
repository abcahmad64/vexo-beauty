import { IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

export class AdminCreateAttributeValueDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  attributeId?: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  value!: string;
}
