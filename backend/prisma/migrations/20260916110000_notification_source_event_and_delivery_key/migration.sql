-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "sourceEventId" TEXT,
ADD COLUMN "deliveryKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_deliveryKey_key" ON "notifications"("deliveryKey");
CREATE INDEX "notifications_sourceEventId_idx" ON "notifications"("sourceEventId");
