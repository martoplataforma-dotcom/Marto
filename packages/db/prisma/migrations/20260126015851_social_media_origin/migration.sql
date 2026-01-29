-- CreateEnum
CREATE TYPE "MediaOrigin" AS ENUM ('UPLOAD', 'EXTERNAL');

-- AlterTable
ALTER TABLE "SocialMedia" ADD COLUMN     "origin" "MediaOrigin" NOT NULL DEFAULT 'UPLOAD';

-- CreateIndex
CREATE INDEX "SocialMedia_origin_idx" ON "SocialMedia"("origin");
