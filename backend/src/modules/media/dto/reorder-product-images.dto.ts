import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class ReorderProductImageItemDto {
  @IsString()
  @MaxLength(128)
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderProductImagesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({
    each: true,
  })
  @Type(() => ReorderProductImageItemDto)
  images!: ReorderProductImageItemDto[];
}
