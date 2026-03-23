-- CreateTable
CREATE TABLE "ProductServiceLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductServiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductServiceLink_productId_idx" ON "ProductServiceLink"("productId");

-- CreateIndex
CREATE INDEX "ProductServiceLink_serviceType_idx" ON "ProductServiceLink"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "ProductServiceLink_productId_serviceType_key" ON "ProductServiceLink"("productId", "serviceType");

-- AddForeignKey
ALTER TABLE "ProductServiceLink" ADD CONSTRAINT "ProductServiceLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
