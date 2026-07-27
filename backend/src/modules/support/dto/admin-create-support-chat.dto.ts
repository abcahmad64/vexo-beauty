import { IsObject, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

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

export class AdminCreateSupportChatDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  externalId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestToken?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestName?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestEmail?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  assignedAgentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
