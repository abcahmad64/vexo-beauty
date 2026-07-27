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

import { AuthGuard } from '@nestjs/passport';

import { Request } from 'express';

import {
  AnyPermissions,
  Permissions,
} from '../rbac/decorators/permissions.decorator';

import { RbacGuard } from '../rbac/guards/rbac.guard';

import { CategoryService } from './services/category.service';

import { CreateCategoryDto } from './dto/create-category.dto';

import { QueryCategoryDto } from './dto/query-category.dto';

import { UpdateCategoryDto } from './dto/update-category.dto';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Post('admin')
  @Permissions('catalog:manage')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ): unknown {
    return this.categoryService.create(dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin')
  @AnyPermissions('catalog:read', 'catalog:manage', 'products:manage')
  findAllForAdmin(@Query() query: QueryCategoryDto): unknown {
    return this.categoryService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/tree')
  @AnyPermissions('catalog:read', 'catalog:manage', 'products:manage')
  findTreeForAdmin(@Query() query: QueryCategoryDto): unknown {
    return this.categoryService.findAllForAdmin({
      ...query,
      tree: true,
    });
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/slug/:slug')
  @AnyPermissions('catalog:read', 'catalog:manage', 'products:manage')
  findBySlugForAdmin(
    @Param('slug') slug: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    return this.categoryService.findBySlugForAdmin(
      slug,
      includeDeleted === 'true',
    );
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/:categoryId')
  @AnyPermissions('catalog:read', 'catalog:manage', 'products:manage')
  findOneForAdmin(
    @Param('categoryId') categoryId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    return this.categoryService.findOneForAdmin(
      categoryId,
      includeDeleted === 'true',
    );
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:categoryId')
  @Permissions('catalog:manage')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ): unknown {
    return this.categoryService.update(categoryId, dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:categoryId/activate')
  @Permissions('catalog:manage')
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    return this.categoryService.activate(categoryId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:categoryId/deactivate')
  @Permissions('catalog:manage')
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    return this.categoryService.deactivate(categoryId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:categoryId/restore')
  @Permissions('catalog:manage')
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    return this.categoryService.restore(categoryId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Delete('admin/:categoryId')
  @Permissions('catalog:manage')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    return this.categoryService.remove(categoryId, this.getUserId(req));
  }

  @Get()
  findAllPublic(@Query() query: QueryCategoryDto): unknown {
    return this.categoryService.findAllPublic(query);
  }

  @Get('tree')
  findTreePublic(@Query() query: QueryCategoryDto): unknown {
    return this.categoryService.findAllPublic({
      ...query,
      tree: true,
    });
  }

  @Get('slug/:slug')
  findBySlugPublic(@Param('slug') slug: string): unknown {
    return this.categoryService.findBySlugPublic(slug);
  }

  @Get(':categoryId')
  findOnePublic(@Param('categoryId') categoryId: string): unknown {
    return this.categoryService.findOnePublic(categoryId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
