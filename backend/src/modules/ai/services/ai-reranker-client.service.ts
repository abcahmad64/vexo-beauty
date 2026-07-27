import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface AiRerankerDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface AiRerankerResult {
  id: string;
  index: number;
  score: number;
  metadata: Record<string, unknown>;
}

type RerankerApiResponse = {
  model?: string;
  duration_ms?: number;
  results?: Array<{
    id?: string;
    index?: number;
    score?: number;
    metadata?: unknown;
  }>;
};

type RerankerHealthResponse = {
  status?: string;
  model_loaded?: boolean;
  model_path?: string;
  model_name?: string;
};

@Injectable()
export class AiRerankerClientService {
  private readonly logger = new Logger(AiRerankerClientService.name);

  private readonly enabled = !['false', '0', 'no', 'off'].includes(
    process.env.AI_RERANKER_ENABLED?.trim().toLowerCase() ?? 'true',
  );

  private readonly baseUrl = (
    process.env.AI_RERANKER_BASE_URL || 'http://reranker:8080'
  ).replace(/\/$/, '');

  private readonly timeoutMs = this.readInteger(
    'AI_RERANKER_TIMEOUT_MS',
    120_000,
    1_000,
    600_000,
  );

  async rerank(input: {
    query: string;
    documents: AiRerankerDocument[];
    topN: number;
    instruction?: string;
  }): Promise<AiRerankerResult[]> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'سرویس رتبه‌بندی معنایی غیرفعال است.',
      );
    }

    if (input.documents.length === 0) {
      return [];
    }

    const response = await this.fetchJson<RerankerApiResponse>(
      `${this.baseUrl}/v1/rerank`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input.query,
          documents: input.documents.map((document) => ({
            id: document.id,
            text: document.text,
            metadata: document.metadata ?? {},
          })),
          top_n: Math.min(Math.max(input.topN, 1), input.documents.length),
          instruction:
            input.instruction ??
            'برای پرسش فروشگاهی فارسی، مرتبط‌ترین محصول یا سند را انتخاب کن.',
        }),
      },
    );

    if (!Array.isArray(response.results)) {
      throw new ServiceUnavailableException(
        'ساختار پاسخ سرویس Reranker معتبر نیست.',
      );
    }

    return response.results.map((item) => {
      if (
        typeof item.id !== 'string' ||
        typeof item.index !== 'number' ||
        !Number.isInteger(item.index) ||
        typeof item.score !== 'number' ||
        !Number.isFinite(item.score)
      ) {
        throw new ServiceUnavailableException(
          'یکی از نتایج سرویس Reranker معتبر نیست.',
        );
      }

      return {
        id: item.id,
        index: item.index,
        score: item.score,
        metadata: this.toRecord(item.metadata),
      };
    });
  }

  async health() {
    if (!this.enabled) {
      return {
        ok: false,
        enabled: false,
        baseUrl: this.baseUrl,
        modelLoaded: false,
        modelName: null,
        modelPath: null,
        error: 'disabled',
      };
    }

    try {
      const payload = await this.fetchJson<RerankerHealthResponse>(
        `${this.baseUrl}/health/readiness`,
        {
          method: 'GET',
        },
        15_000,
      );

      return {
        ok: payload.status === 'ready' && payload.model_loaded === true,
        enabled: true,
        baseUrl: this.baseUrl,
        modelLoaded: payload.model_loaded === true,
        modelName: payload.model_name?.trim() || null,
        modelPath: payload.model_path?.trim() || null,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        enabled: true,
        baseUrl: this.baseUrl,
        modelLoaded: false,
        modelName: null,
        modelPath: null,
        error: this.getErrorMessage(error),
      };
    }
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
    timeoutMs: number = this.timeoutMs,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.text()).trim();

        throw new ServiceUnavailableException(
          `Reranker request failed: ${response.status}${
            body ? ` ${body.slice(0, 512)}` : ''
          }`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('Reranker request timed out.');
      }

      this.logger.warn(
        `Reranker request failed: ${this.getErrorMessage(error)}`,
      );

      throw new ServiceUnavailableException(
        `Reranker provider is unavailable: ${this.getErrorMessage(error)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readInteger(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : fallback;

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.trunc(Math.min(max, Math.max(min, parsed)));
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
