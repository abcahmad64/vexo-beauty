import { Logger, ServiceUnavailableException } from '@nestjs/common';

import {
  type AiRerankerDocument,
  AiRerankerClientService,
} from './ai-reranker-client.service';

const ENV_KEYS = [
  'AI_RERANKER_ENABLED',
  'AI_RERANKER_BASE_URL',
  'AI_RERANKER_TIMEOUT_MS',
] as const;

const documents: AiRerankerDocument[] = [
  {
    id: 'doc-1',
    text: 'hydrating face serum',
    metadata: {
      category: 'serum',
    },
  },
  {
    id: 'doc-2',
    text: 'matte lipstick',
  },
];

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  });

const readRequestBody = (
  fetchSpy: jest.SpiedFunction<typeof fetch>,
  index: number = 0,
): Record<string, unknown> => {
  const call = fetchSpy.mock.calls[index];

  if (!call) {
    throw new Error(`Expected fetch call at index ${index}.`);
  }

  const init = call[1];
  const body = init?.body;

  if (typeof body !== 'string') {
    throw new Error('Expected request body to be a JSON string.');
  }

  const parsed = JSON.parse(body) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected request body to be a JSON object.');
  }

  return parsed as Record<string, unknown>;
};

describe('AiRerankerClientService', () => {
  const originalEnv = new Map<string, string | undefined>();

  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let loggerWarnSpy: jest.SpiedFunction<Logger['warn']>;

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    jest.useRealTimers();

    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    fetchSpy = jest.spyOn(globalThis, 'fetch');
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();

    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('rejects reranking and reports disabled health when explicitly disabled', async () => {
    process.env.AI_RERANKER_ENABLED = ' OFF ';
    process.env.AI_RERANKER_BASE_URL = 'http://custom-reranker/';

    const service = new AiRerankerClientService();

    await expect(
      service.rerank({
        query: 'face serum',
        documents,
        topN: 2,
      }),
    ).rejects.toThrow('سرویس رتبه‌بندی معنایی غیرفعال است.');

    await expect(service.health()).resolves.toEqual({
      ok: false,
      enabled: false,
      baseUrl: 'http://custom-reranker',
      modelLoaded: false,
      modelName: null,
      modelPath: null,
      error: 'disabled',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns an empty result without a network request for empty documents', async () => {
    const service = new AiRerankerClientService();

    await expect(
      service.rerank({
        query: 'face serum',
        documents: [],
        topN: 5,
      }),
    ).resolves.toEqual([]);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a normalized request and maps valid results', async () => {
    process.env.AI_RERANKER_BASE_URL = 'http://reranker.test/';

    fetchSpy.mockResolvedValue(
      jsonResponse({
        model: 'bge-reranker',
        duration_ms: 14,
        results: [
          {
            id: 'doc-1',
            index: 0,
            score: 0.94,
            metadata: {
              matched: true,
            },
          },
          {
            id: 'doc-2',
            index: 1,
            score: 0.42,
            metadata: null,
          },
        ],
      }),
    );

    const service = new AiRerankerClientService();

    const result = await service.rerank({
      query: 'face serum',
      documents,
      topN: 99,
    });

    expect(result).toEqual([
      {
        id: 'doc-1',
        index: 0,
        score: 0.94,
        metadata: {
          matched: true,
        },
      },
      {
        id: 'doc-2',
        index: 1,
        score: 0.42,
        metadata: {},
      },
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const call = fetchSpy.mock.calls[0];

    if (!call) {
      throw new Error('Expected one reranker request.');
    }

    expect(call[0]).toBe('http://reranker.test/v1/rerank');
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(call[1]?.signal).toBeInstanceOf(AbortSignal);

    expect(readRequestBody(fetchSpy)).toEqual({
      query: 'face serum',
      documents: [
        {
          id: 'doc-1',
          text: 'hydrating face serum',
          metadata: {
            category: 'serum',
          },
        },
        {
          id: 'doc-2',
          text: 'matte lipstick',
          metadata: {},
        },
      ],
      top_n: 2,
      instruction:
        'برای پرسش فروشگاهی فارسی، مرتبط‌ترین محصول یا سند را انتخاب کن.',
    });
  });

  it('uses the custom instruction and clamps topN to at least one', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: 'doc-1',
            index: 0,
            score: 0.8,
            metadata: [],
          },
        ],
      }),
    );

    const service = new AiRerankerClientService();

    await service.rerank({
      query: 'serum',
      documents,
      topN: -10,
      instruction: 'custom instruction',
    });

    expect(readRequestBody(fetchSpy)).toMatchObject({
      top_n: 1,
      instruction: 'custom instruction',
    });
  });

  it('rejects a response without a results array', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        model: 'bge-reranker',
      }),
    );

    const service = new AiRerankerClientService();

    await expect(
      service.rerank({
        query: 'face serum',
        documents,
        topN: 1,
      }),
    ).rejects.toThrow('ساختار پاسخ سرویس Reranker معتبر نیست.');
  });

  it.each([
    {
      title: 'missing id',
      item: {
        index: 0,
        score: 0.9,
      },
    },
    {
      title: 'non-integer index',
      item: {
        id: 'doc-1',
        index: 0.5,
        score: 0.9,
      },
    },
    {
      title: 'non-finite score',
      item: {
        id: 'doc-1',
        index: 0,
        score: Number.POSITIVE_INFINITY,
      },
    },
  ])('rejects an invalid result with $title', async ({ item }) => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        results: [item],
      }),
    );

    const service = new AiRerankerClientService();

    await expect(
      service.rerank({
        query: 'face serum',
        documents,
        topN: 1,
      }),
    ).rejects.toThrow('یکی از نتایج سرویس Reranker معتبر نیست.');
  });

  it('preserves an HTTP failure with a bounded response body', async () => {
    const longBody = `failure-${'x'.repeat(700)}`;

    fetchSpy.mockResolvedValue(
      new Response(longBody, {
        status: 503,
      }),
    );

    const service = new AiRerankerClientService();

    let caught: unknown;

    try {
      await service.rerank({
        query: 'face serum',
        documents,
        topN: 1,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ServiceUnavailableException);

    const message = caught instanceof Error ? caught.message : String(caught);

    expect(message).toContain('Reranker request failed: 503 failure-');
    expect(message).toHaveLength('Reranker request failed: 503 '.length + 512);
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('maps an AbortError to a timeout exception', async () => {
    const abortError = new Error('request aborted');
    abortError.name = 'AbortError';

    fetchSpy.mockRejectedValue(abortError);

    const service = new AiRerankerClientService();

    await expect(
      service.rerank({
        query: 'face serum',
        documents,
        topN: 1,
      }),
    ).rejects.toThrow('Reranker request timed out.');

    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('wraps an ordinary provider failure and logs the original reason', async () => {
    fetchSpy.mockRejectedValue(new Error('connection refused'));

    const service = new AiRerankerClientService();

    await expect(
      service.rerank({
        query: 'face serum',
        documents,
        topN: 1,
      }),
    ).rejects.toThrow('Reranker provider is unavailable: connection refused');

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Reranker request failed: connection refused',
    );
  });

  it('reports ready health and trims model details', async () => {
    process.env.AI_RERANKER_BASE_URL = 'http://reranker.health/';

    fetchSpy.mockResolvedValue(
      jsonResponse({
        status: 'ready',
        model_loaded: true,
        model_name: '  bge-reranker  ',
        model_path: '  /models/bge-reranker  ',
      }),
    );

    const service = new AiRerankerClientService();

    await expect(service.health()).resolves.toEqual({
      ok: true,
      enabled: true,
      baseUrl: 'http://reranker.health',
      modelLoaded: true,
      modelName: 'bge-reranker',
      modelPath: '/models/bge-reranker',
      error: null,
    });

    const call = fetchSpy.mock.calls[0];

    if (!call) {
      throw new Error('Expected one health request.');
    }

    expect(call[0]).toBe('http://reranker.health/health/readiness');
    expect(call[1]?.method).toBe('GET');
  });

  it('reports unhealthy when readiness status or model loading is incomplete', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        status: 'starting',
        model_loaded: false,
        model_name: '   ',
        model_path: '',
      }),
    );

    const service = new AiRerankerClientService();

    await expect(service.health()).resolves.toEqual({
      ok: false,
      enabled: true,
      baseUrl: 'http://reranker:8080',
      modelLoaded: false,
      modelName: null,
      modelPath: null,
      error: null,
    });
  });

  it('converts health request failure into an unhealthy snapshot', async () => {
    fetchSpy.mockRejectedValue(new Error('health connection failed'));

    const service = new AiRerankerClientService();

    await expect(service.health()).resolves.toEqual({
      ok: false,
      enabled: true,
      baseUrl: 'http://reranker:8080',
      modelLoaded: false,
      modelName: null,
      modelPath: null,
      error: 'Reranker provider is unavailable: health connection failed',
    });

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Reranker request failed: health connection failed',
    );
  });
});
