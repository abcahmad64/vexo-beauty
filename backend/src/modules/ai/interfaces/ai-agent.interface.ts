import type { AiCanonicalTaskType } from './ai-provider.interface';

export type AiAgentId =
  | 'storefront-sales'
  | 'product-intelligence'
  | 'recommendation-engine'
  | 'marketing-strategist'
  | 'business-copilot'
  | 'media-vision'
  | 'semantic-retrieval'
  | 'fallback-responder';

export type AiAgentCapability =
  | 'PUBLIC_ASSISTANT'
  | 'SALES_CONSULTING'
  | 'PRODUCT_COMPARISON'
  | 'PRODUCT_RESEARCH'
  | 'CONTENT_DRAFTING'
  | 'SEO_DRAFTING'
  | 'PRODUCT_RECOMMENDATION'
  | 'MARKETING_STRATEGY'
  | 'DISCOUNT_SUGGESTION'
  | 'MESSAGE_DRAFTING'
  | 'DEMAND_ANALYSIS'
  | 'BUSINESS_ANALYTICS'
  | 'ADMIN_REPORTING'
  | 'VISION_ANALYSIS'
  | 'ALT_TEXT_DRAFTING'
  | 'IMAGE_DESCRIPTION'
  | 'SEMANTIC_EMBEDDING'
  | 'FALLBACK_RESPONSE'
  | 'HUMAN_HANDOFF';

export type AiAgentExecutionMode =
  'READ_ONLY' | 'SUGGEST_ONLY' | 'APPROVAL_GATED';

export interface AiAgentModelRequirements {
  provider: 'ollama';
  taskTypes: readonly AiCanonicalTaskType[];
  supportsFallback: boolean;
  requiresEmbedding: boolean;
  requiresVision: boolean;
}

export interface AiAgentDefinition {
  id: string;
  title: string;
  description: string;
  version: string;
  enabled: boolean;
  executionMode: AiAgentExecutionMode;
  capabilities: readonly AiAgentCapability[];
  taskTypes: readonly AiCanonicalTaskType[];
  modelRequirements: AiAgentModelRequirements;
  supportsHumanHandoff: boolean;
}

export interface AiAgentSnapshotItem extends AiAgentDefinition {
  status: 'AVAILABLE' | 'DISABLED';
}

export interface AiAgentResolution {
  agent: AiAgentDefinition;
  normalizedTaskType: AiCanonicalTaskType;
  requestedTask: string;
}
