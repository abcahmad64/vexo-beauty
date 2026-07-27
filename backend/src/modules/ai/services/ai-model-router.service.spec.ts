import { AiModelRouterService } from './ai-model-router.service';

const AI_ENV_KEYS = [
  'AI_OLLAMA_ADMIN_REPORT_MODEL',
  'AI_OLLAMA_ALT_TEXT_MODEL',
  'AI_OLLAMA_ANALYTICS_MODEL',
  'AI_OLLAMA_BANNER_TEXT_MODEL',
  'AI_OLLAMA_COMPARISON_MODEL',
  'AI_OLLAMA_CONSULTING_MODEL',
  'AI_OLLAMA_CONTENT_MODEL',
  'AI_OLLAMA_CREATIVE_TEMPERATURE',
  'AI_OLLAMA_DEFAULT_MODEL',
  'AI_OLLAMA_DEMAND_ANALYSIS_MODEL',
  'AI_OLLAMA_DISCOUNT_MODEL',
  'AI_OLLAMA_EMBEDDING_MODEL',
  'AI_OLLAMA_FALLBACK_MODEL',
  'AI_OLLAMA_IMAGE_DESCRIPTION_MODEL',
  'AI_OLLAMA_KEEP_ALIVE',
  'AI_OLLAMA_LONG_NUM_PREDICT',
  'AI_OLLAMA_MARKETING_STRATEGY_MODEL',
  'AI_OLLAMA_NUM_CTX',
  'AI_OLLAMA_NUM_PREDICT',
  'AI_OLLAMA_PRECISE_TEMPERATURE',
  'AI_OLLAMA_PUBLIC_MODEL',
  'AI_OLLAMA_RECOMMENDATION_MODEL',
  'AI_OLLAMA_SALES_MODEL',
  'AI_OLLAMA_SEO_MODEL',
  'AI_OLLAMA_SMS_MODEL',
  'AI_OLLAMA_TEMPERATURE',
  'AI_OLLAMA_TIMEOUT_MS',
  'AI_OLLAMA_THINK',
  'AI_OLLAMA_VISION_MODEL',
  'OLLAMA_MODEL',
  'OLLAMA_TIMEOUT_MS',
] as const;

describe('AiModelRouterService', () => {
  let service: AiModelRouterService;

  const originalEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of AI_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    for (const key of AI_ENV_KEYS) {
      delete process.env[key];
    }

    service = new AiModelRouterService();
  });

  afterAll(() => {
    for (const key of AI_ENV_KEYS) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('returns the complete default public-chat route', () => {
    expect(service.resolve()).toEqual({
      provider: 'ollama',
      taskType: 'PUBLIC_CHAT',
      model: 'qwen3.5:9b',
      temperature: 0.4,
      numPredict: 256,
      numCtx: 8192,
      timeoutMs: 180000,
      keepAlive: '5m',
      think: false,
    });
  });

  it('normalizes legacy aliases and unknown task names', () => {
    expect(service.normalizeTaskType('core')).toBe('PUBLIC_CHAT');
    expect(service.normalizeTaskType('article')).toBe('CONTENT');
    expect(service.normalizeTaskType('marketing')).toBe('MARKETING_STRATEGY');
    expect(service.normalizeTaskType('compare')).toBe('COMPARISON');
    expect(service.normalizeTaskType('unknown-task')).toBe('PUBLIC_CHAT');
  });

  it('uses a task-specific model before the configured default model', () => {
    process.env.OLLAMA_MODEL = 'legacy-model';
    process.env.AI_OLLAMA_DEFAULT_MODEL = ' default-model ';
    process.env.AI_OLLAMA_SALES_MODEL = ' sales-model ';

    expect(
      service.resolve({
        task: 'sales',
      }).model,
    ).toBe('sales-model');

    expect(
      service.resolve({
        task: 'consulting',
      }).model,
    ).toBe('default-model');
  });

  it('uses creative, precise, long, and standard task defaults', () => {
    process.env.AI_OLLAMA_CREATIVE_TEMPERATURE = '0.7';
    process.env.AI_OLLAMA_PRECISE_TEMPERATURE = '0.25';
    process.env.AI_OLLAMA_LONG_NUM_PREDICT = '3000';
    process.env.AI_OLLAMA_NUM_PREDICT = '700';

    expect(
      service.resolve({
        task: 'content',
      }),
    ).toMatchObject({
      taskType: 'CONTENT',
      temperature: 0.7,
      numPredict: 3000,
    });

    expect(
      service.resolve({
        task: 'sales',
      }),
    ).toMatchObject({
      taskType: 'SALES',
      temperature: 0.25,
      numPredict: 700,
    });
  });

  it('clamps and truncates explicit generation overrides', () => {
    expect(
      service.resolve({
        temperature: 3,
        maxTokens: 10,
      }),
    ).toMatchObject({
      temperature: 2,
      numPredict: 64,
    });

    expect(
      service.resolve({
        temperature: -1,
        maxTokens: 9000.9,
      }),
    ).toMatchObject({
      temperature: 0,
      numPredict: 8192,
    });

    expect(
      service.resolve({
        temperature: 0.65,
        maxTokens: 123.9,
      }),
    ).toMatchObject({
      temperature: 0.65,
      numPredict: 123,
    });
  });

  it('falls back from invalid numeric environment values and applies bounds', () => {
    process.env.AI_OLLAMA_NUM_CTX = '100';
    process.env.AI_OLLAMA_NUM_PREDICT = 'not-a-number';
    process.env.AI_OLLAMA_TIMEOUT_MS = 'not-a-number';
    process.env.OLLAMA_TIMEOUT_MS = '950000';

    expect(service.resolve()).toMatchObject({
      numCtx: 512,
      numPredict: 256,
      timeoutMs: 900000,
    });
  });

  it('prefers the AI timeout and trims the keep-alive value', () => {
    process.env.OLLAMA_TIMEOUT_MS = '2000';
    process.env.AI_OLLAMA_TIMEOUT_MS = '3000';
    process.env.AI_OLLAMA_KEEP_ALIVE = ' 5m ';

    expect(service.resolve()).toMatchObject({
      timeoutMs: 3000,
      keepAlive: '5m',
    });

    delete process.env.AI_OLLAMA_TIMEOUT_MS;

    expect(service.resolve().timeoutMs).toBe(2000);
  });

  it('forces non-reasoning task routes to disable thinking', () => {
    process.env.AI_OLLAMA_THINK = 'high';

    expect(
      service.resolve({
        task: 'PUBLIC_CHAT',
      }).think,
    ).toBe(false);

    expect(
      service.resolve({
        task: 'CONSULTING',
      }).think,
    ).toBe(false);
  });

  it('normalizes configured thinking modes for reasoning tasks', () => {
    process.env.AI_OLLAMA_THINK = ' yes ';

    expect(
      service.resolve({
        task: 'ANALYTICS',
      }).think,
    ).toBe(true);

    process.env.AI_OLLAMA_THINK = ' HIGH ';

    expect(
      service.resolve({
        task: 'ADMIN_REPORT',
      }).think,
    ).toBe('high');

    process.env.AI_OLLAMA_THINK = 'unsupported';

    expect(
      service.resolve({
        task: 'DEMAND_ANALYSIS',
      }).think,
    ).toBe(false);
  });

  it('returns the default or configured fallback model', () => {
    expect(service.getFallbackModel()).toBe('qwen3:14b');

    process.env.AI_OLLAMA_FALLBACK_MODEL = ' fallback-model ';

    expect(service.getFallbackModel()).toBe('fallback-model');
  });
});
