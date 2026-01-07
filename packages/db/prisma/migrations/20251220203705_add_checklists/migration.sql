-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistAnswer" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "serviceRequestId" TEXT,
    "orderId" TEXT,
    "answeredByUserId" TEXT,
    "valueText" TEXT,
    "valueNumber" DECIMAL(12,2),
    "valueBool" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTemplate_status_idx" ON "ChecklistTemplate"("status");

-- CreateIndex
CREATE INDEX "ChecklistQuestion_templateId_idx" ON "ChecklistQuestion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistQuestion_templateId_order_key" ON "ChecklistQuestion"("templateId", "order");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_templateId_idx" ON "ChecklistAnswer"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_questionId_idx" ON "ChecklistAnswer"("questionId");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_serviceRequestId_idx" ON "ChecklistAnswer"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_orderId_idx" ON "ChecklistAnswer"("orderId");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_answeredByUserId_idx" ON "ChecklistAnswer"("answeredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistAnswer_questionId_serviceRequestId_key" ON "ChecklistAnswer"("questionId", "serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistAnswer_questionId_orderId_key" ON "ChecklistAnswer"("questionId", "orderId");

-- AddForeignKey
ALTER TABLE "ChecklistQuestion" ADD CONSTRAINT "ChecklistQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_answeredByUserId_fkey" FOREIGN KEY ("answeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
