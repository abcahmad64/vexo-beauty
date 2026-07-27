-- CreateEnum
CREATE TYPE "ProductMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ProductAttributeDataType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'ENUM', 'MULTI_SELECT', 'JSON', 'DATE');

-- CreateEnum
CREATE TYPE "ProductAttributeInputType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'SWITCH', 'SELECT', 'MULTI_SELECT', 'DATE', 'COLOR', 'RICH_TEXT');

-- CreateEnum
CREATE TYPE "ProductAttributeTemplateScope" AS ENUM ('CATEGORY', 'PRODUCT_TYPE', 'BRAND_PRODUCT_TYPE', 'PRODUCT_MODEL');

-- DropForeignKey
ALTER TABLE "Attribute" DROP CONSTRAINT "Attribute_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Attribute" DROP CONSTRAINT "Attribute_productTypeId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAttribute" DROP CONSTRAINT "ProductAttribute_attributeValueId_fkey";

-- DropForeignKey
ALTER TABLE "ProductModel" DROP CONSTRAINT "ProductModel_brandId_fkey";

-- DropForeignKey
ALTER TABLE "ProductModel" DROP CONSTRAINT "ProductModel_productTypeId_fkey";

-- DropForeignKey
ALTER TABLE "ProductType" DROP CONSTRAINT "ProductType_categoryId_fkey";

-- DropIndex
DROP INDEX "AdminIpRule_cidr_idx";

-- DropIndex
DROP INDEX "AdminIpRule_type_idx";

-- DropIndex
DROP INDEX "AdminSecurityEvaluationLog_method_idx";

-- DropIndex
DROP INDEX "AdminSecurityEvaluationLog_riskScore_idx";

-- DropIndex
DROP INDEX "AdminSecurityEvaluationLog_route_idx";

-- DropIndex
DROP INDEX "AdminSecurityPolicy_createdById_idx";

-- DropIndex
DROP INDEX "AdminSecurityPolicy_severity_idx";

-- DropIndex
DROP INDEX "Attribute_categoryId_idx";

-- DropIndex
DROP INDEX "Attribute_categoryId_productTypeId_idx";

-- DropIndex
DROP INDEX "Attribute_productTypeId_idx";

-- DropIndex
DROP INDEX "CmsFaq_status_idx";

-- DropIndex
DROP INDEX "Product_costPrice_idx";

-- DropIndex
DROP INDEX "ProductModel_slug_key";

-- DropIndex
DROP INDEX "ProductType_slug_key";

-- DropIndex
DROP INDEX "SearchBoostRule_language_idx";

-- DropIndex
DROP INDEX "SearchBoostRule_query_idx";

-- DropIndex
DROP INDEX "SearchBoostRule_weight_idx";

-- DropIndex
DROP INDEX "SearchRedirect_priority_idx";

-- DropIndex
DROP INDEX "SearchRedirect_targetId_idx";

-- DropIndex
DROP INDEX "SearchRedirect_targetType_idx";

-- AlterTable
ALTER TABLE "AdminIpRule" DROP COLUMN "cidr",
DROP COLUMN "reason",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "AdminSecurityEvaluationLog" DROP COLUMN "matchedRuleIds",
DROP COLUMN "method",
DROP COLUMN "reasonsJson",
DROP COLUMN "riskScore",
DROP COLUMN "route",
DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "AdminSecurityPolicy" DROP COLUMN "configJson",
DROP COLUMN "createdById",
DROP COLUMN "severity";

-- AlterTable
ALTER TABLE "Attribute" DROP COLUMN "categoryId",
DROP COLUMN "isVisible",
DROP COLUMN "productTypeId",
ADD COLUMN     "code" TEXT,
ADD COLUMN     "dataType" "ProductAttributeDataType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "helpText" TEXT,
ADD COLUMN     "inputType" "ProductAttributeInputType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isAiImportant" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isComparable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSeoImportant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "optionsJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "placeholder" TEXT,
ADD COLUMN     "unit" TEXT,
ALTER COLUMN "isFilterable" SET DEFAULT false;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "country" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "iconUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "CmsFaq" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "costPrice",
ADD COLUMN     "aiContentStatus" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
ADD COLUMN     "aiQualityScore" DECIMAL(5,2),
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "discountPercent" DECIMAL(5,2),
ADD COLUMN     "finalPrice" DECIMAL(12,2),
ADD COLUMN     "grossMarginAmount" DECIMAL(12,2),
ADD COLUMN     "grossMarginPercent" DECIMAL(6,2),
ADD COLUMN     "minAllowedPrice" DECIMAL(12,2),
ADD COLUMN     "purchasePrice" DECIMAL(12,2),
ADD COLUMN     "salePrice" DECIMAL(12,2),
ADD COLUMN     "schemaJson" JSONB,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "ProductAttribute" ADD COLUMN     "attributeId" TEXT,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "valueBoolean" BOOLEAN,
ADD COLUMN     "valueJson" JSONB,
ADD COLUMN     "valueNumber" DECIMAL(14,4),
ADD COLUMN     "valueText" TEXT,
ALTER COLUMN "attributeValueId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" "ProductMediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "ProductModel" DROP COLUMN "code",
ADD COLUMN     "modelCode" TEXT,
ADD COLUMN     "seoPattern" TEXT,
ADD COLUMN     "titlePattern" TEXT,
ALTER COLUMN "brandId" SET NOT NULL,
ALTER COLUMN "productTypeId" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductType" ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ALTER COLUMN "categoryId" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SearchBoostRule" DROP COLUMN "language",
DROP COLUMN "query",
DROP COLUMN "reason",
DROP COLUMN "weight";

-- AlterTable
ALTER TABLE "SearchIndexSnapshot" DROP COLUMN "documentCount",
DROP COLUMN "durationMs";

-- AlterTable
ALTER TABLE "SearchRedirect" DROP COLUMN "priority",
DROP COLUMN "targetId",
DROP COLUMN "targetType";

-- CreateTable
CREATE TABLE "ProductAttributeTemplate" (
    "id" TEXT NOT NULL,
    "scope" "ProductAttributeTemplateScope" NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "productTypeId" TEXT,
    "brandId" TEXT,
    "productModelId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ProductAttributeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeTemplateField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "groupName" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAttributeTemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_scope_idx" ON "ProductAttributeTemplate"("scope");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_categoryId_idx" ON "ProductAttributeTemplate"("categoryId");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_productTypeId_idx" ON "ProductAttributeTemplate"("productTypeId");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_brandId_idx" ON "ProductAttributeTemplate"("brandId");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_productModelId_idx" ON "ProductAttributeTemplate"("productModelId");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_priority_idx" ON "ProductAttributeTemplate"("priority");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_isDefault_idx" ON "ProductAttributeTemplate"("isDefault");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_isActive_idx" ON "ProductAttributeTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_deleted_at_idx" ON "ProductAttributeTemplate"("deleted_at");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplateField_templateId_idx" ON "ProductAttributeTemplateField"("templateId");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplateField_attributeId_idx" ON "ProductAttributeTemplateField"("attributeId");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplateField_sortOrder_idx" ON "ProductAttributeTemplateField"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeTemplateField_templateId_attributeId_key" ON "ProductAttributeTemplateField"("templateId", "attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_code_key" ON "Attribute"("code");

-- CreateIndex
CREATE INDEX "Attribute_code_idx" ON "Attribute"("code");

-- CreateIndex
CREATE INDEX "Attribute_dataType_idx" ON "Attribute"("dataType");

-- CreateIndex
CREATE INDEX "Attribute_inputType_idx" ON "Attribute"("inputType");

-- CreateIndex
CREATE INDEX "Attribute_isFilterable_idx" ON "Attribute"("isFilterable");

-- CreateIndex
CREATE INDEX "Attribute_isComparable_idx" ON "Attribute"("isComparable");

-- CreateIndex
CREATE INDEX "Attribute_isSeoImportant_idx" ON "Attribute"("isSeoImportant");

-- CreateIndex
CREATE INDEX "Attribute_isAiImportant_idx" ON "Attribute"("isAiImportant");

-- CreateIndex
CREATE INDEX "Attribute_isActive_idx" ON "Attribute"("isActive");

-- CreateIndex
CREATE INDEX "Product_finalPrice_idx" ON "Product"("finalPrice");

-- CreateIndex
CREATE INDEX "ProductAttribute_attributeId_idx" ON "ProductAttribute"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_productId_attributeId_key" ON "ProductAttribute"("productId", "attributeId");

-- CreateIndex
CREATE INDEX "ProductImage_type_idx" ON "ProductImage"("type");

-- CreateIndex
CREATE INDEX "ProductImage_isActive_idx" ON "ProductImage"("isActive");

-- CreateIndex
CREATE INDEX "ProductModel_slug_idx" ON "ProductModel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModel_brandId_productTypeId_slug_key" ON "ProductModel"("brandId", "productTypeId", "slug");

-- CreateIndex
CREATE INDEX "ProductType_slug_idx" ON "ProductType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_categoryId_slug_key" ON "ProductType"("categoryId", "slug");

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplate" ADD CONSTRAINT "ProductAttributeTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplate" ADD CONSTRAINT "ProductAttributeTemplate_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplate" ADD CONSTRAINT "ProductAttributeTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplate" ADD CONSTRAINT "ProductAttributeTemplate_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplateField" ADD CONSTRAINT "ProductAttributeTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProductAttributeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplateField" ADD CONSTRAINT "ProductAttributeTemplateField_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
