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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateReviewDto } from './dto/create-review.dto';

import { QueryReviewDto } from './dto/query-review.dto';

import { UpdateReviewDto } from './dto/update-review.dto';

import { VerifyReviewDto } from './dto/verify-review.dto';

import { ReviewService } from './services/review.service';

type OptionalAuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    role?:
      | string
      | {
          name?: string;
        };
    roleName?: string;
    permissions?: string[];
  };
};

@ApiTags('Reviews')
@ApiBearerAuth('access-token')
@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('reviews/products/:productId')
  @ApiOperation({
    summary: 'دریافت دیدگاه‌های تاییدشده محصول',
  })
  findProductReviews(
    @Param('productId') productId: string,
    @Query() query: QueryReviewDto,
  ): Promise<unknown> {
    return this.reviewService.findAllPublic(productId, query);
  }

  @Get('reviews/products/:productId/summary')
  @ApiOperation({
    summary: 'دریافت خلاصه امتیازهای محصول',
  })
  getProductRatingSummary(
    @Param('productId') productId: string,
  ): Promise<unknown> {
    return this.reviewService.getProductRatingSummary(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  @ApiOperation({
    summary: 'ثبت دیدگاه برای محصول',
  })
  create(
    @Req() req: OptionalAuthenticatedRequest,
    @Body() dto: CreateReviewDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.reviewService.create(userId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reviews/my')
  @ApiOperation({
    summary: 'دریافت دیدگاه‌های کاربر جاری',
  })
  findMyReviews(
    @Req() req: OptionalAuthenticatedRequest,
    @Query() query: QueryReviewDto,
  ): Promise<unknown> {
    return this.reviewService.findAllForUser(this.getUserId(req), query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reviews/my/:reviewId')
  @ApiOperation({
    summary: 'دریافت جزئیات دیدگاه کاربر جاری',
  })
  findMyReview(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('reviewId') reviewId: string,
  ): Promise<unknown> {
    return this.reviewService.findOneForUser(this.getUserId(req), reviewId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reviews/my/:reviewId')
  @ApiOperation({
    summary: 'ویرایش دیدگاه کاربر جاری',
  })
  updateMyReview(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.reviewService.updateForUser(userId, reviewId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reviews/my/:reviewId')
  @ApiOperation({
    summary: 'حذف دیدگاه کاربر جاری',
  })
  removeMyReview(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('reviewId') reviewId: string,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.reviewService.removeForUser(userId, reviewId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/reviews')
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی دیدگاه‌ها',
  })
  findAllForAdmin(
    @Req() req: OptionalAuthenticatedRequest,
    @Query() query: QueryReviewDto,
  ): Promise<unknown> {
    this.assertReviewManager(req);

    return this.reviewService.findAllForAdmin(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/reviews/:reviewId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی دیدگاه',
  })
  findOneForAdmin(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('reviewId') reviewId: string,
  ): Promise<unknown> {
    this.assertReviewManager(req);

    return this.reviewService.findOneForAdmin(reviewId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/reviews/:reviewId')
  @ApiOperation({
    summary: 'ویرایش دیدگاه توسط ادمین',
  })
  updateForAdmin(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<unknown> {
    this.assertReviewManager(req);

    return this.reviewService.updateForAdmin(
      reviewId,
      dto,
      this.getUserId(req),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/reviews/:reviewId/verify')
  @ApiOperation({
    summary: 'تایید یا رد تایید دیدگاه توسط ادمین',
  })
  verify(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: VerifyReviewDto,
  ): Promise<unknown> {
    this.assertReviewManager(req);

    return this.reviewService.verify(reviewId, dto, this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/reviews/:reviewId')
  @ApiOperation({
    summary: 'حذف دیدگاه توسط ادمین',
  })
  removeForAdmin(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('reviewId') reviewId: string,
  ): Promise<unknown> {
    this.assertReviewManager(req);

    return this.reviewService.removeForAdmin(reviewId, this.getUserId(req));
  }

  private getUserId(req: OptionalAuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertReviewManager(req: OptionalAuthenticatedRequest): void {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    const permissions = new Set(req.user?.permissions ?? []);

    const allowed =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      permissions.has('admin:*') ||
      permissions.has('admin:manage') ||
      permissions.has('admin:read') ||
      permissions.has('review:*') ||
      permissions.has('review:manage') ||
      permissions.has('review:read') ||
      permissions.has('reviews:*') ||
      permissions.has('reviews:manage') ||
      permissions.has('reviews:read') ||
      permissions.has('catalog:*') ||
      permissions.has('catalog:manage');

    if (!allowed) {
      throw new ForbiddenException('شما مجوز مدیریت دیدگاه‌ها را ندارید.');
    }
  }
}
