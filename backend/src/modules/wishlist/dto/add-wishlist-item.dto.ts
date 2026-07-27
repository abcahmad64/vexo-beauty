import { IsString, Length } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class AddWishlistItemDto {
  @IsString()
  @Transform(trimString)
  @Length(1, 128)
  productId!: string;
}
