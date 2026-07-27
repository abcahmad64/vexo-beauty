DO $$
BEGIN
  IF to_regclass('"SupportTicketMessage"') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'senderId'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'senderUserId'
    ) THEN
      ALTER TABLE "SupportTicketMessage"
        RENAME COLUMN "senderId" TO "senderUserId";
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'body'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'message'
    ) THEN
      ALTER TABLE "SupportTicketMessage"
        RENAME COLUMN "body" TO "message";
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'attachmentUrls'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'attachments'
    ) THEN
      ALTER TABLE "SupportTicketMessage"
        RENAME COLUMN "attachmentUrls" TO "attachments";
    END IF;

    ALTER TABLE "SupportTicketMessage"
      ADD COLUMN IF NOT EXISTS "senderUserId" TEXT,
      ADD COLUMN IF NOT EXISTS "message" TEXT,
      ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'senderId'
    ) THEN
      UPDATE "SupportTicketMessage"
      SET "senderUserId" = COALESCE("senderUserId", "senderId");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'body'
    ) THEN
      UPDATE "SupportTicketMessage"
      SET "message" = COALESCE("message", "body");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportTicketMessage'
        AND column_name = 'attachmentUrls'
    ) THEN
      UPDATE "SupportTicketMessage"
      SET "attachments" = CASE
        WHEN "attachments" IS NULL OR "attachments" = '[]'::jsonb
          THEN COALESCE("attachmentUrls", '[]'::jsonb)
        ELSE "attachments"
      END;
    END IF;

    UPDATE "SupportTicketMessage"
    SET "message" = ''
    WHERE "message" IS NULL;

    ALTER TABLE "SupportTicketMessage"
      ALTER COLUMN "message" SET NOT NULL;

    ALTER TABLE "SupportTicketMessage"
      DROP COLUMN IF EXISTS "senderId",
      DROP COLUMN IF EXISTS "body",
      DROP COLUMN IF EXISTS "attachmentUrls";
  END IF;

  IF to_regclass('"SupportChatConversation"') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatConversation'
        AND column_name = 'externalId'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatConversation'
        AND column_name = 'conversationKey'
    ) THEN
      ALTER TABLE "SupportChatConversation"
        RENAME COLUMN "externalId" TO "conversationKey";
    END IF;

    ALTER TABLE "SupportChatConversation"
      ADD COLUMN IF NOT EXISTS "conversationKey" TEXT,
      ADD COLUMN IF NOT EXISTS "guestToken" TEXT,
      ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'WEB',
      ADD COLUMN IF NOT EXISTS "lastCustomerMessageAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "lastAgentMessageAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "unreadByAdmin" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "unreadByCustomer" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatConversation'
        AND column_name = 'externalId'
    ) THEN
      UPDATE "SupportChatConversation"
      SET "conversationKey" = COALESCE(
        NULLIF(BTRIM("conversationKey"), ''),
        NULLIF(BTRIM("externalId"), '')
      );
    END IF;

    UPDATE "SupportChatConversation"
    SET "conversationKey" =
      'CHAT-' || UPPER(REPLACE("id", '-', ''))
    WHERE NULLIF(BTRIM("conversationKey"), '') IS NULL;

    ALTER TABLE "SupportChatConversation"
      ALTER COLUMN "conversationKey" SET NOT NULL;

    ALTER TABLE "SupportChatConversation"
      DROP COLUMN IF EXISTS "externalId";
  END IF;

  IF to_regclass('"SupportChatMessage"') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'senderId'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'senderUserId'
    ) THEN
      ALTER TABLE "SupportChatMessage"
        RENAME COLUMN "senderId" TO "senderUserId";
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'body'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'message'
    ) THEN
      ALTER TABLE "SupportChatMessage"
        RENAME COLUMN "body" TO "message";
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'attachmentUrls'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'attachments'
    ) THEN
      ALTER TABLE "SupportChatMessage"
        RENAME COLUMN "attachmentUrls" TO "attachments";
    END IF;

    ALTER TABLE "SupportChatMessage"
      ADD COLUMN IF NOT EXISTS "senderUserId" TEXT,
      ADD COLUMN IF NOT EXISTS "message" TEXT,
      ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'senderId'
    ) THEN
      UPDATE "SupportChatMessage"
      SET "senderUserId" = COALESCE("senderUserId", "senderId");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'body'
    ) THEN
      UPDATE "SupportChatMessage"
      SET "message" = COALESCE("message", "body");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SupportChatMessage'
        AND column_name = 'attachmentUrls'
    ) THEN
      UPDATE "SupportChatMessage"
      SET "attachments" = CASE
        WHEN "attachments" IS NULL OR "attachments" = '[]'::jsonb
          THEN COALESCE("attachmentUrls", '[]'::jsonb)
        ELSE "attachments"
      END;
    END IF;

    UPDATE "SupportChatMessage"
    SET "message" = ''
    WHERE "message" IS NULL;

    ALTER TABLE "SupportChatMessage"
      ALTER COLUMN "message" SET NOT NULL;

    ALTER TABLE "SupportChatMessage"
      DROP COLUMN IF EXISTS "senderId",
      DROP COLUMN IF EXISTS "body",
      DROP COLUMN IF EXISTS "attachmentUrls";
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "SupportTicketMessage_senderUserId_idx"
  ON "SupportTicketMessage" ("senderUserId");
CREATE INDEX IF NOT EXISTS "SupportTicketMessage_readAt_idx"
  ON "SupportTicketMessage" ("readAt");
CREATE INDEX IF NOT EXISTS "SupportTicketMessage_deleted_at_idx"
  ON "SupportTicketMessage" ("deleted_at");
DROP INDEX IF EXISTS "SupportChatConversation_externalId_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "SupportChatConversation_conversationKey_active_unique"
  ON "SupportChatConversation" (LOWER("conversationKey"))
  WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "SupportChatConversation_conversationKey_idx"
  ON "SupportChatConversation" ("conversationKey");
CREATE INDEX IF NOT EXISTS "SupportChatConversation_guestToken_idx"
  ON "SupportChatConversation" ("guestToken");
CREATE INDEX IF NOT EXISTS "SupportChatConversation_channel_idx"
  ON "SupportChatConversation" ("channel");
CREATE INDEX IF NOT EXISTS "SupportChatConversation_deleted_at_idx"
  ON "SupportChatConversation" ("deleted_at");
CREATE INDEX IF NOT EXISTS "SupportChatMessage_senderUserId_idx"
  ON "SupportChatMessage" ("senderUserId");
CREATE INDEX IF NOT EXISTS "SupportChatMessage_readAt_idx"
  ON "SupportChatMessage" ("readAt");
CREATE INDEX IF NOT EXISTS "SupportChatMessage_deleted_at_idx"
  ON "SupportChatMessage" ("deleted_at");
