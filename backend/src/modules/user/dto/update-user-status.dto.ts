import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { UserStatus } from '../../../generated/prisma';
import { trimOptionalString } from '../../../core/utils/transformer.util';

const normalizeStatus = ({ value }: { readonly value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

export class UpdateUserStatusDto {
  @Transform(normalizeStatus)
  @IsEnum(UserStatus, {
    message: 'وضعیت کاربر معتبر نیست.',
  })
  status!: UserStatus;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'دلیل تغییر وضعیت باید متن باشد.',
  })
  @MaxLength(500, {
    message: 'دلیل تغییر وضعیت نباید بیشتر از ۵۰۰ کاراکتر باشد.',
  })
  reason?: string;
}
