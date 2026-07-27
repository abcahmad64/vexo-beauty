-- Stabilize columns required by the current Prisma schema and seed files.
-- This migration is defensive and safe for development reset / migrate flows.

-- ============================================================
-- Required enum types
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'OutboxStatus'
  ) THEN
    CREATE TYPE "OutboxStatus" AS ENUM (
      'PENDING',
      'PROCESSED',
      'FAILED'
    );
  END IF;
END $$;

-- ============================================================
-- Warehouse
-- ============================================================

ALTER TABLE "Warehouse"
ADD COLUMN IF NOT EXISTS "code" TEXT;

UPDATE "Warehouse"
SET "code" = CONCAT('warehouse-', "id")
WHERE
  "code" IS NULL
  OR LENGTH(TRIM("code")) = 0;

ALTER TABLE "Warehouse"
ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "Warehouse"
ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "Warehouse"
ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

ALTER TABLE "Warehouse"
ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "Warehouse"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_code_key"
ON "Warehouse" ("code");

CREATE INDEX IF NOT EXISTS "Warehouse_code_idx"
ON "Warehouse" ("code");

CREATE INDEX IF NOT EXISTS "Warehouse_deleted_at_idx"
ON "Warehouse" ("deleted_at");

-- ============================================================
-- ProductVariant
-- ============================================================

ALTER TABLE "ProductVariant"
ADD COLUMN IF NOT EXISTS "name" TEXT;

ALTER TABLE "ProductVariant"
ADD COLUMN IF NOT EXISTS "slug" TEXT;

ALTER TABLE "ProductVariant"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

CREATE INDEX IF NOT EXISTS "ProductVariant_slug_idx"
ON "ProductVariant" ("slug");

-- ============================================================
-- Inventory
-- ============================================================

ALTER TABLE "Inventory"
ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER;

UPDATE "Inventory"
SET "reservedQuantity" = COALESCE("reservedQuantity", 0)
WHERE "reservedQuantity" IS NULL;

ALTER TABLE "Inventory"
ALTER COLUMN "reservedQuantity" SET DEFAULT 0;

ALTER TABLE "Inventory"
ALTER COLUMN "reservedQuantity" SET NOT NULL;

ALTER TABLE "Inventory"
ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER;

UPDATE "Inventory"
SET "lowStockThreshold" = COALESCE("lowStockThreshold", 5)
WHERE "lowStockThreshold" IS NULL;

ALTER TABLE "Inventory"
ALTER COLUMN "lowStockThreshold" SET DEFAULT 5;

ALTER TABLE "Inventory"
ALTER COLUMN "lowStockThreshold" SET NOT NULL;

ALTER TABLE "Inventory"
ADD COLUMN IF NOT EXISTS "status" "InventoryStatus";

UPDATE "Inventory"
SET "status" = COALESCE(
  "status",
  'IN_STOCK'::"InventoryStatus"
)
WHERE "status" IS NULL;

ALTER TABLE "Inventory"
ALTER COLUMN "status" SET DEFAULT 'IN_STOCK';

ALTER TABLE "Inventory"
ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "Inventory"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Inventory_status_idx"
ON "Inventory" ("status");

CREATE INDEX IF NOT EXISTS "Inventory_deleted_at_idx"
ON "Inventory" ("deleted_at");

-- ============================================================
-- VariantAttribute
-- ============================================================

ALTER TABLE "VariantAttribute"
ADD COLUMN IF NOT EXISTS "id" TEXT;

UPDATE "VariantAttribute"
SET "id" = CONCAT(
  'va_',
  MD5(
    RANDOM()::TEXT ||
    CLOCK_TIMESTAMP()::TEXT ||
    "variantId" ||
    "attributeValueId"
  )
)
WHERE
  "id" IS NULL
  OR LENGTH(TRIM("id")) = 0;

ALTER TABLE "VariantAttribute"
ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "VariantAttribute"
ADD COLUMN IF NOT EXISTS "attributeId" TEXT;

UPDATE "VariantAttribute" AS va
SET "attributeId" = av."attributeId"
FROM "AttributeValue" AS av
WHERE
  va."attributeValueId" = av."id"
  AND va."attributeId" IS NULL;

ALTER TABLE "VariantAttribute"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

UPDATE "VariantAttribute"
SET "createdAt" = COALESCE(
  "createdAt",
  CURRENT_TIMESTAMP
)
WHERE "createdAt" IS NULL;

ALTER TABLE "VariantAttribute"
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "VariantAttribute"
ALTER COLUMN "createdAt" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "VariantAttribute_id_key"
ON "VariantAttribute" ("id");

CREATE INDEX IF NOT EXISTS "VariantAttribute_attributeId_idx"
ON "VariantAttribute" ("attributeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VariantAttribute_attributeId_fkey'
  ) THEN
    ALTER TABLE "VariantAttribute"
    ADD CONSTRAINT "VariantAttribute_attributeId_fkey"
    FOREIGN KEY ("attributeId")
    REFERENCES "Attribute"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- PushSubscription
-- ============================================================

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key"
ON "PushSubscription" ("endpoint");

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
ON "PushSubscription" ("userId");

CREATE INDEX IF NOT EXISTS "PushSubscription_endpoint_idx"
ON "PushSubscription" ("endpoint");

CREATE INDEX IF NOT EXISTS "PushSubscription_isActive_idx"
ON "PushSubscription" ("isActive");

CREATE INDEX IF NOT EXISTS "PushSubscription_deleted_at_idx"
ON "PushSubscription" ("deleted_at");

-- ============================================================
-- EventOutbox
-- ============================================================

CREATE TABLE IF NOT EXISTS "EventOutbox" (
  "id" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventOutbox_aggregateId_idx"
ON "EventOutbox" ("aggregateId");

CREATE INDEX IF NOT EXISTS "EventOutbox_type_idx"
ON "EventOutbox" ("type");

CREATE INDEX IF NOT EXISTS "EventOutbox_status_idx"
ON "EventOutbox" ("status");

CREATE INDEX IF NOT EXISTS "EventOutbox_createdAt_idx"
ON "EventOutbox" ("createdAt");