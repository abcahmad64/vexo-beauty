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

-- Canonical product-type and product-model catalog structure.
CREATE TABLE IF NOT EXISTS "ProductType" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductModel" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "brandId" TEXT NOT NULL,
  "productTypeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "modelCode" TEXT,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "titlePattern" TEXT,
  "seoPattern" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- Add canonical columns when upgrading an older deployed schema.
ALTER TABLE "ProductType"
ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;

ALTER TABLE "ProductType"
ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

ALTER TABLE "ProductModel"
ADD COLUMN IF NOT EXISTS "modelCode" TEXT;

ALTER TABLE "ProductModel"
ADD COLUMN IF NOT EXISTS "titlePattern" TEXT;

ALTER TABLE "ProductModel"
ADD COLUMN IF NOT EXISTS "seoPattern" TEXT;

-- Preserve legacy ProductModel.code only when that old column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProductModel'
      AND column_name = 'code'
  ) THEN
    EXECUTE '
      UPDATE "ProductModel"
      SET "modelCode" = "code"
      WHERE "modelCode" IS NULL
        AND "code" IS NOT NULL
    ';
  END IF;
END
$$;

-- Attach optional canonical catalog identities to existing products.
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "productTypeId" TEXT;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "productModelId" TEXT;

-- Constraints are added conditionally for compatibility with existing installs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductType_categoryId_fkey'
  ) THEN
    ALTER TABLE "ProductType"
      ADD CONSTRAINT "ProductType_categoryId_fkey"
      FOREIGN KEY ("categoryId")
      REFERENCES "Category"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductModel_brandId_fkey'
  ) THEN
    ALTER TABLE "ProductModel"
      ADD CONSTRAINT "ProductModel_brandId_fkey"
      FOREIGN KEY ("brandId")
      REFERENCES "Brand"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductModel_productTypeId_fkey'
  ) THEN
    ALTER TABLE "ProductModel"
      ADD CONSTRAINT "ProductModel_productTypeId_fkey"
      FOREIGN KEY ("productTypeId")
      REFERENCES "ProductType"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Product_productTypeId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_productTypeId_fkey"
      FOREIGN KEY ("productTypeId")
      REFERENCES "ProductType"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Product_productModelId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_productModelId_fkey"
      FOREIGN KEY ("productModelId")
      REFERENCES "ProductModel"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  "ProductType_categoryId_slug_key"
ON "ProductType" ("categoryId", "slug");

CREATE INDEX IF NOT EXISTS
  "ProductType_categoryId_idx"
ON "ProductType" ("categoryId");

CREATE INDEX IF NOT EXISTS
  "ProductType_slug_idx"
ON "ProductType" ("slug");

CREATE INDEX IF NOT EXISTS
  "ProductType_isActive_idx"
ON "ProductType" ("isActive");

CREATE INDEX IF NOT EXISTS
  "ProductType_sortOrder_idx"
ON "ProductType" ("sortOrder");

CREATE INDEX IF NOT EXISTS
  "ProductType_deleted_at_idx"
ON "ProductType" ("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS
  "ProductModel_brandId_productTypeId_slug_key"
ON "ProductModel" ("brandId", "productTypeId", "slug");

CREATE INDEX IF NOT EXISTS
  "ProductModel_brandId_idx"
ON "ProductModel" ("brandId");

CREATE INDEX IF NOT EXISTS
  "ProductModel_productTypeId_idx"
ON "ProductModel" ("productTypeId");

CREATE INDEX IF NOT EXISTS
  "ProductModel_slug_idx"
ON "ProductModel" ("slug");

CREATE INDEX IF NOT EXISTS
  "ProductModel_modelCode_idx"
ON "ProductModel" ("modelCode");

CREATE INDEX IF NOT EXISTS
  "ProductModel_isActive_idx"
ON "ProductModel" ("isActive");

CREATE INDEX IF NOT EXISTS
  "ProductModel_sortOrder_idx"
ON "ProductModel" ("sortOrder");

CREATE INDEX IF NOT EXISTS
  "ProductModel_deleted_at_idx"
ON "ProductModel" ("deleted_at");

CREATE INDEX IF NOT EXISTS
  "Product_productTypeId_idx"
ON "Product" ("productTypeId");

CREATE INDEX IF NOT EXISTS
  "Product_productModelId_idx"
ON "Product" ("productModelId");

-- Useful lookup indexes for public catalog filtering and ordering.
CREATE INDEX IF NOT EXISTS "Product_finalPrice_idx"
ON "Product" ("finalPrice");

CREATE INDEX IF NOT EXISTS "Product_salePrice_idx"
ON "Product" ("salePrice");

CREATE INDEX IF NOT EXISTS "Product_aiContentStatus_idx"
ON "Product" ("aiContentStatus");

