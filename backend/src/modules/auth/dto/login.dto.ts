import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { readonly value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toLowerCase();
};

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail(
    {},
    {
      message: 'ایمیل واردشده معتبر نیست.',
    },
  )
  @MaxLength(180, {
    message: 'ایمیل نباید بیشتر از ۱۸۰ کاراکتر باشد.',
  })
  email!: string;

  @IsString({
    message: 'رمز عبور باید متن باشد.',
  })
  @MinLength(1, {
    message: 'رمز عبور الزامی است.',
  })
  @MaxLength(120, {
    message: 'رمز عبور نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  password!: string;
}
