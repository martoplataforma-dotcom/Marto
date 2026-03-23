-- CreateTable
CREATE TABLE "ServiceReview" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReview_serviceRequestId_key" ON "ServiceReview"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceReview_orderId_idx" ON "ServiceReview"("orderId");

-- CreateIndex
CREATE INDEX "ServiceReview_userId_idx" ON "ServiceReview"("userId");

-- CreateIndex
CREATE INDEX "ServiceReview_providerId_idx" ON "ServiceReview"("providerId");

-- CreateIndex
CREATE INDEX "ServiceReview_rating_idx" ON "ServiceReview"("rating");

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
