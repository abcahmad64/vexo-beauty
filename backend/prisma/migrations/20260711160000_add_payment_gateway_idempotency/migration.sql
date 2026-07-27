-- Add durable gateway request state for safe payment initiation retries.
ALTER TABLE "Payment"
  ADD COLUMN "gatewayAuthority" TEXT,
  ADD COLUMN "gatewayRequestKey" TEXT,
  ADD COLUMN "gatewayRequestState" TEXT,
  ADD COLUMN "gatewayRequestedAt" TIMESTAMP(3),
  ADD COLUMN "gatewayRequestCompletedAt" TIMESTAMP(3);

-- Preserve authorities created before this migration.
UPDATE "Payment"
SET
  "gatewayAuthority" = COALESCE(
    NULLIF("metadata" #>> '{zarinpal,authority}', ''),
    CASE
      WHEN
        "paymentStatus" = 'PENDING'::"PaymentStatus"
        AND LOWER(COALESCE("gateway", '')) = 'zarinpal'
      THEN NULLIF("transactionId", '')
      ELSE NULL
    END
  ),
  "gatewayRequestedAt" = COALESCE(
    "gatewayRequestedAt",
    "createdAt"
  )
WHERE
  "paymentMethod" = 'ZARINPAL'::"PaymentMethod"
  OR LOWER(COALESCE("gateway", '')) = 'zarinpal';

UPDATE "Payment"
SET
  "gatewayRequestState" = CASE
    WHEN "paymentStatus" = 'PENDING'::"PaymentStatus"
      AND "gatewayAuthority" IS NOT NULL
      THEN 'READY'
    WHEN "paymentStatus" = 'PENDING'::"PaymentStatus"
      THEN 'UNKNOWN'
    WHEN "paymentStatus" = 'COMPLETED'::"PaymentStatus"
      THEN 'COMPLETED'
    WHEN "paymentStatus" = 'FAILED'::"PaymentStatus"
      THEN 'FAILED'
    ELSE "gatewayRequestState"
  END,
  "gatewayRequestCompletedAt" = CASE
    WHEN "gatewayAuthority" IS NOT NULL
      THEN COALESCE("gatewayRequestCompletedAt", "updatedAt")
    ELSE "gatewayRequestCompletedAt"
  END
WHERE
  "paymentMethod" = 'ZARINPAL'::"PaymentMethod"
  OR LOWER(COALESCE("gateway", '')) = 'zarinpal';

-- Keep one canonical owner if legacy rows share an authority.
WITH ranked_authorities AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "gatewayAuthority"
      ORDER BY
        ("paymentStatus" = 'COMPLETED'::"PaymentStatus") DESC,
        "createdAt" ASC,
        "id" ASC
    ) AS row_number
  FROM "Payment"
  WHERE "gatewayAuthority" IS NOT NULL
)
UPDATE "Payment" AS payment
SET
  "gatewayAuthority" = NULL,
  "paymentStatus" = CASE
    WHEN payment."paymentStatus" = 'PENDING'::"PaymentStatus"
      THEN 'FAILED'::"PaymentStatus"
    ELSE payment."paymentStatus"
  END,
  "gatewayRequestState" = CASE
    WHEN payment."paymentStatus" = 'PENDING'::"PaymentStatus"
      THEN 'FAILED'
    ELSE payment."gatewayRequestState"
  END,
  "gatewayRequestCompletedAt" = COALESCE(
    payment."gatewayRequestCompletedAt",
    NOW()
  ),
  "metadata" = COALESCE(
    payment."metadata",
    '{}'::jsonb
  ) || jsonb_build_object(
    'idempotencyMigration',
    jsonb_build_object(
      'reason',
      'duplicate_gateway_authority',
      'resolvedAt',
      NOW()
    )
  ),
  "updatedAt" = NOW()
FROM ranked_authorities
WHERE
  payment."id" = ranked_authorities."id"
  AND ranked_authorities.row_number > 1;

-- Existing duplicate pending Zarinpal rows are invalid. Preserve the best
-- candidate and close the others before the unique invariant is installed.
WITH ranked_pending AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "orderId"
      ORDER BY
        ("gatewayAuthority" IS NOT NULL) DESC,
        ("gatewayRequestState" = 'READY') DESC,
        "createdAt" ASC,
        "id" ASC
    ) AS row_number
  FROM "Payment"
  WHERE
    "paymentStatus" = 'PENDING'::"PaymentStatus"
    AND "paymentMethod" = 'ZARINPAL'::"PaymentMethod"
    AND LOWER(COALESCE("gateway", '')) = 'zarinpal'
    AND "deleted_at" IS NULL
)
UPDATE "Payment" AS payment
SET
  "paymentStatus" = 'FAILED'::"PaymentStatus",
  "gatewayRequestState" = 'FAILED',
  "gatewayRequestCompletedAt" = COALESCE(
    payment."gatewayRequestCompletedAt",
    NOW()
  ),
  "metadata" = COALESCE(
    payment."metadata",
    '{}'::jsonb
  ) || jsonb_build_object(
    'idempotencyMigration',
    jsonb_build_object(
      'reason',
      'duplicate_pending_zarinpal_payment',
      'resolvedAt',
      NOW()
    )
  ),
  "updatedAt" = NOW()
FROM ranked_pending
WHERE
  payment."id" = ranked_pending."id"
  AND ranked_pending.row_number > 1;

CREATE UNIQUE INDEX "Payment_gatewayAuthority_key"
  ON "Payment"("gatewayAuthority");

CREATE UNIQUE INDEX "Payment_gatewayRequestKey_key"
  ON "Payment"("gatewayRequestKey");

CREATE INDEX "Payment_gatewayRequestState_idx"
  ON "Payment"("gatewayRequestState");

CREATE INDEX "Payment_gatewayRequestedAt_idx"
  ON "Payment"("gatewayRequestedAt");

CREATE UNIQUE INDEX "Payment_pending_zarinpal_order_key"
  ON "Payment"("orderId")
  WHERE
    "paymentStatus" = 'PENDING'::"PaymentStatus"
    AND "paymentMethod" = 'ZARINPAL'::"PaymentMethod"
    AND LOWER(COALESCE("gateway", '')) = 'zarinpal'
    AND "deleted_at" IS NULL;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_gatewayRequestState_check"
  CHECK (
    "gatewayRequestState" IS NULL
    OR "gatewayRequestState" IN (
      'REQUESTING',
      'READY',
      'UNKNOWN',
      'FAILED',
      'COMPLETED',
      'CANCELLED'
    )
  );
