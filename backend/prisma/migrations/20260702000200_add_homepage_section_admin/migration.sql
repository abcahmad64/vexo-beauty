CREATE TABLE IF NOT EXISTS "HomeSection" (
  "id" TEXT PRIMARY KEY,
  "sectionKey" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "subtitle" TEXT,
  "description" TEXT,
  "sectionType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceConfig" JSONB,
  "imageUrl" TEXT,
  "actionLabel" TEXT,
  "actionUrl" TEXT,
  "displayMode" TEXT NOT NULL DEFAULT 'grid',
  "maxItems" INTEGER NOT NULL DEFAULT 8,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "HomeSectionProduct" (
  "sectionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HomeSectionProduct_pkey"
    PRIMARY KEY ("sectionId", "productId"),

  CONSTRAINT "HomeSectionProduct_sectionId_fkey"
    FOREIGN KEY ("sectionId")
    REFERENCES "HomeSection"("id")
    ON DELETE CASCADE,

  CONSTRAINT "HomeSectionProduct_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "Product"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "HomeSection_sectionKey_idx"
  ON "HomeSection"("sectionKey");

CREATE INDEX IF NOT EXISTS "HomeSection_slug_idx"
  ON "HomeSection"("slug");

CREATE INDEX IF NOT EXISTS "HomeSection_sectionType_idx"
  ON "HomeSection"("sectionType");

CREATE INDEX IF NOT EXISTS "HomeSection_sourceType_idx"
  ON "HomeSection"("sourceType");

CREATE INDEX IF NOT EXISTS "HomeSection_isActive_idx"
  ON "HomeSection"("isActive");

CREATE INDEX IF NOT EXISTS "HomeSection_sortOrder_idx"
  ON "HomeSection"("sortOrder");

CREATE INDEX IF NOT EXISTS "HomeSection_deleted_at_idx"
  ON "HomeSection"("deleted_at");

CREATE INDEX IF NOT EXISTS "HomeSection_startsAt_endsAt_idx"
  ON "HomeSection"("startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS "HomeSectionProduct_productId_idx"
  ON "HomeSectionProduct"("productId");

CREATE INDEX IF NOT EXISTS "HomeSectionProduct_sortOrder_idx"
  ON "HomeSectionProduct"("sortOrder");