CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "User"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "firstName" DROP NOT NULL,
  ALTER COLUMN "lastName" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "PhoneOtp" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "phone" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'CUSTOMER_LOGIN',
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PhoneOtp_phone_idx" ON "PhoneOtp" ("phone");
CREATE INDEX IF NOT EXISTS "PhoneOtp_purpose_idx" ON "PhoneOtp" ("purpose");
CREATE INDEX IF NOT EXISTS "PhoneOtp_expiresAt_idx" ON "PhoneOtp" ("expiresAt");
CREATE INDEX IF NOT EXISTS "PhoneOtp_consumedAt_idx" ON "PhoneOtp" ("consumedAt");
CREATE INDEX IF NOT EXISTS "PhoneOtp_createdAt_idx" ON "PhoneOtp" ("createdAt");