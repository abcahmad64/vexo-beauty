import {
  Body,
  Controller,
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

import { CatalogWebResearchService } from '../ai/services/catalog-web-research.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  AdminAddCatalogResearchSourceDto,
  AdminApproveCatalogSuggestionDto,
  AdminBulkCatalogSuggestionReviewDto,
  AdminCatalogResearchRunQueryDto,
  AdminCatalogSuggestionQueryDto,
  AdminRejectCatalogSuggestionDto,
} from './dto/admin-catalog-intelligence.dto';

import { AdminCatalogIntelligenceReviewService } from './services/admin-catalog-intelligence-review.service';

import { CatalogIntelligenceEnqueueService } from './services/catalog-intelligence-enqueue.service';

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

@ApiTags('Product Catalog Intelligence Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/products/:productId/intelligence')
@UseGuards(JwtAuthGuard)
export class ProductIntelligenceAdminController {
  constructor(
    private readonly reviewService: AdminCatalogIntelligenceReviewService,
    private readonly enqueueService: CatalogIntelligenceEnqueueService,
    private readonly webResearchService: CatalogWebResearchService,
  ) {}

  @Post('runs')
  @ApiOperation({
    summary: 'شروع دستی تحقیق کاتالوگ محصول',
  })
  startManualResearch(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    this.assertManager(req);

    return this.enqueueService.enqueueManualResearch(
      productId,
      this.getUserId(req),
    );
  }

  @Get('runs')
  @ApiOperation({
    summary: 'دریافت اجراهای تحقیق کاتالوگ محصول',
  })
  listRuns(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Query() query: AdminCatalogResearchRunQueryDto,
  ) {
    this.assertReader(req);

    return this.reviewService.listRuns(productId, query);
  }

  @Get('runs/:researchRunId')
  @ApiOperation({
    summary: 'دریافت جزئیات اجرای تحقیق کاتالوگ',
  })
  getRun(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('researchRunId') researchRunId: string,
  ) {
    this.assertReader(req);

    return this.reviewService.getRun(productId, researchRunId);
  }

  @Post('runs/:researchRunId/sources')
  @ApiOperation({
    summary: 'افزودن و تحلیل منبع دقیق برای پرونده تحقیق محصول',
  })
  addResearchSource(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('researchRunId') researchRunId: string,
    @Body() dto: AdminAddCatalogResearchSourceDto,
  ) {
    this.assertManager(req);

    return this.webResearchService.researchManualSource({
      productId,
      researchRunId,
      sourceUrl: dto.sourceUrl,
      sourceType: dto.sourceType,
      isOfficial: dto.isOfficial === true,
      requestedById: this.getUserId(req),
    });
  }

  @Get('runs/:researchRunId/suggestions')
  @ApiOperation({
    summary: 'دریافت پیشنهادهای تحقیق برای بررسی ادمین',
  })
  listSuggestions(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('researchRunId') researchRunId: string,
    @Query() query: AdminCatalogSuggestionQueryDto,
  ) {
    this.assertReader(req);

    return this.reviewService.listSuggestions(productId, researchRunId, query);
  }

  @Patch('runs/:researchRunId/suggestions/bulk-review')
  @ApiOperation({
    summary: 'تأیید یا رد گروهی پیشنهادهای انتخاب‌شده تحقیق',
  })
  bulkReviewSuggestions(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('researchRunId') researchRunId: string,
    @Body() dto: AdminBulkCatalogSuggestionReviewDto,
  ) {
    this.assertManager(req);

    return this.reviewService.bulkReviewSuggestions(
      productId,
      researchRunId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('runs/:researchRunId/suggestions/:suggestionId/approve')
  @ApiOperation({
    summary: 'تأیید و نسخه‌بندی دانش پیشنهادی',
  })
  approveSuggestion(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('researchRunId') researchRunId: string,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: AdminApproveCatalogSuggestionDto,
  ) {
    this.assertManager(req);

    return this.reviewService.approveSuggestion(
      productId,
      researchRunId,
      suggestionId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('runs/:researchRunId/suggestions/:suggestionId/reject')
  @ApiOperation({
    summary: 'رد پیشنهاد تحقیق کاتالوگ',
  })
  rejectSuggestion(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('researchRunId') researchRunId: string,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: AdminRejectCatalogSuggestionDto,
  ) {
    this.assertManager(req);

    return this.reviewService.rejectSuggestion(
      productId,
      researchRunId,
      suggestionId,
      dto,
      this.getUserId(req),
    );
  }

  @Get('approved-knowledge')
  @ApiOperation({
    summary: 'دریافت دانش جاری تأییدشده محصول',
  })
  listApprovedKnowledge(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    this.assertReader(req);

    return this.reviewService.listApprovedKnowledge(productId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'product:*',
        'product:read',
        'products:*',
        'products:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده هوشمندی کاتالوگ را ندارید.');
  }

  private assertManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'product:*',
        'product:manage',
        'products:*',
        'products:manage',
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز بررسی هوشمندی کاتالوگ را ندارید.');
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
}
