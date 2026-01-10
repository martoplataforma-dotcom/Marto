-- CreateEnum
CREATE TYPE "ServiceProviderKind" AS ENUM ('GENERIC', 'TRANSPORTER');

-- AlterTable
ALTER TABLE "ServiceProvider" ADD COLUMN     "kind" "ServiceProviderKind" NOT NULL DEFAULT 'GENERIC';
