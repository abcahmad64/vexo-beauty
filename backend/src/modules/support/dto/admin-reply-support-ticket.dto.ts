import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class AdminReplySupportTicketDto {
  @IsString()
  @Transform(trimRequiredString)
  body!: string;

  @IsOptional()
  @IsArray()
  attachmentUrls?: string[];

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
