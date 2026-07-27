BEGIN;

CREATE TABLE "CatalogResearchRun" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "productId" TEXT,
  "brandId" TEXT,
  "productModelId" TEXT,
  "triggerType" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'PRODUCT',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "requestedQuery" TEXT,
  "normalizedIdentity" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "progressJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "summaryJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CatalogResearchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogResearchSource" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "researchRunId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "canonicalUrl" TEXT,
  "domain" TEXT,
  "title" TEXT,
  "language" TEXT,
  "publisher" TEXT,
  "publishedAt" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "httpStatus" INTEGER,
  "contentHash" TEXT,
  "extractedText" TEXT,
  "metadataJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "trustScore" DECIMAL(5,2),
  "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "isOfficial" BOOLEAN NOT NULL DEFAULT false,
  "isAccessible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CatalogResearchSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogResearchFieldSuggestion" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "researchRunId" TEXT NOT NULL,
  "sourceId" TEXT,
  "productId" TEXT,
  "fieldPath" TEXT NOT NULL,
  "normalizedValue" JSONB NOT NULL,
  "displayValue" TEXT,
  "unit" TEXT,
  "sourceExcerpt" TEXT,
  "confidence" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "conflictGroup" TEXT,
  "adminDecision" TEXT NOT NULL DEFAULT 'PENDING',
  "adminNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CatalogResearchFieldSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogApprovedKnowledge" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "productId" TEXT,
  "brandId" TEXT,
  "productModelId" TEXT,
  "fieldPath" TEXT NOT NULL,
  "normalizedValue" JSONB NOT NULL,
  "displayValue" TEXT,
  "unit" TEXT,
  "sourceSuggestionId" TEXT,
  "sourceUrlsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "confidence" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "metadataJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CatalogApprovedKnowledge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogDiscoveredProduct" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "brandId" TEXT,
  "sourceResearchRunId" TEXT,
  "normalizedName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "brandName" TEXT,
  "modelCode" TEXT,
  "productFamily" TEXT,
  "categoryHint" TEXT,
  "productTypeHint" TEXT,
  "officialUrl" TEXT,
  "identifiersJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "summaryJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "evidenceJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "completenessScore" DECIMAL(5,2),
  "confidence" DECIMAL(5,2),
  "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
  "importProductId" TEXT,
  "lastResearchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "CatalogDiscoveredProduct_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CatalogResearchSource"
  ADD CONSTRAINT "CatalogResearchSource_researchRunId_fkey"
  FOREIGN KEY ("researchRunId")
  REFERENCES "CatalogResearchRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogResearchFieldSuggestion"
  ADD CONSTRAINT "CatalogResearchFieldSuggestion_researchRunId_fkey"
  FOREIGN KEY ("researchRunId")
  REFERENCES "CatalogResearchRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogResearchFieldSuggestion"
  ADD CONSTRAINT "CatalogResearchFieldSuggestion_sourceId_fkey"
  FOREIGN KEY ("sourceId")
  REFERENCES "CatalogResearchSource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CatalogResearchSource_researchRunId_sourceUrl_key"
  ON "CatalogResearchSource"("researchRunId", "sourceUrl");

CREATE INDEX "CatalogResearchRun_productId_idx" ON "CatalogResearchRun"("productId");
CREATE INDEX "CatalogResearchRun_brandId_idx" ON "CatalogResearchRun"("brandId");
CREATE INDEX "CatalogResearchRun_productModelId_idx" ON "CatalogResearchRun"("productModelId");
CREATE INDEX "CatalogResearchRun_triggerType_idx" ON "CatalogResearchRun"("triggerType");
CREATE INDEX "CatalogResearchRun_scope_idx" ON "CatalogResearchRun"("scope");
CREATE INDEX "CatalogResearchRun_status_idx" ON "CatalogResearchRun"("status");
CREATE INDEX "CatalogResearchRun_createdAt_idx" ON "CatalogResearchRun"("createdAt");
CREATE INDEX "CatalogResearchRun_deleted_at_idx" ON "CatalogResearchRun"("deleted_at");

CREATE INDEX "CatalogResearchSource_researchRunId_idx" ON "CatalogResearchSource"("researchRunId");
CREATE INDEX "CatalogResearchSource_sourceType_idx" ON "CatalogResearchSource"("sourceType");
CREATE INDEX "CatalogResearchSource_domain_idx" ON "CatalogResearchSource"("domain");
CREATE INDEX "CatalogResearchSource_verification_idx" ON "CatalogResearchSource"("verification");
CREATE INDEX "CatalogResearchSource_isOfficial_idx" ON "CatalogResearchSource"("isOfficial");
CREATE INDEX "CatalogResearchSource_retrievedAt_idx" ON "CatalogResearchSource"("retrievedAt");
CREATE INDEX "CatalogResearchSource_deleted_at_idx" ON "CatalogResearchSource"("deleted_at");

CREATE INDEX "CatalogResearchFieldSuggestion_researchRunId_idx"
  ON "CatalogResearchFieldSuggestion"("researchRunId");
CREATE INDEX "CatalogResearchFieldSuggestion_sourceId_idx"
  ON "CatalogResearchFieldSuggestion"("sourceId");
CREATE INDEX "CatalogResearchFieldSuggestion_productId_idx"
  ON "CatalogResearchFieldSuggestion"("productId");
CREATE INDEX "CatalogResearchFieldSuggestion_fieldPath_idx"
  ON "CatalogResearchFieldSuggestion"("fieldPath");
CREATE INDEX "CatalogResearchFieldSuggestion_verificationStatus_idx"
  ON "CatalogResearchFieldSuggestion"("verificationStatus");
CREATE INDEX "CatalogResearchFieldSuggestion_adminDecision_idx"
  ON "CatalogResearchFieldSuggestion"("adminDecision");
CREATE INDEX "CatalogResearchFieldSuggestion_confidence_idx"
  ON "CatalogResearchFieldSuggestion"("confidence");
CREATE INDEX "CatalogResearchFieldSuggestion_deleted_at_idx"
  ON "CatalogResearchFieldSuggestion"("deleted_at");

CREATE INDEX "CatalogApprovedKnowledge_productId_idx"
  ON "CatalogApprovedKnowledge"("productId");
CREATE INDEX "CatalogApprovedKnowledge_brandId_idx"
  ON "CatalogApprovedKnowledge"("brandId");
CREATE INDEX "CatalogApprovedKnowledge_productModelId_idx"
  ON "CatalogApprovedKnowledge"("productModelId");
CREATE INDEX "CatalogApprovedKnowledge_fieldPath_idx"
  ON "CatalogApprovedKnowledge"("fieldPath");
CREATE INDEX "CatalogApprovedKnowledge_isCurrent_idx"
  ON "CatalogApprovedKnowledge"("isCurrent");
CREATE INDEX "CatalogApprovedKnowledge_expiresAt_idx"
  ON "CatalogApprovedKnowledge"("expiresAt");
CREATE INDEX "CatalogApprovedKnowledge_approvedAt_idx"
  ON "CatalogApprovedKnowledge"("approvedAt");
CREATE INDEX "CatalogApprovedKnowledge_deleted_at_idx"
  ON "CatalogApprovedKnowledge"("deleted_at");

CREATE INDEX "CatalogDiscoveredProduct_brandId_idx"
  ON "CatalogDiscoveredProduct"("brandId");
CREATE INDEX "CatalogDiscoveredProduct_modelCode_idx"
  ON "CatalogDiscoveredProduct"("modelCode");
CREATE INDEX "CatalogDiscoveredProduct_productFamily_idx"
  ON "CatalogDiscoveredProduct"("productFamily");
CREATE INDEX "CatalogDiscoveredProduct_status_idx"
  ON "CatalogDiscoveredProduct"("status");
CREATE INDEX "CatalogDiscoveredProduct_confidence_idx"
  ON "CatalogDiscoveredProduct"("confidence");
CREATE INDEX "CatalogDiscoveredProduct_lastResearchedAt_idx"
  ON "CatalogDiscoveredProduct"("lastResearchedAt");
CREATE INDEX "CatalogDiscoveredProduct_deleted_at_idx"
  ON "CatalogDiscoveredProduct"("deleted_at");

COMMIT;
