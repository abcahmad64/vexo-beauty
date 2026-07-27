import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';

import { AddCartItemDto } from './add-cart-item.dto';

export class MergeCartDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({
    each: true,
  })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}
