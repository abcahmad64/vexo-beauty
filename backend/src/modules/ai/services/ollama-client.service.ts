import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { QueueExecutionCancellationUtil } from '../../../core/queue/utils/queue-execution-cancellation.util';

import { AiChatMessage } from '../interfaces/ai-provider.interface';

import { AiModelRoute } from './ai-model-router.service';

import { AiRuntimeCoordinatorService } from './ai-runtime-coordinator.service';

export interface OllamaChatRequest {
  route: AiModelRoute;
  messages: AiChatMessage[];
  json?: boolean;
  jsonSchema?: Record<string, unknown>;
  modelOverride?: string;
  signal?: AbortSignal;
}

export interface OllamaChatResult {
  content: string;
  model: string;
  raw: unknown;
  tokenUsage?: Record<string, unknown>;
}

type OllamaStructuredOutputMode =
  'TEXT' | 'JSON' | 'JSON_SCHEMA' | 'JSON_SCHEMA_FALLBACK';

export interface OllamaEmbedRequest {
  model: string;
  input: string[];
  timeoutMs?: number;
  keepAlive?: string;
  numCtx?: number;
  signal?: AbortSignal;
}

export interface OllamaEmbedResult {
  embeddings: number[][];
  model: string;
  raw: unknown;
  tokenUsage?: Record<string, unknown>;
}

export interface OllamaHealthResult {
  ok: boolean;
  baseUrl: string;
  version: string | null;
  models: string[];
  error: string | null;
}

type OllamaChatResponse = {
  model?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

type OllamaEmbedResponse = {
  model?: string;
  embeddings?: unknown;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
};

type OllamaGenerateResponse = {
  model?: string;
  done?: boolean;
};

type OllamaVersionResponse = {
  version?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

@Injectable()
export class OllamaClientService {
  private readonly logger = new Logger(OllamaClientService.name);

  private readonly enabled = !['false', '0', 'no', 'off'].includes(
    process.env.AI_ENABLED?.trim().toLowerCase() ?? 'true',
  );

  private readonly baseUrl = (
    process.env.AI_OLLAMA_BASE_URL ||
    process.env.OLLAMA_BASE_URL ||
    'http://127.0.0.1:11434'
  ).replace(/\/$/, '');

  private residentModel: string | null = null;

  constructor(
    private readonly runtimeCoordinator: AiRuntimeCoordinatorService,
  ) {}

  chat(request: OllamaChatRequest): Promise<OllamaChatResult> {
    const model = request.modelOverride ?? request.route.model;

    return this.runtimeCoordinator.run(
      {
        operation: 'GENERATION',
        model,
        taskType: request.route.taskType,
      },
      async () => {
        await this.prepareModel(model, request.signal);

        return this.performChat(request, model, request.route.think, true);
      },
    );
  }

  embed(request: OllamaEmbedRequest): Promise<OllamaEmbedResult> {
    return this.runtimeCoordinator.run(
      {
        operation: 'EMBEDDING',
        model: request.model,
        taskType: 'EMBEDDING',
      },
      async () => {
        await this.prepareModel(request.model, request.signal);

        return this.performEmbed(request);
      },
    );
  }

  async health(): Promise<OllamaHealthResult> {
    try {
      const [versionResponse, tagsResponse] = await Promise.all([
        this.fetchJson<OllamaVersionResponse>(
          `${this.baseUrl}/api/version`,
          {
            method: 'GET',
          },
          10_000,
        ),
        this.fetchJson<OllamaTagsResponse>(
          `${this.baseUrl}/api/tags`,
          {
            method: 'GET',
          },
          20_000,
        ),
      ]);

      const models = (tagsResponse.models ?? [])
        .map((item) => item.name ?? item.model ?? '')
        .map((item) => item.trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));

      return {
        ok: true,
        baseUrl: this.baseUrl,
        version: versionResponse.version?.trim() || null,
        models,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        baseUrl: this.baseUrl,
        version: null,
        models: [],
        error: this.getErrorMessage(error),
      };
    }
  }

  private async prepareModel(
    model: string,
    signal?: AbortSignal,
  ): Promise<void> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    this.assertEnabled();

    const normalizedModel = model.trim();

    if (!normalizedModel) {
      throw new ServiceUnavailableException(
        'نام مدل Ollama برای اجرای درخواست معتبر نیست.',
      );
    }

    if (!this.residentModel || this.residentModel === normalizedModel) {
      this.residentModel = normalizedModel;
      return;
    }

    const previousModel = this.residentModel;

    await this.fetchJson<OllamaGenerateResponse>(
      `${this.baseUrl}/api/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: previousModel,
          stream: false,
          keep_alive: 0,
        }),
      },
      120_000,
      signal,
    );

    this.residentModel = normalizedModel;
  }

  private async performChat(
    request: OllamaChatRequest,
    model: string,
    think: boolean | 'low' | 'medium' | 'high',
    allowContentRetry: boolean,
    allowSchemaFallback = true,
    structuredOutputMode: OllamaStructuredOutputMode = this.resolveStructuredOutputMode(
      request,
    ),
  ): Promise<OllamaChatResult> {
    this.assertEnabled();

    let payload: OllamaChatResponse;

    try {
      payload = await this.fetchJson<OllamaChatResponse>(
        `${this.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            stream: false,
            think,
            keep_alive: request.route.keepAlive,
            ...(request.jsonSchema
              ? {
                  format: request.jsonSchema,
                }
              : request.json
                ? {
                    format: 'json',
                  }
                : {}),
            options: {
              temperature: request.route.temperature,
              num_predict: request.route.numPredict,
              num_ctx: request.route.numCtx,
            },
          }),
        },
        request.route.timeoutMs,
        request.signal,
      );
    } catch (error) {
      if (
        allowSchemaFallback &&
        request.jsonSchema &&
        this.isStructuredOutputGrammarError(error)
      ) {
        this.logger.warn(
          [
            'Ollama rejected the JSON schema grammar.',
            'Retrying the same model with JSON mode and server-side validation.',
            `model=${model}`,
            `taskType=${request.route.taskType}`,
          ].join(' '),
        );

        return this.performChat(
          {
            ...request,
            json: true,
            jsonSchema: undefined,
          },
          model,
          false,
          allowContentRetry,
          false,
          'JSON_SCHEMA_FALLBACK',
        );
      }

      throw error;
    }

    const content = payload.message?.content?.trim();

    if (!content) {
      const thinkingLength = payload.message?.thinking?.trim().length ?? 0;

      if (allowContentRetry && (thinkingLength > 0 || think !== false)) {
        return this.performChat(
          request,
          model,
          false,
          false,
          allowSchemaFallback,
          structuredOutputMode,
        );
      }

      throw new ServiceUnavailableException(
        [
          'Ollama returned an empty response.',
          `model=${model}`,
          `done=${String(payload.done ?? null)}`,
          `doneReason=${payload.done_reason ?? 'unknown'}`,
          `thinkingLength=${thinkingLength}`,
          `evalCount=${String(payload.eval_count ?? null)}`,
          `promptEvalCount=${String(payload.prompt_eval_count ?? null)}`,
        ].join(' '),
      );
    }

    return {
      content,
      model: payload.model ?? model,
      raw: payload,
      tokenUsage: this.extractChatTokenUsage(payload, structuredOutputMode),
    };
  }

  private resolveStructuredOutputMode(
    request: OllamaChatRequest,
  ): OllamaStructuredOutputMode {
    if (request.jsonSchema) {
      return 'JSON_SCHEMA';
    }

    if (request.json) {
      return 'JSON';
    }

    return 'TEXT';
  }

  private isStructuredOutputGrammarError(error: unknown): boolean {
    const message = this.getErrorMessage(error).toLowerCase();

    return (
      message.includes('failed to parse grammar') ||
      (message.includes('grammar') &&
        message.includes('failed to initialize samplers'))
    );
  }

  private async performEmbed(
    request: OllamaEmbedRequest,
  ): Promise<OllamaEmbedResult> {
    this.assertEnabled();

    const cleanInput = request.input.map((item) => item.trim()).filter(Boolean);

    if (cleanInput.length === 0) {
      throw new ServiceUnavailableException(
        'متن معتبری برای تولید بردار معنایی ارسال نشده است.',
      );
    }

    const payload = await this.fetchJson<OllamaEmbedResponse>(
      `${this.baseUrl}/api/embed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          input: cleanInput,
          truncate: true,
          keep_alive: request.keepAlive ?? '5m',
          options: {
            num_ctx: request.numCtx ?? 4096,
          },
        }),
      },
      request.timeoutMs ?? 300_000,
      request.signal,
    );

    const embeddings = this.parseEmbeddings(payload.embeddings);

    if (embeddings.length !== cleanInput.length) {
      throw new ServiceUnavailableException(
        'تعداد بردارهای دریافتی از Ollama با تعداد متن‌ها مطابقت ندارد.',
      );
    }

    return {
      embeddings,
      model: payload.model ?? request.model,
      raw: payload,
      tokenUsage: {
        promptEvalCount: payload.prompt_eval_count ?? null,
        totalDuration: payload.total_duration ?? null,
        loadDuration: payload.load_duration ?? null,
      },
    };
  }

  private parseEmbeddings(value: unknown): number[][] {
    if (!Array.isArray(value)) {
      throw new ServiceUnavailableException(
        'ساختار پاسخ بردار معنایی Ollama معتبر نیست.',
      );
    }

    return value.map((candidate) => {
      if (
        !Array.isArray(candidate) ||
        candidate.length === 0 ||
        !candidate.every(
          (item): item is number =>
            typeof item === 'number' && Number.isFinite(item),
        )
      ) {
        throw new ServiceUnavailableException(
          'یکی از بردارهای معنایی Ollama معتبر نیست.',
        );
      }

      return candidate;
    });
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    QueueExecutionCancellationUtil.throwIfAborted(externalSignal);
    const linked = QueueExecutionCancellationUtil.createLinkedTimeoutSignal(
      externalSignal,
      timeoutMs,
    );

    try {
      const response = await fetch(url, {
        ...init,
        signal: linked.signal,
      });

      if (!response.ok) {
        const errorText = (await response.text()).trim();
        const safeErrorText =
          errorText.length > 512 ? `${errorText.slice(0, 512)}...` : errorText;

        throw new ServiceUnavailableException(
          `Ollama request failed: ${response.status}${
            safeErrorText ? ` ${safeErrorText}` : ''
          }`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (externalSignal?.aborted) {
        QueueExecutionCancellationUtil.throwIfAborted(externalSignal);
      }

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (linked.didTimeout()) {
        throw new ServiceUnavailableException('Ollama request timed out.');
      }

      throw new ServiceUnavailableException(
        `Ollama provider is unavailable: ${this.getErrorMessage(error)}`,
      );
    } finally {
      linked.cleanup();
    }
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException('سرویس هوش مصنوعی غیرفعال است.');
    }
  }

  private extractChatTokenUsage(
    payload: OllamaChatResponse,
    structuredOutputMode: OllamaStructuredOutputMode,
  ): Record<string, unknown> {
    return {
      structuredOutputMode,
      promptEvalCount: payload.prompt_eval_count ?? null,
      evalCount: payload.eval_count ?? null,
      totalDuration: payload.total_duration ?? null,
      loadDuration: payload.load_duration ?? null,
      promptEvalDuration: payload.prompt_eval_duration ?? null,
      evalDuration: payload.eval_duration ?? null,
      doneReason: payload.done_reason ?? null,
      thinkingLength: payload.message?.thinking?.length ?? 0,
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
