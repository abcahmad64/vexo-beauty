import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
};

export type CatalogResearchRunStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY_FOR_WEB_RESEARCH'
  | 'WEB_RESEARCH_PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'COMPLETED'
  | 'WEB_RESEARCH_FAILED'
  | 'FAILED'
  | 'QUEUE_FAILED';

export type CatalogSuggestionDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export type CatalogSourceType =
  | 'BRAND_OFFICIAL'
  | 'PRODUCT_OFFICIAL'
  | 'REGULATORY'
  | 'DISTRIBUTOR_OFFICIAL'
  | 'TRUSTED_RETAILER'
  | 'SPECIALIZED'
  | 'MANUAL_SOURCE';

export class AdminCatalogResearchRunQueryDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'PENDING',
    'QUEUED',
    'PROCESSING',
    'READY_FOR_WEB_RESEARCH',
    'WEB_RESEARCH_PROCESSING',
    'READY_FOR_REVIEW',
    'COMPLETED',
    'WEB_RESEARCH_FAILED',
    'FAILED',
    'QUEUE_FAILED',
  ])
  status?: CatalogResearchRunStatus;
}

export class AdminCatalogSuggestionQueryDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  fieldPath?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  adminDecision?: CatalogSuggestionDecision;
}

export class AdminAddCatalogResearchSourceDto {
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(2000)
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
    require_tld: false,
  })
  sourceUrl!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'BRAND_OFFICIAL',
    'PRODUCT_OFFICIAL',
    'REGULATORY',
    'DISTRIBUTOR_OFFICIAL',
    'TRUSTED_RETAILER',
    'SPECIALIZED',
    'MANUAL_SOURCE',
  ])
  sourceType?: CatalogSourceType;

  @IsOptional()
  @IsBoolean()
  isOfficial?: boolean;
}

export class AdminApproveCatalogSuggestionDto {
  @IsOptional()
  normalizedValue?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  displayValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimOptionalString)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimOptionalString)
  adminNote?: string;
}

export class AdminRejectCatalogSuggestionDto {
  @IsString()
  @MaxLength(2000)
  @Transform(trimOptionalString)
  adminNote!: string;
}

export class AdminBulkCatalogSuggestionReviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  suggestionIds!: string[];

  @IsString()
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimOptionalString)
  adminNote?: string;
}
