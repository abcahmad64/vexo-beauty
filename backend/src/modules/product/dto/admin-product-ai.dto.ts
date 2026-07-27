import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AiProductContentMode } from '../../ai/dto/ai-product-content.dto';

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

const productContentModes = [
  AiProductContentMode.FULL,
  AiProductContentMode.SHORT_DESCRIPTION,
  AiProductContentMode.DESCRIPTION,
  AiProductContentMode.SEO,
  AiProductContentMode.FAQ,
  AiProductContentMode.AD_COPY,
];

const directlyApplicableProductContentModes = [
  AiProductContentMode.FULL,
  AiProductContentMode.SHORT_DESCRIPTION,
  AiProductContentMode.DESCRIPTION,
];

export class AdminProductAiContentDraftDto {
  @IsOptional()
  @IsString()
  @IsIn(productContentModes)
  mode?: AiProductContentMode;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  extraInstruction?: string;

  @IsOptional()
  @IsBoolean()
  includeSeoHints?: boolean;

  @IsOptional()
  @IsBoolean()
  includeMarketingHooks?: boolean;

  @IsOptional()
  @IsBoolean()
  includeSalesAdvisorNotes?: boolean;

  @IsOptional()
  @IsObject()
  overrideContext?: Record<string, unknown>;
}

export class AdminProductAiContentApplyDto {
  @IsOptional()
  @IsString()
  @IsIn(directlyApplicableProductContentModes)
  mode?: AiProductContentMode;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  extraInstruction?: string;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  approvalReason?: string;

  @IsOptional()
  @IsObject()
  editedDraft?: Record<string, unknown>;
}

export class AdminProductAiSeoDraftDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  extraInstruction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  includeStructuredData?: boolean;

  @IsOptional()
  @IsBoolean()
  includeImageAltSuggestions?: boolean;

  @IsOptional()
  @IsBoolean()
  includeFaqSuggestions?: boolean;
}

export class AdminProductAiSeoApplyDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  extraInstruction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  approvalReason?: string;

  @IsOptional()
  @IsObject()
  editedSeoDraft?: Record<string, unknown>;
}
export class AdminProductAiQualityAuditDto {
  @IsOptional()
  @IsBoolean()
  includeMissingFields?: boolean;

  @IsOptional()
  @IsBoolean()
  includeContradictions?: boolean;

  @IsOptional()
  @IsBoolean()
  includeSeoChecks?: boolean;

  @IsOptional()
  @IsBoolean()
  includeMediaChecks?: boolean;

  @IsOptional()
  @IsBoolean()
  includePricingSafetyChecks?: boolean;

  @IsOptional()
  @IsBoolean()
  includeAttributeSuggestions?: boolean;

  @IsOptional()
  @IsBoolean()
  applyToProduct?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  extraInstruction?: string;
}
export enum AdminProductAiRegistrationSection {
  IDENTITY = 'identity',
  ATTRIBUTES = 'attributes',
  VARIANTS = 'variants',
  PRICING = 'pricing',
  MEDIA = 'media',
  SEO = 'seo',
  AI = 'ai',
}

export class AdminProductAiRegistrationAssistDto {
  @IsEnum(AdminProductAiRegistrationSection)
  section!: AdminProductAiRegistrationSection;

  @IsOptional()
  @IsObject()
  currentDraft?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  extraInstruction?: string;
}
