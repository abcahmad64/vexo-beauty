import type {
  AiProviderCostAccountingSummary,
  AiProviderTokenUsage,
} from './ai-provider-cost-accounting.interface';

export type AiCanonicalTaskType =
  | 'PUBLIC_CHAT'
  | 'CONSULTING'
  | 'SALES'
  | 'CONTENT'
  | 'SEO'
  | 'SMS'
  | 'BANNER_TEXT'
  | 'RECOMMENDATION'
  | 'COMPARISON'
  | 'EMBEDDING'
  | 'ANALYTICS'
  | 'MARKETING_STRATEGY'
  | 'DISCOUNT'
  | 'ADMIN_REPORT'
  | 'DEMAND_ANALYSIS'
  | 'VISION'
  | 'ALT_TEXT'
  | 'IMAGE_DESCRIPTION'
  | 'FALLBACK';

export type AiLegacyTaskType =
  | 'core'
  | 'sales'
  | 'consulting'
  | 'comparison'
  | 'content'
  | 'article'
  | 'marketing'
  | 'recommendation';

export type AiTaskType = AiCanonicalTaskType | AiLegacyTaskType;

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerateOptions {
  task?: AiTaskType;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  jsonSchema?: Record<string, unknown>;
  userId?: string;
  promptKey?: string;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AiProviderResult {
  content: string;
  model: string;
  provider?: string;
  taskType?: AiCanonicalTaskType;
  latencyMs?: number;
  runLogId?: string;
  usage?: AiProviderTokenUsage;
  costAccounting?: AiProviderCostAccountingSummary;
  raw?: unknown;
}

export interface AiProvider {
  generate(
    messages: AiChatMessage[],
    options?: AiGenerateOptions,
  ): Promise<AiProviderResult>;
}
