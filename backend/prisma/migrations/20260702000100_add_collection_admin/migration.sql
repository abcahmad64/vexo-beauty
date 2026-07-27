CREATE TABLE IF NOT EXISTS "Collection" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "imageUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "CollectionProduct" (
  "collectionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CollectionProduct_pkey"
    PRIMARY KEY ("collectionId", "productId"),

  CONSTRAINT "CollectionProduct_collectionId_fkey"
    FOREIGN KEY ("collectionId")
    REFERENCES "Collection"("id")
    ON DELETE CASCADE,

  CONSTRAINT "CollectionProduct_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "Product"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Collection_slug_idx"
  ON "Collection"("slug");

CREATE INDEX IF NOT EXISTS "Collection_isActive_idx"
  ON "Collection"("isActive");

CREATE INDEX IF NOT EXISTS "Collection_sortOrder_idx"
  ON "Collection"("sortOrder");

CREATE INDEX IF NOT EXISTS "Collection_deleted_at_idx"
  ON "Collection"("deleted_at");

CREATE INDEX IF NOT EXISTS "Collection_startsAt_endsAt_idx"
  ON "Collection"("startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS "CollectionProduct_productId_idx"
  ON "CollectionProduct"("productId");

CREATE INDEX IF NOT EXISTS "CollectionProduct_sortOrder_idx"
  ON "CollectionProduct"("sortOrder");