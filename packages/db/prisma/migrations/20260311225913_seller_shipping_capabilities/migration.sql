-- AlterTable
ALTER TABLE "Factory" ADD COLUMN     "originZipCode" TEXT,
ADD COLUMN     "supportsCorreios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsLocalDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsPickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsTransportadora" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "originZipCode" TEXT,
ADD COLUMN     "supportsCorreios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsLocalDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsPickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsTransportadora" BOOLEAN NOT NULL DEFAULT false;
