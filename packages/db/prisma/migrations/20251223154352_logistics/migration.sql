/*
  Warnings:

  - You are about to drop the `Assignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChecklistAnswer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChecklistQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChecklistTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Merchant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MerchantMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OutboxEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payout` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserRole` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TransporterType" AS ENUM ('CARRIER', 'LOCAL_COURIER', 'STORE_PICKUP');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'QUOTED', 'CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('DELAY', 'DAMAGE', 'LOSS', 'INVALID_ADDRESS', 'OTHER');

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_serviceRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistAnswer" DROP CONSTRAINT "ChecklistAnswer_answeredByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistAnswer" DROP CONSTRAINT "ChecklistAnswer_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistAnswer" DROP CONSTRAINT "ChecklistAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistAnswer" DROP CONSTRAINT "ChecklistAnswer_serviceRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistAnswer" DROP CONSTRAINT "ChecklistAnswer_templateId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistQuestion" DROP CONSTRAINT "ChecklistQuestion_templateId_fkey";

-- DropForeignKey
ALTER TABLE "MerchantMember" DROP CONSTRAINT "MerchantMember_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "MerchantMember" DROP CONSTRAINT "MerchantMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceRequest" DROP CONSTRAINT "ServiceRequest_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceRequest" DROP CONSTRAINT "ServiceRequest_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_userId_fkey";

-- DropTable
DROP TABLE "Assignment";

-- DropTable
DROP TABLE "ChecklistAnswer";

-- DropTable
DROP TABLE "ChecklistQuestion";

-- DropTable
DROP TABLE "ChecklistTemplate";

-- DropTable
DROP TABLE "Merchant";

-- DropTable
DROP TABLE "MerchantMember";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "OrderItem";

-- DropTable
DROP TABLE "OutboxEvent";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "Payout";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "ServiceRequest";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserRole";

-- DropEnum
DROP TYPE "AssignmentStatus";

-- DropEnum
DROP TYPE "ChecklistStatus";

-- DropEnum
DROP TYPE "MerchantStatus";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "OutboxStatus";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "PayoutStatus";

-- DropEnum
DROP TYPE "ProductStatus";

-- DropEnum
DROP TYPE "ReviewTargetType";

-- DropEnum
DROP TYPE "ServiceRequestStatus";

-- DropEnum
DROP TYPE "UserStatus";

-- CreateTable
CREATE TABLE "Transporter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransporterType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "state" TEXT,
    "serviceArea" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "transporterId" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "quotedPrice" INTEGER,
    "estimatedDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentIncident" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_transporterId_idx" ON "Shipment"("transporterId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_status_idx" ON "ShipmentEvent"("status");

-- CreateIndex
CREATE INDEX "ShipmentIncident_shipmentId_idx" ON "ShipmentIncident"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentIncident_type_idx" ON "ShipmentIncident"("type");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentIncident" ADD CONSTRAINT "ShipmentIncident_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
