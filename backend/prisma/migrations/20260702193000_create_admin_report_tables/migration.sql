CREATE TABLE IF NOT EXISTS "AdminReportSnapshot" (
  "id" TEXT PRIMARY KEY,
  "reportType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "filtersJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "resultJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AdminReportSnapshot_reportType_check"
    CHECK ("reportType" IN (
      'OVERVIEW',
      'SALES',
      'ORDERS',
      'PAYMENTS',
      'CUSTOMERS',
      'PRODUCTS',
      'COUPONS',
      'SUPPORT'
    ))
);

CREATE INDEX IF NOT EXISTS "AdminReportSnapshot_reportType_idx"
  ON "AdminReportSnapshot" ("reportType");

CREATE INDEX IF NOT EXISTS "AdminReportSnapshot_createdById_idx"
  ON "AdminReportSnapshot" ("createdById");

CREATE INDEX IF NOT EXISTS "AdminReportSnapshot_createdAt_idx"
  ON "AdminReportSnapshot" ("createdAt");

CREATE TABLE IF NOT EXISTS "AdminReportExportLog" (
  "id" TEXT PRIMARY KEY,
  "reportType" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "filtersJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "exportedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminReportExportLog_format_check"
    CHECK ("format" IN ('csv', 'json'))
);

CREATE INDEX IF NOT EXISTS "AdminReportExportLog_reportType_idx"
  ON "AdminReportExportLog" ("reportType");

CREATE INDEX IF NOT EXISTS "AdminReportExportLog_exportedById_idx"
  ON "AdminReportExportLog" ("exportedById");

CREATE INDEX IF NOT EXISTS "AdminReportExportLog_createdAt_idx"
  ON "AdminReportExportLog" ("createdAt");