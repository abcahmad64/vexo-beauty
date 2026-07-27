CREATE TABLE IF NOT EXISTS "SearchQueryLog" (
  "id" TEXT PRIMARY KEY,
  "query" TEXT NOT NULL,
  "normalizedQuery" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "userId" TEXT,
  "sessionId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'WEB',
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "clickedEntityType" TEXT,
  "clickedEntityId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "SearchQueryLog_normalizedQuery_idx"
  ON "SearchQueryLog" ("normalizedQuery");

CREATE INDEX IF NOT EXISTS "SearchQueryLog_language_idx"
  ON "SearchQueryLog" ("language");

CREATE INDEX IF NOT EXISTS "SearchQueryLog_userId_idx"
  ON "SearchQueryLog" ("userId");

CREATE INDEX IF NOT EXISTS "SearchQueryLog_resultCount_idx"
  ON "SearchQueryLog" ("resultCount");

CREATE INDEX IF NOT EXISTS "SearchQueryLog_createdAt_idx"
  ON "SearchQueryLog" ("createdAt");

CREATE TABLE IF NOT EXISTS "SearchSynonym" (
  "id" TEXT PRIMARY KEY,
  "term" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "synonymsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "SearchSynonym_term_language_active_unique"
  ON "SearchSynonym" (LOWER("term"), "language")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "SearchSynonym_language_idx"
  ON "SearchSynonym" ("language");

CREATE INDEX IF NOT EXISTS "SearchSynonym_isActive_idx"
  ON "SearchSynonym" ("isActive");

CREATE TABLE IF NOT EXISTS "SearchRedirect" (
  "id" TEXT PRIMARY KEY,
  "query" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "targetUrl" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "SearchRedirect_targetType_check"
    CHECK ("targetType" IN ('PRODUCT', 'CATEGORY', 'BRAND', 'PAGE', 'URL'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "SearchRedirect_query_language_active_unique"
  ON "SearchRedirect" (LOWER("query"), "language")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "SearchRedirect_language_idx"
  ON "SearchRedirect" ("language");

CREATE INDEX IF NOT EXISTS "SearchRedirect_targetType_idx"
  ON "SearchRedirect" ("targetType");

CREATE INDEX IF NOT EXISTS "SearchRedirect_priority_idx"
  ON "SearchRedirect" ("priority");

CREATE TABLE IF NOT EXISTS "SearchBoostRule" (
  "id" TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "query" TEXT,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "weight" NUMERIC(8, 2) NOT NULL DEFAULT 1,
  "reason" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "SearchBoostRule_entityType_check"
    CHECK ("entityType" IN ('PRODUCT', 'CATEGORY', 'BRAND', 'PAGE'))
);

CREATE INDEX IF NOT EXISTS "SearchBoostRule_entity_idx"
  ON "SearchBoostRule" ("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "SearchBoostRule_query_idx"
  ON "SearchBoostRule" ("query");

CREATE INDEX IF NOT EXISTS "SearchBoostRule_language_idx"
  ON "SearchBoostRule" ("language");

CREATE INDEX IF NOT EXISTS "SearchBoostRule_isActive_idx"
  ON "SearchBoostRule" ("isActive");

CREATE TABLE IF NOT EXISTS "SearchIndexSnapshot" (
  "id" TEXT PRIMARY KEY,
  "indexName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "documentCount" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "errorMessage" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "SearchIndexSnapshot_status_check"
    CHECK ("status" IN ('RUNNING', 'SUCCESS', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS "SearchIndexSnapshot_indexName_idx"
  ON "SearchIndexSnapshot" ("indexName");

CREATE INDEX IF NOT EXISTS "SearchIndexSnapshot_status_idx"
  ON "SearchIndexSnapshot" ("status");

CREATE INDEX IF NOT EXISTS "SearchIndexSnapshot_createdById_idx"
  ON "SearchIndexSnapshot" ("createdById");

CREATE INDEX IF NOT EXISTS "SearchIndexSnapshot_startedAt_idx"
  ON "SearchIndexSnapshot" ("startedAt");