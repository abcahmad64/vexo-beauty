CREATE TABLE IF NOT EXISTS "AiShadowRoutingDecision" (
  "id" TEXT PRIMARY KEY,
  "decisionId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'SHADOW_RESOLUTION_ONLY',
  "resolvedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "subjectKeySource" TEXT NOT NULL,
  "subjectKeyFingerprint" TEXT NOT NULL,
  "requestedTask" TEXT NOT NULL,
  "taskType" TEXT NOT NULL,
  "actualProvider" TEXT NOT NULL,
  "actualModel" TEXT NOT NULL,
  "rolloutId" TEXT,
  "policyVersion" INTEGER,
  "trafficPercent" INTEGER,
  "bucket" INTEGER,
  "threshold" INTEGER,
  "cohort" TEXT NOT NULL,
  "shadowProvider" TEXT NOT NULL,
  "shadowModel" TEXT NOT NULL,
  "routeChanged" BOOLEAN NOT NULL DEFAULT FALSE,
  "providerInvoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "modelActivated" BOOLEAN NOT NULL DEFAULT FALSE,
  "decisionPersisted" BOOLEAN NOT NULL DEFAULT TRUE,
  "userIdFingerprint" TEXT,
  "requestIdFingerprint" TEXT,
  "traceIdFingerprint" TEXT,
  "executionIdFingerprint" TEXT,
  "aiRunLogId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiShadowRoutingDecision_mode_check"
    CHECK ("mode" = 'SHADOW_RESOLUTION_ONLY'),
  CONSTRAINT "AiShadowRoutingDecision_cohort_check"
    CHECK ("cohort" IN ('BASELINE', 'CANDIDATE', 'NO_ROLLOUT')),
  CONSTRAINT "AiShadowRoutingDecision_immutability_check"
    CHECK (
      "routeChanged" = FALSE
      AND "providerInvoked" = FALSE
      AND "modelActivated" = FALSE
      AND "decisionPersisted" = TRUE
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiShadowRoutingDecision_decisionId_key"
  ON "AiShadowRoutingDecision" ("decisionId");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_resolvedAt_idx"
  ON "AiShadowRoutingDecision" ("resolvedAt");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_expiresAt_idx"
  ON "AiShadowRoutingDecision" ("expiresAt");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_taskType_idx"
  ON "AiShadowRoutingDecision" ("taskType");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_cohort_idx"
  ON "AiShadowRoutingDecision" ("cohort");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_rolloutId_idx"
  ON "AiShadowRoutingDecision" ("rolloutId");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_subjectKeyFingerprint_idx"
  ON "AiShadowRoutingDecision" ("subjectKeyFingerprint");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_requestIdFingerprint_idx"
  ON "AiShadowRoutingDecision" ("requestIdFingerprint");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_traceIdFingerprint_idx"
  ON "AiShadowRoutingDecision" ("traceIdFingerprint");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_executionIdFingerprint_idx"
  ON "AiShadowRoutingDecision" ("executionIdFingerprint");
CREATE INDEX IF NOT EXISTS "AiShadowRoutingDecision_aiRunLogId_idx"
  ON "AiShadowRoutingDecision" ("aiRunLogId");
