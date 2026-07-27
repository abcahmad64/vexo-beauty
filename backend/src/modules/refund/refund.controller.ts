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
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type { Request } from 'express';

import { ApproveRefundDto } from './dto/approve-refund.dto';

import { CreateRefundDto } from './dto/create-refund.dto';

import { ProcessRefundDto } from './dto/process-refund.dto';

import { QueryRefundDto } from './dto/query-refund.dto';

import { RefundSummaryQueryDto } from './dto/refund-summary-query.dto';

import { RejectRefundDto } from './dto/reject-refund.dto';

import { RequestRefundDto } from './dto/request-refund.dto';

import { UpdateRefundDto } from './dto/update-refund.dto';

import { RefundDecisionService } from './services/refund-decision.service';

import { RefundRequestService } from './services/refund-request.service';

import { RefundService } from './services/refund.service';

import { RefundSummaryService } from './services/refund-summary.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?: string;
  roleName?: string;
  permissions?: string[];
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@Controller('refunds')
export class RefundController {
  constructor(
    private readonly refundService: RefundService,
    private readonly refundRequestService: RefundRequestService,
    private readonly refundDecisionService: RefundDecisionService,
    private readonly refundSummaryService: RefundSummaryService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('my')
  requestMyRefund(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestRefundDto,
  ) {
    return this.refundRequestService.requestForUser(this.getUserId(req), dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/summary')
  getMyRefundSummary(
    @Req() req: AuthenticatedRequest,
    @Query() query: RefundSummaryQueryDto,
  ) {
    return this.refundSummaryService.getUserSummary(this.getUserId(req), query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  findMyRefunds(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryRefundDto,
  ) {
    return this.refundService.findAllForUser(this.getUserId(req), query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/:refundId')
  findMyRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
  ) {
    return this.refundService.findOneForUser(this.getUserId(req), refundId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin')
  createRefund(@Req() req: AuthenticatedRequest, @Body() dto: CreateRefundDto) {
    this.assertRefundManager(req);

    return this.refundService.createRefund(dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/summary')
  getAdminRefundSummary(
    @Req() req: AuthenticatedRequest,
    @Query() query: RefundSummaryQueryDto,
  ) {
    this.assertRefundReader(req);

    return this.refundSummaryService.getAdminSummary(query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin')
  findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryRefundDto,
  ) {
    this.assertRefundReader(req);

    return this.refundService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/:refundId')
  findOneForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertRefundReader(req);

    return this.refundService.findOneForAdmin(
      refundId,
      this.toBoolean(includeDeleted),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:refundId')
  updateRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: UpdateRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundService.updateRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:refundId/approve')
  approveRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: ApproveRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundDecisionService.approveRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:refundId/reject')
  rejectRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: RejectRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundDecisionService.rejectRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:refundId/process')
  processRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: ProcessRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundService.processRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:refundId/complete')
  completeRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: Partial<ProcessRefundDto>,
  ) {
    this.assertRefundManager(req);

    return this.refundService.completeRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:refundId/fail')
  failRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: Partial<ProcessRefundDto>,
  ) {
    this.assertRefundManager(req);

    return this.refundService.failRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('admin/:refundId')
  deleteRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
  ) {
    this.assertRefundManager(req);

    return this.refundService.deleteRefund(refundId, {
      actorId: this.getUserId(req),
    });
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertRefundReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'refund:*',
        'refund:read',
        'refunds:*',
        'refunds:read',
        'payment:*',
        'payment:read',
        'payments:*',
        'payments:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مشاهده بازگشت وجه‌ها را ندارید.');
  }

  private assertRefundManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'refund:*',
        'refund:manage',
        'refund:create',
        'refund:update',
        'refund:delete',
        'refunds:*',
        'refunds:manage',
        'refunds:create',
        'refunds:update',
        'refunds:delete',
        'payment:*',
        'payment:manage',
        'payments:*',
        'payments:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مدیریت بازگشت وجه‌ها را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role = req.user?.roleName ?? req.user?.role;

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

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
