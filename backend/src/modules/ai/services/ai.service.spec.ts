import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AIMessageRole } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AiProductContentMode } from '../dto/ai-product-content.dto';

import { AiEventPublisher } from '../events/ai.event.publisher';

import type {
  AiChatMessage,
  AiProvider,
} from '../interfaces/ai-provider.interface';

import { AiContextService } from './ai-context.service';

import { AiService } from './ai.service';

describe('AiService regression baseline', () => {
  const createdAt = new Date('2026-07-10T08:00:00.000Z');

  const updatedAt = new Date('2026-07-11T09:00:00.000Z');

  const createConversationRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'conversation-1',
    externalId: null,
    userId: 'user-1',
    title: 'مشاوره سرم پوست',
    createdAt,
    updatedAt,
    deletedAt: null,
    ...overrides,
  });

  const createMessageRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'message-1',
    conversationId: 'conversation-1',
    role: AIMessageRole.USER,
    content: 'پیام کاربر',
    createdAt,
    updatedAt,
    ...overrides,
  });

  let conversationCreate: jest.Mock;
  let conversationFindMany: jest.Mock;
  let conversationCount: jest.Mock;
  let conversationFindFirst: jest.Mock;
  let conversationUpdate: jest.Mock;

  let messageCreate: jest.Mock;
  let messageFindMany: jest.Mock;

  let transaction: jest.Mock;
  let executeRaw: jest.Mock;
  let aiRunLogCreate: jest.Mock;
  let couponCreate: jest.Mock;

  let getStoreSnapshot: jest.Mock;
  let searchCatalog: jest.Mock;
  let getUserBehaviorContext: jest.Mock;
  let getProductSnapshot: jest.Mock;
  let getProductSnapshots: jest.Mock;

  let providerGenerate: jest.Mock;

  let publishConversationCreated: jest.Mock;
  let publishMessageCreated: jest.Mock;
  let publishProductAdviceGenerated: jest.Mock;
  let publishProductComparisonGenerated: jest.Mock;
  let publishProductContentGenerated: jest.Mock;
  let publishProductContentApplied: jest.Mock;
  let publishArticleDraftGenerated: jest.Mock;
  let publishAbandonedOfferGenerated: jest.Mock;

  let service: AiService;

  beforeEach(() => {
    conversationCreate = jest.fn();

    conversationFindMany = jest.fn();

    conversationCount = jest.fn();

    conversationFindFirst = jest.fn();

    conversationUpdate = jest.fn();

    messageCreate = jest.fn();

    messageFindMany = jest.fn();

    transaction = jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );

    executeRaw = jest.fn();

    aiRunLogCreate = jest.fn();

    couponCreate = jest.fn();

    getStoreSnapshot = jest.fn();

    searchCatalog = jest.fn();

    getUserBehaviorContext = jest.fn();

    getProductSnapshot = jest.fn();

    getProductSnapshots = jest.fn();

    providerGenerate = jest.fn();

    publishConversationCreated = jest.fn();

    publishMessageCreated = jest.fn();

    publishProductAdviceGenerated = jest.fn();

    publishProductComparisonGenerated = jest.fn();

    publishProductContentGenerated = jest.fn();

    publishProductContentApplied = jest.fn();

    publishArticleDraftGenerated = jest.fn();

    publishAbandonedOfferGenerated = jest.fn();

    const prisma = {
      aIConversation: {
        create: conversationCreate,
        findMany: conversationFindMany,
        count: conversationCount,
        findFirst: conversationFindFirst,
        update: conversationUpdate,
      },
      aIMessage: {
        create: messageCreate,
        findMany: messageFindMany,
      },
      aiRunLog: {
        create: aiRunLogCreate,
      },
      coupon: {
        create: couponCreate,
      },
      $transaction: transaction,
      $executeRaw: executeRaw,
    } as unknown as PrismaService;

    const contextService = {
      getStoreSnapshot,
      searchCatalog,
      getUserBehaviorContext,
      getProductSnapshot,
      getProductSnapshots,
    } as unknown as AiContextService;

    const aiProvider = {
      generate: providerGenerate,
    } as unknown as AiProvider;

    const eventPublisher = {
      publishConversationCreated,
      publishMessageCreated,
      publishProductAdviceGenerated,
      publishProductComparisonGenerated,
      publishProductContentGenerated,
      publishProductContentApplied,
      publishArticleDraftGenerated,
      publishAbandonedOfferGenerated,
    } as unknown as AiEventPublisher;

    service = new AiService(prisma, contextService, aiProvider, eventPublisher);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const prepareSuccessfulChat = () => {
    messageFindMany.mockResolvedValue([]);

    getStoreSnapshot.mockResolvedValue({
      language: 'fa',
      categories: [],
      brands: [],
      topProducts: [],
    });

    searchCatalog.mockResolvedValue({
      products: [],
      total: 0,
    });

    getUserBehaviorContext.mockResolvedValue({
      cartItems: [],
      wishlistItems: [],
      recentPurchasedProducts: [],
    });

    getProductSnapshots.mockResolvedValue([]);

    messageCreate
      .mockResolvedValueOnce(
        createMessageRow({
          id: 'user-message',
          role: AIMessageRole.USER,
          content: 'یک سرم مناسب پوست خشک معرفی کن',
        }),
      )
      .mockResolvedValueOnce(
        createMessageRow({
          id: 'assistant-message',
          role: AIMessageRole.ASSISTANT,
          content: 'پاسخ ایمن و دقیق',
        }),
      );

    providerGenerate.mockResolvedValue({
      content: 'پاسخ ایمن و دقیق',
      model: 'local-sales-model',
    });

    conversationUpdate.mockResolvedValue(createConversationRow());
  };

  it('creates and maps a conversation while publishing its event', async () => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-07-12T12:00:00.000Z'));

    conversationCreate.mockResolvedValue(
      createConversationRow({
        externalId: 'external-1',
        title: 'عنوان سفارشی',
      }),
    );

    const result = await service.createConversation(
      'user-1',
      '  عنوان سفارشی  ',
      '  external-1  ',
      'admin-1',
    );

    const conversationCreateCalls = conversationCreate.mock
      .calls as unknown as Array<
      [
        {
          data: {
            userId: string;
            title: string;
            externalId: string | null;
          };
          select: unknown;
        },
      ]
    >;

    const conversationCreateInput = conversationCreateCalls[0]?.[0];

    expect(conversationCreateInput?.data).toEqual({
      userId: 'user-1',
      title: 'عنوان سفارشی',
      externalId: 'external-1',
    });

    expect(conversationCreateInput?.select).toBeDefined();
    expect(typeof conversationCreateInput?.select).toBe('object');

    expect(publishConversationCreated).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      userId: 'user-1',
      externalId: 'external-1',
      actorId: 'admin-1',
      occurredAt: new Date('2026-07-12T12:00:00.000Z'),
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'conversation-1',
        title: 'عنوان سفارشی',
        externalId: 'external-1',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        deletedAt: null,
      }),
    );

    expect(typeof result.createdAtFa).toBe('string');
    expect(typeof result.updatedAtFa).toBe('string');
  });

  it('uses the default conversation title and null external id for blank inputs', async () => {
    conversationCreate.mockResolvedValue(
      createConversationRow({
        title: 'مشاوره هوشمند',
      }),
    );

    await service.createConversation('user-1', '   ', '   ');

    expect(conversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'user-1',
          title: 'مشاوره هوشمند',
          externalId: null,
        },
      }),
    );
  });

  it('returns filtered and paginated conversations with mapped dates', async () => {
    conversationFindMany.mockResolvedValue([createConversationRow()]);

    conversationCount.mockResolvedValue(5);

    const result = await service.findConversations('user-1', {
      page: 2,
      limit: 2,
      q: 'سرم',
      createdFrom: '2026-07-01T00:00:00.000Z',
      createdTo: '2026-07-31T23:59:59.000Z',
    });

    expect(conversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          deletedAt: null,
          title: {
            contains: 'سرم',
            mode: 'insensitive',
          },
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-31T23:59:59.000Z'),
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip: 2,
        take: 2,
      }),
    );

    expect(conversationCount).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        deletedAt: null,
        title: {
          contains: 'سرم',
          mode: 'insensitive',
        },
        createdAt: {
          gte: new Date('2026-07-01T00:00:00.000Z'),
          lte: new Date('2026-07-31T23:59:59.000Z'),
        },
      },
    });

    expect(result.meta).toEqual({
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'conversation-1',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      }),
    );
  });

  it('rejects an invalid conversation date before querying Prisma', async () => {
    await expect(
      service.findConversations('user-1', {
        createdFrom: 'not-a-date',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns one conversation with chronologically mapped messages', async () => {
    const messageCreatedAt = new Date('2026-07-10T10:00:00.000Z');

    const messageUpdatedAt = new Date('2026-07-10T10:01:00.000Z');

    conversationFindFirst.mockResolvedValue({
      ...createConversationRow(),
      messages: [
        createMessageRow({
          createdAt: messageCreatedAt,
          updatedAt: messageUpdatedAt,
        }),
      ],
    });

    const result = await service.findConversation('user-1', 'conversation-1');

    expect(conversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'conversation-1',
          userId: 'user-1',
          deletedAt: null,
        },
      }),
    );

    expect(result.messages).toEqual([
      expect.objectContaining({
        id: 'message-1',
        createdAt: messageCreatedAt.toISOString(),
        updatedAt: messageUpdatedAt.toISOString(),
      }),
    ]);

    expect(typeof result.messages[0]?.createdAtFa).toBe('string');
    expect(typeof result.messages[0]?.updatedAtFa).toBe('string');
  });

  it('throws when the requested conversation does not exist', async () => {
    conversationFindFirst.mockResolvedValue(null);

    await expect(
      service.findConversation('user-1', 'missing-conversation'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes an owned conversation and returns deletion metadata', async () => {
    jest.useFakeTimers();

    const deletedAt = new Date('2026-07-12T14:30:00.000Z');

    jest.setSystemTime(deletedAt);

    conversationFindFirst.mockResolvedValue({
      ...createConversationRow(),
      messages: [],
    });

    conversationUpdate.mockResolvedValue(
      createConversationRow({
        deletedAt,
      }),
    );

    const result = await service.removeConversation('user-1', 'conversation-1');

    expect(conversationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'conversation-1',
      },
      data: {
        deletedAt,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: 'گفت‌وگوی هوشمند با موفقیت حذف شد.',
        deletedAt: deletedAt.toISOString(),
      }),
    );

    expect(typeof result.deletedAtFa).toBe('string');
  });

  it('runs the complete chat flow for an existing conversation', async () => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-07-12T15:00:00.000Z'));

    prepareSuccessfulChat();

    conversationFindFirst.mockResolvedValue(createConversationRow());

    messageFindMany.mockResolvedValue([
      createMessageRow({
        id: 'history-assistant',
        role: AIMessageRole.ASSISTANT,
        content: 'پاسخ قبلی',
        createdAt: new Date('2026-07-10T10:01:00.000Z'),
      }),
      createMessageRow({
        id: 'history-user',
        role: AIMessageRole.USER,
        content: 'پرسش قبلی',
        createdAt: new Date('2026-07-10T10:00:00.000Z'),
      }),
    ]);

    const result = await service.chat('user-1', {
      conversationId: 'conversation-1',
      message: 'یک سرم مناسب پوست خشک معرفی کن',
      productIds: ['product-1'],
      visitorContext: {
        skinType: 'dry',
      },
    });

    expect(getStoreSnapshot).toHaveBeenCalledTimes(1);

    expect(searchCatalog).toHaveBeenCalledWith({
      query: 'یک سرم مناسب پوست خشک معرفی کن',
      productIds: ['product-1'],
      limit: 8,
    });

    expect(getUserBehaviorContext).toHaveBeenCalledWith('user-1');

    expect(getProductSnapshots).toHaveBeenCalledWith(['product-1']);

    const providerCall = providerGenerate.mock.calls[0] as [
      AiChatMessage[],
      Record<string, unknown>,
    ];

    const messages = providerCall[0];

    const options = providerCall[1];

    expect(messages.map((message) => message.role)).toEqual([
      'system',
      'system',
      'user',
      'assistant',
      'user',
    ]);

    expect(messages[2]?.content).toBe('پرسش قبلی');

    expect(messages[3]?.content).toBe('پاسخ قبلی');

    expect(messages[4]?.content).toContain('یک سرم مناسب پوست خشک معرفی کن');

    expect(options).toEqual({
      task: 'sales',
      temperature: 0.4,
      maxTokens: 1200,
      userId: 'user-1',
      promptKey: 'customer-chat',
      metadata: {
        conversationId: 'conversation-1',
        hasSelectedProducts: true,
      },
    });

    expect(messageCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: {
          conversationId: 'conversation-1',
          role: AIMessageRole.USER,
          content: 'یک سرم مناسب پوست خشک معرفی کن',
        },
      }),
    );

    expect(messageCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: {
          conversationId: 'conversation-1',
          role: AIMessageRole.ASSISTANT,
          content: 'پاسخ ایمن و دقیق',
        },
      }),
    );

    expect(publishMessageCreated).toHaveBeenCalledTimes(2);

    expect(conversationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'conversation-1',
      },
      data: {
        updatedAt: new Date('2026-07-12T15:00:00.000Z'),
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        conversationId: 'conversation-1',
        answer: 'پاسخ ایمن و دقیق',
        model: 'local-sales-model',
      }),
    );

    expect(result.messages.user).toEqual(
      expect.objectContaining({
        id: 'user-message',
        role: AIMessageRole.USER,
      }),
    );

    expect(result.messages.assistant).toEqual(
      expect.objectContaining({
        id: 'assistant-message',
        role: AIMessageRole.ASSISTANT,
      }),
    );
  });

  it('rejects chat when an explicitly requested conversation is missing', async () => {
    conversationFindFirst.mockResolvedValue(null);

    await expect(
      service.chat('user-1', {
        conversationId: 'missing-conversation',
        message: 'یک محصول معرفی کن',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(providerGenerate).not.toHaveBeenCalled();

    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('creates a new external conversation with a normalized truncated title', async () => {
    prepareSuccessfulChat();

    conversationFindFirst.mockResolvedValue(null);

    conversationCreate.mockResolvedValue(
      createConversationRow({
        externalId: 'visitor-session-1',
      }),
    );

    const longMessage = `  ${'محصول مناسب پوست خشک '.repeat(8)}  `;

    await service.chat('user-1', {
      externalId: 'visitor-session-1',
      message: longMessage,
    });

    expect(conversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          externalId: 'visitor-session-1',
          userId: 'user-1',
          deletedAt: null,
        },
      }),
    );

    const createCalls = conversationCreate.mock.calls as unknown as Array<
      [
        {
          data: {
            userId: string;
            title: string;
            externalId: string;
          };
        },
      ]
    >;

    const createInput = createCalls[0]?.[0];

    if (!createInput) {
      throw new Error('Expected the external conversation creation call.');
    }

    expect(createInput.data.userId).toBe('user-1');

    expect(createInput.data.externalId).toBe('visitor-session-1');

    expect(createInput.data.title).toHaveLength(63);

    expect(createInput.data.title.endsWith('...')).toBe(true);

    expect(createInput.data.title).not.toContain('  ');

    expect(publishConversationCreated).toHaveBeenCalledTimes(1);

    expect(providerGenerate).toHaveBeenCalledTimes(1);
  });

  const createProductSnapshot = (
    productId: string,
    productName = `Product ${productId}`,
  ) => ({
    product: {
      id: productId,
      name: productName,
      slug: `product-${productId}`,
      sku: `SKU-${productId}`,
      description: null,
      shortDescription: 'توضیح کوتاه محصول',
      price: '100000',
      comparePrice: null,
      brandName: 'Vexo',
      categoryName: 'Skin Care',
      averageRating: '4.5',
      reviewCount: 10,
      viewCount: 100,
      isActive: true,
      status: 'ACTIVE',
    },
    variants: [],
    images: [],
    attributes: [],
    inventory: [],
    reviews: {
      averageRating: '4.5',
      reviewCount: 10,
      latestComments: [],
    },
  });

  const getProviderCall = (): [AiChatMessage[], Record<string, unknown>] => {
    const calls = providerGenerate.mock.calls as unknown as Array<
      [AiChatMessage[], Record<string, unknown>]
    >;

    const call = calls[0];

    if (!call) {
      throw new Error('Expected one AI provider call.');
    }

    return call;
  };

  it('builds sanitized public context and cleans the public consultation answer', async () => {
    getStoreSnapshot.mockResolvedValue({
      language: 'fa',
      categories: [
        {
          id: 'category-1',
          name: 'Skin Care',
          slug: 'skin-care',
        },
        {
          id: 'category-demo',
          name: 'Test Category',
          slug: 'test-category',
        },
      ],
      brands: [
        {
          id: 'brand-1',
          name: 'Vexo',
          slug: 'vexo',
        },
      ],
      topProducts: [
        createProductSnapshot('top-product', 'Top Product').product,
      ],
    });

    searchCatalog.mockResolvedValue({
      products: [
        createProductSnapshot('catalog-product', 'Catalog Product').product,
        createProductSnapshot('test-product', 'Test Product').product,
      ],
      total: 2,
    });

    getProductSnapshots.mockResolvedValue([
      createProductSnapshot('selected-product', 'Selected Product'),
    ]);

    providerGenerate.mockResolvedValue({
      content: '```خرید کنید```',
      model: 'public-sales-model',
    });

    const result = await service.publicConsult({
      message: 'یک سرم مناسب معرفی کن',
      productIds: ['selected-product'],
      visitorContext: {
        skinType: 'dry',
        budgetMax: 500000,
        secretToken: 'must-not-leak',
      },
    });

    expect(getStoreSnapshot).toHaveBeenCalledTimes(1);

    expect(searchCatalog).toHaveBeenCalledWith({
      query: 'یک سرم مناسب معرفی کن',
      productIds: ['selected-product'],
      limit: 5,
    });

    expect(getProductSnapshots).toHaveBeenCalledWith(['selected-product']);

    expect(getUserBehaviorContext).not.toHaveBeenCalled();

    const [messages, options] = getProviderCall();

    expect(messages.map((message) => message.role)).toEqual([
      'system',
      'system',
      'user',
    ]);

    const contextPrompt = messages[1]?.content ?? '';

    expect(contextPrompt).toContain('Skin Care');

    expect(contextPrompt).toContain('Catalog Product');

    expect(contextPrompt).toContain('Selected Product');

    expect(contextPrompt).toContain('dry');

    expect(contextPrompt).not.toContain('Test Category');

    expect(contextPrompt).not.toContain('Test Product');

    expect(contextPrompt).not.toContain('secretToken');

    expect(options).toEqual({
      task: 'sales',
      temperature: 0.35,
      maxTokens: 512,
      promptKey: 'public-consult',
      metadata: {
        scope: 'public',
        hasSelectedProducts: true,
        contextReturned: false,
      },
    });

    expect(result).toEqual({
      answer: 'مشاهده محصول',
      model: 'public-sales-model',
    });
  });

  it('skips selected-product loading for public consultation without product ids', async () => {
    getStoreSnapshot.mockResolvedValue({
      language: 'fa',
      categories: [],
      brands: [],
      topProducts: [],
    });

    searchCatalog.mockResolvedValue({
      products: [],
      total: 0,
    });

    providerGenerate.mockResolvedValue({
      content: 'پاسخ عمومی',
      model: 'public-model',
    });

    const result = await service.publicConsult({
      message: 'راهنمایی خرید می‌خواهم',
    });

    expect(getProductSnapshots).not.toHaveBeenCalled();

    const [, options] = getProviderCall();

    expect(options).toEqual({
      task: 'sales',
      temperature: 0.35,
      maxTokens: 512,
      promptKey: 'public-consult',
      metadata: {
        scope: 'public',
        hasSelectedProducts: false,
        contextReturned: false,
      },
    });

    expect(result).toEqual({
      answer: 'پاسخ عمومی',
      model: 'public-model',
    });
  });

  it('generates product advice with full context and publishes its event', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-12T16:00:00.000Z');

    jest.setSystemTime(occurredAt);

    const catalog = {
      products: [createProductSnapshot('product-1', 'Hydrating Serum').product],
      total: 1,
    };

    const snapshots = [createProductSnapshot('product-1', 'Hydrating Serum')];

    searchCatalog.mockResolvedValue(catalog);

    getProductSnapshots.mockResolvedValue(snapshots);

    providerGenerate.mockResolvedValue({
      content: '```برند معتبر را امتحان کنید```',
      model: 'consulting-model',
    });

    const result = await service.generateProductAdvice(
      {
        request: 'برای پوست خشک سرم معرفی کن',
        categoryId: 'category-1',
        brandId: 'brand-1',
        productIds: ['product-1'],
        budgetMin: 100000,
        budgetMax: 500000,
        skinType: 'dry',
        hairType: 'normal',
        concern: 'رطوبت',
        deviceNeed: 'none',
        extra: {
          locale: 'fa',
        },
      },
      'admin-1',
    );

    expect(searchCatalog).toHaveBeenCalledWith({
      query: 'برای پوست خشک سرم معرفی کن',
      productIds: ['product-1'],
      categoryId: 'category-1',
      brandId: 'brand-1',
      budgetMin: 100000,
      budgetMax: 500000,
      limit: 10,
    });

    expect(getProductSnapshots).toHaveBeenCalledWith(['product-1']);

    const [messages, options] = getProviderCall();

    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);

    expect(messages[1]?.content).toContain('برای پوست خشک سرم معرفی کن');

    expect(options).toEqual({
      task: 'consulting',
      temperature: 0.3,
      maxTokens: 1200,
      promptKey: 'product-advice',
      metadata: {
        actorId: 'admin-1',
      },
    });

    expect(publishProductAdviceGenerated).toHaveBeenCalledWith({
      productIds: ['product-1'],
      request: 'برای پوست خشک سرم معرفی کن',
      actorId: 'admin-1',
      occurredAt,
    });

    expect(result.answer).toBe('برند را بررسی کنید');

    expect(result.model).toBe('consulting-model');

    expect(result.context.catalog).toBe(catalog);

    expect(result.context.selectedProducts).toBe(snapshots);

    expect(result.context.customerProfile).toEqual({
      skinType: 'dry',
      hairType: 'normal',
      concern: 'رطوبت',
      deviceNeed: 'none',
      budgetMin: 100000,
      budgetMax: 500000,
      extra: {
        locale: 'fa',
      },
    });
  });

  it('skips snapshot loading when product advice has no selected products', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-12T16:30:00.000Z');

    jest.setSystemTime(occurredAt);

    searchCatalog.mockResolvedValue({
      products: [],
      total: 0,
    });

    providerGenerate.mockResolvedValue({
      content: 'پاسخ مشاوره',
      model: 'consulting-model',
    });

    const result = await service.generateProductAdvice({
      request: 'محصول مناسب معرفی کن',
    });

    expect(getProductSnapshots).not.toHaveBeenCalled();

    expect(publishProductAdviceGenerated).toHaveBeenCalledWith({
      productIds: [],
      request: 'محصول مناسب معرفی کن',
      actorId: undefined,
      occurredAt,
    });

    expect(result.context.selectedProducts).toEqual([]);
  });

  it('does not publish a product-advice event when the provider fails', async () => {
    const failure = new Error('Advice provider failed');

    searchCatalog.mockResolvedValue({
      products: [],
      total: 0,
    });

    providerGenerate.mockRejectedValue(failure);

    await expect(
      service.generateProductAdvice({
        request: 'محصول مناسب معرفی کن',
      }),
    ).rejects.toBe(failure);

    expect(publishProductAdviceGenerated).not.toHaveBeenCalled();
  });

  it('rejects comparison when fewer than two product snapshots resolve', async () => {
    getProductSnapshots.mockResolvedValue([createProductSnapshot('product-1')]);

    await expect(
      service.compareProducts({
        productIds: ['product-1', 'missing-product'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(providerGenerate).not.toHaveBeenCalled();

    expect(publishProductComparisonGenerated).not.toHaveBeenCalled();
  });

  it('uses the short comparison token policy and publishes the comparison event', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-12T17:00:00.000Z');

    jest.setSystemTime(occurredAt);

    const snapshots = [
      createProductSnapshot('product-1', 'First Product'),
      createProductSnapshot('product-2', 'Second Product'),
    ];

    getProductSnapshots.mockResolvedValue(snapshots);

    providerGenerate.mockResolvedValue({
      content: 'خرید کنید',
      model: 'comparison-model',
    });

    const result = await service.compareProducts(
      {
        productIds: ['product-1', 'product-2'],
        question: 'یک مقایسه خلاصه ارائه کن',
        customerProfile: 'پوست خشک',
      },
      'admin-1',
    );

    const [messages, options] = getProviderCall();

    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);

    expect(messages[1]?.content).toContain('First Product');

    expect(messages[1]?.content).toContain('Second Product');

    expect(options).toEqual({
      task: 'comparison',
      temperature: 0.2,
      maxTokens: 450,
      promptKey: 'product-comparison',
      metadata: {
        actorId: 'admin-1',
        productCount: 2,
      },
    });

    expect(publishProductComparisonGenerated).toHaveBeenCalledWith({
      productIds: ['product-1', 'product-2'],
      actorId: 'admin-1',
      occurredAt,
    });

    expect(result.answer).toBe('مشاهده محصول');

    expect(result.model).toBe('comparison-model');

    expect(result.context).toEqual({
      question: 'یک مقایسه خلاصه ارائه کن',
      customerProfile: 'پوست خشک',
      products: snapshots,
    });
  });

  it('uses the standard comparison token budget for a normal question', async () => {
    getProductSnapshots.mockResolvedValue([
      createProductSnapshot('product-1'),
      createProductSnapshot('product-2'),
    ]);

    providerGenerate.mockResolvedValue({
      content: 'پاسخ مقایسه',
      model: 'comparison-model',
    });

    await service.compareProducts({
      productIds: ['product-1', 'product-2'],
      question: 'این دو محصول چه تفاوتی دارند؟',
    });

    const [, options] = getProviderCall();

    expect(options).toEqual({
      task: 'comparison',
      temperature: 0.2,
      maxTokens: 900,
      promptKey: 'product-comparison',
      metadata: {
        actorId: null,
        productCount: 2,
      },
    });
  });

  it('does not publish a comparison event when the provider fails', async () => {
    const failure = new Error('Comparison provider failed');

    getProductSnapshots.mockResolvedValue([
      createProductSnapshot('product-1'),
      createProductSnapshot('product-2'),
    ]);

    providerGenerate.mockRejectedValue(failure);

    await expect(
      service.compareProducts({
        productIds: ['product-1', 'product-2'],
      }),
    ).rejects.toBe(failure);

    expect(publishProductComparisonGenerated).not.toHaveBeenCalled();
  });

  it('generates normalized full product content with the default mode', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-12T18:00:00.000Z');

    jest.setSystemTime(occurredAt);

    const snapshot = createProductSnapshot('product-1', 'سرم پوست Vexo');

    getProductSnapshot.mockResolvedValue(snapshot);

    providerGenerate.mockResolvedValue({
      content: JSON.stringify({
        shortDescription:
          'سرم پوست Vexo برای روتین مراقبت پوست قابل بررسی است.',
        description:
          'سرم پوست Vexo بر اساس اطلاعات ثبت‌شده برای بررسی در روتین مراقبت پوست قابل انتخاب است.',
        seoTitle: 'سرم پوست Vexo | VEXO Beauty',
        seoDescription: 'بررسی سرم پوست Vexo در فروشگاه VEXO Beauty.',
        sellingPoints: ['محصول برند Vexo', 'قابل بررسی برای روتین مراقبت پوست'],
        faq: [
          {
            question: 'سرم پوست Vexo برای چه استفاده‌ای قابل بررسی است؟',
            answer: 'برای بررسی در روتین مراقبت پوست قابل انتخاب است.',
          },
        ],
        adCopy: 'سرم پوست Vexo را در VEXO Beauty بررسی کنید.',
      }),
      model: 'content-model',
    });

    const result = await service.generateProductContent(
      {
        productId: 'product-1',
      },
      'admin-1',
    );

    expect(getProductSnapshot).toHaveBeenCalledWith('product-1');

    const [messages, options] = getProviderCall();

    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);

    expect(messages[1]?.content).toContain('سرم پوست Vexo');

    expect(options).toEqual({
      task: 'content',
      temperature: 0.18,
      maxTokens: 1800,
      json: true,
      promptKey: 'product-content-full',
      metadata: {
        actorId: 'admin-1',
        productId: 'product-1',
        mode: AiProductContentMode.FULL,
      },
    });

    expect(result).toEqual({
      productId: 'product-1',
      mode: AiProductContentMode.FULL,
      content: {
        shortDescription:
          'سرم پوست Vexo برای روتین مراقبت پوست قابل بررسی است.',
        description:
          'سرم پوست Vexo بر اساس اطلاعات ثبت‌شده برای بررسی در روتین مراقبت پوست قابل انتخاب است.',
        seoTitle: 'سرم پوست Vexo | VEXO Beauty',
        seoDescription: 'بررسی سرم پوست Vexo در فروشگاه VEXO Beauty.',
        sellingPoints: ['محصول برند Vexo', 'قابل بررسی برای روتین مراقبت پوست'],
        faq: [
          {
            question: 'سرم پوست Vexo برای چه استفاده‌ای قابل بررسی است؟',
            answer: 'برای بررسی در روتین مراقبت پوست قابل انتخاب است.',
          },
        ],
        adCopy: 'سرم پوست Vexo را در VEXO Beauty بررسی کنید.',
      },
      applied: null,
      model: 'content-model',
      fallbackUsed: false,
      fallbackReason: null,
    });

    expect(executeRaw).not.toHaveBeenCalled();

    expect(publishProductContentApplied).not.toHaveBeenCalled();

    expect(publishProductContentGenerated).toHaveBeenCalledWith({
      productId: 'product-1',
      applied: false,
      actorId: 'admin-1',
      occurredAt,
    });
  });

  it('returns safe fallback content when the provider rejects', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-12T18:30:00.000Z');

    jest.setSystemTime(occurredAt);

    const baseSnapshot = createProductSnapshot('product-1', 'سرم پوست چرب');

    const snapshot = {
      ...baseSnapshot,
      product: {
        ...baseSnapshot.product,
        categoryName: 'مراقبت پوست',
        shortDescription: 'محصول پوست چرب و مختلط با بافت سبک و آبرسانی ملایم',
      },
    };

    getProductSnapshot.mockResolvedValue(snapshot);

    providerGenerate.mockRejectedValue(
      new Error('Content provider unavailable'),
    );

    const result = await service.generateProductContent({
      productId: 'product-1',
    });

    expect(result.productId).toBe('product-1');

    expect(result.mode).toBe(AiProductContentMode.FULL);

    expect(result.model).toBe('safe-fallback');

    expect(result.fallbackUsed).toBe(true);

    expect(result.fallbackReason).toBe('Content provider unavailable');

    expect(result.content.shortDescription).toContain('پوست چرب و مختلط');

    expect(Object.keys(result.content)).toEqual([
      'shortDescription',
      'description',
      'seoTitle',
      'seoDescription',
      'sellingPoints',
      'faq',
      'adCopy',
    ]);

    expect(publishProductContentGenerated).toHaveBeenCalledWith({
      productId: 'product-1',
      applied: false,
      actorId: undefined,
      occurredAt,
    });
  });

  it('uses mode-filtered SEO fallback when the provider returns malformed JSON', async () => {
    const snapshot = createProductSnapshot('product-1', 'کرم مراقبت پوست');

    getProductSnapshot.mockResolvedValue(snapshot);

    providerGenerate.mockResolvedValue({
      content: 'this is not valid json',
      model: 'malformed-content-model',
    });

    const result = await service.generateProductContent({
      productId: 'product-1',
      mode: AiProductContentMode.SEO,
    });

    const [, options] = getProviderCall();

    expect(options).toEqual({
      task: 'content',
      temperature: 0.18,
      maxTokens: 500,
      json: true,
      promptKey: 'product-content-seo',
      metadata: {
        actorId: null,
        productId: 'product-1',
        mode: AiProductContentMode.SEO,
      },
    });

    expect(Object.keys(result.content)).toEqual(['seoTitle', 'seoDescription']);

    expect(result.content.seoTitle).toContain('کرم مراقبت پوست');

    expect(result.model).toBe('malformed-content-model');

    expect(result.fallbackUsed).toBe(false);

    expect(result.fallbackReason).toBeNull();
  });

  it('filters FAQ output and uses the FAQ token budget', async () => {
    getProductSnapshot.mockResolvedValue(
      createProductSnapshot('product-1', 'سرم پوست Vexo'),
    );

    providerGenerate.mockResolvedValue({
      content: JSON.stringify({
        shortDescription: 'این فیلد باید حذف شود.',
        faq: [
          {
            question: 'این محصول برای چه استفاده‌ای قابل بررسی است؟',
            answer: 'برای بررسی در روتین مراقبت پوست قابل انتخاب است.',
          },
        ],
      }),
      model: 'faq-content-model',
    });

    const result = await service.generateProductContent({
      productId: 'product-1',
      mode: AiProductContentMode.FAQ,
    });

    const [, options] = getProviderCall();

    expect(options).toEqual({
      task: 'content',
      temperature: 0.18,
      maxTokens: 700,
      json: true,
      promptKey: 'product-content-faq',
      metadata: {
        actorId: null,
        productId: 'product-1',
        mode: AiProductContentMode.FAQ,
      },
    });

    expect(Object.keys(result.content)).toEqual(['faq']);

    expect(result.content.faq).toEqual([
      {
        question: 'این محصول برای چه استفاده‌ای قابل بررسی است؟',
        answer: 'برای بررسی در روتین مراقبت پوست قابل انتخاب است.',
      },
    ]);
  });

  it('uses the description token budget and removes fields outside description mode', async () => {
    getProductSnapshot.mockResolvedValue(
      createProductSnapshot('product-1', 'محصول مراقبتی Vexo'),
    );

    providerGenerate.mockResolvedValue({
      content: JSON.stringify({
        description:
          'محصول مراقبتی Vexo بر اساس اطلاعات ثبت‌شده قابل بررسی است.',
        seoTitle: 'این فیلد باید حذف شود',
      }),
      model: 'description-model',
    });

    const result = await service.generateProductContent({
      productId: 'product-1',
      mode: AiProductContentMode.DESCRIPTION,
    });

    const [, options] = getProviderCall();

    expect(options).toEqual({
      task: 'content',
      temperature: 0.18,
      maxTokens: 900,
      json: true,
      promptKey: 'product-content-description',
      metadata: {
        actorId: null,
        productId: 'product-1',
        mode: AiProductContentMode.DESCRIPTION,
      },
    });

    expect(result.content).toEqual({
      description: 'محصول مراقبتی Vexo بر اساس اطلاعات ثبت‌شده قابل بررسی است.',
    });
  });

  it('replaces unsafe generated product claims with safe fallback content', async () => {
    getProductSnapshot.mockResolvedValue(
      createProductSnapshot('product-1', 'سرم پوست Vexo'),
    );

    providerGenerate.mockResolvedValue({
      content: JSON.stringify({
        shortDescription: 'درمان قطعی آکنه و رفع قطعی لک با تضمین نتیجه',
      }),
      model: 'unsafe-content-model',
    });

    const result = await service.generateProductContent({
      productId: 'product-1',
      mode: AiProductContentMode.SHORT_DESCRIPTION,
    });

    expect(result.content.shortDescription).toContain('سرم پوست Vexo');

    expect(result.content.shortDescription).not.toContain('درمان');

    expect(result.content.shortDescription).not.toContain('آکنه');

    expect(result.content.shortDescription).not.toContain('تضمین نتیجه');

    expect(result.fallbackUsed).toBe(false);
  });

  it('rejects direct product mutation and requires the governed apply workflow', async () => {
    await expect(
      service.generateProductContent(
        {
          productId: 'product-1',
          mode: AiProductContentMode.SHORT_DESCRIPTION,
          applyToProduct: true,
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(getProductSnapshot).not.toHaveBeenCalled();
    expect(providerGenerate).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(publishProductContentApplied).not.toHaveBeenCalled();
    expect(publishProductContentGenerated).not.toHaveBeenCalled();
  });

  it('rejects direct application for unsupported SEO mode without publishing events', async () => {
    getProductSnapshot.mockResolvedValue(
      createProductSnapshot('product-1', 'سرم پوست Vexo'),
    );

    providerGenerate.mockResolvedValue({
      content: JSON.stringify({
        seoTitle: 'سرم پوست Vexo | VEXO Beauty',
        seoDescription: 'بررسی سرم پوست Vexo در فروشگاه VEXO Beauty.',
      }),
      model: 'seo-content-model',
    });

    await expect(
      service.generateProductContent({
        productId: 'product-1',
        mode: AiProductContentMode.SEO,
        applyToProduct: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeRaw).not.toHaveBeenCalled();

    expect(publishProductContentApplied).not.toHaveBeenCalled();

    expect(publishProductContentGenerated).not.toHaveBeenCalled();
  });

  it('builds and records a deterministic article draft without calling the provider', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-13T07:00:00.000Z');

    jest.setSystemTime(occurredAt);

    searchCatalog.mockResolvedValue({
      products: [
        {
          id: 'catalog-product-1',
        },
        {
          id: 'catalog-product-2',
        },
      ],
    });

    getProductSnapshots.mockResolvedValue([
      createProductSnapshot('product-1', 'ژل آبرسان Vexo'),
    ]);

    aiRunLogCreate.mockResolvedValue({
      id: 'run-log-1',
    });

    const result = await service.generateArticleDraft(
      {
        topic: 'راهنمای انتخاب آبرسان پوست چرب',
        productIds: ['product-1'],
        keywords: ['آبرسان', 'پوست چرب'],
      },
      'admin-1',
    );

    expect(searchCatalog).toHaveBeenCalledWith({
      query: 'راهنمای انتخاب آبرسان پوست چرب',
      productIds: ['product-1'],
      categoryId: undefined,
      brandId: undefined,
      limit: 5,
    });

    expect(getProductSnapshots).toHaveBeenCalledWith(['product-1']);

    expect(providerGenerate).not.toHaveBeenCalled();

    expect(result.title).toBe('راهنمای انتخاب آبرسان پوست چرب');

    expect(result.article).toContain('راهنمای انتخاب آبرسان پوست چرب');

    expect(result.article).toContain('ژل آبرسان Vexo');

    expect(result.article).toContain('کلیدواژه‌های مرتبط: آبرسان، پوست چرب');

    expect(result).toMatchObject({
      model: 'backend-deterministic-article-builder',
      fallbackUsed: false,
      fallbackReason: null,
      context: {
        topic: 'راهنمای انتخاب آبرسان پوست چرب',
        keywordCount: 2,
        productCount: 1,
        catalogProductCount: 2,
        safeWordCount: 600,
        source: 'backend-deterministic',
      },
    });

    expect(aiRunLogCreate).toHaveBeenCalledTimes(1);

    const runLogCalls = aiRunLogCreate.mock.calls as unknown[][];

    const runLogInput = runLogCalls[0]?.[0];

    expect(runLogInput).toMatchObject({
      data: {
        taskType: 'CONTENT',
        promptKey: 'article-draft',
        userId: 'admin-1',
        inputJson: {
          topic: 'راهنمای انتخاب آبرسان پوست چرب',
          keywords: ['آبرسان', 'پوست چرب'],
          targetAudience: 'خریداران فروشگاه',
          tone: 'آموزشی، طبیعی، فروشگاهی و بدون اغراق',
          wordCount: 600,
          productCount: 1,
          catalogProductCount: 2,
        },
        outputJson: {
          articleLength: result.article.length,
          backendDeterministic: true,
        },
        provider: 'backend',
        model: 'deterministic-article-builder',
        status: 'SUCCESS',
        latencyMs: 0,
        errorMessage: null,
      },
    });

    expect(publishArticleDraftGenerated).toHaveBeenCalledWith({
      topic: 'راهنمای انتخاب آبرسان پوست چرب',
      productIds: ['product-1'],
      actorId: 'admin-1',
      occurredAt,
    });
  });

  it('caps deterministic article word count and tolerates run-log persistence failure', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-13T07:30:00.000Z');

    jest.setSystemTime(occurredAt);

    searchCatalog.mockResolvedValue({
      products: [],
    });

    aiRunLogCreate.mockRejectedValue(new Error('Run-log database unavailable'));

    const result = await service.generateArticleDraft({
      topic: 'راهنمای روتین مراقبت پوست',
      wordCount: 4000,
    });

    expect(getProductSnapshots).not.toHaveBeenCalled();

    expect(providerGenerate).not.toHaveBeenCalled();

    expect(result.context).toEqual({
      topic: 'راهنمای روتین مراقبت پوست',
      keywordCount: 0,
      productCount: 0,
      catalogProductCount: 0,
      safeWordCount: 700,
      source: 'backend-deterministic',
    });

    expect(result.article).toContain('راهنمای روتین مراقبت پوست');

    expect(publishArticleDraftGenerated).toHaveBeenCalledWith({
      topic: 'راهنمای روتین مراقبت پوست',
      productIds: [],
      actorId: undefined,
      occurredAt,
    });
  });

  it('normalizes an abandoned offer and caps the provider discount', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-13T08:00:00.000Z');

    const viewedAt = new Date('2026-07-12T18:00:00.000Z');

    jest.setSystemTime(occurredAt);

    getProductSnapshot.mockResolvedValue(
      createProductSnapshot('product-1', 'سرم پوست Vexo'),
    );

    providerGenerate.mockResolvedValue({
      content: JSON.stringify({
        shouldOfferDiscount: false,
        discountPercent: 40,
        title: 'متن تولیدشده نباید مستقیماً استفاده شود',
        message: 'محصول محبوب را همین حالا بخرید',
      }),
      model: 'marketing-model',
    });

    const result = await service.generateAbandonedOffer(
      {
        productId: 'product-1',
        userId: 'user-1',
        viewedAt: viewedAt.toISOString(),
      },
      'admin-1',
    );

    const [messages, options] = getProviderCall();

    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);

    expect(options).toEqual({
      task: 'marketing',
      temperature: 0.22,
      maxTokens: 900,
      json: true,
      promptKey: 'abandoned-offer',
      metadata: {
        actorId: 'admin-1',
        productId: 'product-1',
        createCoupon: false,
      },
    });

    expect(result).toMatchObject({
      productId: 'product-1',
      offer: {
        shouldOfferDiscount: false,
        discountPercent: 15,
        title: 'یادآوری سرم پوست Vexo',
        message:
          'سرم پوست Vexo هنوز برای بررسی شما در دسترس است. می‌توانید جزئیات محصول را دوباره مشاهده کنید.',
        urgencyText: 'این پیشنهاد برای مدت محدودی قابل بررسی است.',
        cta: 'مشاهده محصول',
      },
      coupon: null,
      model: 'marketing-model',
      fallbackUsed: false,
      fallbackReason: null,
    });

    expect(result.context).toMatchObject({
      userId: 'user-1',
      visitorId: undefined,
      viewedAt,
      existingDiscountPercent: 0,
      suggestedDiscountPercent: 8,
    });

    expect(couponCreate).not.toHaveBeenCalled();

    expect(publishAbandonedOfferGenerated).toHaveBeenCalledWith({
      productId: 'product-1',
      userId: 'user-1',
      visitorId: null,
      discountPercent: 15,
      couponCode: null,
      actorId: 'admin-1',
      occurredAt,
    });
  });

  it('uses the calculated safe abandoned-offer fallback when the provider fails', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-13T08:30:00.000Z');

    jest.setSystemTime(occurredAt);

    getProductSnapshot.mockResolvedValue(
      createProductSnapshot('product-1', 'کرم مراقبت پوست'),
    );

    providerGenerate.mockRejectedValue(
      new Error('Marketing provider unavailable'),
    );

    const result = await service.generateAbandonedOffer({
      productId: 'product-1',
      visitorId: 'visitor-1',
    });

    expect(result).toMatchObject({
      productId: 'product-1',
      offer: {
        shouldOfferDiscount: true,
        discountPercent: 8,
        title: 'پیشنهاد محدود برای کرم مراقبت پوست',
        cta: 'مشاهده محصول',
      },
      coupon: null,
      model: 'safe-fallback',
      fallbackUsed: true,
      fallbackReason: 'Marketing provider unavailable',
    });

    expect(result.context.viewedAt).toEqual(occurredAt);

    expect(publishAbandonedOfferGenerated).toHaveBeenCalledWith({
      productId: 'product-1',
      userId: null,
      visitorId: 'visitor-1',
      discountPercent: 8,
      couponCode: null,
      actorId: undefined,
      occurredAt,
    });
  });

  it('creates an expiring coupon for an abandoned offer and publishes its code', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-13T09:00:00.000Z');

    const expiresAt = new Date('2026-07-13T21:00:00.000Z');

    jest.setSystemTime(occurredAt);

    getProductSnapshot.mockResolvedValue(
      createProductSnapshot('product-1', 'سرم پوست Vexo'),
    );

    providerGenerate.mockResolvedValue({
      content: JSON.stringify({
        shouldOfferDiscount: true,
        discountPercent: 12,
      }),
      model: 'coupon-marketing-model',
    });

    couponCreate.mockResolvedValue({
      id: 'coupon-1',
      code: 'VEXO-AI-TEST',
    });

    const result = await service.generateAbandonedOffer(
      {
        productId: 'product-1',
        userId: 'user-1',
        createCoupon: true,
        expiresInHours: 12,
      },
      'admin-1',
    );

    expect(couponCreate).toHaveBeenCalledTimes(1);

    const couponCreateCalls = couponCreate.mock.calls as unknown[][];

    const couponCreateInput = couponCreateCalls[0]?.[0];

    expect(couponCreateInput).toMatchObject({
      data: {
        description: 'پیشنهاد بازیابی بازدید رهاشده تولیدشده توسط هوش مصنوعی',
        usageLimit: 1,
        usedCount: 0,
        startDate: occurredAt,
        endDate: expiresAt,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
      },
    });

    expect(
      typeof (
        couponCreateInput as {
          data: {
            code: unknown;
          };
        }
      ).data.code,
    ).toBe('string');

    expect(result.coupon).toMatchObject({
      id: 'coupon-1',
      code: 'VEXO-AI-TEST',
      discountPercent: 12,
      expiresAt,
    });

    if (!result.coupon || !('expiresAtFa' in result.coupon)) {
      throw new Error('Expected coupon Persian expiration text.');
    }

    expect(typeof result.coupon.expiresAtFa).toBe('string');

    expect(result.offer).toMatchObject({
      shouldOfferDiscount: true,
      discountPercent: 12,
    });

    expect(publishAbandonedOfferGenerated).toHaveBeenCalledWith({
      productId: 'product-1',
      userId: 'user-1',
      visitorId: null,
      discountPercent: 12,
      couponCode: 'VEXO-AI-TEST',
      actorId: 'admin-1',
      occurredAt,
    });
  });

  it('rejects an invalid abandoned-offer date before provider or event execution', async () => {
    getProductSnapshot.mockResolvedValue(createProductSnapshot('product-1'));

    await expect(
      service.generateAbandonedOffer({
        productId: 'product-1',
        viewedAt: 'not-a-valid-date',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(getProductSnapshot).toHaveBeenCalledWith('product-1');

    expect(providerGenerate).not.toHaveBeenCalled();

    expect(couponCreate).not.toHaveBeenCalled();

    expect(publishAbandonedOfferGenerated).not.toHaveBeenCalled();
  });

  it('returns the product-recommendation wrapper over generated product advice', async () => {
    jest.useFakeTimers();

    const occurredAt = new Date('2026-07-13T10:00:00.000Z');

    jest.setSystemTime(occurredAt);

    const catalog = {
      products: [],
      total: 0,
    };

    searchCatalog.mockResolvedValue(catalog);

    providerGenerate.mockResolvedValue({
      content: 'پیشنهاد محصول بر اساس نیاز شما آماده است.',
      model: 'recommendation-model',
    });

    const result = await service.recommendProducts(
      {
        request: 'برای پوست خشک محصول مناسب معرفی کن',
        skinType: 'dry',
        concern: 'رطوبت',
        budgetMax: 500000,
      },
      'admin-1',
    );

    expect(searchCatalog).toHaveBeenCalledWith({
      query: 'برای پوست خشک محصول مناسب معرفی کن',
      productIds: undefined,
      categoryId: undefined,
      brandId: undefined,
      budgetMin: undefined,
      budgetMax: 500000,
      limit: 10,
    });

    expect(getProductSnapshots).not.toHaveBeenCalled();

    const [messages, options] = getProviderCall();

    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);

    expect(messages[1]?.content).toContain(
      'برای پوست خشک محصول مناسب معرفی کن',
    );

    expect(options).toEqual({
      task: 'consulting',
      temperature: 0.3,
      maxTokens: 1200,
      promptKey: 'product-advice',
      metadata: {
        actorId: 'admin-1',
      },
    });

    expect(publishProductAdviceGenerated).toHaveBeenCalledWith({
      productIds: [],
      request: 'برای پوست خشک محصول مناسب معرفی کن',
      actorId: 'admin-1',
      occurredAt,
    });

    expect(result).toEqual({
      answer: 'پیشنهاد محصول بر اساس نیاز شما آماده است.',
      model: 'recommendation-model',
      context: {
        request: 'برای پوست خشک محصول مناسب معرفی کن',
        customerProfile: {
          skinType: 'dry',
          hairType: undefined,
          concern: 'رطوبت',
          deviceNeed: undefined,
          budgetMin: undefined,
          budgetMax: 500000,
          extra: undefined,
        },
        catalog,
        selectedProducts: [],
      },
      type: 'PRODUCT_RECOMMENDATION',
    });
  });
});
