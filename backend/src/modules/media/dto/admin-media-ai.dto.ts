import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminMediaAiImageDescriptionDto {
  @IsOptional()
  @IsUUID()
  imageId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  context?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  extraInstruction?: string;
}

export class AdminMediaAiAltTextDraftDto {
  @IsOptional()
  @IsUUID()
  imageId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  context?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  extraInstruction?: string;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(180)
  maxLength?: number;
}

export class AdminMediaAiAltTextApplyDto {
  @IsUUID()
  imageId!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  context?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  extraInstruction?: string;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(180)
  maxLength?: number;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  approvalReason?: string;
}

export class AdminMediaAiBannerTextDto {
  @IsString()
  @MaxLength(300)
  campaignGoal!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cta?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  extraInstruction?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(500)
  maxLength?: number;
}
