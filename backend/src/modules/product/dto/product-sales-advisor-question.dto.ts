import { Transform } from 'class-transformer';

import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const trimRequiredString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export class ProductSalesAdvisorQuestionDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 1200)
  question!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(32)
  @IsIn(['SHORT', 'DETAILED', 'COMPARISON', 'SUPPORT'])
  answerMode?: 'SHORT' | 'DETAILED' | 'COMPARISON' | 'SUPPORT';

  @IsOptional()
  @IsObject()
  visitorContext?: Record<string, unknown>;
}
