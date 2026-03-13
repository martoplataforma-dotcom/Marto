-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "allowCorreios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowLocalDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowPickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowTransportadora" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "productType" TEXT,
ADD COLUMN     "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthCm" INTEGER;
