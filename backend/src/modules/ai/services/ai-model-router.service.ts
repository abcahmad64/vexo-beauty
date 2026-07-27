import { Injectable } from '@nestjs/common';

import {
  AiCanonicalTaskType,
  AiGenerateOptions,
} from '../interfaces/ai-provider.interface';

export interface AiModelRoute {
  provider: 'ollama';
  taskType: AiCanonicalTaskType;
  model: string;
  temperature: number;
  numPredict: number;
  numCtx: number;
  timeoutMs: number;
  keepAlive: string;
  think: boolean | 'low' | 'medium' | 'high';
}

@Injectable()
export class AiModelRouterService {
  resolve(options: AiGenerateOptions = {}): AiModelRoute {
    const taskType = this.normalizeTaskType(options.task ?? 'PUBLIC_CHAT');

    return {
      provider: 'ollama',
      taskType,
      model: this.resolveModel(taskType),
      temperature: this.resolveTemperature(taskType, options.temperature),
      numPredict: this.resolveNumPredict(taskType, options.maxTokens),
      numCtx: this.readNumber('AI_OLLAMA_NUM_CTX', 8192, 512, 131072),
      timeoutMs: this.readNumber(
        'AI_OLLAMA_TIMEOUT_MS',
        this.readNumber('OLLAMA_TIMEOUT_MS', 180000, 1000, 900000),
        1000,
        900000,
      ),
      keepAlive: this.readString('AI_OLLAMA_KEEP_ALIVE', '5m'),
      think: this.resolveThinkMode(taskType),
    };
  }

  getFallbackModel(): string {
    return this.readString('AI_OLLAMA_FALLBACK_MODEL', 'qwen3:14b');
  }

  normalizeTaskType(task: string): AiCanonicalTaskType {
    const normalized = String(task).trim().toUpperCase();

    const legacyMap: Record<string, AiCanonicalTaskType> = {
      CORE: 'PUBLIC_CHAT',
      PUBLIC: 'PUBLIC_CHAT',
      PUBLIC_CHAT: 'PUBLIC_CHAT',
      CHAT: 'PUBLIC_CHAT',

      SALES: 'SALES',
      CONSULTING: 'CONSULTING',
      COMPARISON: 'COMPARISON',
      COMPARE: 'COMPARISON',

      CONTENT: 'CONTENT',
      ARTICLE: 'CONTENT',
      SEO: 'SEO',

      SMS: 'SMS',
      BANNER_TEXT: 'BANNER_TEXT',

      RECOMMENDATION: 'RECOMMENDATION',
      MARKETING: 'MARKETING_STRATEGY',
      MARKETING_STRATEGY: 'MARKETING_STRATEGY',

      ANALYTICS: 'ANALYTICS',
      DISCOUNT: 'DISCOUNT',
      ADMIN_REPORT: 'ADMIN_REPORT',
      DEMAND_ANALYSIS: 'DEMAND_ANALYSIS',

      EMBEDDING: 'EMBEDDING',
      VISION: 'VISION',
      ALT_TEXT: 'ALT_TEXT',
      IMAGE_DESCRIPTION: 'IMAGE_DESCRIPTION',
      FALLBACK: 'FALLBACK',
    };

    return legacyMap[normalized] ?? 'PUBLIC_CHAT';
  }

  private resolveThinkMode(
    taskType: AiCanonicalTaskType,
  ): boolean | 'low' | 'medium' | 'high' {
    const nonReasoningTasks: AiCanonicalTaskType[] = [
      'PUBLIC_CHAT',
      'CONSULTING',
      'SALES',
      'CONTENT',
      'SEO',
      'SMS',
      'BANNER_TEXT',
      'RECOMMENDATION',
      'COMPARISON',
      'EMBEDDING',
      'VISION',
      'ALT_TEXT',
      'IMAGE_DESCRIPTION',
      'FALLBACK',
    ];

    if (nonReasoningTasks.includes(taskType)) {
      return false;
    }

    const raw = this.readString('AI_OLLAMA_THINK', 'false')
      .trim()
      .toLowerCase();

    if (['true', '1', 'yes'].includes(raw)) {
      return true;
    }

    if (raw === 'low' || raw === 'medium' || raw === 'high') {
      return raw;
    }

    return false;
  }

  private resolveModel(taskType: AiCanonicalTaskType): string {
    const defaultModel = this.readString(
      'AI_OLLAMA_DEFAULT_MODEL',
      this.readString('OLLAMA_MODEL', 'qwen3.5:9b'),
    );

    const envByTask: Record<AiCanonicalTaskType, string> = {
      PUBLIC_CHAT: 'AI_OLLAMA_PUBLIC_MODEL',
      CONSULTING: 'AI_OLLAMA_CONSULTING_MODEL',
      SALES: 'AI_OLLAMA_SALES_MODEL',
      CONTENT: 'AI_OLLAMA_CONTENT_MODEL',
      SEO: 'AI_OLLAMA_SEO_MODEL',
      SMS: 'AI_OLLAMA_SMS_MODEL',
      BANNER_TEXT: 'AI_OLLAMA_BANNER_TEXT_MODEL',
      RECOMMENDATION: 'AI_OLLAMA_RECOMMENDATION_MODEL',
      COMPARISON: 'AI_OLLAMA_COMPARISON_MODEL',

      EMBEDDING: 'AI_OLLAMA_EMBEDDING_MODEL',

      ANALYTICS: 'AI_OLLAMA_ANALYTICS_MODEL',
      MARKETING_STRATEGY: 'AI_OLLAMA_MARKETING_STRATEGY_MODEL',
      DISCOUNT: 'AI_OLLAMA_DISCOUNT_MODEL',
      ADMIN_REPORT: 'AI_OLLAMA_ADMIN_REPORT_MODEL',
      DEMAND_ANALYSIS: 'AI_OLLAMA_DEMAND_ANALYSIS_MODEL',

      VISION: 'AI_OLLAMA_VISION_MODEL',
      ALT_TEXT: 'AI_OLLAMA_ALT_TEXT_MODEL',
      IMAGE_DESCRIPTION: 'AI_OLLAMA_IMAGE_DESCRIPTION_MODEL',

      FALLBACK: 'AI_OLLAMA_FALLBACK_MODEL',
    };

    return this.readString(envByTask[taskType], defaultModel);
  }

  private resolveTemperature(
    taskType: AiCanonicalTaskType,
    override?: number,
  ): number {
    if (override !== undefined && Number.isFinite(override)) {
      return this.clamp(override, 0, 2);
    }

    if (
      taskType === 'CONTENT' ||
      taskType === 'SEO' ||
      taskType === 'SMS' ||
      taskType === 'BANNER_TEXT'
    ) {
      return this.readNumber('AI_OLLAMA_CREATIVE_TEMPERATURE', 0.55, 0, 2);
    }

    if (
      taskType === 'CONSULTING' ||
      taskType === 'SALES' ||
      taskType === 'COMPARISON' ||
      taskType === 'PUBLIC_CHAT'
    ) {
      return this.readNumber(
        'AI_OLLAMA_PRECISE_TEMPERATURE',
        this.readNumber('AI_OLLAMA_TEMPERATURE', 0.4, 0, 2),
        0,
        2,
      );
    }

    return this.readNumber('AI_OLLAMA_TEMPERATURE', 0.4, 0, 2);
  }

  private resolveNumPredict(
    taskType: AiCanonicalTaskType,
    override?: number,
  ): number {
    if (override !== undefined && Number.isFinite(override)) {
      return Math.trunc(this.clamp(override, 64, 8192));
    }

    if (
      taskType === 'CONTENT' ||
      taskType === 'SEO' ||
      taskType === 'ADMIN_REPORT'
    ) {
      return this.readNumber('AI_OLLAMA_LONG_NUM_PREDICT', 2048, 128, 8192);
    }

    return this.readNumber('AI_OLLAMA_NUM_PREDICT', 256, 64, 8192);
  }

  private readString(key: string, fallback: string): string {
    const value = process.env[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }

    return fallback;
  }

  private readNumber(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const value = process.env[key];

    if (value === undefined || value === null || value.trim() === '') {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return this.clamp(parsed, min, max);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
