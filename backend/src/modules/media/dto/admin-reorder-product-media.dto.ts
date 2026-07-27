import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class AdminReorderProductMediaItemDto {
  @IsString()
  imageId!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class AdminReorderProductMediaDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({
    each: true,
  })
  @Type(() => AdminReorderProductMediaItemDto)
  items!: AdminReorderProductMediaItemDto[];
}
