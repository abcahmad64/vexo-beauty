import { IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class SetEntityImageDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(1200)
  url!: string;
}
