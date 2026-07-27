CREATE TABLE IF NOT EXISTS "CmsPage" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "body" TEXT,
  "contentJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "canonicalUrl" TEXT,
  "ogImageUrl" TEXT,
  "noIndex" BOOLEAN NOT NULL DEFAULT FALSE,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CmsPage_status_check"
    CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "CmsPage_visibility_check"
    CHECK ("visibility" IN ('PUBLIC', 'PRIVATE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPage_slug_language_active_unique"
  ON "CmsPage" (LOWER("slug"), "language")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "CmsPage_status_idx"
  ON "CmsPage" ("status");

CREATE INDEX IF NOT EXISTS "CmsPage_language_idx"
  ON "CmsPage" ("language");

CREATE INDEX IF NOT EXISTS "CmsPage_publishedAt_idx"
  ON "CmsPage" ("publishedAt");

CREATE TABLE IF NOT EXISTS "CmsBlock" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "placement" TEXT NOT NULL DEFAULT 'general',
  "title" TEXT,
  "body" TEXT,
  "contentJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CmsBlock_status_check"
    CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "CmsBlock_key_language_active_unique"
  ON "CmsBlock" (LOWER("key"), "language")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "CmsBlock_status_idx"
  ON "CmsBlock" ("status");

CREATE INDEX IF NOT EXISTS "CmsBlock_placement_idx"
  ON "CmsBlock" ("placement");

CREATE INDEX IF NOT EXISTS "CmsBlock_sortOrder_idx"
  ON "CmsBlock" ("sortOrder");

CREATE TABLE IF NOT EXISTS "CmsFaq" (
  "id" TEXT PRIMARY KEY,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "category" TEXT NOT NULL DEFAULT 'general',
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CmsFaq_status_check"
    CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS "CmsFaq_language_idx"
  ON "CmsFaq" ("language");

CREATE INDEX IF NOT EXISTS "CmsFaq_category_idx"
  ON "CmsFaq" ("category");

CREATE INDEX IF NOT EXISTS "CmsFaq_status_idx"
  ON "CmsFaq" ("status");

CREATE INDEX IF NOT EXISTS "CmsFaq_sortOrder_idx"
  ON "CmsFaq" ("sortOrder");