import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

const normalizeOptionalNullableString = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
};

export class UpdateProfileDto {
  @Transform(normalizeOptionalNullableString)
  @IsOptional()
  @IsString({
    message: 'نام باید متن باشد.',
  })
  @Length(2, 80, {
    message: 'نام باید بین ۲ تا ۸۰ کاراکتر باشد.',
  })
  firstName?: string | null;

  @Transform(normalizeOptionalNullableString)
  @IsOptional()
  @IsString({
    message: 'نام خانوادگی باید متن باشد.',
  })
  @Length(2, 80, {
    message: 'نام خانوادگی باید بین ۲ تا ۸۰ کاراکتر باشد.',
  })
  lastName?: string | null;
}
