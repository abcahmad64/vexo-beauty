import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

import { trimString } from '../../../core/utils/transformer.util';

export class RefreshTokenDto {
  @Transform(trimString)
  @IsString({
    message: 'توکن تازه‌سازی الزامی است.',
  })
  @Matches(/^[a-f0-9]{128}$/iu, {
    message: 'توکن تازه‌سازی معتبر نیست.',
  })
  refreshToken!: string;
}
