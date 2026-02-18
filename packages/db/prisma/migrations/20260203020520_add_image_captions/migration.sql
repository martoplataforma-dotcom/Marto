-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageCaptions" TEXT[] DEFAULT ARRAY[]::TEXT[];
