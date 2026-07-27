ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(12, 2);

CREATE INDEX IF NOT EXISTS "Product_costPrice_idx"
  ON "Product" ("costPrice");