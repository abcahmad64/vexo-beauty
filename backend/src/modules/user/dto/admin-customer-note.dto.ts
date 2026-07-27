import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  toOptionalBoolean,
  trimOptionalString,
  trimString,
} from '../../../core/utils/transformer.util';

export type AdminCustomerNoteVisibility =
  'admin' | 'support' | 'finance' | 'private';

const ADMIN_CUSTOMER_NOTE_VISIBILITIES: readonly AdminCustomerNoteVisibility[] =
  ['admin', 'support', 'finance', 'private'] as const;

export class AdminCustomerNoteDto {
  @Transform(trimString)
  @IsString({
    message: 'متن یادداشت باید متن باشد.',
  })
  @MinLength(1, {
    message: 'متن یادداشت الزامی است.',
  })
  @MaxLength(2000, {
    message: 'متن یادداشت نباید بیشتر از ۲۰۰۰ کاراکتر باشد.',
  })
  note!: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'وضعیت اهمیت یادداشت باید بولین باشد.',
  })
  isImportant?: boolean;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'سطح نمایش یادداشت باید متن باشد.',
  })
  @IsIn(ADMIN_CUSTOMER_NOTE_VISIBILITIES, {
    message: 'سطح نمایش یادداشت معتبر نیست.',
  })
  visibility?: AdminCustomerNoteVisibility;
}
