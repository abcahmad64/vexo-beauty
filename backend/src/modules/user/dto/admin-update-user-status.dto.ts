import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { trimOptionalString } from '../../../core/utils/transformer.util';
import { AdminUserStatus } from './admin-query-user.dto';

const ADMIN_USER_STATUSES: readonly AdminUserStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'DELETED',
] as const;

const normalizeStatus = ({ value }: { readonly value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

export class AdminUpdateUserStatusDto {
  @Transform(normalizeStatus)
  @IsString({
    message: 'وضعیت کاربر باید متن باشد.',
  })
  @IsIn(ADMIN_USER_STATUSES, {
    message: 'وضعیت کاربر معتبر نیست.',
  })
  status!: AdminUserStatus;

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
