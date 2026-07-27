import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class AdminSupportNoteDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(2000)
  note!: string;

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  visibility?: string;
}
