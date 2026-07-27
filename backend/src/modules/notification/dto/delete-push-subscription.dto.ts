import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class DeletePushSubscriptionDto {
  @IsString()
  @Transform(trimString)
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
  })
  endpoint!: string;
}
