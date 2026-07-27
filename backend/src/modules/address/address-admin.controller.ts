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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminCreateAddressDto } from './dto/admin-create-address.dto';
import { AdminQueryAddressDto } from './dto/admin-query-address.dto';
import { AdminUpdateAddressDto } from './dto/admin-update-address.dto';
import { AdminAddressService } from './services/admin-address.service';

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

@ApiTags('Address Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/addresses')
@UseGuards(JwtAuthGuard)
export class AddressAdminController {
  constructor(private readonly adminAddressService: AdminAddressService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی آدرس‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryAddressDto,
  ): Promise<unknown> {
    this.assertAddressReader(req);

    return this.adminAddressService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد آدرس برای کاربر توسط ادمین',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAddressDto,
  ): Promise<unknown> {
    this.assertAddressManager(req);

    return this.adminAddressService.create(dto, this.getUserId(req));
  }

  @Get(':addressId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی آدرس',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    this.assertAddressReader(req);

    return this.adminAddressService.findOne(addressId);
  }

  @Patch(':addressId')
  @ApiOperation({
    summary: 'به‌روزرسانی آدرس توسط ادمین',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
    @Body() dto: AdminUpdateAddressDto,
  ): Promise<unknown> {
    this.assertAddressManager(req);

    return this.adminAddressService.update(addressId, dto, this.getUserId(req));
  }

  @Patch(':addressId/default')
  @ApiOperation({
    summary: 'انتخاب آدرس پیش‌فرض کاربر',
  })
  setDefault(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    this.assertAddressManager(req);

    return this.adminAddressService.setDefault(addressId, this.getUserId(req));
  }

  @Patch(':addressId/unset-default')
  @ApiOperation({
    summary: 'خارج کردن آدرس از حالت پیش‌فرض',
  })
  unsetDefault(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    this.assertAddressManager(req);

    return this.adminAddressService.unsetDefault(
      addressId,
      this.getUserId(req),
    );
  }

  @Delete(':addressId')
  @ApiOperation({
    summary: 'حذف نرم آدرس',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    this.assertAddressManager(req);

    return this.adminAddressService.delete(addressId, this.getUserId(req));
  }

  @Patch(':addressId/restore')
  @ApiOperation({
    summary: 'بازگردانی آدرس حذف‌شده',
  })
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    this.assertAddressManager(req);

    return this.adminAddressService.restore(addressId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertAddressReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'address:*',
        'address:read',
        'addresses:*',
        'addresses:read',
        'customer:*',
        'customer:read',
        'customers:*',
        'customers:read',
        'user:*',
        'user:read',
        'users:*',
        'users:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت آدرس‌ها را ندارید.');
  }

  private assertAddressManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'address:*',
        'address:manage',
        'addresses:*',
        'addresses:manage',
        'customer:*',
        'customer:manage',
        'customers:*',
        'customers:manage',
        'user:*',
        'user:manage',
        'users:*',
        'users:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت آدرس‌ها را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      req.user?.roleName ??
      (typeof req.user?.role === 'string'
        ? req.user.role
        : req.user?.role?.name) ??
      null;

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
