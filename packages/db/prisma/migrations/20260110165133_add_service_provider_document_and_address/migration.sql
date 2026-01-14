-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CPF', 'CNPJ');

-- AlterTable
ALTER TABLE "ServiceProvider" ADD COLUMN     "address" JSONB,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "document" TEXT,
ADD COLUMN     "documentType" "DocumentType";
