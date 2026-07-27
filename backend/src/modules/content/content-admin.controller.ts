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

import {
  AdminContentAiArticleDraftDto,
  AdminContentAiArticlePublishDto,
} from './dto/admin-content-ai.dto';

import { AdminContentExportQueryDto } from './dto/admin-content-export-query.dto';

import { AdminContentNoteDto } from './dto/admin-content-note.dto';

import { AdminCreateCmsBlockDto } from './dto/admin-create-cms-block.dto';

import { AdminCreateCmsFaqDto } from './dto/admin-create-cms-faq.dto';

import { AdminCreateCmsPageDto } from './dto/admin-create-cms-page.dto';

import { AdminQueryContentDto } from './dto/admin-query-content.dto';

import { AdminUpdateCmsBlockDto } from './dto/admin-update-cms-block.dto';

import { AdminUpdateCmsFaqDto } from './dto/admin-update-cms-faq.dto';

import { AdminUpdateCmsPageDto } from './dto/admin-update-cms-page.dto';

import { AdminUpdateCmsStatusDto } from './dto/admin-update-cms-status.dto';

import { AdminContentAiService } from './services/admin-content-ai.service';

import { AdminContentExportService } from './services/admin-content-export.service';

import { AdminContentService } from './services/admin-content.service';

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

@ApiTags('Content Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/content')
@UseGuards(JwtAuthGuard)
export class ContentAdminController {
  constructor(
    private readonly adminContentService: AdminContentService,
    private readonly adminContentExportService: AdminContentExportService,
    private readonly adminContentAiService: AdminContentAiService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریت محتوا',
  })
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertContentReader(req);

    return this.adminContentService.getDashboard();
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از محتوای سایت',
  })
  async exportContent(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminContentExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertContentReader(req);

    const result = await this.adminContentExportService.exportContent(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post('ai/article-draft')
  @ApiOperation({
    summary: 'تولید پیش‌نویس محتوای سایت با هوش مصنوعی',
  })
  generateAiArticleDraft(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminContentAiArticleDraftDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentAiService.generateArticleDraft(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/article-publish')
  @ApiOperation({
    summary: 'انتشار محتوای تولیدشده با هوش مصنوعی پس از تأیید ادمین',
  })
  publishAiArticle(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminContentAiArticlePublishDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentAiService.publishArticle(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Get('pages')
  findPages(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryContentDto,
  ) {
    this.assertContentReader(req);

    return this.adminContentService.findPages(query);
  }

  @Post('pages')
  createPage(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateCmsPageDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.createPage(dto, this.getUserId(req));
  }

  @Get('pages/:pageId')
  findPage(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertContentReader(req);

    return this.adminContentService.findPage(
      pageId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('pages/:pageId')
  updatePage(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
    @Body() dto: AdminUpdateCmsPageDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.updatePage(
      pageId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('pages/:pageId/status')
  updatePageStatus(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
    @Body() dto: AdminUpdateCmsStatusDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.updatePageStatus(
      pageId,
      dto,
      this.getUserId(req),
    );
  }

  @Post('pages/:pageId/notes')
  createPageNote(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
    @Body() dto: AdminContentNoteDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.createNote(
      'page',
      pageId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('pages/:pageId/restore')
  restorePage(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.restorePage(pageId, this.getUserId(req));
  }

  @Delete('pages/:pageId')
  deletePage(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.deletePage(pageId, this.getUserId(req));
  }

  @Get('blocks')
  findBlocks(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryContentDto,
  ) {
    this.assertContentReader(req);

    return this.adminContentService.findBlocks(query);
  }

  @Post('blocks')
  createBlock(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateCmsBlockDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.createBlock(dto, this.getUserId(req));
  }

  @Get('blocks/:blockId')
  findBlock(
    @Req() req: AuthenticatedRequest,
    @Param('blockId') blockId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertContentReader(req);

    return this.adminContentService.findBlock(
      blockId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('blocks/:blockId')
  updateBlock(
    @Req() req: AuthenticatedRequest,
    @Param('blockId') blockId: string,
    @Body() dto: AdminUpdateCmsBlockDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.updateBlock(
      blockId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('blocks/:blockId/status')
  updateBlockStatus(
    @Req() req: AuthenticatedRequest,
    @Param('blockId') blockId: string,
    @Body() dto: AdminUpdateCmsStatusDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.updateBlockStatus(
      blockId,
      dto,
      this.getUserId(req),
    );
  }

  @Post('blocks/:blockId/notes')
  createBlockNote(
    @Req() req: AuthenticatedRequest,
    @Param('blockId') blockId: string,
    @Body() dto: AdminContentNoteDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.createNote(
      'block',
      blockId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('blocks/:blockId/restore')
  restoreBlock(
    @Req() req: AuthenticatedRequest,
    @Param('blockId') blockId: string,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.restoreBlock(blockId, this.getUserId(req));
  }

  @Delete('blocks/:blockId')
  deleteBlock(
    @Req() req: AuthenticatedRequest,
    @Param('blockId') blockId: string,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.deleteBlock(blockId, this.getUserId(req));
  }

  @Get('faqs')
  findFaqs(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryContentDto,
  ) {
    this.assertContentReader(req);

    return this.adminContentService.findFaqs(query);
  }

  @Post('faqs')
  createFaq(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateCmsFaqDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.createFaq(dto, this.getUserId(req));
  }

  @Get('faqs/:faqId')
  findFaq(
    @Req() req: AuthenticatedRequest,
    @Param('faqId') faqId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertContentReader(req);

    return this.adminContentService.findFaq(
      faqId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('faqs/:faqId')
  updateFaq(
    @Req() req: AuthenticatedRequest,
    @Param('faqId') faqId: string,
    @Body() dto: AdminUpdateCmsFaqDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.updateFaq(faqId, dto, this.getUserId(req));
  }

  @Patch('faqs/:faqId/status')
  updateFaqStatus(
    @Req() req: AuthenticatedRequest,
    @Param('faqId') faqId: string,
    @Body() dto: AdminUpdateCmsStatusDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.updateFaqStatus(
      faqId,
      dto,
      this.getUserId(req),
    );
  }

  @Post('faqs/:faqId/notes')
  createFaqNote(
    @Req() req: AuthenticatedRequest,
    @Param('faqId') faqId: string,
    @Body() dto: AdminContentNoteDto,
  ) {
    this.assertContentManager(req);

    return this.adminContentService.createNote(
      'faq',
      faqId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('faqs/:faqId/restore')
  restoreFaq(@Req() req: AuthenticatedRequest, @Param('faqId') faqId: string) {
    this.assertContentManager(req);

    return this.adminContentService.restoreFaq(faqId, this.getUserId(req));
  }

  @Delete('faqs/:faqId')
  deleteFaq(@Req() req: AuthenticatedRequest, @Param('faqId') faqId: string) {
    this.assertContentManager(req);

    return this.adminContentService.deleteFaq(faqId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private getAiPermissionContext(req: AuthenticatedRequest) {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return {
      userId: this.getUserId(req),
      role,
      roleName:
        req.user?.roleName ??
        (typeof req.user?.role === 'object'
          ? (req.user.role?.name ?? null)
          : role),
      permissions: req.user?.permissions ?? [],
    };
  }

  private assertContentReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'content:*',
        'content:read',
        'content:manage',
        'cms:*',
        'cms:read',
        'cms:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت محتوا را ندارید.');
  }

  private assertContentManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'content:*',
        'content:manage',
        'content:create',
        'content:update',
        'content:delete',
        'cms:*',
        'cms:manage',
        'cms:create',
        'cms:update',
        'cms:delete',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت محتوا را ندارید.');
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
