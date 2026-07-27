import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { AuthConstants } from '../../auth/constants/auth.constants';

export class ChangePasswordDto {
  @IsString({
    message: 'رمز عبور فعلی باید متن باشد.',
  })
  @MinLength(1, {
    message: 'رمز عبور فعلی الزامی است.',
  })
  @MaxLength(120, {
    message: 'رمز عبور فعلی نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  currentPassword!: string;

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
}
