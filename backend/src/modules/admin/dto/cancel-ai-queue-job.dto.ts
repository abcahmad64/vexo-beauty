import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAiQueueJobDto {
  @ApiPropertyOptional({
    description: 'دلیل ثبت‌شده برای لغو اجرای هوش مصنوعی',
    maxLength: 500,
    example: 'اطلاعات ورودی محصول نیاز به اصلاح دارد.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
