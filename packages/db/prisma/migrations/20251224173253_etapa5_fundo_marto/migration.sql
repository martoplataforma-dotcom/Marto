-- CreateEnum
CREATE TYPE "FundEntryType" AS ENUM ('PLATFORM_FEE', 'BREAKAGE', 'PARTNER_INCENTIVE', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PointsTxType" AS ENUM ('EARN_PURCHASE', 'EARN_REVIEW', 'EARN_REFERRAL', 'EARN_MISSION', 'SPEND_CASHBACK', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "MissionRewardType" AS ENUM ('POINTS');

-- CreateTable
CREATE TABLE "MartoFund" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MartoFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MartoFundEntry" (
    "id" TEXT NOT NULL,
    "type" "FundEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MartoFundEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointsWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PointsTxType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "rewardType" "MissionRewardType" NOT NULL DEFAULT 'POINTS',
    "rewardValue" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxCompletionsPerUser" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionCompletion" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MartoFundEntry_type_createdAt_idx" ON "MartoFundEntry"("type", "createdAt");

-- CreateIndex
CREATE INDEX "MartoFundEntry_refType_refId_idx" ON "MartoFundEntry"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "PointsWallet_userId_key" ON "PointsWallet"("userId");

-- CreateIndex
CREATE INDEX "PointsTransaction_userId_createdAt_idx" ON "PointsTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsTransaction_type_createdAt_idx" ON "PointsTransaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "PointsTransaction_refType_refId_idx" ON "PointsTransaction"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_code_key" ON "Mission"("code");

-- CreateIndex
CREATE INDEX "MissionCompletion_userId_createdAt_idx" ON "MissionCompletion"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MissionCompletion_missionId_userId_refType_refId_key" ON "MissionCompletion"("missionId", "userId", "refType", "refId");

-- AddForeignKey
ALTER TABLE "MissionCompletion" ADD CONSTRAINT "MissionCompletion_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
