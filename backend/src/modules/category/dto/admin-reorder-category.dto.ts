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

import { Transform, Type } from 'class-transformer';

const trimOptionalNullableString = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

export class AdminReorderCategoryItemDto {
  @IsString()
  categoryId!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  parentId?: string | null;
}

export class AdminReorderCategoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({
    each: true,
  })
  @Type(() => AdminReorderCategoryItemDto)
  items!: AdminReorderCategoryItemDto[];
}
