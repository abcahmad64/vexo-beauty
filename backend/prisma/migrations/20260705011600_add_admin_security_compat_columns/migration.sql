ALTER TABLE "AdminSecurityPolicy"
ADD COLUMN IF NOT EXISTS "severity" TEXT;

UPDATE "AdminSecurityPolicy"
SET "severity" = 'MEDIUM'
WHERE "severity" IS NULL;

ALTER TABLE "AdminSecurityPolicy"
ALTER COLUMN "severity" SET DEFAULT 'MEDIUM';

ALTER TABLE "AdminSecurityPolicy"
ALTER COLUMN "severity" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AdminSecurityPolicy_severity_idx"
ON "AdminSecurityPolicy" ("severity");

-- __VEXO_SHADOW_SAFE_ADMIN_IP_RULE_COMPAT_SOURCE_COLUMNS__
ALTER TABLE "AdminIpRule"
ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;

ALTER TABLE "AdminIpRule"
ADD COLUMN IF NOT EXISTS "ruleType" TEXT;

UPDATE "AdminIpRule"
SET "ruleType" = 'ALLOW'
WHERE "ruleType" IS NULL;

ALTER TABLE "AdminIpRule"
ADD COLUMN IF NOT EXISTS "cidr" TEXT;

UPDATE "AdminIpRule"
SET "cidr" = "ipAddress"
WHERE "cidr" IS NULL
  AND "ipAddress" IS NOT NULL;

ALTER TABLE "AdminIpRule"
ADD COLUMN IF NOT EXISTS "type" TEXT;

UPDATE "AdminIpRule"
SET "type" = "ruleType"
WHERE "type" IS NULL
  AND "ruleType" IS NOT NULL;

UPDATE "AdminIpRule"
SET "type" = 'ALLOW'
WHERE "type" IS NULL;

ALTER TABLE "AdminIpRule"
ALTER COLUMN "type" SET DEFAULT 'ALLOW';

ALTER TABLE "AdminIpRule"
ALTER COLUMN "type" SET NOT NULL;
-- __VEXO_SHADOW_SAFE_ADMIN_IP_RULE_COMPAT_SOURCE_COLUMNS_FINALIZE__
UPDATE "AdminIpRule"
SET "ipAddress" = COALESCE("cidr", '0.0.0.0')
WHERE "ipAddress" IS NULL;

UPDATE "AdminIpRule"
SET "ruleType" = COALESCE("type", 'ALLOW')
WHERE "ruleType" IS NULL;

ALTER TABLE "AdminIpRule"
ALTER COLUMN "ipAddress" SET NOT NULL;

ALTER TABLE "AdminIpRule"
ALTER COLUMN "ruleType" SET NOT NULL;



CREATE INDEX IF NOT EXISTS "AdminIpRule_cidr_idx"
ON "AdminIpRule" ("cidr");

CREATE INDEX IF NOT EXISTS "AdminIpRule_type_idx"
ON "AdminIpRule" ("type");

CREATE OR REPLACE FUNCTION "sync_AdminIpRule_compat_columns"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."cidr" IS NULL AND NEW."ipAddress" IS NOT NULL THEN
      NEW."cidr" := NEW."ipAddress";
    END IF;

    IF NEW."ipAddress" IS NULL AND NEW."cidr" IS NOT NULL THEN
      NEW."ipAddress" := NEW."cidr";
    END IF;

    IF NEW."type" IS NULL AND NEW."ruleType" IS NOT NULL THEN
      NEW."type" := NEW."ruleType";
    END IF;

    IF NEW."ruleType" IS NULL AND NEW."type" IS NOT NULL THEN
      NEW."ruleType" := NEW."type";
    END IF;

    IF NEW."type" IS NULL THEN
      NEW."type" := 'ALLOW';
    END IF;

    IF NEW."ruleType" IS NULL THEN
      NEW."ruleType" := NEW."type";
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."cidr" IS DISTINCT FROM OLD."cidr"
     AND NEW."ipAddress" IS NOT DISTINCT FROM OLD."ipAddress" THEN
    NEW."ipAddress" := NEW."cidr";
  END IF;

  IF NEW."ipAddress" IS DISTINCT FROM OLD."ipAddress"
     AND NEW."cidr" IS NOT DISTINCT FROM OLD."cidr" THEN
    NEW."cidr" := NEW."ipAddress";
  END IF;

  IF NEW."type" IS DISTINCT FROM OLD."type"
     AND NEW."ruleType" IS NOT DISTINCT FROM OLD."ruleType" THEN
    NEW."ruleType" := NEW."type";
  END IF;

  IF NEW."ruleType" IS DISTINCT FROM OLD."ruleType"
     AND NEW."type" IS NOT DISTINCT FROM OLD."type" THEN
    NEW."type" := NEW."ruleType";
  END IF;

  IF NEW."type" IS NULL AND NEW."ruleType" IS NOT NULL THEN
    NEW."type" := NEW."ruleType";
  END IF;

  IF NEW."ruleType" IS NULL AND NEW."type" IS NOT NULL THEN
    NEW."ruleType" := NEW."type";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AdminIpRule_sync_compat_columns" ON "AdminIpRule";

CREATE TRIGGER "AdminIpRule_sync_compat_columns"
BEFORE INSERT OR UPDATE OF "ipAddress", "cidr", "ruleType", "type"
ON "AdminIpRule"
FOR EACH ROW
EXECUTE FUNCTION "sync_AdminIpRule_compat_columns"();

ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "route" TEXT;

ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "method" TEXT;

ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "riskScore" INTEGER;

UPDATE "AdminSecurityEvaluationLog"
SET "riskScore" = 0
WHERE "riskScore" IS NULL;

ALTER TABLE "AdminSecurityEvaluationLog"
ALTER COLUMN "riskScore" SET DEFAULT 0;

ALTER TABLE "AdminSecurityEvaluationLog"
ALTER COLUMN "riskScore" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_route_idx"
ON "AdminSecurityEvaluationLog" ("route");

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_method_idx"
ON "AdminSecurityEvaluationLog" ("method");

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_riskScore_idx"
ON "AdminSecurityEvaluationLog" ("riskScore");
