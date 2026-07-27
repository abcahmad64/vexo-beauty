import { IsString, Length, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class CreateAttributeDto {
  @IsString()
  @Transform(trimString)
  @Length(2, 120)
  @MaxLength(120)
  name!: string;
}
