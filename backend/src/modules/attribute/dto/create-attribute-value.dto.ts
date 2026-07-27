import { IsString, Length, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class CreateAttributeValueDto {
  @IsString()
  @Transform(trimString)
  @Length(1, 160)
  @MaxLength(160)
  value!: string;
}
