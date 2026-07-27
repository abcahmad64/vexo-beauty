import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AIMessageRole,
  CouponStatus,
  CouponType,
  Prisma,
} from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { AI_PROVIDER } from '../constants/ai-provider.tokens';

import { AiAbandonedOfferDto } from '../dto/ai-abandoned-offer.dto';

import { AiArticleDto } from '../dto/ai-article.dto';

import { AiChatDto } from '../dto/ai-chat.dto';

import { AiProductAdviceDto } from '../dto/ai-product-advice.dto';

import { AiProductCompareDto } from '../dto/ai-product-compare.dto';

import {
  AiProductContentDto,
  AiProductContentMode,
} from '../dto/ai-product-content.dto';

import { QueryAiConversationDto } from '../dto/query-ai-conversation.dto';

import { AiEventPublisher } from '../events/ai.event.publisher';

import { AiChatMessage, AiProvider } from '../interfaces/ai-provider.interface';

import { AiProductSnapshot } from '../interfaces/ai-context.interface';

import {
  AI_PERSIAN_CORE_SYSTEM_PROMPT,
  buildAbandonedOfferPrompt,
  buildContextSystemPrompt,
  buildProductAdvicePrompt,
  buildProductComparisonPrompt,
  buildProductContentPrompt,
  buildSalesPrompt,
} from '../prompts/ai-system.prompt';

import { AiContextService } from './ai-context.service';

type JsonObject = Record<string, unknown>;

type ProductContentFaqItem = {
  question: string;
  answer: string;
};

type ProductContentShape = {
  shortDescription?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  sellingPoints?: string[];
  faq?: ProductContentFaqItem[];
  adCopy?: string;
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: AiContextService,

    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,

    private readonly eventPublisher: AiEventPublisher,
  ) {}

  private readonly conversationSelect = {
    id: true,
    externalId: true,
    userId: true,
    title: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  } satisfies Prisma.AIConversationSelect;

  private getSafeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'AI output was rejected and safe fallback was used.';
  }

  private readonly messageSelect = {
    id: true,
    conversationId: true,
    role: true,
    content: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.AIMessageSelect;

  async createConversation(
    userId: string,
    title?: string,
    externalId?: string,
    actorId?: string,
  ) {
    const conversation = await this.prisma.aIConversation.create({
      data: {
        userId,
        title: title?.trim() || 'مشاوره هوشمند',
        externalId: externalId?.trim() || null,
      },
      select: this.conversationSelect,
    });

    this.eventPublisher.publishConversationCreated({
      conversationId: conversation.id,
      userId: conversation.userId,
      externalId: conversation.externalId,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapConversation(conversation);
  }

  async findConversations(userId: string, query: QueryAiConversationDto) {
    const { page, limit, skip } = this.buildPagination(query);

    const where: Prisma.AIConversationWhereInput = {
      userId,
      ...(query.includeDeleted === true
        ? {}
        : {
            deletedAt: null,
          }),
      ...(query.q
        ? {
            title: {
              contains: query.q,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const createdAt = this.buildDateRange(query.createdFrom, query.createdTo);

    if (createdAt) {
      where.createdAt = createdAt;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.aIConversation.findMany({
        where,
        select: this.conversationSelect,
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),

      this.prisma.aIConversation.count({
        where,
      }),
    ]);

    return this.buildPaginatedResult(
      data.map((conversation) => this.mapConversation(conversation)),
      total,
      page,
      limit,
    );
  }

  async findConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
      select: {
        ...this.conversationSelect,
        messages: {
          select: this.messageSelect,
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('گفت‌وگوی هوشمند موردنظر یافت نشد.');
    }

    return this.mapConversationWithMessages(conversation);
  }

  async removeConversation(userId: string, conversationId: string) {
    await this.findConversation(userId, conversationId);

    const deletedAt = new Date();

    await this.prisma.aIConversation.update({
      where: {
        id: conversationId,
      },
      data: {
        deletedAt,
      },
    });

    return {
      success: true,
      message: 'گفت‌وگوی هوشمند با موفقیت حذف شد.',
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: formatPersianDateTime(deletedAt),
    };
  }

  async chat(userId: string, dto: AiChatDto) {
    const conversation = await this.resolveConversation(userId, dto);

    const history = await this.getRecentMessages(conversation.id, 20);

    const context = await this.buildConversationContext(userId, dto);

    const userMessage = await this.prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: AIMessageRole.USER,
        content: dto.message,
      },
      select: this.messageSelect,
    });

    this.eventPublisher.publishMessageCreated({
      conversationId: conversation.id,
      messageId: userMessage.id,
      role: userMessage.role,
      actorId: userId,
      occurredAt: new Date(),
    });

    const messages: AiChatMessage[] = [
      {
        role: 'system',
        content: AI_PERSIAN_CORE_SYSTEM_PROMPT,
      },
      {
        role: 'system',
        content: buildContextSystemPrompt(context),
      },
      ...history.map((message) => ({
        role: this.mapRole(message.role),
        content: message.content,
      })),
      {
        role: 'user',
        content: buildSalesPrompt(dto.message),
      },
    ];

    const result = await this.aiProvider.generate(messages, {
      task: 'sales',
      temperature: 0.4,
      maxTokens: 1200,
      userId,
      promptKey: 'customer-chat',
      metadata: {
        conversationId: conversation.id,
        hasSelectedProducts: Boolean(dto.productIds?.length),
      },
    });

    const answer = this.sanitizeGeneratedAnswer(result.content);

    const assistantMessage = await this.prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: AIMessageRole.ASSISTANT,
        content: answer,
      },
      select: this.messageSelect,
    });

    this.eventPublisher.publishMessageCreated({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      role: assistantMessage.role,
      actorId: userId,
      occurredAt: new Date(),
    });

    await this.prisma.aIConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return {
      conversationId: conversation.id,
      answer,
      model: result.model,
      messages: {
        user: this.mapMessage(userMessage),
        assistant: this.mapMessage(assistantMessage),
      },
    };
  }

  async publicConsult(dto: AiChatDto) {
    const context = await this.buildPublicContext(dto);

    const result = await this.aiProvider.generate(
      [
        {
          role: 'system',
          content: AI_PERSIAN_CORE_SYSTEM_PROMPT,
        },
        {
          role: 'system',
          content: buildContextSystemPrompt(context),
        },
        {
          role: 'user',
          content: buildSalesPrompt(dto.message),
        },
      ],
      {
        task: 'sales',
        temperature: 0.35,
        maxTokens: 512,
        promptKey: 'public-consult',
        metadata: {
          scope: 'public',
          hasSelectedProducts: Boolean(dto.productIds?.length),
          contextReturned: false,
        },
      },
    );

    return {
      answer: this.sanitizeGeneratedAnswer(result.content),
      model: result.model,
    };
  }

  async generateProductAdvice(dto: AiProductAdviceDto, actorId?: string) {
    const catalog = await this.contextService.searchCatalog({
      query: dto.request,
      productIds: dto.productIds,
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      budgetMin: dto.budgetMin,
      budgetMax: dto.budgetMax,
      limit: 10,
    });

    const snapshots = dto.productIds?.length
      ? await this.contextService.getProductSnapshots(dto.productIds)
      : [];

    const payload = {
      request: dto.request,
      customerProfile: {
        skinType: dto.skinType,
        hairType: dto.hairType,
        concern: dto.concern,
        deviceNeed: dto.deviceNeed,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        extra: dto.extra,
      },
      catalog,
      selectedProducts: snapshots,
    };

    const result = await this.aiProvider.generate(
      [
        {
          role: 'system',
          content: AI_PERSIAN_CORE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildProductAdvicePrompt(payload),
        },
      ],
      {
        task: 'consulting',
        temperature: 0.3,
        maxTokens: 1200,
        promptKey: 'product-advice',
        metadata: {
          actorId: actorId ?? null,
        },
      },
    );

    this.eventPublisher.publishProductAdviceGenerated({
      productIds: dto.productIds ?? [],
      request: dto.request,
      actorId,
      occurredAt: new Date(),
    });

    return {
      answer: this.sanitizeGeneratedAnswer(result.content),
      model: result.model,
      context: payload,
    };
  }

  async compareProducts(dto: AiProductCompareDto, actorId?: string) {
    const snapshots = await this.contextService.getProductSnapshots(
      dto.productIds,
    );

    if (snapshots.length < 2) {
      throw new BadRequestException('برای مقایسه، حداقل دو محصول لازم است.');
    }

    const payload = {
      question: dto.question,
      customerProfile: dto.customerProfile,
      products: snapshots,
    };

    const result = await this.aiProvider.generate(
      [
        {
          role: 'system',
          content: AI_PERSIAN_CORE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildProductComparisonPrompt(payload),
        },
      ],
      {
        task: 'comparison',
        temperature: 0.2,
        maxTokens: this.getComparisonMaxTokens(dto.question),
        promptKey: 'product-comparison',
        metadata: {
          actorId: actorId ?? null,
          productCount: dto.productIds.length,
        },
      },
    );

    this.eventPublisher.publishProductComparisonGenerated({
      productIds: dto.productIds,
      actorId,
      occurredAt: new Date(),
    });

    return {
      answer: this.sanitizeGeneratedAnswer(result.content),
      model: result.model,
      context: payload,
    };
  }
  async generateProductContent(dto: AiProductContentDto, actorId?: string) {
    if (dto.applyToProduct === true) {
      throw new BadRequestException(
        'تولید محتوای محصول فقط پیش‌نویس ایجاد می‌کند. اعمال محتوا باید از مسیر product.content.apply و پس از تأیید صریح ادمین انجام شود.',
      );
    }

    const snapshot = await this.contextService.getProductSnapshot(
      dto.productId,
    );

    const mode = dto.mode ?? AiProductContentMode.FULL;

    const payload = {
      mode,
      extraInstruction: dto.extraInstruction,
      outputContract: this.buildProductContentOutputContract(mode),
      safetyRules: [
        'فقط بر اساس اطلاعات واقعی product بنویس.',
        'کاربرد فصلی، آب‌وهوا، روزهای گرم، روزهای پرکار یا موقعیت مصرف نساز.',
        'ادعای درمانی، ضد آکنه، ضد لک، ضد ریزش، بستن منافذ، جلوگیری از ریزش، رفع قطعی یا تضمین نتیجه ننویس.',
        'عبارت‌های اغراق‌آمیز مثل عالی، تخصصی، ایده‌آل، موثر، رطوبت‌رسانی عالی یا مرطوب‌کننده سبک ننویس مگر دقیقاً در داده واقعی محصول وجود داشته باشد.',
        'اگر داده کافی نیست، متن عمومی، کوتاه و امن بنویس.',
        'خروجی باید JSON معتبر و بدون markdown باشد.',
      ],
      product: snapshot,
      missingContent: this.detectMissingProductContent(snapshot),
    };

    let parsedContent: JsonObject = {};
    let model = 'safe-fallback';
    let fallbackReason: string | null = null;

    try {
      const result = await this.aiProvider.generate(
        [
          {
            role: 'system',
            content: AI_PERSIAN_CORE_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildProductContentPrompt(payload),
          },
        ],
        {
          task: 'content',
          temperature: 0.18,
          maxTokens: this.getProductContentMaxTokens(mode),
          json: true,
          promptKey: `product-content-${mode.toLowerCase()}`,
          metadata: {
            actorId: actorId ?? null,
            productId: dto.productId,
            mode,
          },
        },
      );

      model = result.model;

      parsedContent = this.parseJsonObject(result.content);
    } catch (error) {
      fallbackReason = this.getSafeErrorMessage(error);

      parsedContent = {};
    }

    const content = this.normalizeProductContentForMode(
      parsedContent,
      mode,
      snapshot,
    );

    this.eventPublisher.publishProductContentGenerated({
      productId: snapshot.product.id,
      applied: false,
      actorId,
      occurredAt: new Date(),
    });

    return {
      productId: snapshot.product.id,
      mode,
      content,
      applied: null,
      model,
      fallbackUsed: Boolean(fallbackReason),
      fallbackReason,
    };
  }

  async generateArticleDraft(dto: AiArticleDto, actorId?: string) {
    const startedAt = Date.now();

    const safeWordCount = Math.min(
      700,
      Math.max(300, Number(dto.wordCount ?? 600)),
    );

    const catalog = await this.contextService.searchCatalog({
      query: dto.topic,
      productIds: dto.productIds,
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      limit: 5,
    });

    const snapshots = dto.productIds?.length
      ? await this.contextService.getProductSnapshots(dto.productIds)
      : [];

    const payload = {
      topic: dto.topic,
      keywords: dto.keywords ?? [],
      targetAudience: dto.targetAudience ?? 'خریداران فروشگاه',
      tone: dto.tone ?? 'آموزشی، طبیعی، فروشگاهی و بدون اغراق',
      wordCount: safeWordCount,
      productCount: snapshots.length,
      catalogProductCount: this.asArray(this.asObject(catalog).products).length,
      safetyRules: [
        'مقاله باید آموزشی، فروشگاهی و بدون ادعای درمانی باشد.',
        'محصول خیالی، برند خیالی، قیمت یا موجودی نساز.',
        'فقط از محصول واقعی context با لحن محتاطانه استفاده کن.',
        'خروجی باید سریع، امن و قابل استفاده در سایت باشد.',
      ],
    };

    const article = this.normalizeArticleDraft(
      this.buildSafeArticleFallback(
        dto.topic,
        dto.keywords ?? [],
        snapshots,
        safeWordCount,
      ),
      this.buildSafeArticleFallback(
        dto.topic,
        dto.keywords ?? [],
        snapshots,
        safeWordCount,
      ),
    );

    await this.recordDeterministicArticleRunLog({
      actorId,
      payload,
      article,
      startedAt,
    });

    this.eventPublisher.publishArticleDraftGenerated({
      topic: dto.topic,
      productIds: dto.productIds ?? [],
      actorId,
      occurredAt: new Date(),
    });

    return {
      title: dto.topic,
      article,
      model: 'backend-deterministic-article-builder',
      fallbackUsed: false,
      fallbackReason: null,
      context: {
        topic: dto.topic,
        keywordCount: dto.keywords?.length ?? 0,
        productCount: snapshots.length,
        catalogProductCount: this.asArray(this.asObject(catalog).products)
          .length,
        safeWordCount,
        source: 'backend-deterministic',
      },
    };
  }

  async generateAbandonedOffer(dto: AiAbandonedOfferDto, actorId?: string) {
    const snapshot = await this.contextService.getProductSnapshot(
      dto.productId,
    );

    const viewedAt = this.parseOptionalDate(dto.viewedAt) ?? new Date();

    const existingDiscount = this.calculateExistingDiscountPercent(snapshot);

    const suggestedDiscount = this.calculateSuggestedDiscountPercent(
      dto.baseDiscountPercent ?? 5,
      dto.maxDiscountPercent ?? 15,
      existingDiscount,
      snapshot,
    );

    const payload = {
      product: snapshot,
      userId: dto.userId,
      visitorId: dto.visitorId,
      viewedAt,
      existingDiscountPercent: existingDiscount,
      suggestedDiscountPercent: suggestedDiscount,
      schemaLimit:
        'در schema فعلی قیمت خرید یا costPrice محصول وجود ندارد؛ بنابراین سقف تخفیف بر اساس قیمت فروش، comparePrice، رفتار مشاهده بدون خرید و قواعد امن تجاری محاسبه می‌شود.',
      safetyRules: [
        'برای کاربر عمومی متن داخلی، reason، استراتژی مارکتینگ یا توضیح فنی تصمیم را ننویس.',
        'قیمت، واحد پول، محبوب بودن محصول یا ادعای تخفیف اعمال‌شده نساز.',
        'اگر createCoupon false است، ادعا نکن کوپن ساخته شد، تخفیف اعمال شد یا پیامک ارسال شد.',
        'لحن باید نرم، فروشگاهی و غیر دستوری باشد.',
        'خروجی باید JSON معتبر باشد.',
      ],
    };

    let offer: JsonObject = {};
    let model = 'safe-fallback';
    let fallbackReason: string | null = null;

    try {
      const result = await this.aiProvider.generate(
        [
          {
            role: 'system',
            content: AI_PERSIAN_CORE_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildAbandonedOfferPrompt(payload),
          },
        ],
        {
          task: 'marketing',
          temperature: 0.22,
          maxTokens: 900,
          json: true,
          promptKey: 'abandoned-offer',
          metadata: {
            actorId: actorId ?? null,
            productId: dto.productId,
            createCoupon: dto.createCoupon === true,
          },
        },
      );

      model = result.model;

      offer = this.parseJsonObject(result.content);
    } catch (error) {
      fallbackReason = this.getSafeErrorMessage(error);

      offer = {};
    }

    const discountPercent = this.normalizeDiscountPercent(
      offer.discountPercent,
      suggestedDiscount,
      dto.maxDiscountPercent ?? 15,
    );

    const normalizedOffer = this.normalizeAbandonedOffer(
      offer,
      snapshot,
      discountPercent,
    );

    let coupon: {
      id: string;
      code: string;
      discountPercent: number;
      expiresAt: Date;
    } | null = null;

    if (dto.createCoupon === true) {
      coupon = await this.createAiCoupon(
        discountPercent,
        dto.expiresInHours ?? 24,
        snapshot.product.price,
      );
    }

    this.eventPublisher.publishAbandonedOfferGenerated({
      productId: snapshot.product.id,
      userId: dto.userId ?? null,
      visitorId: dto.visitorId ?? null,
      discountPercent,
      couponCode: coupon?.code ?? null,
      actorId,
      occurredAt: new Date(),
    });

    return {
      productId: snapshot.product.id,
      offer: normalizedOffer,
      coupon,
      model,
      fallbackUsed: Boolean(fallbackReason),
      fallbackReason,
      context: payload,
    };
  }

  async recommendProducts(dto: AiProductAdviceDto, actorId?: string) {
    const advice = await this.generateProductAdvice(dto, actorId);

    return {
      ...advice,
      type: 'PRODUCT_RECOMMENDATION',
    };
  }
  private async recordDeterministicArticleRunLog(input: {
    actorId?: string;
    payload: JsonObject;
    article: string;
    startedAt: number;
  }): Promise<void> {
    try {
      await this.prisma.aiRunLog.create({
        data: {
          taskType: 'CONTENT',
          promptKey: 'article-draft',
          userId: input.actorId ?? null,
          inputJson: input.payload as Prisma.InputJsonValue,
          outputJson: {
            articleLength: input.article.length,
            backendDeterministic: true,
          },
          provider: 'backend',
          model: 'deterministic-article-builder',
          status: 'SUCCESS',
          latencyMs: Date.now() - input.startedAt,
          tokenUsageJson: Prisma.JsonNull,
          errorMessage: null,
        },
      });
    } catch {
      return;
    }
  }

  private getArticleMaxTokens(wordCount: number): number {
    if (wordCount <= 350) {
      return 900;
    }

    if (wordCount <= 550) {
      return 1200;
    }

    return 1500;
  }

  private normalizeArticleDraft(value: string, fallback: string): string {
    const cleaned = this.cleanGeneratedProductText(value ?? '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^```markdown/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleaned) {
      return fallback;
    }

    if (!this.isReadableText(cleaned)) {
      return fallback;
    }

    if (this.containsUnsafeArticleTerm(cleaned)) {
      return fallback;
    }

    return cleaned;
  }

  private containsUnsafeArticleTerm(value: string): boolean {
    const normalized = this.normalizeForMatch(value);

    const blockedTerms = [
      'درمان قطعی',
      'درمان اکنه',
      'درمان اکنی',
      'درمان جوش',
      'ضد جوش',
      'ضدجوش',
      'ضد لک',
      'ضدلک',
      'بستن منافذ',
      'رفع قطعی',
      'حذف قطعی',
      'نتیجه قطعی',
      'تضمین نتیجه',
      'جایگزین پزشک',
      'بدون نیاز به پزشک',
      'محصول محبوب',
      'برند معتبر',
      'بهترین محصول بازار',
      'پرفروش ترین',
      'پرفروش‌ترین',
    ];

    return blockedTerms.some((term) =>
      normalized.includes(this.normalizeForMatch(term)),
    );
  }

  private buildSafeArticleFallback(
    topic: string,
    keywords: string[],
    snapshots: AiProductSnapshot[],
    wordCount: number,
  ): string {
    const cleanTopic =
      this.cleanGeneratedProductText(topic) || 'راهنمای انتخاب محصول مراقبتی';

    const selectedProduct = snapshots[0]?.product;

    const productName = selectedProduct
      ? this.cleanGeneratedProductText(selectedProduct.name)
      : '';

    const keywordLine =
      keywords.length > 0
        ? `کلیدواژه‌های مرتبط: ${keywords
            .map((keyword) => this.cleanGeneratedProductText(keyword))
            .filter(Boolean)
            .slice(0, 5)
            .join('، ')}`
        : '';

    const productLine = productName
      ? `در میان محصولات ثبت‌شده، ${productName} می‌تواند به عنوان یک گزینه قابل بررسی برای روتین مراقبت پوست چرب و مختلط معرفی شود.`
      : 'برای انتخاب محصول مناسب، بهتر است توضیحات ثبت‌شده محصول و نیاز پوست خود را هم‌زمان بررسی کنید.';

    const compactNote =
      wordCount <= 400
        ? ''
        : '\n\nبرای نتیجه بهتر، محصول را بر اساس نوع پوست، بافت، توضیحات ثبت‌شده و سازگاری با روتین شخصی خود بررسی کنید. از تصمیم‌گیری صرفاً بر اساس تبلیغات یا عبارت‌های اغراق‌آمیز خودداری کنید.';

    return [
      cleanTopic,
      '',
      'انتخاب آبرسان برای پوست چرب بهتر است با تمرکز بر بافت سبک، حس راحتی روی پوست و امکان استفاده در روتین روزانه انجام شود. پوست چرب هم به رطوبت نیاز دارد، اما انتخاب محصول باید با نیاز واقعی پوست و توضیحات ثبت‌شده محصول هماهنگ باشد.',
      '',
      productLine,
      '',
      'پیش از خرید، توضیحات محصول، نوع پوست هدف، روش استفاده و سازگاری آن با سایر مراحل روتین مراقبت پوست را بررسی کنید. متن محصول نباید جایگزین نظر تخصصی پزشک یا مشاور پوست شود.',
      keywordLine ? `\n${keywordLine}` : '',
      compactNote,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private normalizeAbandonedOffer(
    value: JsonObject,
    snapshot: AiProductSnapshot,
    discountPercent: number,
  ): JsonObject {
    const productName =
      this.cleanGeneratedProductText(snapshot.product.name) || 'این محصول';

    const shouldOfferDiscount = this.getBooleanWithDefault(
      value.shouldOfferDiscount,
      true,
    );

    const safeDiscountPercent = Math.max(
      1,
      Math.min(99, Math.round(discountPercent)),
    );

    const title = shouldOfferDiscount
      ? `پیشنهاد محدود برای ${productName}`
      : `یادآوری ${productName}`;

    const message = shouldOfferDiscount
      ? `${productName} هنوز برای بررسی شما در دسترس است. در صورت تمایل، می‌توانید پیشنهاد ${safeDiscountPercent} درصدی فعلی فروشگاه را بررسی کنید.`
      : `${productName} هنوز برای بررسی شما در دسترس است. می‌توانید جزئیات محصول را دوباره مشاهده کنید.`;

    const urgencyText = 'این پیشنهاد برای مدت محدودی قابل بررسی است.';

    const cta = 'مشاهده محصول';

    return {
      shouldOfferDiscount,
      discountPercent: safeDiscountPercent,
      title: this.truncateText(title, 90),
      message: this.truncateText(message, 260),
      urgencyText: this.truncateText(urgencyText, 120),
      cta,
    };
  }

  private pickSafeOfferText(
    value: string | null,
    fallback: string,
    maxLength: number,
    couponCreated: boolean,
  ): string {
    const cleaned = this.cleanGeneratedProductText(value ?? '');

    if (cleaned && this.isSafeOfferText(cleaned, couponCreated)) {
      return this.truncateText(cleaned, maxLength);
    }

    return this.truncateText(fallback, maxLength);
  }

  private isSafeOfferText(value: string, couponCreated: boolean): boolean {
    const normalized = this.normalizeForMatch(value);

    if (!this.isReadableText(value)) {
      return false;
    }

    const alwaysBlockedTerms = [
      'محصول محبوب',
      'محبوب',
      'به قیمت',
      'ریال',
      'تومان',
      'لطفا سرعت بزنید',
      'لطفاً سرعت بزنید',
      'سرعت بزنید',
      'ترغیب فروش',
      'بازگرداندن مشترک',
      'مشترک',
      'خرید را انجام دهید',
      'همین حالا بخرید',
      'از دست ندهید',
      'فرصت را از دست ندهید',
      'خاص برای شما',
      'محبوب‌ترین',
      'پرفروش‌ترین',
      'فترة',
      'فتره',
      'خرید اکنون',
      'همین حالا خرید کنید',
      'همین حالا بخرید',
      'خرید کنید',
      'برای شما ارائه شده است',
      'برای شما ارائه شده',
      'برای شما دارید',
      'پیشنهاد خاص',
      'تضمین',
      'نتیجه قطعی',
      'درمان',
      'درمانی',
      'آکنه',
      'ضد جوش',
      'ضدجوش',
      'ضد لک',
      'ضدلک',
      'بستن منافذ',
      'ضد ریزش',
      'ضدریزش',
      'جلوگیری از ریزش',
      'تقویت ریشه',
    ];

    if (
      alwaysBlockedTerms.some((term) =>
        normalized.includes(this.normalizeForMatch(term)),
      )
    ) {
      return false;
    }

    const actionCompletionClaims = [
      'تخفیف اعمال شد',
      'کوپن ساخته شد',
      'کد تخفیف ساخته شد',
      'پیامک ارسال شد',
    ];

    if (
      !couponCreated &&
      actionCompletionClaims.some((term) =>
        normalized.includes(this.normalizeForMatch(term)),
      )
    ) {
      return false;
    }

    return true;
  }

  private getBooleanWithDefault(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    return fallback;
  }

  private buildProductContentOutputContract(mode: AiProductContentMode) {
    const fieldsByMode: Record<AiProductContentMode, string[]> = {
      [AiProductContentMode.FULL]: [
        'shortDescription',
        'description',
        'seoTitle',
        'seoDescription',
        'sellingPoints',
        'faq',
        'adCopy',
      ],
      [AiProductContentMode.SHORT_DESCRIPTION]: ['shortDescription'],
      [AiProductContentMode.DESCRIPTION]: ['description'],
      [AiProductContentMode.SEO]: ['seoTitle', 'seoDescription'],
      [AiProductContentMode.FAQ]: ['faq'],
      [AiProductContentMode.AD_COPY]: ['adCopy'],
    };

    return {
      mode,
      allowedFields: fieldsByMode[mode],
      instruction:
        'فقط همین allowedFields را تولید کن. فیلدهای خارج از allowedFields لازم نیست، اما اگر تولید شد توسط backend حذف می‌شود.',
    };
  }

  private getProductContentMaxTokens(mode: AiProductContentMode): number {
    if (mode === AiProductContentMode.FULL) {
      return 1800;
    }

    if (mode === AiProductContentMode.DESCRIPTION) {
      return 900;
    }

    if (mode === AiProductContentMode.FAQ) {
      return 700;
    }

    return 500;
  }

  private getComparisonMaxTokens(question?: string): number {
    const normalized = this.normalizeForMatch(question ?? '');

    if (
      normalized.includes('کوتاه') ||
      normalized.includes('خلاصه') ||
      normalized.includes('مختصر')
    ) {
      return 450;
    }

    return 900;
  }

  private normalizeProductContentForMode(
    value: JsonObject,
    mode: AiProductContentMode,
    snapshot: AiProductSnapshot,
  ): JsonObject {
    const generated = this.toProductContentShape(value);

    const fallback = this.buildSafeProductContentFallback(snapshot);

    const sourceText = this.buildProductContentSourceText(snapshot);

    const normalized: ProductContentShape = {
      shortDescription: this.pickSafeGeneratedString(
        generated.shortDescription,
        fallback.shortDescription,
        220,
        sourceText,
      ),
      description: this.pickSafeGeneratedString(
        generated.description,
        fallback.description,
        1400,
        sourceText,
      ),
      seoTitle: this.pickSafeGeneratedString(
        generated.seoTitle,
        fallback.seoTitle,
        80,
        sourceText,
      ),
      seoDescription: this.pickSafeGeneratedString(
        generated.seoDescription,
        fallback.seoDescription,
        180,
        sourceText,
      ),
      sellingPoints: this.pickSafeGeneratedStringList(
        generated.sellingPoints,
        fallback.sellingPoints,
        4,
        120,
        sourceText,
      ),
      faq: this.pickSafeGeneratedFaq(generated.faq, fallback.faq, sourceText),
      adCopy: this.pickSafeGeneratedString(
        generated.adCopy,
        fallback.adCopy,
        180,
        sourceText,
      ),
    };

    return this.pickProductContentByMode(normalized, mode);
  }

  private buildProductContentSourceText(snapshot: AiProductSnapshot): string {
    const product = snapshot.product;

    return this.normalizeForMatch(
      [
        product.name,
        product.shortDescription,
        product.description,
        product.brandName,
        product.categoryName,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  private toProductContentShape(value: JsonObject): ProductContentShape {
    const faq = this.asArray(value.faq)
      .map((item) => {
        const row = this.asObject(item);

        const question = this.getString(row.question);

        const answer = this.getString(row.answer);

        if (!question || !answer) {
          return null;
        }

        return {
          question,
          answer,
        };
      })
      .filter((item): item is ProductContentFaqItem => item !== null);

    const sellingPoints = this.asArray(value.sellingPoints)
      .map((item) => this.getString(item))
      .filter((item): item is string => Boolean(item));

    return {
      shortDescription: this.getString(value.shortDescription) ?? undefined,
      description: this.getString(value.description) ?? undefined,
      seoTitle: this.getString(value.seoTitle) ?? undefined,
      seoDescription: this.getString(value.seoDescription) ?? undefined,
      sellingPoints,
      faq,
      adCopy: this.getString(value.adCopy) ?? undefined,
    };
  }

  private pickProductContentByMode(
    content: ProductContentShape,
    mode: AiProductContentMode,
  ): JsonObject {
    if (mode === AiProductContentMode.SHORT_DESCRIPTION) {
      return {
        shortDescription: content.shortDescription,
      };
    }

    if (mode === AiProductContentMode.DESCRIPTION) {
      return {
        description: content.description,
      };
    }

    if (mode === AiProductContentMode.SEO) {
      return {
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
      };
    }

    if (mode === AiProductContentMode.FAQ) {
      return {
        faq: content.faq,
      };
    }

    if (mode === AiProductContentMode.AD_COPY) {
      return {
        adCopy: content.adCopy,
      };
    }

    return {
      shortDescription: content.shortDescription,
      description: content.description,
      seoTitle: content.seoTitle,
      seoDescription: content.seoDescription,
      sellingPoints: content.sellingPoints,
      faq: content.faq,
      adCopy: content.adCopy,
    };
  }

  private pickSafeGeneratedString(
    value: string | undefined,
    fallback: string | undefined,
    maxLength: number,
    sourceText: string,
  ): string {
    const cleaned = this.cleanGeneratedProductText(value ?? '');

    if (cleaned && this.isSafeGeneratedProductText(cleaned, sourceText)) {
      return this.truncateText(cleaned, maxLength);
    }

    return this.truncateText(fallback ?? '', maxLength);
  }

  private pickSafeGeneratedStringList(
    value: string[] | undefined,
    fallback: string[] | undefined,
    maxItems: number,
    maxLength: number,
    sourceText: string,
  ): string[] {
    const safe = (value ?? [])
      .map((item) => this.cleanGeneratedProductText(item))
      .filter((item) => this.isSafeGeneratedProductText(item, sourceText))
      .map((item) => this.truncateText(item, maxLength))
      .slice(0, maxItems);

    if (safe.length > 0) {
      return safe;
    }

    return (fallback ?? [])
      .map((item) => this.truncateText(item, maxLength))
      .slice(0, maxItems);
  }

  private pickSafeGeneratedFaq(
    value: ProductContentFaqItem[] | undefined,
    fallback: ProductContentFaqItem[] | undefined,
    sourceText: string,
  ): ProductContentFaqItem[] {
    const safe = (value ?? [])
      .map((item) => {
        const question = this.cleanGeneratedProductText(item.question);

        const answer = this.cleanGeneratedProductText(item.answer);

        if (
          !this.isSafeGeneratedProductText(question, sourceText) ||
          !this.isSafeGeneratedProductText(answer, sourceText)
        ) {
          return null;
        }

        return {
          question: this.truncateText(question, 140),
          answer: this.truncateText(answer, 320),
        };
      })
      .filter((item): item is ProductContentFaqItem => item !== null)
      .slice(0, 3);

    if (safe.length > 0) {
      return safe;
    }

    return (fallback ?? []).slice(0, 3);
  }

  private buildSafeProductContentFallback(
    snapshot: AiProductSnapshot,
  ): Required<ProductContentShape> {
    const product = snapshot.product;

    const name = this.cleanGeneratedProductText(product.name) || 'این محصول';

    const brandName = this.cleanGeneratedProductText(product.brandName ?? '');

    const categoryName = this.cleanGeneratedProductText(
      product.categoryName ?? '',
    );

    const sourceText = this.buildProductContentSourceText(snapshot);

    const isSkinProduct =
      sourceText.includes('پوست') ||
      sourceText.includes('آبرسان') ||
      sourceText.includes('کرم') ||
      sourceText.includes('ژل');

    const isHairProduct =
      sourceText.includes('مو') ||
      sourceText.includes('شامپو') ||
      sourceText.includes('نرم کننده');

    const hasOilySkin =
      sourceText.includes('پوست چرب') ||
      sourceText.includes('چرب و مختلط') ||
      sourceText.includes('مختلط');

    let shortDescription = `${name} محصولی برای بررسی در روتین مراقبتی روزانه است.`;

    let description = `${name} بر اساس اطلاعات ثبت‌شده محصول، برای بررسی در روتین مراقبتی قابل انتخاب است. برای انتخاب دقیق‌تر، توضیحات محصول و سازگاری آن با نیاز شخصی خود را بررسی کنید.`;

    if (isSkinProduct && hasOilySkin) {
      shortDescription = `${name} گزینه‌ای سبک برای روتین مراقبت روزانه پوست چرب و مختلط است.`;

      description = `${name} برای روتین مراقبت پوست چرب و مختلط قابل بررسی است. تمرکز اطلاعات ثبت‌شده این محصول روی بافت سبک و آبرسانی ملایم است و می‌تواند بخشی از روتین مراقبت روزانه پوست باشد.`;
    } else if (isSkinProduct) {
      shortDescription = `${name} گزینه‌ای قابل بررسی برای روتین مراقبت پوست است.`;

      description = `${name} برای استفاده در روتین مراقبت پوست قابل بررسی است. متن محصول بر اساس اطلاعات ثبت‌شده نوشته می‌شود و از اضافه‌کردن ویژگی‌های تأییدنشده خودداری شده است.`;
    } else if (isHairProduct) {
      shortDescription = `${name} گزینه‌ای قابل بررسی برای روتین مراقبت و شست‌وشوی مو است.`;

      description = `${name} برای قرار گرفتن در روتین مراقبت مو قابل بررسی است. متن محصول بر اساس اطلاعات ثبت‌شده نوشته می‌شود و از اضافه‌کردن ویژگی‌های تأییدنشده خودداری شده است.`;
    }

    const brandPart = brandName ? ` برند ${brandName}` : '';

    const categoryPart = categoryName ? ` در دسته ${categoryName}` : '';

    return {
      shortDescription: this.truncateText(shortDescription, 220),
      description: this.truncateText(description, 1400),
      seoTitle: this.truncateText(`${name} | VEXO Beauty`, 80),
      seoDescription: this.truncateText(
        `بررسی ${name}${brandPart}${categoryPart} در فروشگاه VEXO Beauty؛ مناسب برای روتین مراقبتی بر اساس اطلاعات ثبت‌شده محصول.`,
        180,
      ),
      sellingPoints: this.buildSafeSellingPoints(
        name,
        brandName,
        categoryName,
        isSkinProduct,
        isHairProduct,
      ),
      faq: this.buildSafeFaq(name, categoryName, isSkinProduct, isHairProduct),
      adCopy: this.truncateText(
        `برای تکمیل روتین مراقبتی خود، ${name} را در VEXO Beauty بررسی کنید.`,
        180,
      ),
    };
  }

  private buildSafeSellingPoints(
    name: string,
    brandName: string,
    categoryName: string,
    isSkinProduct: boolean,
    isHairProduct: boolean,
  ): string[] {
    const points: string[] = [];

    if (brandName) {
      points.push(`محصول برند ${brandName}`);
    }

    if (categoryName) {
      points.push(`قرارگرفته در دسته ${categoryName}`);
    }

    if (isSkinProduct) {
      points.push('قابل بررسی برای روتین مراقبت پوست');
    }

    if (isHairProduct) {
      points.push('قابل بررسی برای روتین مراقبت مو');
    }

    if (points.length === 0) {
      points.push(`${name} با اطلاعات ثبت‌شده در فروشگاه`);
      points.push('متن ایمن بر اساس اطلاعات ثبت‌شده');
    }

    return points.slice(0, 4);
  }

  private buildSafeFaq(
    name: string,
    categoryName: string,
    isSkinProduct: boolean,
    isHairProduct: boolean,
  ): ProductContentFaqItem[] {
    const routine = isSkinProduct
      ? 'روتین مراقبت پوست'
      : isHairProduct
        ? 'روتین مراقبت مو'
        : 'روتین مراقبتی';

    return [
      {
        question: 'این محصول برای چه استفاده‌ای قابل بررسی است؟',
        answer: categoryName
          ? `${name} در دسته ${categoryName} قرار دارد و برای بررسی در ${routine} قابل انتخاب است.`
          : `${name} برای بررسی در ${routine} قابل انتخاب است.`,
      },
      {
        question: 'پیش از خرید به چه نکته‌ای توجه کنم؟',
        answer:
          'توضیحات ثبت‌شده محصول، نوع نیاز و سازگاری آن با روتین شخصی خود را بررسی کنید.',
      },
    ];
  }
  private cleanGeneratedProductText(value: string): string {
    return value
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/مختطالی|مختطی|مختطلس|مختطلي|مختطالي/g, 'مختلط')
      .replace(/مرطوفتی|مرطوبیت/g, 'رطوبت')
      .replace(/برق بزنندگی/g, 'براقیت')
      .replace(/پوست یا ماست/g, 'پوست یا مو')
      .replace(/دermaline/g, 'Dermaline')
      .replace(/لایم/g, '')
      .replace(/آبرسانی\s+م\s+ارائه\s+دهد/g, 'آبرسانی ملایم ارائه دهد')
      .replace(/آبرسانی\s+م\s+/g, 'آبرسانی ملایم ')
      .replace(
        /به\s+صورت\s+م\s+آب\s+را\s+تامین\s+کند/g,
        'به آبرسانی ملایم کمک کند',
      )
      .replace(
        /به\s+صورت\s+م\s+آب\s+را\s+تأمین\s+کند/g,
        'به آبرسانی ملایم کمک کند',
      )
      .replace(/آب\s+را\s+تامین\s+کند/g, 'به آبرسانی ملایم کمک کند')
      .replace(/آب\s+را\s+تأمین\s+کند/g, 'به آبرسانی ملایم کمک کند')
      .replace(/طراحی شده‌اند/g, 'طراحی شده است')
      .replace(/محصولات? پیشنهادی ما/g, 'گزینه قابل بررسی')
      .replace(/دقیقاً با این ویژگی‌ها مطابقت دارد/g, 'با این نیاز همخوان است')
      .replace(/دقیقا با این ویژگی‌ها مطابقت دارد/g, 'با این نیاز همخوان است')
      .replace(/دقیقاً/g, '')
      .replace(/دقیقا/g, '')
      .replace(/برند معتبر/g, 'برند')
      .replace(/امتحان کنید/g, 'بررسی کنید')
      .replace(/تجربه کنید/g, 'بررسی کنید')
      .replace(/سلامت پوست/g, 'روتین مراقبت پوست')
      .replace(/سلامت مو/g, 'روتین مراقبت مو')
      .replace(/موهایی آسیب‌دیده/g, 'مو')
      .replace(/موهای آسیب‌دیده/g, 'مو')
      .replace(/موی آسیب‌دیده/g, 'مو')
      .replace(/موهای ضعیف/g, 'مو')
      .replace(/موی ضعیف/g, 'مو')
      .replace(/حفظ کیفیت مو/g, 'مراقبت از مو')
      .replace(/شستشوی/g, 'شست‌وشوی')
      .replace(/تأمین/g, 'تامین')
      .replace(
        /لطفاً سرعت بزنید/g,
        'این پیشنهاد برای مدت محدودی قابل بررسی است',
      )
      .replace(/لطفا سرعت بزنید/g, 'این پیشنهاد برای مدت محدودی قابل بررسی است')
      .replace(/سرعت بزنید/g, 'این پیشنهاد برای مدت محدودی قابل بررسی است')
      .replace(/فترة\s+محدود/g, 'این پیشنهاد برای مدت محدودی قابل بررسی است')
      .replace(/فتره\s+محدود/g, 'این پیشنهاد برای مدت محدودی قابل بررسی است')
      .replace(/مدت\s+محدود/g, 'این پیشنهاد برای مدت محدودی قابل بررسی است')
      .replace(/فترة/g, 'مدت')
      .replace(/فتره/g, 'مدت')
      .replace(/خرید اکنون/g, 'مشاهده محصول')
      .replace(/همین حالا خرید کنید/g, 'مشاهده محصول')
      .replace(/همین حالا بخرید/g, 'مشاهده محصول')
      .replace(/خرید را انجام دهید/g, 'مشاهده محصول')
      .replace(/خرید کنید/g, 'مشاهده محصول')
      .replace(/برای شما ارائه شده است/g, 'برای بررسی شما در دسترس است')
      .replace(/برای شما ارائه شده/g, 'برای بررسی شما در دسترس است')
      .replace(/خاص برای شما/g, 'قابل بررسی برای شما')
      .replace(/برای شما دارید/g, 'برای بررسی شما در دسترس است')
      .replace(/از دست ندهید/g, 'بررسی کنید')
      .replace(/فرصت را از دست ندهید/g, 'این پیشنهاد را بررسی کنید')
      .replace(/پیشنهاد خاص/g, 'پیشنهاد محدود')
      .replace(/محصول محبوب/g, 'محصول')
      .replace(/محبوب‌ترین/g, 'قابل بررسی')
      .replace(/پرفروش‌ترین/g, 'قابل بررسی')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isSafeGeneratedProductText(value: string, sourceText = ''): boolean {
    const cleaned = this.cleanGeneratedProductText(value);

    if (!cleaned) {
      return false;
    }

    if (!this.isReadableText(cleaned)) {
      return false;
    }

    return !this.containsUnsafeGeneratedProductTerm(cleaned, sourceText);
  }
  private containsUnsafeGeneratedProductTerm(
    value: string,
    sourceText = '',
  ): boolean {
    const normalized = this.normalizeForMatch(value);

    const normalizedSource = this.normalizeForMatch(sourceText);

    const alwaysBlockedTerms = [
      'درمانگر',
      'درمان',
      'درمانی',
      'شفا',
      'ضد آکنه',
      'ضدآکنه',
      'آکنه',
      'ضد جوش',
      'ضدجوش',
      'جوش',
      'ضد لک',
      'ضدلک',
      'لک',
      'ضد ریزش',
      'ضدریزش',
      'جلوگیری از ریزش',
      'پیشگیری از ریزش',
      'عامل تشدید آکنه',
      'بستن منافذ',
      'کوچک کننده منافذ',
      'کوچک‌کننده منافذ',
      'از بین بردن منافذ',
      'رفع منافذ',
      'رفع قطعی',
      'حذف قطعی',
      'تضمین نتیجه',
      'نتیجه قطعی',
      'جایگزین پزشک',
      'حساسیت',
      'شوره',
      'شیری روی پوست',
      'مختط',
      'دermaline',
      'غبار',
      'برند معتبر',
      'معتبر',
      'امتحان کنید',
      'تجربه کنید',
    ];

    if (
      alwaysBlockedTerms.some((term) =>
        normalized.includes(this.normalizeForMatch(term)),
      )
    ) {
      return true;
    }

    const blockedIfNotInSource = [
      'حفظ رطوبت طبیعی',
      'رطوبت طبیعی',
      'رطوبت رسانی عالی',
      'رطوبت‌رسانی عالی',
      'آبرسانی موثر',
      'آبرسانی مؤثر',
      'موثر',
      'مؤثر',
      'عالی',
      'مرطوب کننده',
      'مرطوب‌کننده',
      'مرطوب کننده سبک',
      'مرطوب‌کننده سبک',
      'حفظ تعادل آب',
      'تعادل آب',
      'تعادل آب و روغن',
      'لایه سطحی',
      'تازگی',
      'نرمی',
      'پوست حساس',
      'حساس',
      'مستعد',
      'چربی اضافه',
      'جذب سریع',
      'سریع جذب',
      'غیرچسبنده',
      'بدون چربی',
      'بدون ایجاد چربی',
      'مراقبت تخصصی',
      'تخصصی',
      'جایگزین مرطوب کننده',
      'جایگزین مرطوب‌کننده',
      'برطرف کند',
      'برطرف کردن',
      'تامین کند',
      'تأمین کند',
      'متعادل بماند',
      'متعادل ماندن',
      'صبح و شب',
      'صبحگاهی',
      'در طول روز',
      'تمام روز',
      'تمام فصول',
      'همه فصول',
      'انواع آب و هوا',
      'آب و هوا',
      'روزهای گرم',
      'روزهای پرکار',
      'روزهای روشن',
      'ماندگاری',
      'ماندگاری رطوبت',
      'ایده آل',
      'ایده‌آل',
      'هوشمندانه',
    ];

    return blockedIfNotInSource.some((term) => {
      const normalizedTerm = this.normalizeForMatch(term);

      return (
        normalized.includes(normalizedTerm) &&
        !normalizedSource.includes(normalizedTerm)
      );
    });
  }

  private sanitizeGeneratedAnswer(value: string): string {
    return this.cleanGeneratedProductText(value);
  }

  private truncateText(value: string, maxLength: number): string {
    const cleaned = value.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return `${cleaned.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  private async resolveConversation(userId: string, dto: AiChatDto) {
    if (dto.conversationId) {
      const conversation = await this.prisma.aIConversation.findFirst({
        where: {
          id: dto.conversationId,
          userId,
          deletedAt: null,
        },
        select: this.conversationSelect,
      });

      if (!conversation) {
        throw new NotFoundException('گفت‌وگوی هوشمند موردنظر یافت نشد.');
      }

      return conversation;
    }

    if (dto.externalId) {
      const existing = await this.prisma.aIConversation.findFirst({
        where: {
          externalId: dto.externalId,
          userId,
          deletedAt: null,
        },
        select: this.conversationSelect,
      });

      if (existing) {
        return existing;
      }
    }

    return this.createConversation(
      userId,
      this.buildConversationTitle(dto.message),
      dto.externalId,
      userId,
    );
  }

  private async getRecentMessages(conversationId: string, take: number) {
    const messages = await this.prisma.aIMessage.findMany({
      where: {
        conversationId,
      },
      select: this.messageSelect,
      orderBy: {
        createdAt: 'desc',
      },
      take,
    });

    return messages.reverse();
  }

  private async buildConversationContext(userId: string, dto: AiChatDto) {
    const [store, catalog, behavior, selectedProducts] = await Promise.all([
      this.contextService.getStoreSnapshot(),
      this.contextService.searchCatalog({
        query: dto.message,
        productIds: dto.productIds,
        limit: 8,
      }),
      this.contextService.getUserBehaviorContext(userId),
      dto.productIds?.length
        ? this.contextService.getProductSnapshots(dto.productIds)
        : Promise.resolve([]),
    ]);

    return {
      store,
      catalog,
      userBehavior: behavior,
      selectedProducts,
      visitorContext: dto.visitorContext ?? null,
    };
  }

  private async buildPublicContext(dto: AiChatDto) {
    const [store, catalog, selectedProducts] = await Promise.all([
      this.contextService.getStoreSnapshot(),
      this.contextService.searchCatalog({
        query: dto.message,
        productIds: dto.productIds,
        limit: 5,
      }),
      dto.productIds?.length
        ? this.contextService.getProductSnapshots(dto.productIds)
        : Promise.resolve([]),
    ]);

    return this.sanitizePublicAiContext({
      store,
      catalog,
      selectedProducts,
      visitorContext: dto.visitorContext ?? null,
    });
  }

  private sanitizePublicAiContext(input: {
    store: unknown;
    catalog: unknown;
    selectedProducts: unknown;
    visitorContext: unknown;
  }) {
    const store = this.asObject(input.store);

    return {
      store: {
        language: 'fa',
        categories: this.sanitizeNamedList(store.categories, 8),
        brands: this.sanitizeNamedList(store.brands, 8),
        topProducts: this.sanitizePublicProducts(store.topProducts, 5),
      },
      catalog: this.sanitizeCatalogSummary(input.catalog, 5),
      selectedProducts: this.sanitizeSelectedProductSnapshots(
        input.selectedProducts,
        5,
      ),
      visitorContext: this.sanitizeVisitorContext(input.visitorContext),
    };
  }

  private sanitizeCatalogSummary(value: unknown, limit: number) {
    const catalog = this.asObject(value);

    const products = this.sanitizePublicProducts(catalog.products, limit);

    return {
      total: products.length,
      products,
    };
  }

  private sanitizeNamedList(value: unknown, limit: number) {
    return this.asArray(value)
      .map((item) => this.asObject(item))
      .map((item) => {
        const name = this.getString(item.name);

        const slug = this.getString(item.slug);

        return {
          name,
          slug,
        };
      })
      .filter(
        (item) =>
          Boolean(item.name) &&
          this.isReadableText(item.name) &&
          !this.isLikelyTestData(item.name, item.slug),
      )
      .slice(0, limit);
  }

  private sanitizePublicProducts(value: unknown, limit: number) {
    return this.asArray(value)
      .map((item) => this.asObject(item))
      .map((product) => this.sanitizeFlatProduct(product))
      .filter(
        (
          product,
        ): product is NonNullable<
          ReturnType<typeof this.sanitizeFlatProduct>
        > => product !== null,
      )
      .slice(0, limit);
  }

  private sanitizeSelectedProductSnapshots(value: unknown, limit: number) {
    return this.asArray(value)
      .map((snapshot) => this.asObject(snapshot))
      .map((snapshot) =>
        this.sanitizeFlatProduct(this.asObject(snapshot.product)),
      )
      .filter(
        (
          product,
        ): product is NonNullable<
          ReturnType<typeof this.sanitizeFlatProduct>
        > => product !== null,
      )
      .slice(0, limit);
  }

  private sanitizeFlatProduct(product: JsonObject): {
    name: string;
    slug: string | null;
    sku: string | null;
    brandName: string | null;
    categoryName: string | null;
    price: string | null;
    comparePrice: string | null;
    shortDescription: string | null;
  } | null {
    const name = this.getString(product.name);

    const slug = this.getString(product.slug);

    const sku = this.getString(product.sku);

    const brandName = this.getString(product.brandName);

    const categoryName = this.getString(product.categoryName);

    if (
      !name ||
      !this.isReadableText(name) ||
      this.isLikelyTestData(name, slug, sku, brandName, categoryName)
    ) {
      return null;
    }

    const shortDescription = this.getString(product.shortDescription);

    return {
      name,
      slug,
      sku,
      brandName: this.isReadableText(brandName) ? brandName : null,
      categoryName: this.isReadableText(categoryName) ? categoryName : null,
      price: this.getDisplayString(product.price),
      comparePrice: this.getDisplayString(product.comparePrice),
      shortDescription: this.isReadableText(shortDescription)
        ? shortDescription
        : null,
    };
  }

  private sanitizeVisitorContext(value: unknown): JsonObject | null {
    const context = this.asObject(value);

    const allowedKeys = [
      'skinType',
      'hairType',
      'concern',
      'deviceNeed',
      'budgetMin',
      'budgetMax',
      'page',
      'locale',
    ];

    const sanitized: JsonObject = {};

    for (const key of allowedKeys) {
      const raw = context[key];

      if (raw === undefined || raw === null) {
        continue;
      }

      if (
        typeof raw === 'string' ||
        typeof raw === 'number' ||
        typeof raw === 'boolean'
      ) {
        sanitized[key] = raw;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  private asObject(value: unknown): JsonObject {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonObject;
    }

    return {};
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private isReadableText(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }

    const mojibakeMarkers = ['Ø', 'Ù', 'Ú', 'Û', '�', 'â€'];

    return !mojibakeMarkers.some((marker) => value.includes(marker));
  }

  private isLikelyTestData(
    ...values: Array<string | null | undefined>
  ): boolean {
    const joined = values.filter(Boolean).join(' ').toLowerCase();

    return (
      joined.includes('test') ||
      joined.includes('تست') ||
      joined.includes('آزمایشی')
    );
  }

  private getDisplayString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      const result = String(value).trim();

      return result.length > 0 ? result : null;
    }

    return null;
  }

  private detectMissingProductContent(snapshot: AiProductSnapshot) {
    const shortDescription = snapshot.product.shortDescription;

    const description = snapshot.product.description;

    return {
      shortDescription:
        !shortDescription || shortDescription.trim().length < 50,
      description: !description || description.trim().length < 200,
      attributes: snapshot.attributes.length === 0,
      images: snapshot.images.length === 0,
      reviews: snapshot.reviews.reviewCount === 0,
    };
  }

  private calculateExistingDiscountPercent(
    snapshot: AiProductSnapshot,
  ): number {
    const price = Number(snapshot.product.price);

    const comparePrice = snapshot.product.comparePrice
      ? Number(snapshot.product.comparePrice)
      : 0;

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(comparePrice) ||
      comparePrice <= price ||
      price <= 0
    ) {
      return 0;
    }

    return Math.round(((comparePrice - price) / comparePrice) * 100);
  }

  private calculateSuggestedDiscountPercent(
    base: number,
    max: number,
    existingDiscount: number,
    snapshot: AiProductSnapshot,
  ): number {
    const safeBase = Math.max(1, Math.min(base, max));

    const hasLowSocialProof = snapshot.reviews.reviewCount < 3;

    const hasIncompleteContent =
      this.detectMissingProductContent(snapshot).description;

    let discount = safeBase;

    if (existingDiscount === 0) {
      discount += 2;
    }

    if (hasLowSocialProof) {
      discount += 2;
    }

    if (hasIncompleteContent) {
      discount += 1;
    }

    return Math.min(max, Math.max(1, discount));
  }

  private async createAiCoupon(
    discountPercent: number,
    expiresInHours: number,
    productPrice: string,
  ) {
    const code = this.generateCouponCode();

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: CouponType.PERCENTAGE,
        value: new Prisma.Decimal(discountPercent),
        description: 'پیشنهاد بازیابی بازدید رهاشده تولیدشده توسط هوش مصنوعی',
        usageLimit: 1,
        usedCount: 0,
        status: CouponStatus.ACTIVE,
        startDate: new Date(),
        endDate: expiresAt,
        minAmount: new Prisma.Decimal(productPrice).mul(0.8),
        isActive: true,
      },
      select: {
        id: true,
        code: true,
      },
    });

    return {
      id: coupon.id,
      code: coupon.code,
      discountPercent,
      expiresAt,
      expiresAtFa: formatPersianDateTime(expiresAt),
    };
  }

  private normalizeDiscountPercent(
    value: unknown,
    fallback: number,
    max: number,
  ): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(max, Math.max(1, Math.round(parsed)));
  }

  private parseJsonObject(value: string): JsonObject {
    const cleaned = this.cleanAiJsonResponse(value);

    try {
      const parsed: unknown = JSON.parse(cleaned);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as JsonObject;
      }
    } catch {
      const extracted = this.extractFirstJsonObject(cleaned);

      if (extracted) {
        try {
          const parsed: unknown = JSON.parse(extracted);

          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as JsonObject;
          }
        } catch {
          return {
            raw: value,
          };
        }
      }
    }

    return {
      raw: value,
    };
  }

  private cleanAiJsonResponse(value: string): string {
    return value
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();
  }

  private extractFirstJsonObject(value: string): string | null {
    const start = value.indexOf('{');

    const end = value.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    return value.slice(start, end + 1);
  }

  private getString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeForMatch(value: string): string {
    return value
      .toLowerCase()
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/إ|أ|آ/g, 'ا')
      .replace(/\u200c/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapRole(role: AIMessageRole): 'user' | 'assistant' | 'system' {
    if (role === AIMessageRole.USER) {
      return 'user';
    }

    if (role === AIMessageRole.SYSTEM) {
      return 'system';
    }

    return 'assistant';
  }

  private buildConversationTitle(message: string): string {
    const cleaned = message.replace(/\s+/g, ' ').trim();

    return cleaned.length > 60 ? `${cleaned.slice(0, 60)}...` : cleaned;
  }

  private generateCouponCode(): string {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();

    return `AI-${random}`;
  }

  private mapConversation<
    T extends {
      createdAt: Date;
      updatedAt: Date;
      deletedAt?: Date | null;
    },
  >(conversation: T) {
    const deletedAt = conversation.deletedAt ?? null;

    return {
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(conversation.createdAt),
      updatedAt: conversation.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(conversation.updatedAt),
      deletedAt: deletedAt ? deletedAt.toISOString() : null,
      deletedAtFa: formatPersianDateTime(deletedAt),
    };
  }

  private mapConversationWithMessages<
    T extends {
      createdAt: Date;
      updatedAt: Date;
      deletedAt?: Date | null;
      messages: Array<{
        createdAt: Date;
        updatedAt: Date;
      }>;
    },
  >(conversation: T) {
    return {
      ...this.mapConversation(conversation),
      messages: conversation.messages.map((message) =>
        this.mapMessage(message),
      ),
    };
  }

  private mapMessage<
    T extends {
      createdAt: Date;
      updatedAt: Date;
    },
  >(message: T) {
    return {
      ...message,
      createdAt: message.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(message.createdAt),
      updatedAt: message.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(message.updatedAt),
    };
  }

  private buildPagination(query: QueryAiConversationDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
    };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private buildDateRange(
    from?: string,
    to?: string,
  ):
    | {
        gte?: Date;
        lte?: Date;
      }
    | undefined {
    if (!from && !to) {
      return undefined;
    }

    const range: {
      gte?: Date;
      lte?: Date;
    } = {};

    if (from) {
      range.gte = this.parseDate(from);
    }

    if (to) {
      range.lte = this.parseDate(to);
    }

    return range;
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    return this.parseDate(value);
  }

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ ارسال‌شده معتبر نیست.');
    }

    return date;
  }
}
