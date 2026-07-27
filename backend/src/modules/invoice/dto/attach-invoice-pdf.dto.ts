import { IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class AttachInvoicePdfDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(1000)
  pdfUrl!: string;
}
