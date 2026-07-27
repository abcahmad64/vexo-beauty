import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

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

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

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

const normalizeOptionalStringArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
};

const attributeDataTypes = [
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'ENUM',
  'MULTI_SELECT',
  'JSON',
  'DATE',
] as const;

const attributeInputTypes = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'SWITCH',
  'SELECT',
  'MULTI_SELECT',
  'DATE',
  'COLOR',
  'RICH_TEXT',
] as const;

export type AdminProductAttributeDataType = (typeof attributeDataTypes)[number];

export type AdminProductAttributeInputType =
  (typeof attributeInputTypes)[number];

export type ProductAttributeTemplateScope =
  'CATEGORY' | 'PRODUCT_TYPE' | 'BRAND_PRODUCT_TYPE' | 'PRODUCT_MODEL';

export class AdminCreateProductTypeDto {
  @IsString()
  @Transform(trimRequiredString)
  categoryId!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(320)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminUpdateProductTypeDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(320)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminCreateProductModelDto {
  @IsString()
  @Transform(trimRequiredString)
  brandId!: string;

  @IsString()
  @Transform(trimRequiredString)
  productTypeId!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  modelCode?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  titlePattern?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  seoPattern?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminUpdateProductModelDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productTypeId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  modelCode?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  titlePattern?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  seoPattern?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminCreateProductAttributeDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(attributeDataTypes)
  dataType?: AdminProductAttributeDataType;

  @IsOptional()
  @IsString()
  @IsIn(attributeInputTypes)
  inputType?: AdminProductAttributeInputType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Transform(normalizeOptionalStringArray)
  options?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  placeholder?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  helpText?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsBoolean()
  isComparable?: boolean;

  @IsOptional()
  @IsBoolean()
  isSeoImportant?: boolean;

  @IsOptional()
  @IsBoolean()
  isAiImportant?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateProductAttributeDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalNullableString)
  @MaxLength(120)
  code?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalNullableString)
  @MaxLength(160)
  label?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalNullableString)
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(attributeDataTypes)
  dataType?: AdminProductAttributeDataType;

  @IsOptional()
  @IsString()
  @IsIn(attributeInputTypes)
  inputType?: AdminProductAttributeInputType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalNullableString)
  @MaxLength(40)
  unit?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Transform(normalizeOptionalStringArray)
  options?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalNullableString)
  @MaxLength(180)
  placeholder?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalNullableString)
  @MaxLength(500)
  helpText?: string | null;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsBoolean()
  isComparable?: boolean;

  @IsOptional()
  @IsBoolean()
  isSeoImportant?: boolean;

  @IsOptional()
  @IsBoolean()
  isAiImportant?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminCreateProductAttributeValueDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  value!: string;
}

export class AdminUpdateProductAttributeValueDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  value?: string;
}

export class AdminResolveProductAttributeTemplateDto {
  @IsString()
  @Transform(trimRequiredString)
  categoryId!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productTypeId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productModelId?: string;
}

export class AdminAttributeTemplateFieldDto {
  @IsString()
  @Transform(trimRequiredString)
  attributeId!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  groupName?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminCreateProductAttributeTemplateDto {
  @IsString()
  @IsIn(['CATEGORY', 'PRODUCT_TYPE', 'BRAND_PRODUCT_TYPE', 'PRODUCT_MODEL'])
  scope!: ProductAttributeTemplateScope;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productTypeId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productModelId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AdminAttributeTemplateFieldDto)
  fields?: AdminAttributeTemplateFieldDto[];
}

export class AdminUpdateProductAttributeTemplateDto {
  @IsOptional()
  @IsString()
  @IsIn(['CATEGORY', 'PRODUCT_TYPE', 'BRAND_PRODUCT_TYPE', 'PRODUCT_MODEL'])
  scope?: ProductAttributeTemplateScope;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productTypeId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productModelId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
