ALTER TABLE "CmsFaq"
ADD COLUMN IF NOT EXISTS "status" TEXT;

-- __VEXO_SHADOW_SAFE_CMSFAQ_STATUS_REPAIR__
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'CmsFaq'
      AND column_name = 'isActive'
  ) THEN
    UPDATE "CmsFaq"
    SET "status" =
      CASE
        WHEN "isActive" = TRUE THEN 'PUBLISHED'
        ELSE 'DRAFT'
      END
    WHERE "status" IS NULL;
  ELSE
    UPDATE "CmsFaq"
    SET "status" = COALESCE("status", 'DRAFT')
    WHERE "status" IS NULL;
  END IF;
END $$;

ALTER TABLE "CmsFaq"
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "CmsFaq"
ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "CmsFaq_status_idx"
ON "CmsFaq" ("status");

CREATE OR REPLACE FUNCTION "sync_CmsFaq_isActive_from_status"()
RETURNS trigger AS $$
BEGIN
  NEW."isActive" :=
    CASE
      WHEN NEW."status" = 'PUBLISHED' THEN TRUE
      ELSE FALSE
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "CmsFaq_status_sync_isActive" ON "CmsFaq";

CREATE TRIGGER "CmsFaq_status_sync_isActive"
BEFORE INSERT OR UPDATE OF "status"
ON "CmsFaq"
FOR EACH ROW
EXECUTE FUNCTION "sync_CmsFaq_isActive_from_status"();
