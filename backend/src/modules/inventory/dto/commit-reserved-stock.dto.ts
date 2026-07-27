import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { Transform, Type } from 'class-transformer';

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

export class CommitReservedStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  reference?: string;
}
