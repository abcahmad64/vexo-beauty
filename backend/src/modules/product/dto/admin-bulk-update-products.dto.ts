import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminProductStatus } from './admin-query-product.dto';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export type AdminProductBulkAction =
  'update' | 'activate' | 'deactivate' | 'archive' | 'delete';

export class AdminBulkUpdateProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({
    each: true,
  })
  productIds!: string[];

  @IsString()
  @IsIn(['update', 'activate', 'deactivate', 'archive', 'delete'])
  action!: AdminProductBulkAction;

  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: AdminProductStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  reason?: string;
}
