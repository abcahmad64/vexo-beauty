import { IsIn, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class ZarinpalCallbackQueryDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(180)
  Authority!: string;

  @IsString()
  @Transform(trimString)
  @IsIn(['OK', 'NOK'])
  Status!: 'OK' | 'NOK';
}
