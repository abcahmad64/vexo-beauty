import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

import { trimOptionalString } from '../../../core/utils/transformer.util';

export class LogoutDto {
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'توکن تازه‌سازی باید متن باشد.',
  })
  @Matches(/^[a-f0-9]{128}$/iu, {
    message: 'توکن تازه‌سازی معتبر نیست.',
  })
  refreshToken?: string;
}
