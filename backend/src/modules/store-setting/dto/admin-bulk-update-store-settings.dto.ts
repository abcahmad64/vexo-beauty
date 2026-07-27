import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class AdminBulkUpdateStoreSettingItemDto {
  @IsString()
  key!: string;

  value!: unknown;
}

export class AdminBulkUpdateStoreSettingsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({
    each: true,
  })
  @Type(() => AdminBulkUpdateStoreSettingItemDto)
  items!: AdminBulkUpdateStoreSettingItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
