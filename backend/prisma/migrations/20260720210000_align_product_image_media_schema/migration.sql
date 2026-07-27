-- Align the deployed ProductImage table with the canonical Prisma model
-- and the existing admin product media service.
--
-- The migration is additive and preserves every existing image row.

DO $$
BEGIN
  IF to_regtype('public."ProductMediaType"') IS NULL THEN
    CREATE TYPE "ProductMediaType" AS ENUM ('IMAGE', 'VIDEO');
  END IF;
END
$$;

ALTER TABLE "ProductImage"
  ADD COLUMN IF NOT EXISTS "type" "ProductMediaType",
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "caption" TEXT,
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "size" INTEGER,
  ADD COLUMN IF NOT EXISTS "width" INTEGER,
  ADD COLUMN IF NOT EXISTS "height" INTEGER,
  ADD COLUMN IF NOT EXISTS "duration" INTEGER,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN;

UPDATE "ProductImage"
SET "type" = 'IMAGE'::"ProductMediaType"
WHERE "type" IS NULL;

UPDATE "ProductImage"
SET "isActive" = TRUE
WHERE "isActive" IS NULL;

ALTER TABLE "ProductImage"
  ALTER COLUMN "type" SET DEFAULT 'IMAGE'::"ProductMediaType",
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "isActive" SET DEFAULT TRUE,
  ALTER COLUMN "isActive" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ProductImage_type_idx"
ON "ProductImage" ("type");

CREATE INDEX IF NOT EXISTS "ProductImage_isActive_idx"
ON "ProductImage" ("isActive");
