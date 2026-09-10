-- AlterTable
ALTER TABLE "cvs" ADD COLUMN "latestOperationId" TEXT,
ADD COLUMN "extractionAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "cvs_latestOperationId_idx" ON "cvs"("latestOperationId");
