-- Align the deployed PostgreSQL catalog schema with the public product
-- queries and the canonical Prisma data model.
--
-- This migration is intentionally additive and idempotent. It does not
-- delete, rename, or rewrite existing catalog data.

ALTER TABLE "ProductImage"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN;

UPDATE "ProductImage"
SET "isActive" = TRUE
WHERE "isActive" IS NULL;

ALTER TABLE "ProductImage"
ALTER COLUMN "isActive" SET DEFAULT TRUE;

ALTER TABLE "ProductImage"
ALTER COLUMN "isActive" SET NOT NULL;

ALTER TABLE "Category"
ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5, 2);

CREATE INDEX IF NOT EXISTS "ProductImage_isActive_idx"
ON "ProductImage" ("isActive");
