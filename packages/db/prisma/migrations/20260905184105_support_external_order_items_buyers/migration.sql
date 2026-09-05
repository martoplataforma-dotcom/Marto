-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerContactSnapshot" JSONB,
ADD COLUMN     "buyerNameSnapshot" TEXT,
ADD COLUMN     "destinationAddressSnapshot" JSONB,
ADD COLUMN     "recipientNameSnapshot" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "skuSnapshot" TEXT,
ADD COLUMN     "titleSnapshot" TEXT,
ADD COLUMN     "variationSnapshot" JSONB,
ALTER COLUMN "productId" DROP NOT NULL;
