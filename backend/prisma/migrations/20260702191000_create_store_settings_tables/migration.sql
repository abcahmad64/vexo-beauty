CREATE TABLE IF NOT EXISTS "StoreSetting" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "group" TEXT NOT NULL DEFAULT 'GENERAL',
  "type" TEXT NOT NULL DEFAULT 'STRING',
  "label" TEXT NOT NULL,
  "description" TEXT,
  "valueJson" JSONB NOT NULL DEFAULT 'null'::jsonb,
  "valueText" TEXT,
  "defaultValueJson" JSONB,
  "validationJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
  "isReadonly" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "StoreSetting_group_check"
    CHECK ("group" IN (
      'GENERAL',
      'BUSINESS',
      'SEO',
      'PAYMENT',
      'SHIPPING',
      'NOTIFICATION',
      'SECURITY',
      'INTEGRATION',
      'THEME',
      'LEGAL',
      'AI',
      'ANALYTICS'
    )),
  CONSTRAINT "StoreSetting_type_check"
    CHECK ("type" IN (
      'STRING',
      'TEXT',
      'NUMBER',
      'BOOLEAN',
      'JSON',
      'ARRAY',
      'URL',
      'EMAIL'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreSetting_key_active_unique"
  ON "StoreSetting" (LOWER("key"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "StoreSetting_group_idx"
  ON "StoreSetting" ("group");

CREATE INDEX IF NOT EXISTS "StoreSetting_type_idx"
  ON "StoreSetting" ("type");

CREATE INDEX IF NOT EXISTS "StoreSetting_isPublic_idx"
  ON "StoreSetting" ("isPublic");

CREATE INDEX IF NOT EXISTS "StoreSetting_isActive_idx"
  ON "StoreSetting" ("isActive");

CREATE TABLE IF NOT EXISTS "StoreSettingRevision" (
  "id" TEXT PRIMARY KEY,
  "settingId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "previousValueJson" JSONB,
  "nextValueJson" JSONB,
  "actorId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StoreSettingRevision_settingId_idx"
  ON "StoreSettingRevision" ("settingId");

CREATE INDEX IF NOT EXISTS "StoreSettingRevision_key_idx"
  ON "StoreSettingRevision" ("key");

CREATE INDEX IF NOT EXISTS "StoreSettingRevision_createdAt_idx"
  ON "StoreSettingRevision" ("createdAt");