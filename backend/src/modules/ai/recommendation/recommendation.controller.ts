import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request } from 'express';

import { RateLimit } from '../../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { RecommendationQueryDto } from './dto/recommendation-query.dto';

import { RecommendationService } from './services/recommendation.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@ApiTags('Recommendations')
@RateLimit('search')
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('similar')
  @ApiOperation({
    summary: 'دریافت محصولات مشابه',
    description:
      'محصولات مشابه را بر اساس محصول، دسته‌بندی، برند، جست‌وجو و امتیاز رفتاری برمی‌گرداند.',
  })
  similarProducts(@Query() query: RecommendationQueryDto): Promise<unknown> {
    return this.recommendationService.similarProducts(query);
  }

  @Get('best-sellers')
  @ApiOperation({
    summary: 'دریافت پرفروش‌ترین محصولات',
    description:
      'محصولات پرفروش را بر اساس آیتم‌های سفارش و فیلتر دسته‌بندی برمی‌گرداند.',
  })
  bestSellers(@Query() query: RecommendationQueryDto): Promise<unknown> {
    return this.recommendationService.bestSellers(query);
  }

  @Get('trending')
  @ApiOperation({
    summary: 'دریافت محصولات ترند',
    description:
      'محصولات ترند را بر اساس بازدید، تعداد دیدگاه و میانگین امتیاز برمی‌گرداند.',
  })
  trending(@Query() query: RecommendationQueryDto): Promise<unknown> {
    return this.recommendationService.trending(query);
  }

  @Get('new-arrivals')
  @ApiOperation({
    summary: 'دریافت محصولات جدید',
    description:
      'جدیدترین محصولات فعال فروشگاه را بر اساس تاریخ ایجاد برمی‌گرداند.',
  })
  newArrivals(@Query() query: RecommendationQueryDto): Promise<unknown> {
    return this.recommendationService.newArrivals(query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('cart-related')
  @ApiOperation({
    summary: 'دریافت پیشنهادهای مرتبط با سبد خرید',
    description:
      'برای کاربر احراز هویت‌شده، محصولات مرتبط با دسته‌بندی و برندهای موجود در سبد خرید را برمی‌گرداند.',
  })
  cartRelated(
    @Req() req: AuthenticatedRequest,
    @Query() query: RecommendationQueryDto,
  ): Promise<unknown> {
    return this.recommendationService.cartRelated(this.getUserId(req), query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('personalized')
  @ApiOperation({
    summary: 'دریافت پیشنهادهای شخصی‌سازی‌شده',
    description:
      'برای کاربر احراز هویت‌شده، محصولات پیشنهادی را بر اساس سابقه سفارش و رفتار خرید برمی‌گرداند.',
  })
  personalized(
    @Req() req: AuthenticatedRequest,
    @Query() query: RecommendationQueryDto,
  ): Promise<unknown> {
    return this.recommendationService.personalized(this.getUserId(req), query);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }
}
