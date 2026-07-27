import { Transform } from 'class-transformer';

import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

const trimRequiredString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export class AdminShipmentNoteDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(2000)
  note!: string;

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  visibility?: string;
}
