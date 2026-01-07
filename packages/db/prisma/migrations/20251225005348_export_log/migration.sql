-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ExportResource" AS ENUM ('INSIGHTS_PRODUCTS_REPORT', 'INSIGHTS_PRODUCTS_COMPARE', 'INSIGHTS_PRODUCTS_BENCHMARK');

-- CreateTable
CREATE TABLE "ExportLog" (
    "id" TEXT NOT NULL,
    "resource" "ExportResource" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "merchantId" TEXT,
    "params" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportLog_resource_createdAt_idx" ON "ExportLog"("resource", "createdAt");

-- CreateIndex
CREATE INDEX "ExportLog_merchantId_createdAt_idx" ON "ExportLog"("merchantId", "createdAt");
