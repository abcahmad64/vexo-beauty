import { IsBoolean, IsOptional } from 'class-validator';

export class AdminGenerateInvoicePdfDto {
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}
