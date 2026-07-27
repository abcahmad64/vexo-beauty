CREATE TABLE "AdminProductCreateRequest" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "payloadFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminProductCreateRequest_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "AdminProductCreateRequest_idempotencyKey_key"
ON "AdminProductCreateRequest" ("idempotencyKey");

CREATE UNIQUE INDEX
  "AdminProductCreateRequest_productId_key"
ON "AdminProductCreateRequest" ("productId");

CREATE INDEX
  "AdminProductCreateRequest_actorId_idx"
ON "AdminProductCreateRequest" ("actorId");

CREATE INDEX
  "AdminProductCreateRequest_createdAt_idx"
ON "AdminProductCreateRequest" ("createdAt");
