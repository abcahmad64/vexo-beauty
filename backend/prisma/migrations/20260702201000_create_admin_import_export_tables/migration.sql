CREATE TABLE IF NOT EXISTS "AdminImportJob" (
  "id" TEXT PRIMARY KEY,
  "entity" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'UPSERT',
  "sourceFormat" TEXT NOT NULL DEFAULT 'JSON',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "title" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "rowsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "previewJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "resultJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "errorMessage" TEXT,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AdminImportJob_entity_check"
    CHECK ("entity" IN ('BRAND', 'CATEGORY', 'COUPON')),
  CONSTRAINT "AdminImportJob_mode_check"
    CHECK ("mode" IN ('CREATE', 'UPDATE', 'UPSERT')),
  CONSTRAINT "AdminImportJob_sourceFormat_check"
    CHECK ("sourceFormat" IN ('JSON', 'CSV')),
  CONSTRAINT "AdminImportJob_status_check"
    CHECK ("status" IN ('PENDING', 'PREVIEWED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS "AdminImportJob_entity_idx"
  ON "AdminImportJob" ("entity");

CREATE INDEX IF NOT EXISTS "AdminImportJob_status_idx"
  ON "AdminImportJob" ("status");

CREATE INDEX IF NOT EXISTS "AdminImportJob_createdById_idx"
  ON "AdminImportJob" ("createdById");

CREATE INDEX IF NOT EXISTS "AdminImportJob_createdAt_idx"
  ON "AdminImportJob" ("createdAt");

CREATE TABLE IF NOT EXISTS "AdminExportJob" (
  "id" TEXT PRIMARY KEY,
  "entity" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'CSV',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "title" TEXT,
  "filtersJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "resultJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "fileName" TEXT,
  "mimeType" TEXT,
  "content" TEXT,
  "errorMessage" TEXT,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AdminExportJob_entity_check"
    CHECK ("entity" IN (
      'BRAND',
      'CATEGORY',
      'COUPON',
      'PRODUCT',
      'ORDER',
      'USER',
      'PAYMENT',
      'REFUND',
      'INVOICE',
      'SUPPORT_TICKET',
      'SEARCH_LOG',
      'AI_RECOMMENDATION',
      'SECURITY_INCIDENT'
    )),
  CONSTRAINT "AdminExportJob_format_check"
    CHECK ("format" IN ('CSV', 'JSON')),
  CONSTRAINT "AdminExportJob_status_check"
    CHECK ("status" IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS "AdminExportJob_entity_idx"
  ON "AdminExportJob" ("entity");

CREATE INDEX IF NOT EXISTS "AdminExportJob_status_idx"
  ON "AdminExportJob" ("status");

CREATE INDEX IF NOT EXISTS "AdminExportJob_createdById_idx"
  ON "AdminExportJob" ("createdById");

CREATE INDEX IF NOT EXISTS "AdminExportJob_createdAt_idx"
  ON "AdminExportJob" ("createdAt");