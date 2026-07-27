import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum AttributeSyncMode {
  REPLACE = 'REPLACE',
  MERGE = 'MERGE',
  REMOVE = 'REMOVE',
}

export class SyncProductAttributesDto {
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({
    each: true,
  })
  attributeValueIds!: string[];

  @IsOptional()
  @IsEnum(AttributeSyncMode)
  mode?: AttributeSyncMode;
}
