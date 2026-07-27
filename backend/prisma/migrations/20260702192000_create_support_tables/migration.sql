CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT PRIMARY KEY,
  "ticketNumber" TEXT NOT NULL,
  "userId" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "guestPhone" TEXT,
  "orderId" TEXT,
  "subject" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "channel" TEXT NOT NULL DEFAULT 'WEB',
  "assignedAgentId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "SupportTicket_priority_check"
    CHECK ("priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT "SupportTicket_status_check"
    CHECK ("status" IN ('OPEN', 'PENDING', 'ANSWERED', 'CLOSED')),
  CONSTRAINT "SupportTicket_channel_check"
    CHECK ("channel" IN ('WEB', 'CHAT', 'EMAIL', 'PHONE', 'ADMIN'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_ticketNumber_active_unique"
  ON "SupportTicket" (LOWER("ticketNumber"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "SupportTicket_userId_idx"
  ON "SupportTicket" ("userId");

CREATE INDEX IF NOT EXISTS "SupportTicket_orderId_idx"
  ON "SupportTicket" ("orderId");

CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx"
  ON "SupportTicket" ("status");

CREATE INDEX IF NOT EXISTS "SupportTicket_priority_idx"
  ON "SupportTicket" ("priority");

CREATE INDEX IF NOT EXISTS "SupportTicket_assignedAgentId_idx"
  ON "SupportTicket" ("assignedAgentId");

CREATE INDEX IF NOT EXISTS "SupportTicket_lastMessageAt_idx"
  ON "SupportTicket" ("lastMessageAt");

CREATE TABLE IF NOT EXISTS "SupportTicketMessage" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderId" TEXT,
  "body" TEXT NOT NULL,
  "attachmentUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isInternal" BOOLEAN NOT NULL DEFAULT FALSE,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "SupportTicketMessage_ticketId_fk"
    FOREIGN KEY ("ticketId")
    REFERENCES "SupportTicket" ("id")
    ON DELETE CASCADE,
  CONSTRAINT "SupportTicketMessage_senderType_check"
    CHECK ("senderType" IN ('CUSTOMER', 'AGENT', 'SYSTEM'))
);

CREATE INDEX IF NOT EXISTS "SupportTicketMessage_ticketId_idx"
  ON "SupportTicketMessage" ("ticketId");

CREATE INDEX IF NOT EXISTS "SupportTicketMessage_senderType_idx"
  ON "SupportTicketMessage" ("senderType");

CREATE INDEX IF NOT EXISTS "SupportTicketMessage_createdAt_idx"
  ON "SupportTicketMessage" ("createdAt");

CREATE TABLE IF NOT EXISTS "SupportChatConversation" (
  "id" TEXT PRIMARY KEY,
  "externalId" TEXT,
  "userId" TEXT,
  "guestToken" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "guestPhone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "channel" TEXT NOT NULL DEFAULT 'WEB',
  "assignedAgentId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastCustomerMessageAt" TIMESTAMP(3),
  "lastAgentMessageAt" TIMESTAMP(3),
  "unreadByAdmin" INTEGER NOT NULL DEFAULT 0,
  "unreadByCustomer" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "SupportChatConversation_status_check"
    CHECK ("status" IN ('OPEN', 'WAITING', 'ASSIGNED', 'CLOSED', 'ARCHIVED')),
  CONSTRAINT "SupportChatConversation_channel_check"
    CHECK ("channel" IN ('WEB', 'MOBILE', 'ADMIN'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportChatConversation_externalId_unique"
  ON "SupportChatConversation" (LOWER("externalId"))
  WHERE "externalId" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "SupportChatConversation_userId_idx"
  ON "SupportChatConversation" ("userId");

CREATE INDEX IF NOT EXISTS "SupportChatConversation_guestToken_idx"
  ON "SupportChatConversation" ("guestToken");

CREATE INDEX IF NOT EXISTS "SupportChatConversation_status_idx"
  ON "SupportChatConversation" ("status");

CREATE INDEX IF NOT EXISTS "SupportChatConversation_assignedAgentId_idx"
  ON "SupportChatConversation" ("assignedAgentId");

CREATE INDEX IF NOT EXISTS "SupportChatConversation_lastMessageAt_idx"
  ON "SupportChatConversation" ("lastMessageAt");

CREATE TABLE IF NOT EXISTS "SupportChatMessage" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderId" TEXT,
  "body" TEXT NOT NULL,
  "attachmentUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "SupportChatMessage_conversationId_fk"
    FOREIGN KEY ("conversationId")
    REFERENCES "SupportChatConversation" ("id")
    ON DELETE CASCADE,
  CONSTRAINT "SupportChatMessage_senderType_check"
    CHECK ("senderType" IN ('CUSTOMER', 'AGENT', 'SYSTEM', 'AI'))
);

CREATE INDEX IF NOT EXISTS "SupportChatMessage_conversationId_idx"
  ON "SupportChatMessage" ("conversationId");

CREATE INDEX IF NOT EXISTS "SupportChatMessage_senderType_idx"
  ON "SupportChatMessage" ("senderType");

CREATE INDEX IF NOT EXISTS "SupportChatMessage_createdAt_idx"
  ON "SupportChatMessage" ("createdAt");