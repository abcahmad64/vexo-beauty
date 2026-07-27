import { ServiceUnavailableException } from '@nestjs/common';

import { QueueExecutionCancelledError } from '../../../core/queue/utils/queue-execution-cancellation.util';

import type { AiChatMessage } from '../interfaces/ai-provider.interface';

import type { AiModelRoute } from './ai-model-router.service';
import { AiRuntimeCoordinatorService } from './ai-runtime-coordinator.service';
import { OllamaClientService } from './ollama-client.service';

const ENV_KEYS = ['AI_OLLAMA_BASE_URL', 'OLLAMA_BASE_URL'] as const;

const messages: AiChatMessage[] = [
  {
    role: 'system',
    content: 'You are a sales assistant.',
  },
  {
    role: 'user',
    content: 'Recommend a product.',
  },
];

const createRoute = (overrides: Partial<AiModelRoute> = {}): AiModelRoute => ({
  provider: 'ollama',
  taskType: 'PUBLIC_CHAT',
  model: 'primary-model',
  temperature: 0.4,
  numPredict: 256,
  numCtx: 4096,
  timeoutMs: 180000,
  keepAlive: '30m',
  ...overrides,
  think: overrides.think ?? false,
});

const createJsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const readRequestBodyAt = (
  fetchSpy: jest.SpiedFunction<typeof fetch>,
  index: number,
): unknown => {
  const call = fetchSpy.mock.calls[index];

  if (!call) {
    throw new Error(`Expected fetch call at index ${index}.`);
  }

  const [, init] = call;
  const body = init?.body;

  if (typeof body !== 'string') {
    throw new Error('Expected fetch request body to be a string.');
  }

  return JSON.parse(body) as unknown;
};

const readRequestBody = (fetchSpy: jest.SpiedFunction<typeof fetch>): unknown =>
  readRequestBodyAt(fetchSpy, 0);

const createService = (): OllamaClientService =>
  new OllamaClientService(new AiRuntimeCoordinatorService());

describe('OllamaClientService', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const originalEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    process.env.AI_OLLAMA_BASE_URL = 'http://ollama.test/';

    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('sends the expected request and returns normalized response metadata', async () => {
    const payload = {
      model: 'resolved-model',
      message: {
        role: 'assistant',
        content: '  پاسخ نهایی  ',
        thinking: 'abc',
      },
      done: true,
      done_reason: 'stop',
      total_duration: 100,
      load_duration: 10,
      prompt_eval_count: 12,
      prompt_eval_duration: 20,
      eval_count: 34,
      eval_duration: 40,
    };

    fetchSpy.mockResolvedValue(createJsonResponse(payload));

    const service = createService();

    const result = await service.chat({
      route: createRoute(),
      messages,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];

    expect(url).toBe('http://ollama.test/api/chat');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    expect(readRequestBody(fetchSpy)).toEqual({
      model: 'primary-model',
      messages,
      stream: false,
      think: false,
      keep_alive: '30m',
      options: {
        temperature: 0.4,
        num_predict: 256,
        num_ctx: 4096,
      },
    });

    expect(result).toEqual({
      content: 'پاسخ نهایی',
      model: 'resolved-model',
      raw: payload,
      tokenUsage: {
        structuredOutputMode: 'TEXT',
        promptEvalCount: 12,
        evalCount: 34,
        totalDuration: 100,
        loadDuration: 10,
        promptEvalDuration: 20,
        evalDuration: 40,
        doneReason: 'stop',
        thinkingLength: 3,
      },
    });
  });

  it('uses the model override, JSON format, and route think level', async () => {
    fetchSpy.mockResolvedValue(
      createJsonResponse({
        message: {
          content: '{"success":true}',
        },
      }),
    );

    const service = createService();

    const result = await service.chat({
      route: createRoute({
        think: 'high',
      }),
      messages,
      json: true,
      modelOverride: 'fallback-model',
    });

    expect(readRequestBody(fetchSpy)).toEqual({
      model: 'fallback-model',
      messages,
      stream: false,
      think: 'high',
      keep_alive: '30m',
      format: 'json',
      options: {
        temperature: 0.4,
        num_predict: 256,
        num_ctx: 4096,
      },
    });

    expect(result.model).toBe('fallback-model');
    expect(result.content).toBe('{"success":true}');
  });

  it('passes a boolean route think mode through to Ollama', async () => {
    fetchSpy.mockResolvedValue(
      createJsonResponse({
        message: {
          content: 'response',
        },
      }),
    );

    const service = createService();

    await service.chat({
      route: createRoute({
        think: true,
      }),
      messages,
    });

    expect(readRequestBody(fetchSpy)).toMatchObject({
      think: true,
    });
  });

  it('uses the legacy base URL and preserves a false route think mode', async () => {
    delete process.env.AI_OLLAMA_BASE_URL;
    process.env.OLLAMA_BASE_URL = 'http://legacy-ollama.test/';

    fetchSpy.mockResolvedValue(
      createJsonResponse({
        message: {
          content: 'response',
        },
      }),
    );

    const service = createService();

    await service.chat({
      route: createRoute(),
      messages,
    });

    expect(fetchSpy.mock.calls[0][0]).toBe(
      'http://legacy-ollama.test/api/chat',
    );

    expect(readRequestBody(fetchSpy)).toMatchObject({
      think: false,
    });
  });

  it('retries a schema grammar failure with the same model in JSON mode', async () => {
    const jsonSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['summary'],
      properties: {
        summary: {
          type: 'string',
        },
      },
    };

    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: 'Failed to initialize samplers: failed to parse grammar',
              type: 'invalid_request_error',
            },
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          model: 'primary-model',
          message: {
            content: '{"summary":"ok"}',
          },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: 20,
          eval_count: 8,
        }),
      );

    const service = createService();

    const result = await service.chat({
      route: createRoute(),
      messages,
      jsonSchema,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(readRequestBodyAt(fetchSpy, 0)).toMatchObject({
      model: 'primary-model',
      format: jsonSchema,
      think: false,
    });

    expect(readRequestBodyAt(fetchSpy, 1)).toMatchObject({
      model: 'primary-model',
      format: 'json',
      think: false,
    });

    expect(result.model).toBe('primary-model');
    expect(result.content).toBe('{"summary":"ok"}');
    expect(result.tokenUsage).toMatchObject({
      structuredOutputMode: 'JSON_SCHEMA_FALLBACK',
      promptEvalCount: 20,
      evalCount: 8,
    });
  });

  it('does not downgrade unrelated schema request failures to JSON mode', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'model is not available',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const service = createService();

    const request = service.chat({
      route: createRoute(),
      messages,
      jsonSchema: {
        type: 'object',
      },
    });

    await expect(request).rejects.toThrow('Ollama request failed: 400');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('converts non-success HTTP responses into service-unavailable errors', async () => {
    fetchSpy.mockResolvedValue(
      new Response('daemon unavailable', {
        status: 503,
      }),
    );

    const service = createService();

    const request = service.chat({
      route: createRoute(),
      messages,
    });

    await expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(request).rejects.toThrow(
      'Ollama request failed: 503 daemon unavailable',
    );
  });

  it('retries an empty thinking response once and then reports diagnostics', async () => {
    const emptyPayload = {
      message: {
        content: '   ',
        thinking: 'abc',
      },
      done: false,
      done_reason: 'load',
      eval_count: 0,
      prompt_eval_count: 7,
    };

    fetchSpy
      .mockResolvedValueOnce(createJsonResponse(emptyPayload))
      .mockResolvedValueOnce(createJsonResponse(emptyPayload));

    const service = createService();

    let capturedError: unknown;

    try {
      await service.chat({
        route: createRoute(),
        messages,
      });
    } catch (error) {
      capturedError = error;
    }

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(capturedError).toBeInstanceOf(ServiceUnavailableException);
    expect(capturedError).toHaveProperty(
      'message',
      [
        'Ollama returned an empty response.',
        'model=primary-model',
        'done=false',
        'doneReason=load',
        'thinkingLength=3',
        'evalCount=0',
        'promptEvalCount=7',
      ].join(' '),
    );
  });

  it('converts aborted requests into timeout errors', async () => {
    jest.useFakeTimers();

    fetchSpy.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');

              error.name = 'AbortError';
              reject(error);
            },
            {
              once: true,
            },
          );
        }),
    );

    const service = createService();

    const request = service.chat({
      route: createRoute({
        timeoutMs: 1000,
      }),
      messages,
    });

    const expectation = expect(request).rejects.toThrow(
      'Ollama request timed out.',
    );

    await jest.advanceTimersByTimeAsync(1000);
    await expectation;
  });

  it('wraps unexpected network failures with the original message', async () => {
    fetchSpy.mockRejectedValue(new TypeError('connect ECONNREFUSED'));

    const service = createService();

    const request = service.chat({
      route: createRoute(),
      messages,
    });

    await expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(request).rejects.toThrow(
      'Ollama provider is unavailable: connect ECONNREFUSED',
    );
  });

  it('propagates external cooperative cancellation instead of converting it to a timeout', async () => {
    const controller = new AbortController();
    const cancellation = {
      version: '1.0.0' as const,
      status: 'REQUESTED' as const,
      queueName: 'ai' as const,
      jobId: 'ai-job-1',
      cancellationId: 'ai-cancel-1',
      requestedAt: '2026-07-23T00:00:00.000Z',
      requestedBy: 'admin-1',
      reason: 'توقف ارائه‌دهنده',
      source: 'admin.queue.ai-execution-cancellation' as const,
      stateAtRequest: 'active',
      activeSignalDispatched: true,
    };

    fetchSpy.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
    );

    const service = createService();
    const request = service.chat({
      route: createRoute(),
      messages,
      signal: controller.signal,
    });

    controller.abort(
      JSON.stringify({
        kind: 'VEXO_QUEUE_EXECUTION_CANCELLATION',
        cancellation,
      }),
    );

    await expect(request).rejects.toBeInstanceOf(QueueExecutionCancelledError);
  });
});
