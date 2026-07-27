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

-- __VEXO_SHADOW_SAFE_ADMIN_SECURITY_POLICY_VALUEJSON_COLUMN__
ALTER TABLE "AdminSecurityPolicy"
ADD COLUMN IF NOT EXISTS "valueJson" JSONB;

UPDATE "AdminSecurityPolicy"
SET "valueJson" = '{}'::jsonb
WHERE "valueJson" IS NULL;

ALTER TABLE "AdminSecurityPolicy"
ALTER COLUMN "valueJson" SET DEFAULT '{}'::jsonb;

ALTER TABLE "AdminSecurityPolicy"
ALTER COLUMN "valueJson" SET NOT NULL;

ALTER TABLE "AdminSecurityPolicy"
ADD COLUMN IF NOT EXISTS "configJson" JSONB;

UPDATE "AdminSecurityPolicy"
SET "configJson" = "valueJson"
WHERE "configJson" IS NULL
  AND "valueJson" IS NOT NULL;

UPDATE "AdminSecurityPolicy"
SET "configJson" = '{}'::jsonb
WHERE "configJson" IS NULL;

ALTER TABLE "AdminSecurityPolicy"
ALTER COLUMN "configJson" SET DEFAULT '{}'::jsonb;

ALTER TABLE "AdminSecurityPolicy"
ALTER COLUMN "configJson" SET NOT NULL;

CREATE OR REPLACE FUNCTION "sync_AdminSecurityPolicy_config_columns"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."configJson" IS NULL AND NEW."valueJson" IS NOT NULL THEN
      NEW."configJson" := NEW."valueJson";
    END IF;

    IF NEW."valueJson" IS NULL AND NEW."configJson" IS NOT NULL THEN
      NEW."valueJson" := NEW."configJson";
    END IF;

    IF NEW."configJson" IS NULL THEN
      NEW."configJson" := '{}'::jsonb;
    END IF;

    IF NEW."valueJson" IS NULL THEN
      NEW."valueJson" := NEW."configJson";
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."configJson" IS DISTINCT FROM OLD."configJson"
     AND NEW."valueJson" IS NOT DISTINCT FROM OLD."valueJson" THEN
    NEW."valueJson" := NEW."configJson";
  END IF;

  IF NEW."valueJson" IS DISTINCT FROM OLD."valueJson"
     AND NEW."configJson" IS NOT DISTINCT FROM OLD."configJson" THEN
    NEW."configJson" := NEW."valueJson";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AdminSecurityPolicy_sync_config_columns" ON "AdminSecurityPolicy";

CREATE TRIGGER "AdminSecurityPolicy_sync_config_columns"
BEFORE INSERT OR UPDATE OF "valueJson", "configJson"
ON "AdminSecurityPolicy"
FOR EACH ROW
EXECUTE FUNCTION "sync_AdminSecurityPolicy_config_columns"();

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

ALTER TABLE "AdminIpRule"
ADD COLUMN IF NOT EXISTS "reason" TEXT;

CREATE INDEX IF NOT EXISTS "AdminIpRule_cidr_idx"
ON "AdminIpRule" ("cidr");

CREATE INDEX IF NOT EXISTS "AdminIpRule_type_idx"
ON "AdminIpRule" ("type");

CREATE OR REPLACE FUNCTION "sync_AdminIpRule_compat_columns_v2"()
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AdminIpRule_sync_compat_columns" ON "AdminIpRule";
DROP TRIGGER IF EXISTS "AdminIpRule_sync_compat_columns_v2" ON "AdminIpRule";

CREATE TRIGGER "AdminIpRule_sync_compat_columns_v2"
BEFORE INSERT OR UPDATE OF "ipAddress", "cidr", "ruleType", "type"
ON "AdminIpRule"
FOR EACH ROW
EXECUTE FUNCTION "sync_AdminIpRule_compat_columns_v2"();

ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "route" TEXT;

ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "method" TEXT;

ALTER TABLE "AdminSecurityEvaluationLog"
ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

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
