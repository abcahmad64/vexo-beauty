ALTER TABLE "AdminSecurityPolicy"
ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE INDEX IF NOT EXISTS "AdminSecurityPolicy_createdById_idx"
ON "AdminSecurityPolicy" ("createdById");

ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "matchedRuleIds" JSONB;

UPDATE "AdminSecurityEvaluationLog"
SET "matchedRuleIds" = '[]'::jsonb
WHERE "matchedRuleIds" IS NULL;

ALTER TABLE "AdminSecurityEvaluationLog"
ALTER COLUMN "matchedRuleIds" SET DEFAULT '[]'::jsonb;

ALTER TABLE "AdminSecurityEvaluationLog"
ALTER COLUMN "matchedRuleIds" SET NOT NULL;
