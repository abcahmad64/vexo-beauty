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

import { AdminQuerySearchLogDto } from './dto/admin-query-search-log.dto';

import { AdminRunSearchIndexDto } from './dto/admin-run-search-index.dto';

import {
  AdminCreateSearchBoostRuleDto,
  AdminUpdateSearchBoostRuleDto,
} from './dto/admin-search-boost-rule.dto';

import { AdminSearchExportQueryDto } from './dto/admin-search-export-query.dto';

import { AdminSearchNoteDto } from './dto/admin-search-note.dto';

import {
  AdminCreateSearchRedirectDto,
  AdminUpdateSearchRedirectDto,
} from './dto/admin-search-redirect.dto';

import {
  AdminCreateSearchSynonymDto,
  AdminUpdateSearchSynonymDto,
} from './dto/admin-search-synonym.dto';

import { AdminSearchTestDto } from './dto/admin-search-test.dto';

import { AdminSearchExportService } from './services/admin-search-export.service';

import { AdminSearchService } from './services/admin-search.service';

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

@ApiTags('Search Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/search')
@UseGuards(JwtAuthGuard)
export class SearchAdminController {
  constructor(
    private readonly adminSearchService: AdminSearchService,
    private readonly adminSearchExportService: AdminSearchExportService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریت جست‌وجو',
  })
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertSearchReader(req);

    return this.adminSearchService.getDashboard();
  }

  @Post('test')
  @ApiOperation({
    summary: 'تست مدیریتی جست‌وجو',
  })
  testSearch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminSearchTestDto,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.testSearch(dto, this.getOptionalUserId(req));
  }

  @Get('logs')
  findLogs(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQuerySearchLogDto,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findLogs(query);
  }

  @Get('export')
  async exportSearch(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminSearchExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertSearchReader(req);

    const result = await this.adminSearchExportService.exportSearch(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Get('synonyms')
  findSynonyms(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminSearchExportQueryDto,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findSynonyms(query);
  }

  @Post('synonyms')
  createSynonym(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateSearchSynonymDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.createSynonym(dto, this.getUserId(req));
  }

  @Get('synonyms/:synonymId')
  findSynonym(
    @Req() req: AuthenticatedRequest,
    @Param('synonymId') synonymId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findSynonym(
      synonymId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('synonyms/:synonymId')
  updateSynonym(
    @Req() req: AuthenticatedRequest,
    @Param('synonymId') synonymId: string,
    @Body() dto: AdminUpdateSearchSynonymDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.updateSynonym(
      synonymId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('synonyms/:synonymId/restore')
  restoreSynonym(
    @Req() req: AuthenticatedRequest,
    @Param('synonymId') synonymId: string,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.restoreSynonym(
      synonymId,
      this.getUserId(req),
    );
  }

  @Delete('synonyms/:synonymId')
  deleteSynonym(
    @Req() req: AuthenticatedRequest,
    @Param('synonymId') synonymId: string,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.deleteSynonym(
      synonymId,
      this.getUserId(req),
    );
  }

  @Get('redirects')
  findRedirects(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminSearchExportQueryDto,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findRedirects(query);
  }

  @Post('redirects')
  createRedirect(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateSearchRedirectDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.createRedirect(dto, this.getUserId(req));
  }

  @Get('redirects/:redirectId')
  findRedirect(
    @Req() req: AuthenticatedRequest,
    @Param('redirectId') redirectId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findRedirect(
      redirectId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('redirects/:redirectId')
  updateRedirect(
    @Req() req: AuthenticatedRequest,
    @Param('redirectId') redirectId: string,
    @Body() dto: AdminUpdateSearchRedirectDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.updateRedirect(
      redirectId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('redirects/:redirectId/restore')
  restoreRedirect(
    @Req() req: AuthenticatedRequest,
    @Param('redirectId') redirectId: string,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.restoreRedirect(
      redirectId,
      this.getUserId(req),
    );
  }

  @Delete('redirects/:redirectId')
  deleteRedirect(
    @Req() req: AuthenticatedRequest,
    @Param('redirectId') redirectId: string,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.deleteRedirect(
      redirectId,
      this.getUserId(req),
    );
  }

  @Get('boost-rules')
  findBoostRules(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminSearchExportQueryDto,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findBoostRules(query);
  }

  @Post('boost-rules')
  createBoostRule(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateSearchBoostRuleDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.createBoostRule(dto, this.getUserId(req));
  }

  @Get('boost-rules/:boostId')
  findBoostRule(
    @Req() req: AuthenticatedRequest,
    @Param('boostId') boostId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findBoostRule(
      boostId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('boost-rules/:boostId')
  updateBoostRule(
    @Req() req: AuthenticatedRequest,
    @Param('boostId') boostId: string,
    @Body() dto: AdminUpdateSearchBoostRuleDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.updateBoostRule(
      boostId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('boost-rules/:boostId/restore')
  restoreBoostRule(
    @Req() req: AuthenticatedRequest,
    @Param('boostId') boostId: string,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.restoreBoostRule(
      boostId,
      this.getUserId(req),
    );
  }

  @Delete('boost-rules/:boostId')
  deleteBoostRule(
    @Req() req: AuthenticatedRequest,
    @Param('boostId') boostId: string,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.deleteBoostRule(
      boostId,
      this.getUserId(req),
    );
  }

  @Post('index/run')
  runIndex(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminRunSearchIndexDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.runIndex(dto, this.getUserId(req));
  }

  @Get('index/snapshots')
  findIndexSnapshots(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminSearchExportQueryDto,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findIndexSnapshots(query);
  }

  @Get('index/snapshots/:snapshotId')
  findIndexSnapshot(
    @Req() req: AuthenticatedRequest,
    @Param('snapshotId') snapshotId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSearchReader(req);

    return this.adminSearchService.findIndexSnapshot(
      snapshotId,
      this.toBoolean(includeDeleted),
    );
  }

  @Get('notes/:entityKey')
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('entityKey') entityKey: string,
    @Query('limit') limit?: string,
  ) {
    this.assertSearchReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminSearchService.getNotes(
      entityKey,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post('notes/:entityKey')
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('entityKey') entityKey: string,
    @Body() dto: AdminSearchNoteDto,
  ) {
    this.assertSearchManager(req);

    return this.adminSearchService.createNote(
      entityKey,
      dto,
      this.getUserId(req),
    );
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = this.getOptionalUserId(req);

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private getOptionalUserId(req: AuthenticatedRequest): string | undefined {
    return req.user?.id ?? req.user?.userId ?? req.user?.sub;
  }

  private assertSearchReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'search:*',
        'search:read',
        'search:manage',
        'catalog:read',
        'analytics:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت جست‌وجو را ندارید.');
  }

  private assertSearchManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'search:*',
        'search:manage',
        'search:update',
        'search:index',
        'catalog:manage',
        'analytics:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت جست‌وجو را ندارید.');
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
