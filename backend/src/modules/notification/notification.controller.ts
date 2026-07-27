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

import { Request } from 'express';

import {
  AdminNotificationAiSmsDraftDto,
  AdminNotificationAiSmsSendDto,
} from './dto/admin-notification-ai.dto';

import { CreateNotificationDto } from './dto/create-notification.dto';

import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';

import { QueryNotificationDto } from './dto/query-notification.dto';

import { SendNotificationDto } from './dto/send-notification.dto';

import { AdminNotificationAiService } from './services/admin-notification-ai.service';

import { NotificationService } from './services/notification.service';

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

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly adminNotificationAiService: AdminNotificationAiService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('admin')
  createNotification(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateNotificationDto,
  ) {
    this.assertNotificationManager(req);

    return this.notificationService.createNotification(dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin/send')
  sendNotification(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendNotificationDto,
  ) {
    this.assertNotificationManager(req);

    return this.notificationService.sendNotification(dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin/ai/sms-draft')
  generateAiSmsDraft(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminNotificationAiSmsDraftDto,
  ) {
    this.assertNotificationManager(req);

    return this.adminNotificationAiService.generateSmsDraft(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin/ai/sms-send')
  sendAiSms(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminNotificationAiSmsSendDto,
  ) {
    this.assertNotificationManager(req);

    return this.adminNotificationAiService.sendApprovedSms(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin')
  findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryNotificationDto,
  ) {
    this.assertNotificationReader(req);

    return this.notificationService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/users/:userId/read-all')
  markAllReadForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    this.assertNotificationManager(req);

    return this.notificationService.markAllReadForAdmin(userId, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/:notificationId')
  findOneForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertNotificationReader(req);

    return this.notificationService.findOneForAdmin(
      notificationId,
      this.toBoolean(includeDeleted),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:notificationId/read')
  markReadForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
    @Body() dto: MarkNotificationReadDto,
  ) {
    this.assertNotificationManager(req);

    return this.notificationService.markReadForAdmin(notificationId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('admin/:notificationId')
  deleteForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    this.assertNotificationManager(req);

    return this.notificationService.deleteForAdmin(notificationId, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/unread-count')
  getMyUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUnreadCountForUser(this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('my/read-all')
  markAllMyNotificationsAsRead(@Req() req: AuthenticatedRequest) {
    const userId = this.getUserId(req);

    return this.notificationService.markAllReadForUser(userId, {
      actorId: userId,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  findMyNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.findAllForUser(this.getUserId(req), query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/:notificationId')
  findMyNotification(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationService.findOneForUser(
      this.getUserId(req),
      notificationId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('my/:notificationId/read')
  markMyNotificationAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
    @Body() dto: MarkNotificationReadDto,
  ) {
    const userId = this.getUserId(req);

    return this.notificationService.markReadForUser(
      userId,
      notificationId,
      dto,
      {
        actorId: userId,
      },
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('my/:notificationId')
  deleteMyNotification(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    const userId = this.getUserId(req);

    return this.notificationService.deleteForUser(userId, notificationId, {
      actorId: userId,
    });
  }

  private getAiPermissionContext(req: AuthenticatedRequest) {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return {
      userId: this.getUserId(req),
      role: role ?? undefined,
      permissions: req.user?.permissions ?? [],
    };
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertNotificationReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'notification:*',
        'notification:read',
        'notifications:*',
        'notifications:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مشاهده اعلان‌ها را ندارید.');
  }

  private assertNotificationManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'notification:*',
        'notification:manage',
        'notification:create',
        'notification:update',
        'notification:delete',
        'notifications:*',
        'notifications:manage',
        'notifications:create',
        'notifications:update',
        'notifications:delete',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مدیریت اعلان‌ها را ندارید.');
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

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
