ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "reasonsJson" JSONB;

UPDATE "AdminSecurityEvaluationLog"
SET "reasonsJson" = '[]'::jsonb
WHERE "reasonsJson" IS NULL;

ALTER TABLE "AdminSecurityEvaluationLog"
ALTER COLUMN "reasonsJson" SET DEFAULT '[]'::jsonb;

ALTER TABLE "AdminSecurityEvaluationLog"
ALTER COLUMN "reasonsJson" SET NOT NULL;
