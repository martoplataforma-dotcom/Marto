/*
  Warnings:

  - A unique constraint covering the columns `[serviceProviderId]` on the table `Transporter` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `serviceProviderId` to the `Transporter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transporter" ADD COLUMN     "serviceProviderId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transporter_serviceProviderId_key" ON "Transporter"("serviceProviderId");

-- AddForeignKey
ALTER TABLE "Transporter" ADD CONSTRAINT "Transporter_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
