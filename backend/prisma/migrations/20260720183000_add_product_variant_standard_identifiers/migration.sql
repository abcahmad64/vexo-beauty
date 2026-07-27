BEGIN;

ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "barcode" TEXT,
  ADD COLUMN IF NOT EXISTS "gtin" TEXT,
  ADD COLUMN IF NOT EXISTS "mpn" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_barcode_key"
  ON "ProductVariant"("barcode");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_gtin_key"
  ON "ProductVariant"("gtin");

CREATE INDEX IF NOT EXISTS "ProductVariant_barcode_idx"
  ON "ProductVariant"("barcode");

CREATE INDEX IF NOT EXISTS "ProductVariant_gtin_idx"
  ON "ProductVariant"("gtin");

CREATE INDEX IF NOT EXISTS "ProductVariant_mpn_idx"
  ON "ProductVariant"("mpn");

COMMIT;
