import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { Request } from 'express';

import { CreatePaymentDto } from './dto/create-payment.dto';

import { FailPaymentDto } from './dto/fail-payment.dto';

import { MarkPaymentRefundedDto } from './dto/mark-payment-refunded.dto';

import { QueryPaymentDto } from './dto/query-payment.dto';

import { UpdatePaymentDto } from './dto/update-payment.dto';

import { VerifyPaymentDto } from './dto/verify-payment.dto';

import { PaymentService } from './services/payment.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    role?:
      | string
      | {
          name?: string;
        };
    roleName?: string;
    permissions?: string[];
  };
};

@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  createForUser(@Req() req: AuthenticatedRequest): never {
    this.getUserId(req);

    throw new ForbiddenException('پرداخت باید از مسیر امن درگاه آغاز شود.');
  }

  @Get('my')
  findMyPayments(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryPaymentDto,
  ) {
    return this.paymentService.findAllForUser(this.getUserId(req), query);
  }

  @Get('my/:paymentId')
  findMyPayment(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentService.findOneForUser(this.getUserId(req), paymentId);
  }

  @Patch('my/:paymentId/complete')
  completeMyPayment(@Req() req: AuthenticatedRequest): never {
    this.getUserId(req);

    throw new ForbiddenException(
      'تأیید پرداخت فقط از طریق بازگشت امن درگاه انجام می‌شود.',
    );
  }

  @Patch('my/:paymentId/fail')
  failMyPayment(@Req() req: AuthenticatedRequest): never {
    this.getUserId(req);

    throw new ForbiddenException(
      'وضعیت پرداخت مشتری فقط توسط سامانه تغییر می‌کند.',
    );
  }

  @Post('admin')
  createForAdmin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentDto,
  ) {
    this.assertPaymentManager(req);

    return this.paymentService.createForAdmin(dto, this.getUserId(req));
  }

  @Get('admin')
  findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryPaymentDto,
  ) {
    this.assertPaymentReader(req);

    return this.paymentService.findAllForAdmin(query);
  }

  @Get('admin/:paymentId')
  findOneForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    this.assertPaymentReader(req);

    return this.paymentService.findOneForAdmin(paymentId);
  }

  @Patch('admin/:paymentId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    this.assertPaymentManager(req);

    return this.paymentService.update(paymentId, dto, this.getUserId(req));
  }

  @Patch('admin/:paymentId/complete')
  complete(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    this.assertPaymentManager(req);

    return this.paymentService.complete(paymentId, dto, this.getUserId(req));
  }

  @Patch('admin/:paymentId/fail')
  fail(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
    @Body() dto: FailPaymentDto,
  ) {
    this.assertPaymentManager(req);

    return this.paymentService.fail(paymentId, dto, this.getUserId(req));
  }

  @Patch('admin/:paymentId/refunded')
  markRefunded(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
    @Body() dto: MarkPaymentRefundedDto,
  ) {
    this.assertPaymentManager(req);

    return this.paymentService.markRefunded(
      paymentId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('admin/orders/:orderId/sync')
  syncOrderPaymentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    this.assertPaymentManager(req);

    return this.paymentService.syncOrderPaymentStatus(
      orderId,
      this.getUserId(req),
    );
  }

  @Delete('admin/:paymentId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    this.assertPaymentManager(req);

    return this.paymentService.remove(paymentId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'برای انجام این عملیات باید وارد حساب کاربری شوید.',
      );
    }

    return userId;
  }

  private assertPaymentReader(req: AuthenticatedRequest): void {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    const permissions = new Set(req.user?.permissions ?? []);

    const allowed =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      permissions.has('payment:read') ||
      permissions.has('payment:manage') ||
      permissions.has('payments:read') ||
      permissions.has('payments:manage') ||
      permissions.has('finance:read') ||
      permissions.has('finance:manage');

    if (!allowed) {
      throw new ForbiddenException('شما اجازه دسترسی به پرداخت‌ها را ندارید.');
    }
  }

  private assertPaymentManager(req: AuthenticatedRequest): void {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    const permissions = new Set(req.user?.permissions ?? []);

    const allowed =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      permissions.has('payment:manage') ||
      permissions.has('payments:manage') ||
      permissions.has('finance:manage');

    if (!allowed) {
      throw new ForbiddenException('شما اجازه مدیریت پرداخت‌ها را ندارید.');
    }
  }
}
