import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { QueryAnalyticsDto } from './dto/query-analytics.dto';

import { RecordEventDto } from './dto/record-event.dto';

import { RecordMetricDto } from './dto/record-metric.dto';

import { AnalyticsService } from './services/analytics.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?:
    | string
    | {
        name?: string | null;
      };
  roleName?: string | null;
  permissions?: string[];
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.getDashboard(query, this.getUserId(req));
  }

  @Get('sales')
  getSalesReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.getSalesReport(query, this.getUserId(req));
  }

  @Get('orders')
  getOrderReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.getOrderReport(query, this.getUserId(req));
  }

  @Get('payments')
  getPaymentReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.getPaymentReport(query, this.getUserId(req));
  }

  @Get('top-products')
  getTopProducts(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.getTopProducts(query, this.getUserId(req));
  }

  @Get('products')
  getProductPerformance(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.getProductPerformance(query);
  }

  @Get('customers')
  getCustomerReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.getCustomerReport(query);
  }

  @Get('events')
  findEvents(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.findEvents(query);
  }

  @Get('metrics')
  findMetrics(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAnalyticsDto,
  ): Promise<unknown> {
    this.assertAnalyticsReader(req);

    return this.analyticsService.findMetrics(query);
  }

  @Post('events')
  recordEvent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RecordEventDto,
  ): Promise<unknown> {
    this.assertAnalyticsManager(req);

    return this.analyticsService.recordEvent(dto, this.getUserId(req));
  }

  @Post('metrics')
  recordMetric(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RecordMetricDto,
  ): Promise<unknown> {
    this.assertAnalyticsManager(req);

    return this.analyticsService.recordMetric(dto, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertAnalyticsReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'analytics:*',
        'analytics:read',
        'reports:*',
        'reports:read',
        'admin:*',
        'admin:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده گزارش‌های تحلیلی را ندارید.');
  }

  private assertAnalyticsManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'analytics:*',
        'analytics:manage',
        'analytics:create',
        'reports:*',
        'reports:manage',
        'admin:*',
        'admin:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت گزارش‌های تحلیلی را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }
}
