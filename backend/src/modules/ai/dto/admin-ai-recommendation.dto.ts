import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminAiRecommendationStatus,
  AdminAiSeverity,
} from './admin-query-ai.dto';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

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

export type AdminAiRecommendationTargetType =
  | 'STORE'
  | 'ORDER'
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'SEO'
  | 'SUPPORT'
  | 'SEARCH'
  | 'PAYMENT'
  | 'INVENTORY';

export class AdminCreateAiRecommendationDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn([
    'STORE',
    'ORDER',
    'PRODUCT',
    'CUSTOMER',
    'SEO',
    'SUPPORT',
    'SEARCH',
    'PAYMENT',
    'INVENTORY',
  ])
  targetType!: AdminAiRecommendationTargetType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  targetId?: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(250)
  title!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: AdminAiSeverity;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AdminUpdateAiRecommendationStatusDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['OPEN', 'RESOLVED', 'DISMISSED'])
  status!: AdminAiRecommendationStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
