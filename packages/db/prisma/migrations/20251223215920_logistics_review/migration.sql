-- CreateEnum
CREATE TYPE "LogisticsRating" AS ENUM ('ONE', 'TWO', 'THREE', 'FOUR', 'FIVE');

-- CreateTable
CREATE TABLE "LogisticsReview" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "rating" "LogisticsRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogisticsReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsReview_shipmentId_key" ON "LogisticsReview"("shipmentId");

-- AddForeignKey
ALTER TABLE "LogisticsReview" ADD CONSTRAINT "LogisticsReview_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
