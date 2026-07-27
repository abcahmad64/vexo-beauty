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
  Res,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request, Response } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminAssignSupportDto } from './dto/admin-assign-support.dto';

import { AdminCreateSupportChatDto } from './dto/admin-create-support-chat.dto';

import { AdminCreateSupportTicketDto } from './dto/admin-create-support-ticket.dto';

import { AdminQuerySupportChatDto } from './dto/admin-query-support-chat.dto';

import { AdminQuerySupportTicketDto } from './dto/admin-query-support-ticket.dto';

import { AdminReplySupportTicketDto } from './dto/admin-reply-support-ticket.dto';

import { AdminSendSupportChatMessageDto } from './dto/admin-send-support-chat-message.dto';

import { AdminSupportExportQueryDto } from './dto/admin-support-export-query.dto';

import { AdminSupportNoteDto } from './dto/admin-support-note.dto';

import { AdminUpdateSupportChatStatusDto } from './dto/admin-update-support-chat-status.dto';

import { AdminUpdateSupportTicketDto } from './dto/admin-update-support-ticket.dto';

import { AdminUpdateSupportTicketStatusDto } from './dto/admin-update-support-ticket-status.dto';

import { AdminSupportExportService } from './services/admin-support-export.service';

import { AdminSupportService } from './services/admin-support.service';

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

@ApiTags('Support Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/support')
@UseGuards(JwtAuthGuard)
export class SupportAdminController {
  constructor(
    private readonly adminSupportService: AdminSupportService,
    private readonly adminSupportExportService: AdminSupportExportService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریت پشتیبانی',
  })
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertSupportReader(req);

    return this.adminSupportService.getDashboard();
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از پشتیبانی',
  })
  async exportSupport(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminSupportExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertSupportReader(req);

    const result = await this.adminSupportExportService.exportSupport(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Get('tickets')
  findTickets(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQuerySupportTicketDto,
  ) {
    this.assertSupportReader(req);

    return this.adminSupportService.findTickets(query);
  }

  @Post('tickets')
  createTicket(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateSupportTicketDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.createTicket(dto, this.getUserId(req));
  }

  @Get('tickets/:ticketId')
  findTicket(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSupportReader(req);

    return this.adminSupportService.findTicket(
      ticketId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('tickets/:ticketId')
  updateTicket(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: AdminUpdateSupportTicketDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.updateTicket(
      ticketId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('tickets/:ticketId/status')
  updateTicketStatus(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: AdminUpdateSupportTicketStatusDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.updateTicketStatus(
      ticketId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('tickets/:ticketId/assign')
  assignTicket(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: AdminAssignSupportDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.assignTicket(
      ticketId,
      dto,
      this.getUserId(req),
    );
  }

  @Post('tickets/:ticketId/replies')
  replyTicket(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: AdminReplySupportTicketDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.replyTicket(
      ticketId,
      dto,
      this.getUserId(req),
    );
  }

  @Post('tickets/:ticketId/notes')
  createTicketNote(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: AdminSupportNoteDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.createSupportNote(
      'ticket',
      ticketId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('tickets/:ticketId/restore')
  restoreTicket(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.restoreTicket(
      ticketId,
      this.getUserId(req),
    );
  }

  @Delete('tickets/:ticketId')
  deleteTicket(
    @Req() req: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.deleteTicket(ticketId, this.getUserId(req));
  }

  @Get('chats')
  findChats(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQuerySupportChatDto,
  ) {
    this.assertSupportReader(req);

    return this.adminSupportService.findChats(query);
  }

  @Post('chats')
  createChat(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateSupportChatDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.createChat(dto, this.getUserId(req));
  }

  @Get('chats/:conversationId')
  findChat(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSupportReader(req);

    return this.adminSupportService.findChat(
      conversationId,
      this.toBoolean(includeDeleted),
    );
  }

  @Post('chats/:conversationId/messages')
  sendChatMessage(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() dto: AdminSendSupportChatMessageDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.sendChatMessage(
      conversationId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('chats/:conversationId/status')
  updateChatStatus(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() dto: AdminUpdateSupportChatStatusDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.updateChatStatus(
      conversationId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('chats/:conversationId/assign')
  assignChat(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() dto: AdminAssignSupportDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.assignChat(
      conversationId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('chats/:conversationId/read')
  markChatRead(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.markChatRead(
      conversationId,
      this.getUserId(req),
    );
  }

  @Post('chats/:conversationId/notes')
  createChatNote(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() dto: AdminSupportNoteDto,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.createSupportNote(
      'chat',
      conversationId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('chats/:conversationId/restore')
  restoreChat(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.restoreChat(
      conversationId,
      this.getUserId(req),
    );
  }

  @Delete('chats/:conversationId')
  deleteChat(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    this.assertSupportManager(req);

    return this.adminSupportService.deleteChat(
      conversationId,
      this.getUserId(req),
    );
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertSupportReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'support:*',
        'support:read',
        'support:manage',
        'tickets:*',
        'tickets:read',
        'tickets:manage',
        'chat:*',
        'chat:read',
        'chat:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت پشتیبانی را ندارید.');
  }

  private assertSupportManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'support:*',
        'support:manage',
        'support:update',
        'tickets:*',
        'tickets:manage',
        'tickets:update',
        'chat:*',
        'chat:manage',
        'chat:update',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت پشتیبانی را ندارید.');
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
