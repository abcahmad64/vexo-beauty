CREATE TABLE IF NOT EXISTS "AiPromptTemplate" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "taskType" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "userPrompt" TEXT NOT NULL,
  "variablesJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "model" TEXT,
  "temperature" NUMERIC(4, 2),
  "maxTokens" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AiPromptTemplate_taskType_check"
    CHECK ("taskType" IN (
      'STORE_HEALTH_SUMMARY',
      'SALES_INSIGHT',
      'SEO_REVIEW',
      'SUPPORT_SUMMARY',
      'SEARCH_INSIGHT',
      'CUSTOM_PROMPT'
    )),
  CONSTRAINT "AiPromptTemplate_status_check"
    CHECK ("status" IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiPromptTemplate_key_active_unique"
  ON "AiPromptTemplate" (LOWER("key"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "AiPromptTemplate_taskType_idx"
  ON "AiPromptTemplate" ("taskType");

CREATE INDEX IF NOT EXISTS "AiPromptTemplate_status_idx"
  ON "AiPromptTemplate" ("status");

CREATE TABLE IF NOT EXISTS "AiKnowledgeDocument" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
  "language" TEXT NOT NULL DEFAULT 'fa',
  "content" TEXT NOT NULL,
  "tagsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AiKnowledgeDocument_sourceType_check"
    CHECK ("sourceType" IN ('MANUAL', 'CMS', 'PRODUCT', 'POLICY', 'FAQ', 'URL'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiKnowledgeDocument_key_active_unique"
  ON "AiKnowledgeDocument" (LOWER("key"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "AiKnowledgeDocument_language_idx"
  ON "AiKnowledgeDocument" ("language");

CREATE INDEX IF NOT EXISTS "AiKnowledgeDocument_sourceType_idx"
  ON "AiKnowledgeDocument" ("sourceType");

CREATE INDEX IF NOT EXISTS "AiKnowledgeDocument_isActive_idx"
  ON "AiKnowledgeDocument" ("isActive");

CREATE TABLE IF NOT EXISTS "AiGuardrailRule" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "action" TEXT NOT NULL DEFAULT 'WARN',
  "message" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AiGuardrailRule_severity_check"
    CHECK ("severity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT "AiGuardrailRule_action_check"
    CHECK ("action" IN ('WARN', 'BLOCK'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiGuardrailRule_key_active_unique"
  ON "AiGuardrailRule" (LOWER("key"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "AiGuardrailRule_severity_idx"
  ON "AiGuardrailRule" ("severity");

CREATE INDEX IF NOT EXISTS "AiGuardrailRule_action_idx"
  ON "AiGuardrailRule" ("action");

CREATE INDEX IF NOT EXISTS "AiGuardrailRule_isActive_idx"
  ON "AiGuardrailRule" ("isActive");

CREATE TABLE IF NOT EXISTS "AiRunLog" (
  "id" TEXT PRIMARY KEY,
  "taskType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "promptTemplateId" TEXT,
  "model" TEXT,
  "inputJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "outputJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "guardrailResultJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "errorMessage" TEXT,
  "durationMs" INTEGER,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AiRunLog_taskType_check"
    CHECK ("taskType" IN (
      'STORE_HEALTH_SUMMARY',
      'SALES_INSIGHT',
      'SEO_REVIEW',
      'SUPPORT_SUMMARY',
      'SEARCH_INSIGHT',
      'CUSTOM_PROMPT'
    )),
  CONSTRAINT "AiRunLog_status_check"
    CHECK ("status" IN ('RUNNING', 'SUCCESS', 'FAILED', 'BLOCKED'))
);

CREATE INDEX IF NOT EXISTS "AiRunLog_taskType_idx"
  ON "AiRunLog" ("taskType");

CREATE INDEX IF NOT EXISTS "AiRunLog_status_idx"
  ON "AiRunLog" ("status");

CREATE INDEX IF NOT EXISTS "AiRunLog_promptTemplateId_idx"
  ON "AiRunLog" ("promptTemplateId");

CREATE INDEX IF NOT EXISTS "AiRunLog_createdById_idx"
  ON "AiRunLog" ("createdById");

CREATE INDEX IF NOT EXISTS "AiRunLog_startedAt_idx"
  ON "AiRunLog" ("startedAt");

CREATE TABLE IF NOT EXISTS "AiRecommendation" (
  "id" TEXT PRIMARY KEY,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdByRunId" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AiRecommendation_targetType_check"
    CHECK ("targetType" IN (
      'STORE',
      'ORDER',
      'PRODUCT',
      'CUSTOMER',
      'SEO',
      'SUPPORT',
      'SEARCH',
      'PAYMENT',
      'INVENTORY'
    )),
  CONSTRAINT "AiRecommendation_severity_check"
    CHECK ("severity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT "AiRecommendation_status_check"
    CHECK ("status" IN ('OPEN', 'RESOLVED', 'DISMISSED'))
);

CREATE INDEX IF NOT EXISTS "AiRecommendation_target_idx"
  ON "AiRecommendation" ("targetType", "targetId");

CREATE INDEX IF NOT EXISTS "AiRecommendation_status_idx"
  ON "AiRecommendation" ("status");

CREATE INDEX IF NOT EXISTS "AiRecommendation_severity_idx"
  ON "AiRecommendation" ("severity");

CREATE INDEX IF NOT EXISTS "AiRecommendation_createdByRunId_idx"
  ON "AiRecommendation" ("createdByRunId");