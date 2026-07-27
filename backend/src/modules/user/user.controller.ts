import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AnyPermissions,
  Permissions,
} from '../rbac/decorators/permissions.decorator';
import { RbacGuard } from '../rbac/guards/rbac.guard';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './services/user.service';

type AuthenticatedRequest = Request & {
  readonly user?: {
    readonly id?: string;
    readonly userId?: string;
    readonly sub?: string;
  };
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.userService.findProfile(this.getUserId(req));
  }

  @Patch('me')
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.userService.updateProfile(userId, dto, userId);
  }

  @Patch('me/password')
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.userService.changePassword(userId, dto, userId);
  }

  @Get('admin')
  @UseGuards(RbacGuard)
  @AnyPermissions('users:read', 'users:manage', 'admin:manage')
  findAll(@Query() query: QueryUserDto): Promise<unknown> {
    return this.userService.findAll(query);
  }

  @Post('admin')
  @UseGuards(RbacGuard)
  @Permissions('users:manage')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateUserDto,
  ): Promise<unknown> {
    return this.userService.create(dto, this.getUserId(req));
  }

  @Get('admin/:userId')
  @UseGuards(RbacGuard)
  @AnyPermissions('users:read', 'users:manage', 'admin:manage')
  findOne(@Param('userId') userId: string): Promise<unknown> {
    return this.userService.findOneForAdmin(userId);
  }

  @Patch('admin/:userId')
  @UseGuards(RbacGuard)
  @Permissions('users:manage')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<unknown> {
    return this.userService.updateUser(userId, dto, this.getUserId(req));
  }

  @Patch('admin/:userId/status')
  @UseGuards(RbacGuard)
  @Permissions('users:manage')
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<unknown> {
    return this.userService.updateStatus(userId, dto, this.getUserId(req));
  }

  @Patch('admin/:userId/password')
  @UseGuards(RbacGuard)
  @Permissions('users:manage')
  adminResetPassword(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AdminResetPasswordDto,
  ): Promise<unknown> {
    return this.userService.adminResetPassword(
      userId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('admin/:userId/revoke-sessions')
  @UseGuards(RbacGuard)
  @Permissions('users:manage')
  revokeSessions(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    return this.userService.revokeSessions(userId, this.getUserId(req));
  }

  @Get('admin/:userId/summary')
  @UseGuards(RbacGuard)
  @AnyPermissions('users:read', 'users:manage', 'admin:manage')
  getUserSummary(@Param('userId') userId: string): Promise<unknown> {
    return this.userService.getUserSummary(userId);
  }

  @Patch('admin/:userId/restore')
  @UseGuards(RbacGuard)
  @Permissions('users:manage')
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    return this.userService.restore(userId, this.getUserId(req));
  }

  @Delete('admin/:userId')
  @UseGuards(RbacGuard)
  @Permissions('users:manage')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    return this.userService.remove(userId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
