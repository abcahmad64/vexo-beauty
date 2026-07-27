-- Align the AI runtime tables with the current Prisma/client contract.
--
-- Compatibility policy:
-- - Preserve all legacy columns used by existing raw admin SQL.
-- - Add the canonical Prisma columns used by current runtime services.
-- - Backfill canonical columns from legacy data.
-- - Remove obsolete CHECK constraints that reject current runtime values.
-- - Do not delete or rename existing data-bearing columns.

BEGIN;

-- -------------------------------------------------------------------
-- AiGuardrailRule compatibility
-- -------------------------------------------------------------------

ALTER TABLE "AiGuardrailRule"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "ruleType" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;

UPDATE "AiGuardrailRule"
SET
  "name" = COALESCE(
    NULLIF(BTRIM("name"), ''),
    NULLIF(BTRIM("title"), ''),
    NULLIF(BTRIM("key"), ''),
    "id"
  ),
  "ruleType" = COALESCE(
    NULLIF(BTRIM("ruleType"), ''),
    NULLIF(BTRIM("key"), ''),
    'LEGACY_GUARDRAIL'
  )
WHERE
  "name" IS NULL
  OR BTRIM("name") = ''
  OR "ruleType" IS NULL
  OR BTRIM("ruleType") = '';

ALTER TABLE "AiGuardrailRule"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "ruleType" SET NOT NULL,
  ALTER COLUMN "pattern" DROP NOT NULL,
  ALTER COLUMN "message" DROP NOT NULL;

-- The current runtime stores operational records with actions such as
-- BUDGET, SLO and RUNBOOK in the same compatibility table.
ALTER TABLE "AiGuardrailRule"
  DROP CONSTRAINT IF EXISTS "AiGuardrailRule_action_check";

CREATE INDEX IF NOT EXISTS "AiGuardrailRule_ruleType_idx"
  ON "AiGuardrailRule" ("ruleType");

CREATE INDEX IF NOT EXISTS "AiGuardrailRule_priority_idx"
  ON "AiGuardrailRule" ("priority");

CREATE INDEX IF NOT EXISTS "AiGuardrailRule_deleted_at_idx"
  ON "AiGuardrailRule" ("deleted_at");

-- -------------------------------------------------------------------
-- AiRunLog compatibility
-- -------------------------------------------------------------------

ALTER TABLE "AiRunLog"
  ADD COLUMN IF NOT EXISTS "promptKey" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER,
  ADD COLUMN IF NOT EXISTS "tokenUsageJson" JSONB;

-- Preserve useful legacy values in their canonical equivalents.
UPDATE "AiRunLog"
SET
  "userId" = COALESCE("userId", "createdById"),
  "latencyMs" = COALESCE("latencyMs", "durationMs")
WHERE
  ("userId" IS NULL AND "createdById" IS NOT NULL)
  OR ("latencyMs" IS NULL AND "durationMs" IS NOT NULL);

-- Canonical task types include values such as SALES and CONTENT.
ALTER TABLE "AiRunLog"
  DROP CONSTRAINT IF EXISTS "AiRunLog_taskType_check";

-- Canonical status handling also includes values such as CANCELLED.
ALTER TABLE "AiRunLog"
  DROP CONSTRAINT IF EXISTS "AiRunLog_status_check";

CREATE INDEX IF NOT EXISTS "AiRunLog_promptKey_idx"
  ON "AiRunLog" ("promptKey");

CREATE INDEX IF NOT EXISTS "AiRunLog_userId_idx"
  ON "AiRunLog" ("userId");

CREATE INDEX IF NOT EXISTS "AiRunLog_createdAt_idx"
  ON "AiRunLog" ("createdAt");

CREATE INDEX IF NOT EXISTS "AiRunLog_deleted_at_idx"
  ON "AiRunLog" ("deleted_at");

COMMIT;
