CREATE TABLE IF NOT EXISTS "AdminSecurityIncident" (
  "id" TEXT PRIMARY KEY,
  "incidentNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "targetType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "targetId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "assignedAdminId" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AdminSecurityIncident_severity_check"
    CHECK ("severity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT "AdminSecurityIncident_status_check"
    CHECK ("status" IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
  CONSTRAINT "AdminSecurityIncident_source_check"
    CHECK ("source" IN ('AUTH', 'RBAC', 'API', 'ADMIN', 'ORDER', 'PAYMENT', 'SYSTEM', 'AI')),
  CONSTRAINT "AdminSecurityIncident_targetType_check"
    CHECK ("targetType" IN ('USER', 'ADMIN', 'SESSION', 'IP', 'API_KEY', 'ORDER', 'PAYMENT', 'SYSTEM'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSecurityIncident_incidentNumber_active_unique"
  ON "AdminSecurityIncident" (LOWER("incidentNumber"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "AdminSecurityIncident_severity_idx"
  ON "AdminSecurityIncident" ("severity");

CREATE INDEX IF NOT EXISTS "AdminSecurityIncident_status_idx"
  ON "AdminSecurityIncident" ("status");

CREATE INDEX IF NOT EXISTS "AdminSecurityIncident_source_idx"
  ON "AdminSecurityIncident" ("source");

CREATE INDEX IF NOT EXISTS "AdminSecurityIncident_target_idx"
  ON "AdminSecurityIncident" ("targetType", "targetId");

CREATE INDEX IF NOT EXISTS "AdminSecurityIncident_ipAddress_idx"
  ON "AdminSecurityIncident" ("ipAddress");

CREATE INDEX IF NOT EXISTS "AdminSecurityIncident_assignedAdminId_idx"
  ON "AdminSecurityIncident" ("assignedAdminId");

CREATE INDEX IF NOT EXISTS "AdminSecurityIncident_createdAt_idx"
  ON "AdminSecurityIncident" ("createdAt");

CREATE TABLE IF NOT EXISTS "AdminSecurityPolicy" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'SYSTEM',
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "configJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AdminSecurityPolicy_category_check"
    CHECK ("category" IN ('AUTH', 'SESSION', 'RBAC', 'API', 'DATA', 'PRIVACY', 'PAYMENT', 'SYSTEM')),
  CONSTRAINT "AdminSecurityPolicy_severity_check"
    CHECK ("severity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSecurityPolicy_key_active_unique"
  ON "AdminSecurityPolicy" (LOWER("key"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "AdminSecurityPolicy_category_idx"
  ON "AdminSecurityPolicy" ("category");

CREATE INDEX IF NOT EXISTS "AdminSecurityPolicy_severity_idx"
  ON "AdminSecurityPolicy" ("severity");

CREATE INDEX IF NOT EXISTS "AdminSecurityPolicy_isEnabled_idx"
  ON "AdminSecurityPolicy" ("isEnabled");

CREATE TABLE IF NOT EXISTS "AdminIpRule" (
  "id" TEXT PRIMARY KEY,
  "ipAddress" TEXT NOT NULL,
  "cidr" TEXT,
  "type" TEXT NOT NULL DEFAULT 'WATCH',
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AdminIpRule_type_check"
    CHECK ("type" IN ('ALLOW', 'BLOCK', 'WATCH'))
);

CREATE INDEX IF NOT EXISTS "AdminIpRule_ipAddress_idx"
  ON "AdminIpRule" ("ipAddress");

CREATE INDEX IF NOT EXISTS "AdminIpRule_type_idx"
  ON "AdminIpRule" ("type");

CREATE INDEX IF NOT EXISTS "AdminIpRule_isActive_idx"
  ON "AdminIpRule" ("isActive");

CREATE INDEX IF NOT EXISTS "AdminIpRule_expiresAt_idx"
  ON "AdminIpRule" ("expiresAt");

CREATE TABLE IF NOT EXISTS "AdminSecurityEvaluationLog" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "ipAddress" TEXT,
  "route" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "userAgent" TEXT,
  "decision" TEXT NOT NULL DEFAULT 'ALLOW',
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "matchedRuleIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "reasonsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "AdminSecurityEvaluationLog_decision_check"
    CHECK ("decision" IN ('ALLOW', 'WATCH', 'BLOCK'))
);

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_userId_idx"
  ON "AdminSecurityEvaluationLog" ("userId");

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_ipAddress_idx"
  ON "AdminSecurityEvaluationLog" ("ipAddress");

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_decision_idx"
  ON "AdminSecurityEvaluationLog" ("decision");

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_riskScore_idx"
  ON "AdminSecurityEvaluationLog" ("riskScore");

CREATE INDEX IF NOT EXISTS "AdminSecurityEvaluationLog_createdAt_idx"
  ON "AdminSecurityEvaluationLog" ("createdAt");