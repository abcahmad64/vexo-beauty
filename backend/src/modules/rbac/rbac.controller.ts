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

import { AssignUserRoleDto } from './dto/assign-user-role.dto';

import { CreatePermissionDto } from './dto/create-permission.dto';

import { CreateRoleDto } from './dto/create-role.dto';

import { QueryPermissionDto } from './dto/query-permission.dto';

import { QueryRoleDto } from './dto/query-role.dto';

import { SyncRolePermissionsDto } from './dto/sync-role-permissions.dto';

import { UpdatePermissionDto } from './dto/update-permission.dto';

import { UpdateRoleDto } from './dto/update-role.dto';

import { RbacService } from './services/rbac.service';

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

@ApiTags('RBAC Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/rbac')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @ApiOperation({
    summary: 'دریافت لیست نقش‌ها',
  })
  findRoles(@Req() req: AuthenticatedRequest, @Query() query: QueryRoleDto) {
    this.assertRbacReader(req);

    return this.rbacService.findRoles(query);
  }

  @Post('roles')
  @ApiOperation({
    summary: 'ایجاد نقش',
  })
  createRole(@Req() req: AuthenticatedRequest, @Body() dto: CreateRoleDto) {
    this.assertRbacManager(req);

    return this.rbacService.createRole(dto, this.getUserId(req));
  }

  @Get('roles/:roleId')
  @ApiOperation({
    summary: 'دریافت جزئیات نقش',
  })
  findRole(@Req() req: AuthenticatedRequest, @Param('roleId') roleId: string) {
    this.assertRbacReader(req);

    return this.rbacService.findRole(roleId);
  }

  @Patch('roles/:roleId')
  @ApiOperation({
    summary: 'به‌روزرسانی نقش',
  })
  updateRole(
    @Req() req: AuthenticatedRequest,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.updateRole(roleId, dto, this.getUserId(req));
  }

  @Delete('roles/:roleId')
  @ApiOperation({
    summary: 'حذف نرم نقش',
  })
  deleteRole(
    @Req() req: AuthenticatedRequest,
    @Param('roleId') roleId: string,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.deleteRole(roleId, this.getUserId(req));
  }

  @Patch('roles/:roleId/restore')
  @ApiOperation({
    summary: 'بازگردانی نقش حذف‌شده',
  })
  restoreRole(
    @Req() req: AuthenticatedRequest,
    @Param('roleId') roleId: string,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.restoreRole(roleId, this.getUserId(req));
  }

  @Get('roles/:roleId/permissions')
  @ApiOperation({
    summary: 'دریافت مجوزهای نقش',
  })
  getRolePermissions(
    @Req() req: AuthenticatedRequest,
    @Param('roleId') roleId: string,
  ) {
    this.assertRbacReader(req);

    return this.rbacService.getRolePermissions(roleId);
  }

  @Patch('roles/:roleId/permissions')
  @ApiOperation({
    summary: 'همگام‌سازی مجوزهای نقش',
  })
  syncRolePermissions(
    @Req() req: AuthenticatedRequest,
    @Param('roleId') roleId: string,
    @Body() dto: SyncRolePermissionsDto,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.syncRolePermissions(
      roleId,
      dto,
      this.getUserId(req),
    );
  }

  @Get('roles/:roleId/has-permission/:permissionName')
  @ApiOperation({
    summary: 'بررسی دسترسی مؤثر نقش به یک مجوز',
  })
  roleHasPermission(
    @Req() req: AuthenticatedRequest,
    @Param('roleId') roleId: string,
    @Param('permissionName') permissionName: string,
  ) {
    this.assertRbacReader(req);

    return this.rbacService.roleHasPermission(roleId, permissionName);
  }

  @Get('permissions')
  @ApiOperation({
    summary: 'دریافت لیست مجوزها',
  })
  findPermissions(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryPermissionDto,
  ) {
    this.assertRbacReader(req);

    return this.rbacService.findPermissions(query);
  }

  @Post('permissions')
  @ApiOperation({
    summary: 'ایجاد مجوز',
  })
  createPermission(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePermissionDto,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.createPermission(dto, this.getUserId(req));
  }

  @Get('permissions/:permissionId')
  @ApiOperation({
    summary: 'دریافت جزئیات مجوز',
  })
  findPermission(
    @Req() req: AuthenticatedRequest,
    @Param('permissionId') permissionId: string,
  ) {
    this.assertRbacReader(req);

    return this.rbacService.findPermission(permissionId);
  }

  @Patch('permissions/:permissionId')
  @ApiOperation({
    summary: 'به‌روزرسانی مجوز',
  })
  updatePermission(
    @Req() req: AuthenticatedRequest,
    @Param('permissionId') permissionId: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.updatePermission(
      permissionId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete('permissions/:permissionId')
  @ApiOperation({
    summary: 'حذف نرم مجوز',
  })
  deletePermission(
    @Req() req: AuthenticatedRequest,
    @Param('permissionId') permissionId: string,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.deletePermission(permissionId, this.getUserId(req));
  }

  @Patch('permissions/:permissionId/restore')
  @ApiOperation({
    summary: 'بازگردانی مجوز حذف‌شده',
  })
  restorePermission(
    @Req() req: AuthenticatedRequest,
    @Param('permissionId') permissionId: string,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.restorePermission(
      permissionId,
      this.getUserId(req),
    );
  }

  @Get('matrix')
  @ApiOperation({
    summary: 'دریافت ماتریس نقش‌ها و مجوزها',
  })
  getPermissionMatrix(@Req() req: AuthenticatedRequest) {
    this.assertRbacReader(req);

    return this.rbacService.getPermissionMatrix();
  }

  @Patch('users/:userId/role')
  @ApiOperation({
    summary: 'اختصاص نقش به کاربر',
  })
  assignUserRole(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AssignUserRoleDto,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.assignUserRole(userId, dto, this.getUserId(req));
  }

  @Delete('users/:userId/role')
  @ApiOperation({
    summary: 'حذف نقش کاربر',
  })
  revokeUserRole(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    this.assertRbacManager(req);

    return this.rbacService.revokeUserRole(userId, this.getUserId(req));
  }

  @Get('users/:userId/access')
  @ApiOperation({
    summary: 'دریافت دسترسی‌های کاربر',
  })
  getUserAccess(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    this.assertRbacReader(req);

    return this.rbacService.getUserAccess(userId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertRbacReader(req: AuthenticatedRequest): void {
    if (this.hasSuperAdmin(req)) {
      return;
    }

    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'admin:manage',
        'rbac:*',
        'rbac:read',
        'rbac:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مدیریت نقش‌ها و دسترسی‌ها را ندارید.',
    );
  }

  private assertRbacManager(req: AuthenticatedRequest): void {
    if (this.hasSuperAdmin(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'rbac:*',
        'rbac:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مدیریت نقش‌ها و دسترسی‌ها را ندارید.',
    );
  }

  private hasSuperAdmin(req: AuthenticatedRequest): boolean {
    return this.getRoleName(req) === 'SUPER_ADMIN';
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    return this.getRoleName(req) === 'ADMIN';
  }

  private getRoleName(req: AuthenticatedRequest): string | null {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return role ? role.toUpperCase() : null;
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((requiredPermission) =>
      this.permissionMatches(userPermissions, requiredPermission),
    );
  }

  private permissionMatches(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    const required = requiredPermission.toLowerCase();

    return userPermissions.some((permission) => {
      const owned = permission.toLowerCase();

      if (owned === '*' || owned === 'admin:*') {
        return true;
      }

      if (owned === required) {
        return true;
      }

      if (owned.endsWith(':*')) {
        const prefix = owned.slice(0, -1);

        return required.startsWith(prefix);
      }

      return false;
    });
  }
}
