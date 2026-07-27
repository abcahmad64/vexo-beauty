-- __VEXO_SHADOW_SAFE_SEARCHBOOST_BOOST_COLUMN__
ALTER TABLE "SearchBoostRule"
ADD COLUMN IF NOT EXISTS "boost" NUMERIC(8, 2);

UPDATE "SearchBoostRule"
SET "boost" = 1.00
WHERE "boost" IS NULL;

ALTER TABLE "SearchBoostRule"
ALTER COLUMN "boost" SET DEFAULT 1.00;

ALTER TABLE "SearchBoostRule"
ALTER COLUMN "boost" SET NOT NULL;

ALTER TABLE "SearchBoostRule"
ADD COLUMN IF NOT EXISTS "weight" NUMERIC(8, 2);

UPDATE "SearchBoostRule"
SET "weight" = "boost"
WHERE "weight" IS NULL
  AND "boost" IS NOT NULL;

UPDATE "SearchBoostRule"
SET "weight" = 1.00
WHERE "weight" IS NULL;

ALTER TABLE "SearchBoostRule"
ALTER COLUMN "weight" SET DEFAULT 1.00;

ALTER TABLE "SearchBoostRule"
ALTER COLUMN "weight" SET NOT NULL;

ALTER TABLE "SearchBoostRule"
ADD COLUMN IF NOT EXISTS "reason" TEXT;

CREATE INDEX IF NOT EXISTS "SearchBoostRule_weight_idx"
ON "SearchBoostRule" ("weight");

CREATE OR REPLACE FUNCTION "sync_SearchBoostRule_boost_weight_columns"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."weight" IS NULL AND NEW."boost" IS NOT NULL THEN
      NEW."weight" := NEW."boost";
    END IF;

    IF NEW."boost" IS NULL AND NEW."weight" IS NOT NULL THEN
      NEW."boost" := NEW."weight";
    END IF;

    IF NEW."weight" IS NULL THEN
      NEW."weight" := 1.00;
    END IF;

    IF NEW."boost" IS NULL THEN
      NEW."boost" := NEW."weight";
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."weight" IS DISTINCT FROM OLD."weight"
     AND NEW."boost" IS NOT DISTINCT FROM OLD."boost" THEN
    NEW."boost" := NEW."weight";
  END IF;

  IF NEW."boost" IS DISTINCT FROM OLD."boost"
     AND NEW."weight" IS NOT DISTINCT FROM OLD."weight" THEN
    NEW."weight" := NEW."boost";
  END IF;

  IF NEW."weight" IS NULL AND NEW."boost" IS NOT NULL THEN
    NEW."weight" := NEW."boost";
  END IF;

  IF NEW."boost" IS NULL AND NEW."weight" IS NOT NULL THEN
    NEW."boost" := NEW."weight";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SearchBoostRule_sync_boost_weight_columns" ON "SearchBoostRule";

CREATE TRIGGER "SearchBoostRule_sync_boost_weight_columns"
BEFORE INSERT OR UPDATE OF "boost", "weight"
ON "SearchBoostRule"
FOR EACH ROW
EXECUTE FUNCTION "sync_SearchBoostRule_boost_weight_columns"();

ALTER TABLE "SearchRedirect"
ADD COLUMN IF NOT EXISTS "priority" INTEGER;

UPDATE "SearchRedirect"
SET "priority" = 0
WHERE "priority" IS NULL;

ALTER TABLE "SearchRedirect"
ALTER COLUMN "priority" SET DEFAULT 0;

ALTER TABLE "SearchRedirect"
ALTER COLUMN "priority" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "SearchRedirect_priority_idx"
ON "SearchRedirect" ("priority");
