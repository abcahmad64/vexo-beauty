import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export type AdminCollectionProductsMode = 'replace' | 'append' | 'remove';

export class AdminCollectionProductItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminCollectionProductsDto {
  @IsString()
  @IsIn(['replace', 'append', 'remove'])
  mode!: AdminCollectionProductsMode;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({
    each: true,
  })
  @Type(() => AdminCollectionProductItemDto)
  items!: AdminCollectionProductItemDto[];
}
