-- __VEXO_SHADOW_SAFE_SEARCHBOOST_QUERYPATTERN_COLUMN__
ALTER TABLE "SearchBoostRule"
ADD COLUMN IF NOT EXISTS "queryPattern" TEXT;

ALTER TABLE "SearchBoostRule"
ADD COLUMN IF NOT EXISTS "query" TEXT;

-- __VEXO_SHADOW_SAFE_SEARCHBOOST_QUERYPATTERN_REPAIR__
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'SearchBoostRule'
      AND column_name = 'queryPattern'
  ) THEN
    UPDATE "SearchBoostRule"
    SET "query" = "queryPattern"
    WHERE "query" IS NULL
      AND "queryPattern" IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SearchBoostRule_query_idx"
ON "SearchBoostRule" ("query");

CREATE OR REPLACE FUNCTION "sync_SearchBoostRule_query_columns"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."query" IS NULL AND NEW."queryPattern" IS NOT NULL THEN
      NEW."query" := NEW."queryPattern";
    END IF;

    IF NEW."queryPattern" IS NULL AND NEW."query" IS NOT NULL THEN
      NEW."queryPattern" := NEW."query";
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."query" IS DISTINCT FROM OLD."query"
     AND NEW."queryPattern" IS NOT DISTINCT FROM OLD."queryPattern" THEN
    NEW."queryPattern" := NEW."query";
  END IF;

  IF NEW."queryPattern" IS DISTINCT FROM OLD."queryPattern"
     AND NEW."query" IS NOT DISTINCT FROM OLD."query" THEN
    NEW."query" := NEW."queryPattern";
  END IF;

  IF NEW."query" IS NULL AND NEW."queryPattern" IS NOT NULL THEN
    NEW."query" := NEW."queryPattern";
  END IF;

  IF NEW."queryPattern" IS NULL AND NEW."query" IS NOT NULL THEN
    NEW."queryPattern" := NEW."query";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SearchBoostRule_sync_query_columns" ON "SearchBoostRule";

CREATE TRIGGER "SearchBoostRule_sync_query_columns"
BEFORE INSERT OR UPDATE OF "query", "queryPattern"
ON "SearchBoostRule"
FOR EACH ROW
EXECUTE FUNCTION "sync_SearchBoostRule_query_columns"();

ALTER TABLE "SearchRedirect"
ADD COLUMN IF NOT EXISTS "targetType" TEXT;

UPDATE "SearchRedirect"
SET "targetType" = 'URL'
WHERE "targetType" IS NULL;

ALTER TABLE "SearchRedirect"
ALTER COLUMN "targetType" SET DEFAULT 'URL';

ALTER TABLE "SearchRedirect"
ALTER COLUMN "targetType" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "SearchRedirect_targetType_idx"
ON "SearchRedirect" ("targetType");

-- __VEXO_SHADOW_SAFE_SEARCHINDEXSNAPSHOT_TOTALITEMS_COLUMN__
ALTER TABLE "SearchIndexSnapshot"
ADD COLUMN IF NOT EXISTS "totalItems" INTEGER;

ALTER TABLE "SearchIndexSnapshot"
ADD COLUMN IF NOT EXISTS "documentCount" INTEGER;

UPDATE "SearchIndexSnapshot"
SET "documentCount" = "totalItems"
WHERE "documentCount" IS NULL;

ALTER TABLE "SearchIndexSnapshot"
ALTER COLUMN "documentCount" SET DEFAULT 0;

ALTER TABLE "SearchIndexSnapshot"
ALTER COLUMN "documentCount" SET NOT NULL;

CREATE OR REPLACE FUNCTION "sync_SearchIndexSnapshot_count_columns"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."documentCount" IS NULL AND NEW."totalItems" IS NOT NULL THEN
      NEW."documentCount" := NEW."totalItems";
    END IF;

    IF NEW."totalItems" IS NULL AND NEW."documentCount" IS NOT NULL THEN
      NEW."totalItems" := NEW."documentCount";
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."documentCount" IS DISTINCT FROM OLD."documentCount"
     AND NEW."totalItems" IS NOT DISTINCT FROM OLD."totalItems" THEN
    NEW."totalItems" := NEW."documentCount";
  END IF;

  IF NEW."totalItems" IS DISTINCT FROM OLD."totalItems"
     AND NEW."documentCount" IS NOT DISTINCT FROM OLD."documentCount" THEN
    NEW."documentCount" := NEW."totalItems";
  END IF;

  IF NEW."documentCount" IS NULL AND NEW."totalItems" IS NOT NULL THEN
    NEW."documentCount" := NEW."totalItems";
  END IF;

  IF NEW."totalItems" IS NULL AND NEW."documentCount" IS NOT NULL THEN
    NEW."totalItems" := NEW."documentCount";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SearchIndexSnapshot_sync_count_columns" ON "SearchIndexSnapshot";

CREATE TRIGGER "SearchIndexSnapshot_sync_count_columns"
BEFORE INSERT OR UPDATE OF "documentCount", "totalItems"
ON "SearchIndexSnapshot"
FOR EACH ROW
EXECUTE FUNCTION "sync_SearchIndexSnapshot_count_columns"();
