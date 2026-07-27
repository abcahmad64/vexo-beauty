import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { toOptionalBoolean } from '../../../core/utils/transformer.util';
import { AuthConstants } from '../../auth/constants/auth.constants';

export class AdminResetPasswordDto {
  @IsString({
    message: 'رمز عبور جدید باید متن باشد.',
  })
  @MinLength(AuthConstants.PASSWORD_MIN_LENGTH, {
    message: `رمز عبور جدید باید حداقل ${AuthConstants.PASSWORD_MIN_LENGTH} کاراکتر باشد.`,
  })
  @MaxLength(120, {
    message: 'رمز عبور جدید نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/u, {
    message:
      'رمز عبور جدید باید حداقل شامل یک حرف کوچک انگلیسی، یک حرف بزرگ انگلیسی و یک عدد باشد.',
  })
  newPassword!: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'وضعیت لغو نشست‌ها باید بولین باشد.',
  })
  revokeSessions?: boolean;
}
