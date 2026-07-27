import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';

import { RegisterPushSubscriptionDto } from './dto/register-push-subscription.dto';

import { PushSubscriptionService } from './services/push-subscription.service';

type RequestUser = {
  readonly id?: string;
  readonly userId?: string;
  readonly sub?: string;
};

type AuthenticatedRequest = Request & {
  readonly user?: RequestUser;
};

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationPushSubscriptionController {
  constructor(
    private readonly configService: ConfigService,
    private readonly pushSubscriptionService: PushSubscriptionService,
  ) {}

  @Get('push-subscriptions/public-key')
  @ApiOperation({
    summary: 'دریافت کلید عمومی Web Push',
    description:
      'کلید عمومی VAPID را برای ثبت Push Subscription در Frontend برمی‌گرداند.',
  })
  getPublicKey(): {
    publicKey: string | null;
    enabled: boolean;
  } {
    const enabled = this.getBooleanConfig('PUSH_ENABLED', false);

    const configuredPublicKey = this.configService
      .get<string>('VAPID_PUBLIC_KEY')
      ?.trim();

    return {
      publicKey: enabled && configuredPublicKey ? configuredPublicKey : null,
      enabled,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('push-subscriptions')
  @ApiOperation({
    summary: 'ثبت Push Subscription کاربر',
    description:
      'Subscription مرورگر یا موبایل را برای ارسال Push Notification ذخیره می‌کند.',
  })
  register(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterPushSubscriptionDto,
  ) {
    return this.pushSubscriptionService.register(this.getUserId(req), dto, {
      ipAddress: this.getIpAddress(req),
      userAgent: this.getUserAgent(req),
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('push-subscriptions')
  @ApiOperation({
    summary: 'دریافت Push Subscriptionهای کاربر فعلی',
    description:
      'لیست Subscriptionهای فعال کاربر احرازهویت‌شده را برمی‌گرداند.',
  })
  findMine(@Req() req: AuthenticatedRequest) {
    return this.pushSubscriptionService.findAllForUser(this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete('push-subscriptions')
  @ApiOperation({
    summary: 'حذف Push Subscription کاربر',
    description: 'Subscription مشخص‌شده را برای کاربر فعلی غیرفعال می‌کند.',
  })
  deleteMine(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.pushSubscriptionService.deleteForUser(this.getUserId(req), dto);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const user = req.user;

    const userId = user?.id ?? user?.userId ?? user?.sub;

    if (!userId) {
      throw new UnauthorizedException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private getIpAddress(req: Request): string | undefined {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      const ip = forwardedFor.split(',')[0]?.trim();

      return ip && ip.length > 0 ? ip : undefined;
    }

    if (Array.isArray(forwardedFor)) {
      const ip = forwardedFor[0]?.split(',')[0]?.trim();

      return ip && ip.length > 0 ? ip : undefined;
    }

    return req.ip;
  }

  private getUserAgent(req: Request): string | undefined {
    const userAgent = req.headers['user-agent'];

    if (typeof userAgent !== 'string') {
      return undefined;
    }

    const normalized = userAgent.trim();

    return normalized.length > 0 ? normalized : undefined;
  }

  private getBooleanConfig(key: string, fallback: boolean): boolean {
    const value = this.configService.get<string | boolean>(key);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }
}
