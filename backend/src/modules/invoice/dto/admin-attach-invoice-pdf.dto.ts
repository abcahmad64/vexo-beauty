import { IsString } from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class AdminAttachInvoicePdfDto {
  @IsString()
  @Transform(trimRequiredString)
  pdfUrl!: string;
}
