-- CreateTable
CREATE TABLE "AnalyticsProductDaily" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ordersCount" INTEGER NOT NULL,
    "unitsSold" INTEGER NOT NULL,
    "grossRevenue" DECIMAL(12,2) NOT NULL,
    "avgPrice" DECIMAL(12,2) NOT NULL,
    "reviewsCount" INTEGER NOT NULL,
    "avgRating" DECIMAL(3,2),
    "logisticsCost" DECIMAL(12,2),
    "serviceCost" DECIMAL(12,2),
    "margin" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsProductDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsProductDaily_merchantId_idx" ON "AnalyticsProductDaily"("merchantId");

-- CreateIndex
CREATE INDEX "AnalyticsProductDaily_date_idx" ON "AnalyticsProductDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsProductDaily_date_productId_region_key" ON "AnalyticsProductDaily"("date", "productId", "region");
