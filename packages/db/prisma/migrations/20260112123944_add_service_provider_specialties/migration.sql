-- AlterEnum
ALTER TYPE "ServiceProviderKind" ADD VALUE 'DELIVERY';

-- AlterTable
ALTER TABLE "ServiceProvider" ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];
