import { IsEnum } from 'class-validator';

import { InvoiceStatus } from '../../../generated/prisma';

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;
}
