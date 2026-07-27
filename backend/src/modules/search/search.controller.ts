import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { SearchQueryDto } from './dto/search-query.dto';

import { SearchSuggestionQueryDto } from './dto/search-suggestion-query.dto';

import { PersianSearchService } from './services/persian-search.service';

import { SearchService } from './services/search.service';

import { SearchSuggestionService } from './services/search-suggestion.service';

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

@Controller()
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly persianSearchService: PersianSearchService,
    private readonly suggestionService: SearchSuggestionService,
  ) {}

  @RateLimit('search')
  @Get('search/products')
  searchProducts(
    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    return this.searchService.searchProducts(query, {
      admin: false,
    });
  }

  @RateLimit('search')
  @Get('search/products/fa')
  searchPersianProducts(
    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    return this.persianSearchService.searchProducts(query);
  }

  @RateLimit('search')
  @Get('search/categories')
  searchCategories(
    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    return this.searchService.searchCategories(query, {
      admin: false,
    });
  }

  @RateLimit('search')
  @Get('search/brands')
  searchBrands(
    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    return this.searchService.searchBrands(query, {
      admin: false,
    });
  }

  @RateLimit('search')
  @Get('search/global')
  globalSearch(
    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    return this.searchService.globalSearch(query, {
      admin: false,
    });
  }

  @RateLimit('search')
  @Get('search/suggestions')
  suggestions(
    @Query()
    query: SearchSuggestionQueryDto,
  ): Promise<unknown> {
    return this.suggestionService.suggest(query);
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Get('admin/search/products')
  searchProductsForAdmin(
    @Req()
    req: AuthenticatedRequest,

    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    this.assertSearchReader(req);

    return this.searchService.searchProducts(query, {
      admin: true,
      actorId: this.getUserId(req),
    });
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Get('admin/search/categories')
  searchCategoriesForAdmin(
    @Req()
    req: AuthenticatedRequest,

    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    this.assertSearchReader(req);

    return this.searchService.searchCategories(query, {
      admin: true,
      actorId: this.getUserId(req),
    });
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Get('admin/search/brands')
  searchBrandsForAdmin(
    @Req()
    req: AuthenticatedRequest,

    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    this.assertSearchReader(req);

    return this.searchService.searchBrands(query, {
      admin: true,
      actorId: this.getUserId(req),
    });
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Get('admin/search/global')
  globalSearchForAdmin(
    @Req()
    req: AuthenticatedRequest,

    @Query()
    query: SearchQueryDto,
  ): Promise<unknown> {
    this.assertSearchReader(req);

    return this.searchService.globalSearch(query, {
      admin: true,
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

  private assertSearchReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'search:*',
        'search:read',
        'catalog:*',
        'catalog:read',
        'products:*',
        'products:read',
        'admin:*',
        'admin:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز استفاده از جست‌وجوی مدیریتی را ندارید.',
    );
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
}
