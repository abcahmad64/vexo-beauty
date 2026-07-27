import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { Type, Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class PushSubscriptionKeysDto {
  @IsString()
  @Transform(trimString)
  @MinLength(1)
  @MaxLength(512)
  p256dh!: string;

  @IsString()
  @Transform(trimString)
  @MinLength(1)
  @MaxLength(512)
  auth!: string;
}

export class RegisterPushSubscriptionDto {
  @IsString()
  @Transform(trimString)
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
  })
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(512)
  userAgent?: string;
}
