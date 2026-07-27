import { ConfigService } from '@nestjs/config';

import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';

import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: <T = string>(key: string, defaultValue?: T): T | string => {
              const values: Record<string, string> = {
                'app.name': 'VEXO Beauty Backend',
                'app.env': 'test',
              };

              return values[key] ?? defaultValue ?? '';
            },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return root service status', () => {
      const result = appController.getRoot();

      expect(result.success).toBe(true);
      expect(result.service).toBe('VEXO Beauty Backend');
      expect(result.environment).toBe('test');
      expect(result.message).toBe(
        'سرویس فروشگاه وکسو بیوتی با موفقیت فعال است.',
      );
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
