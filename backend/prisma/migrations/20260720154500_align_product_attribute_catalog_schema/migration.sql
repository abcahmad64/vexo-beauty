BEGIN;

-- The Prisma schema and product services already use these enums, but the
-- production migration history never created them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ProductAttributeDataType'
  ) THEN
    CREATE TYPE "ProductAttributeDataType" AS ENUM (
      'TEXT',
      'NUMBER',
      'BOOLEAN',
      'ENUM',
      'MULTI_SELECT',
      'JSON',
      'DATE'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ProductAttributeInputType'
  ) THEN
    CREATE TYPE "ProductAttributeInputType" AS ENUM (
      'TEXT',
      'TEXTAREA',
      'NUMBER',
      'SWITCH',
      'SELECT',
      'MULTI_SELECT',
      'DATE',
      'COLOR',
      'RICH_TEXT'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ProductAttributeTemplateScope'
  ) THEN
    CREATE TYPE "ProductAttributeTemplateScope" AS ENUM (
      'CATEGORY',
      'PRODUCT_TYPE',
      'BRAND_PRODUCT_TYPE',
      'PRODUCT_MODEL'
    );
  END IF;
END
$$;

-- Bring the legacy Attribute table up to the contract used by
-- AdminProductCatalogService and AdminProductService.
ALTER TABLE "Attribute"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "dataType" "ProductAttributeDataType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "inputType" "ProductAttributeInputType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "unit" TEXT,
  ADD COLUMN IF NOT EXISTS "optionsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "placeholder" TEXT,
  ADD COLUMN IF NOT EXISTS "helpText" TEXT,
  ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isFilterable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isComparable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isSeoImportant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isAiImportant" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Attribute"
SET
  "optionsJson" = COALESCE("optionsJson", '[]'::jsonb),
  "isRequired" = COALESCE("isRequired", false),
  "isFilterable" = COALESCE("isFilterable", false),
  "isComparable" = COALESCE("isComparable", false),
  "isSeoImportant" = COALESCE("isSeoImportant", false),
  "isAiImportant" = COALESCE("isAiImportant", true),
  "sortOrder" = COALESCE("sortOrder", 0),
  "isActive" = COALESCE("isActive", true);

CREATE UNIQUE INDEX IF NOT EXISTS "Attribute_code_key"
  ON "Attribute"("code");

CREATE INDEX IF NOT EXISTS "Attribute_code_idx"
  ON "Attribute"("code");

CREATE INDEX IF NOT EXISTS "Attribute_dataType_idx"
  ON "Attribute"("dataType");

CREATE INDEX IF NOT EXISTS "Attribute_inputType_idx"
  ON "Attribute"("inputType");

CREATE INDEX IF NOT EXISTS "Attribute_isFilterable_idx"
  ON "Attribute"("isFilterable");

CREATE INDEX IF NOT EXISTS "Attribute_isComparable_idx"
  ON "Attribute"("isComparable");

CREATE INDEX IF NOT EXISTS "Attribute_isSeoImportant_idx"
  ON "Attribute"("isSeoImportant");

CREATE INDEX IF NOT EXISTS "Attribute_isAiImportant_idx"
  ON "Attribute"("isAiImportant");

CREATE INDEX IF NOT EXISTS "Attribute_isActive_idx"
  ON "Attribute"("isActive");

CREATE INDEX IF NOT EXISTS "Attribute_sortOrder_idx"
  ON "Attribute"("sortOrder");

-- Preserve every legacy predefined value while adding support for typed,
-- free-form product attributes.
ALTER TABLE "ProductAttribute"
  ADD COLUMN IF NOT EXISTS "attributeId" TEXT,
  ADD COLUMN IF NOT EXISTS "valueText" TEXT,
  ADD COLUMN IF NOT EXISTS "valueNumber" DECIMAL(14, 4),
  ADD COLUMN IF NOT EXISTS "valueBoolean" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "valueJson" JSONB,
  ADD COLUMN IF NOT EXISTS "unit" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "ProductAttribute" AS pa
SET "attributeId" = av."attributeId"
FROM "AttributeValue" AS av
WHERE
  pa."attributeValueId" = av."id"
  AND pa."attributeId" IS NULL;

UPDATE "ProductAttribute"
SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "ProductAttribute"
  ALTER COLUMN "attributeValueId" DROP NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "ProductAttribute"
  DROP CONSTRAINT IF EXISTS "ProductAttribute_attributeValueId_fkey";

ALTER TABLE "ProductAttribute"
  ADD CONSTRAINT "ProductAttribute_attributeValueId_fkey"
  FOREIGN KEY ("attributeValueId")
  REFERENCES "AttributeValue"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductAttribute_attributeId_fkey'
  ) THEN
    ALTER TABLE "ProductAttribute"
      ADD CONSTRAINT "ProductAttribute_attributeId_fkey"
      FOREIGN KEY ("attributeId")
      REFERENCES "Attribute"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "ProductAttribute_attributeId_idx"
  ON "ProductAttribute"("attributeId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttribute_productId_attributeId_key"
  ON "ProductAttribute"("productId", "attributeId");

-- These tables are referenced by the admin catalog service and declared in
-- schema.prisma, but had no production migration.
CREATE TABLE IF NOT EXISTS "ProductAttributeTemplate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "scope" "ProductAttributeTemplateScope" NOT NULL,
  "name" TEXT NOT NULL,
  "categoryId" TEXT,
  "productTypeId" TEXT,
  "brandId" TEXT,
  "productModelId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "ProductAttributeTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductAttributeTemplate_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "Category"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT "ProductAttributeTemplate_productTypeId_fkey"
    FOREIGN KEY ("productTypeId")
    REFERENCES "ProductType"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT "ProductAttributeTemplate_brandId_fkey"
    FOREIGN KEY ("brandId")
    REFERENCES "Brand"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT "ProductAttributeTemplate_productModelId_fkey"
    FOREIGN KEY ("productModelId")
    REFERENCES "ProductModel"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductAttributeTemplateField" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "templateId" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "groupName" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAttributeTemplateField_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductAttributeTemplateField_templateId_fkey"
    FOREIGN KEY ("templateId")
    REFERENCES "ProductAttributeTemplate"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ProductAttributeTemplateField_attributeId_fkey"
    FOREIGN KEY ("attributeId")
    REFERENCES "Attribute"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_scope_idx"
  ON "ProductAttributeTemplate"("scope");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_categoryId_idx"
  ON "ProductAttributeTemplate"("categoryId");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_productTypeId_idx"
  ON "ProductAttributeTemplate"("productTypeId");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_brandId_idx"
  ON "ProductAttributeTemplate"("brandId");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_productModelId_idx"
  ON "ProductAttributeTemplate"("productModelId");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_priority_idx"
  ON "ProductAttributeTemplate"("priority");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_isDefault_idx"
  ON "ProductAttributeTemplate"("isDefault");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_isActive_idx"
  ON "ProductAttributeTemplate"("isActive");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplate_deleted_at_idx"
  ON "ProductAttributeTemplate"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS
  "ProductAttributeTemplateField_templateId_attributeId_key"
  ON "ProductAttributeTemplateField"("templateId", "attributeId");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplateField_templateId_idx"
  ON "ProductAttributeTemplateField"("templateId");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplateField_attributeId_idx"
  ON "ProductAttributeTemplateField"("attributeId");

CREATE INDEX IF NOT EXISTS "ProductAttributeTemplateField_sortOrder_idx"
  ON "ProductAttributeTemplateField"("sortOrder");

COMMIT;
