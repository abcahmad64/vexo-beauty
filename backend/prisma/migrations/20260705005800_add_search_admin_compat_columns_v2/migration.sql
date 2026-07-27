ALTER TABLE "SearchBoostRule"
ADD COLUMN IF NOT EXISTS "language" TEXT;

UPDATE "SearchBoostRule"
SET "language" = 'fa'
WHERE "language" IS NULL;

ALTER TABLE "SearchBoostRule"
ALTER COLUMN "language" SET DEFAULT 'fa';

ALTER TABLE "SearchBoostRule"
ALTER COLUMN "language" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "SearchBoostRule_language_idx"
ON "SearchBoostRule" ("language");

ALTER TABLE "SearchRedirect"
ADD COLUMN IF NOT EXISTS "targetId" TEXT;

CREATE INDEX IF NOT EXISTS "SearchRedirect_targetId_idx"
ON "SearchRedirect" ("targetId");

ALTER TABLE "SearchIndexSnapshot"
ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;

UPDATE "SearchIndexSnapshot"
SET "durationMs" =
  CASE
    WHEN "durationMs" IS NULL
      AND "startedAt" IS NOT NULL
      AND "finishedAt" IS NOT NULL
    THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("finishedAt" - "startedAt")) * 1000)::int)
    ELSE "durationMs"
  END;

CREATE OR REPLACE FUNCTION "sync_SearchIndexSnapshot_duration_ms"()
RETURNS trigger AS $$
BEGIN
  IF NEW."startedAt" IS NOT NULL
     AND NEW."finishedAt" IS NOT NULL
     AND NEW."durationMs" IS NULL THEN
    NEW."durationMs" := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW."finishedAt" - NEW."startedAt")) * 1000)::int);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SearchIndexSnapshot_sync_duration_ms" ON "SearchIndexSnapshot";

CREATE TRIGGER "SearchIndexSnapshot_sync_duration_ms"
BEFORE INSERT OR UPDATE OF "startedAt", "finishedAt", "durationMs"
ON "SearchIndexSnapshot"
FOR EACH ROW
EXECUTE FUNCTION "sync_SearchIndexSnapshot_duration_ms"();
