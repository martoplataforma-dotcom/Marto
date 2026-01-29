/*
  Warnings:

  - You are about to drop the column `userId` on the `PointsTransaction` table. All the data in the column will be lost.
  - Added the required column `fundId` to the `MartoFundEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `PointsTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Consumer" DROP CONSTRAINT "Consumer_userId_fkey";

-- DropForeignKey
ALTER TABLE "Factory" DROP CONSTRAINT "Factory_userId_fkey";

-- DropForeignKey
ALTER TABLE "Representative" DROP CONSTRAINT "Representative_userId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceProvider" DROP CONSTRAINT "ServiceProvider_userId_fkey";

-- DropIndex
DROP INDEX "PointsTransaction_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "MartoFundEntry" ADD COLUMN     "fundId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PointsTransaction" DROP COLUMN "userId",
ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "MartoFundEntry_fundId_createdAt_idx" ON "MartoFundEntry"("fundId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsTransaction_walletId_createdAt_idx" ON "PointsTransaction"("walletId", "createdAt");

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLike" ADD CONSTRAINT "SocialLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MartoFundEntry" ADD CONSTRAINT "MartoFundEntry_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "MartoFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsWallet" ADD CONSTRAINT "PointsWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "PointsWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Representative" ADD CONSTRAINT "Representative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factory" ADD CONSTRAINT "Factory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
