-- Align the deployed PostgreSQL catalog tables with the canonical Prisma
-- models and the production public catalog queries.
--
-- This migration is additive and idempotent:
-- - no table is dropped;
-- - no existing column is renamed or removed;
-- - existing product and catalog records are preserved.

-- Product SEO and structured content.
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "schemaJson" JSONB;

-- Product commercial and pricing contract.
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "purchasePrice" DECIMAL(12, 2);

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "salePrice" DECIMAL(12, 2);

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "finalPrice" DECIMAL(12, 2);

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "minAllowedPrice" DECIMAL(12, 2);

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "grossMarginAmount" DECIMAL(12, 2);

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "grossMarginPercent" DECIMAL(6, 2);

-- Existing products initially retain their current public price.
UPDATE "Product"
SET "salePrice" = "price"
WHERE "salePrice" IS NULL;

UPDATE "Product"
SET "finalPrice" = COALESCE(
    "salePrice",
    "price"
)
WHERE "finalPrice" IS NULL;

-- Product AI-content contract.
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "aiContentStatus" TEXT;

UPDATE "Product"
SET "aiContentStatus" = 'NOT_GENERATED'
WHERE "aiContentStatus" IS NULL;

ALTER TABLE "Product"
ALTER COLUMN "aiContentStatus"
SET DEFAULT 'NOT_GENERATED';

ALTER TABLE "Product"
ALTER COLUMN "aiContentStatus"
SET NOT NULL;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "aiQualityScore" DECIMAL(5, 2);

-- Category SEO contract.
ALTER TABLE "Category"
ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;

ALTER TABLE "Category"
ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

-- Brand SEO and origin contract.
ALTER TABLE "Brand"
ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;

ALTER TABLE "Brand"
ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

ALTER TABLE "Brand"
ADD COLUMN IF NOT EXISTS "country" TEXT;

-- Product type SEO contract.
ALTER TABLE "ProductType"
ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;

ALTER TABLE "ProductType"
ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

-- Product-model presentation contract.
ALTER TABLE "ProductModel"
ADD COLUMN IF NOT EXISTS "modelCode" TEXT;

ALTER TABLE "ProductModel"
ADD COLUMN IF NOT EXISTS "titlePattern" TEXT;

ALTER TABLE "ProductModel"
ADD COLUMN IF NOT EXISTS "seoPattern" TEXT;

-- Preserve legacy model codes stored in the old "code" column.
UPDATE "ProductModel"
SET "modelCode" = "code"
WHERE "modelCode" IS NULL
  AND "code" IS NOT NULL;

-- Useful lookup indexes for public catalog filtering and ordering.
CREATE INDEX IF NOT EXISTS "Product_finalPrice_idx"
ON "Product" ("finalPrice");

CREATE INDEX IF NOT EXISTS "Product_salePrice_idx"
ON "Product" ("salePrice");

CREATE INDEX IF NOT EXISTS "Product_aiContentStatus_idx"
ON "Product" ("aiContentStatus");

CREATE INDEX IF NOT EXISTS "ProductModel_modelCode_idx"
ON "ProductModel" ("modelCode");
