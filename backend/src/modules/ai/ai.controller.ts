import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AiAbandonedOfferDto } from './dto/ai-abandoned-offer.dto';

import { AiArticleDto } from './dto/ai-article.dto';

import { AiChatDto } from './dto/ai-chat.dto';

import { AiProductAdviceDto } from './dto/ai-product-advice.dto';

import { AiProductCompareDto } from './dto/ai-product-compare.dto';

import { AiProductContentDto } from './dto/ai-product-content.dto';

import { QueryAiConversationDto } from './dto/query-ai-conversation.dto';

import { AiRuntimeHealthService } from './services/ai-runtime-health.service';

import { AiService } from './services/ai.service';

type RequestUser = {
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

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

type AiPublicResult = Record<string, unknown>;

@Controller()
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiRuntimeHealthService: AiRuntimeHealthService,
  ) {}

  @RateLimit('search')
  @Post('ai/public/consult')
  publicConsult(@Body() dto: AiChatDto): Promise<unknown> {
    return this.aiService.publicConsult(dto);
  }

  @RateLimit('search')
  @Post('ai/public/product-advice')
  async publicProductAdvice(@Body() dto: AiProductAdviceDto): Promise<unknown> {
    const result = await this.aiService.generateProductAdvice(dto);

    return this.toPublicAiResult(result);
  }

  @RateLimit('search')
  @Post('ai/public/compare-products')
  async publicCompareProducts(
    @Body() dto: AiProductCompareDto,
  ): Promise<unknown> {
    const result = await this.aiService.compareProducts(dto);

    return this.toPublicAiResult(result);
  }

  @RateLimit('search')
  @Post('ai/public/abandoned-offer')
  async publicAbandonedOffer(
    @Body() dto: AiAbandonedOfferDto,
  ): Promise<unknown> {
    const result = await this.aiService.generateAbandonedOffer({
      ...dto,
      createCoupon: false,
    });

    return this.toPublicAiResult(result);
  }

  @RateLimit('search')
  @UseGuards(JwtAuthGuard)
  @Post('ai/chat')
  chat(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AiChatDto,
  ): Promise<unknown> {
    return this.aiService.chat(this.getUserId(req), dto);
  }

  @RateLimit('search')
  @UseGuards(JwtAuthGuard)
  @Get('ai/conversations')
  findConversations(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiConversationDto,
  ): Promise<unknown> {
    return this.aiService.findConversations(this.getUserId(req), query);
  }

  @RateLimit('search')
  @UseGuards(JwtAuthGuard)
  @Post('ai/conversations')
  createConversation(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      title?: string;
      externalId?: string;
    },
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.aiService.createConversation(
      userId,
      body.title,
      body.externalId,
      userId,
    );
  }

  @RateLimit('search')
  @UseGuards(JwtAuthGuard)
  @Get('ai/conversations/:conversationId')
  findConversation(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ): Promise<unknown> {
    return this.aiService.findConversation(this.getUserId(req), conversationId);
  }

  @RateLimit('search')
  @UseGuards(JwtAuthGuard)
  @Delete('ai/conversations/:conversationId')
  removeConversation(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ): Promise<unknown> {
    return this.aiService.removeConversation(
      this.getUserId(req),
      conversationId,
    );
  }

  @RateLimit('search')
  @UseGuards(JwtAuthGuard)
  @Post('ai/recommend-products')
  recommendProducts(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AiProductAdviceDto,
  ): Promise<unknown> {
    return this.aiService.recommendProducts(dto, this.getUserId(req));
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Get('admin/ai/runtime-health')
  getRuntimeHealth(@Req() req: AuthenticatedRequest) {
    this.assertAiManager(req);

    return this.aiRuntimeHealthService.getHealth();
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Post('admin/ai/product-content')
  generateProductContent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AiProductContentDto,
  ): Promise<unknown> {
    this.assertAiManager(req);

    if (dto.applyToProduct === true) {
      throw new BadRequestException(
        'اعمال مستقیم محتوا از مسیر قدیمی غیرفعال است. ابتدا پیش‌نویس را از مسیر محصول ایجاد کنید و سپس محتوا را از مسیر content-apply با تأیید صریح ادمین اعمال کنید.',
      );
    }

    return this.aiService.generateProductContent(
      {
        ...dto,
        applyToProduct: false,
      },
      this.getUserId(req),
    );
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Post('admin/ai/articles')
  generateArticleDraft(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AiArticleDto,
  ): Promise<unknown> {
    this.assertAiManager(req);

    return this.aiService.generateArticleDraft(dto, this.getUserId(req));
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Post('admin/ai/abandoned-offer')
  generateAdminAbandonedOffer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AiAbandonedOfferDto,
  ): Promise<unknown> {
    this.assertAiManager(req);

    return this.aiService.generateAbandonedOffer(dto, this.getUserId(req));
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Post('admin/ai/product-advice')
  generateAdminProductAdvice(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AiProductAdviceDto,
  ): Promise<unknown> {
    this.assertAiManager(req);

    return this.aiService.generateProductAdvice(dto, this.getUserId(req));
  }

  @RateLimit('admin')
  @UseGuards(JwtAuthGuard)
  @Post('admin/ai/compare-products')
  generateAdminProductComparison(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AiProductCompareDto,
  ): Promise<unknown> {
    this.assertAiManager(req);

    return this.aiService.compareProducts(dto, this.getUserId(req));
  }

  private toPublicAiResult(value: unknown): AiPublicResult {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        result: value,
      };
    }

    const source = value as Record<string, unknown>;

    const safe: AiPublicResult = {};

    const allowedKeys = [
      'answer',
      'article',
      'title',
      'model',
      'type',
      'productId',
      'productIds',
      'offer',
      'content',
    ];

    for (const key of allowedKeys) {
      if (source[key] !== undefined && key !== 'context') {
        safe[key] = source[key];
      }
    }

    if (
      safe.offer &&
      typeof safe.offer === 'object' &&
      !Array.isArray(safe.offer)
    ) {
      safe.offer = this.toPublicOfferResult(
        safe.offer as Record<string, unknown>,
      );
    }

    return safe;
  }

  private toPublicOfferResult(
    offer: Record<string, unknown>,
  ): Record<string, unknown> {
    const safe: Record<string, unknown> = {};

    const allowedKeys = [
      'shouldOfferDiscount',
      'discountPercent',
      'title',
      'message',
      'reason',
      'urgencyText',
      'cta',
    ];

    for (const key of allowedKeys) {
      if (offer[key] !== undefined) {
        safe[key] = offer[key];
      }
    }

    return safe;
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertAiManager(req: AuthenticatedRequest): void {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    const permissions = new Set(
      (req.user?.permissions ?? []).map((permission) =>
        permission.toLowerCase(),
      ),
    );

    const canManageAi =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      permissions.has('*') ||
      permissions.has('admin:*') ||
      permissions.has('ai:*') ||
      permissions.has('ai:manage') ||
      permissions.has('ai:content') ||
      permissions.has('products:*') ||
      permissions.has('products:manage') ||
      permissions.has('marketing:*') ||
      permissions.has('marketing:manage');

    if (!canManageAi) {
      throw new ForbiddenException(
        'شما مجوز مدیریت قابلیت‌های هوشمند را ندارید.',
      );
    }
  }
}
