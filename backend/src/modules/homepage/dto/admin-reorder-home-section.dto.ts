import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class AdminReorderHomeSectionItemDto {
  @IsString()
  sectionId!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class AdminReorderHomeSectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({
    each: true,
  })
  @Type(() => AdminReorderHomeSectionItemDto)
  items!: AdminReorderHomeSectionItemDto[];
}

export class AdminHomeSectionProductItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  isPinned?: boolean;
}

export class AdminHomeSectionProductsDto {
  @IsString()
  sectionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({
    each: true,
  })
  @Type(() => AdminHomeSectionProductItemDto)
  items!: AdminHomeSectionProductItemDto[];
}
