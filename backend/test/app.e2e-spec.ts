import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const configValues: Record<string, string> = {
      'app.name': 'VEXO Beauty Backend',
      'app.env': 'test',
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: <T = string>(key: string, defaultValue?: T): T | string =>
              configValues[key] ?? defaultValue ?? '',
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((response) => {
        const body = response.body as Record<string, unknown>;

        expect(body).toEqual(
          expect.objectContaining({
            success: true,
            message: expect.any(String),
            service: 'VEXO Beauty Backend',
            environment: 'test',
            timestamp: expect.any(String),
          }),
        );

        expect(Number.isNaN(Date.parse(String(body.timestamp)))).toBe(false);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
