-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT,
    "serviceType" TEXT NOT NULL,
    "linkedProductId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_orderId_idx" ON "ServiceRequest"("orderId");

-- CreateIndex
CREATE INDEX "ServiceRequest_userId_idx" ON "ServiceRequest"("userId");

-- CreateIndex
CREATE INDEX "ServiceRequest_providerId_idx" ON "ServiceRequest"("providerId");

-- CreateIndex
CREATE INDEX "ServiceRequest_serviceType_idx" ON "ServiceRequest"("serviceType");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
