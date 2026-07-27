import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { HEALTH_STATUS } from './constants/health.constants';
import { HealthService } from './health.service';
import type {
  HealthAggregateResponse,
  HealthCheckResult,
  HealthLivenessResponse,
  HealthVersionResponse,
} from './types/health.types';

@ApiTags('سلامت سامانه')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'بررسی آمادگی کلی سرویس',
    description:
      'وضعیت کلی سرویس و وابستگی‌های اصلی مانند پایگاه داده، ردیس، فضای ذخیره‌سازی و هوش مصنوعی را بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'سرویس برای دریافت ترافیک آماده است.',
  })
  @ApiServiceUnavailableResponse({
    description: 'یکی از وابستگی‌های حیاتی سرویس آماده نیست.',
  })
  async getHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthAggregateResponse> {
    const result = await this.healthService.getReadiness();

    response.status(
      result.healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }

  @Get('liveness')
  @ApiOperation({
    summary: 'بررسی زنده بودن سرویس',
    description:
      'برای Kubernetes، Docker و Load Balancer استفاده می‌شود تا مشخص شود پردازش اصلی برنامه زنده است.',
  })
  @ApiOkResponse({
    description: 'سرویس زنده است.',
  })
  getLiveness(): HealthLivenessResponse {
    return this.healthService.getLiveness();
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'بررسی آمادگی سرویس',
    description:
      'آمادگی سرویس برای دریافت ترافیک واقعی را بر اساس وضعیت وابستگی‌های حیاتی بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'سرویس آماده دریافت ترافیک است.',
  })
  @ApiServiceUnavailableResponse({
    description: 'سرویس آماده دریافت ترافیک نیست.',
  })
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthAggregateResponse> {
    const result = await this.healthService.getReadiness();

    response.status(
      result.healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }

  @Get('version')
  @ApiOperation({
    summary: 'دریافت نسخه سرویس',
    description:
      'نسخه برنامه، محیط اجرا، نسخه Node.js و مدت زمان اجرای سرویس را برمی‌گرداند.',
  })
  @ApiOkResponse({
    description: 'اطلاعات نسخه با موفقیت دریافت شد.',
  })
  getVersion(): HealthVersionResponse {
    return this.healthService.getVersion();
  }

  @Get('dependencies')
  @ApiOperation({
    summary: 'بررسی وابستگی‌های سرویس',
    description:
      'وضعیت تمام وابستگی‌های اصلی سرویس شامل پایگاه داده، Redis، Storage و AI را بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'وضعیت وابستگی‌ها با موفقیت بررسی شد.',
  })
  @ApiServiceUnavailableResponse({
    description: 'یکی از وابستگی‌های حیاتی سرویس دچار مشکل است.',
  })
  async getDependencies(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthAggregateResponse> {
    const result = await this.healthService.getDependencyHealth();

    response.status(
      result.healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }

  @Get('database')
  @ApiOperation({
    summary: 'بررسی سلامت پایگاه داده',
    description:
      'اتصال Prisma به PostgreSQL را با اجرای یک Query سبک بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'پایگاه داده سالم است.',
  })
  @ApiServiceUnavailableResponse({
    description: 'پایگاه داده در دسترس نیست.',
  })
  async getDatabaseHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthCheckResult> {
    const result = await this.healthService.getDatabaseHealth();

    response.status(
      result.status === HEALTH_STATUS.UP
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }

  @Get('redis')
  @ApiOperation({
    summary: 'بررسی سلامت Redis',
    description:
      'اتصال شبکه‌ای به Redis را بر اساس REDIS_URL یا REDIS_HOST و REDIS_PORT بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'Redis سالم است.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Redis در دسترس نیست.',
  })
  async getRedisHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthCheckResult> {
    const result = await this.healthService.getRedisHealth();

    response.status(
      result.status === HEALTH_STATUS.UP
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }

  @Get('queue')
  @ApiOperation({
    summary: 'بررسی سلامت صف پردازش',
    description:
      'اتصال واقعی BullMQ به Redis را با دستور PING و تنظیمات اختصاصی Queue بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'صف پردازش سالم یا به‌صورت آگاهانه غیرفعال است.',
  })
  @ApiServiceUnavailableResponse({
    description: 'صف پردازش اجباری در دسترس نیست.',
  })
  async getQueueHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthCheckResult> {
    const result = await this.healthService.getQueueHealth();

    response.status(
      result.status === HEALTH_STATUS.UP
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }

  @Get('storage')
  @ApiOperation({
    summary: 'بررسی سلامت فضای ذخیره‌سازی',
    description:
      'اتصال به Bunny Storage را با اعتبارسنجی دسترسی API بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'فضای ذخیره‌سازی سالم است.',
  })
  @ApiServiceUnavailableResponse({
    description: 'فضای ذخیره‌سازی در دسترس نیست.',
  })
  async getStorageHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthCheckResult> {
    const result = await this.healthService.getStorageHealth();

    response.status(
      result.status === HEALTH_STATUS.UP
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }

  @Get('ai')
  @ApiOperation({
    summary: 'بررسی سلامت هوش مصنوعی',
    description:
      'اتصال به Ollama و Endpoint مربوط به مدل‌های فعال را بررسی می‌کند.',
  })
  @ApiOkResponse({
    description: 'سرویس هوش مصنوعی سالم است.',
  })
  @ApiServiceUnavailableResponse({
    description: 'سرویس هوش مصنوعی در دسترس نیست.',
  })
  async getAiHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthCheckResult> {
    const result = await this.healthService.getAiHealth();

    response.status(
      result.status === HEALTH_STATUS.UP
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }
}
