import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum VariantAttributeSyncMode {
  REPLACE = 'REPLACE',
  MERGE = 'MERGE',
  REMOVE = 'REMOVE',
}

export class SyncVariantAttributesDto {
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({
    each: true,
  })
  attributeValueIds!: string[];

  @IsOptional()
  @IsEnum(VariantAttributeSyncMode)
  mode?: VariantAttributeSyncMode;
}
