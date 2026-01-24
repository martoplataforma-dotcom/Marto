/*
  Warnings:

  - A unique constraint covering the columns `[handle]` on the table `Merchant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "handle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_handle_key" ON "Merchant"("handle");
