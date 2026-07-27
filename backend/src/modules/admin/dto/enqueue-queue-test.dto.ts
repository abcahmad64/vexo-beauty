import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  trimOptionalString,
  trimString,
} from '../../../core/utils/transformer.util';

export class EnqueueTestNotificationJobDto {
  @IsString({
    message: 'شناسه کاربر باید رشته باشد.',
  })
  @Transform(trimString)
  @IsNotEmpty({
    message: 'شناسه کاربر برای تست اعلان الزامی است.',
  })
  userId!: string;

  @IsOptional()
  @IsString({
    message: 'عنوان اعلان باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(180, {
    message: 'عنوان اعلان نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد.',
  })
  title?: string;

  @IsOptional()
  @IsString({
    message: 'متن اعلان باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(1000, {
    message: 'متن اعلان نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.',
  })
  message?: string;

  @IsOptional()
  @IsString({
    message: 'آدرس عملیات اعلان باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(500, {
    message: 'آدرس عملیات اعلان نمی‌تواند بیشتر از ۵۰۰ کاراکتر باشد.',
  })
  actionUrl?: string;

  @IsOptional()
  @IsObject({
    message: 'متادیتای اعلان باید یک object معتبر باشد.',
  })
  metadata?: Record<string, unknown>;
}

export class EnqueueTestAnalyticsJobDto {
  @IsOptional()
  @IsString({
    message: 'نام رویداد آنالیتیکس باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(180, {
    message: 'نام رویداد آنالیتیکس نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد.',
  })
  name?: string;

  @IsOptional()
  @IsString({
    message: 'توضیح رویداد آنالیتیکس باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(500, {
    message: 'توضیح رویداد آنالیتیکس نمی‌تواند بیشتر از ۵۰۰ کاراکتر باشد.',
  })
  description?: string;

  @IsOptional()
  @IsString({
    message: 'دسته‌بندی رویداد آنالیتیکس باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(120, {
    message: 'دسته‌بندی رویداد آنالیتیکس نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  category?: string;

  @IsOptional()
  @IsString({
    message: 'شناسه موجودیت باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(120, {
    message: 'شناسه موجودیت نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  entityId?: string;

  @IsOptional()
  @IsString({
    message: 'شناسه کاربر باید رشته باشد.',
  })
  @Transform(trimOptionalString)
  @MaxLength(120, {
    message: 'شناسه کاربر نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  userId?: string;

  @IsOptional()
  @IsObject({
    message: 'داده رویداد آنالیتیکس باید یک object معتبر باشد.',
  })
  data?: Record<string, unknown>;
}
