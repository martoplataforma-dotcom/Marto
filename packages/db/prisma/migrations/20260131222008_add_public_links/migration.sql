-- CreateTable
CREATE TABLE "PublicLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicScan" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "referer" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "PublicScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicLink_code_key" ON "PublicLink"("code");

-- AddForeignKey
ALTER TABLE "PublicScan" ADD CONSTRAINT "PublicScan_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PublicLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
