import { RequestMethod } from '@nestjs/common';

import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { Test, TestingModule } from '@nestjs/testing';

import { RATE_LIMIT_METADATA } from '../../core/rate-limit/constants/rate-limit.constants';

import { AiPublicAssistantController } from './ai-public-assistant.controller';

import {
  PublicAiChatDto,
  PublicAiConsultingDto,
  PublicAiSalesDto,
} from './dto/public-ai-assistant.dto';

import { PublicAiAssistantService } from './services/public-ai-assistant.service';

describe('AiPublicAssistantController', () => {
  let controller: AiPublicAssistantController;

  const publicChat = jest.fn<Promise<unknown>, [dto: PublicAiChatDto]>();

  const salesAssistant = jest.fn<Promise<unknown>, [dto: PublicAiSalesDto]>();

  const consulting = jest.fn<Promise<unknown>, [dto: PublicAiConsultingDto]>();

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AiPublicAssistantController],
      providers: [
        {
          provide: PublicAiAssistantService,
          useValue: {
            publicChat,
            salesAssistant,
            consulting,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<AiPublicAssistantController>(
      AiPublicAssistantController,
    );
  });

  it('delegates public chat requests and returns the service result', async () => {
    const dto: PublicAiChatDto = {
      message: 'برای پوست خشک چه محصولی مناسب است؟',
      language: 'fa',
      limit: 4,
    };

    const serviceResult = {
      answer: {
        message: 'پیشنهادهای مناسب آماده شد.',
      },
      products: [],
    };

    publicChat.mockResolvedValue(serviceResult);

    await expect(controller.chat(dto)).resolves.toBe(serviceResult);

    expect(publicChat).toHaveBeenCalledTimes(1);

    expect(publicChat).toHaveBeenCalledWith(dto);

    expect(salesAssistant).not.toHaveBeenCalled();

    expect(consulting).not.toHaveBeenCalled();
  });

  it('delegates public sales requests and returns the service result', async () => {
    const dto: PublicAiSalesDto = {
      message: 'برای این محصول متن فروش آماده کن',
      productId: 'f8739d5a-59d8-4b45-bbd0-27ed52b5361f',
      salesGoal: 'افزایش تبدیل',
      audience: 'مشتریان دارای پوست خشک',
    };

    const serviceResult = {
      sales: {
        title: 'پیشنهاد فروش امن',
      },
      products: [],
    };

    salesAssistant.mockResolvedValue(serviceResult);

    await expect(controller.sales(dto)).resolves.toBe(serviceResult);

    expect(salesAssistant).toHaveBeenCalledTimes(1);

    expect(salesAssistant).toHaveBeenCalledWith(dto);

    expect(publicChat).not.toHaveBeenCalled();

    expect(consulting).not.toHaveBeenCalled();
  });

  it('delegates public consulting requests and returns the service result', async () => {
    const dto: PublicAiConsultingDto = {
      question: 'یک روتین ساده پیشنهاد بده',
      skinType: 'خشک',
      concerns: ['کم‌آبی', 'حساسیت'],
      budgetHint: 'اقتصادی',
    };

    const serviceResult = {
      consulting: {
        title: 'مشاوره انتخاب محصول',
      },
      products: [],
    };

    consulting.mockResolvedValue(serviceResult);

    await expect(controller.consulting(dto)).resolves.toBe(serviceResult);

    expect(consulting).toHaveBeenCalledTimes(1);

    expect(consulting).toHaveBeenCalledWith(dto);

    expect(publicChat).not.toHaveBeenCalled();

    expect(salesAssistant).not.toHaveBeenCalled();
  });

  it('preserves controller routes, POST methods, and search rate-limit metadata', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, AiPublicAssistantController),
    ).toBe('ai/public');

    const routes = [
      {
        methodName: 'chat',
        path: 'chat',
      },
      {
        methodName: 'sales',
        path: 'sales',
      },
      {
        methodName: 'consulting',
        path: 'consulting',
      },
    ];

    for (const route of routes) {
      const handler = Object.getOwnPropertyDescriptor(
        AiPublicAssistantController.prototype,
        route.methodName,
      )?.value as unknown;

      if (typeof handler !== 'function') {
        throw new Error(`Controller handler not found: ${route.methodName}`);
      }
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(route.path);

      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.POST,
      );

      expect(Reflect.getMetadata(RATE_LIMIT_METADATA.PROFILE, handler)).toBe(
        'search',
      );
    }
  });
});
