-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "JobStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "creatorId" TEXT;

-- CreateIndex
CREATE INDEX "jobs_creatorId_idx" ON "jobs"("creatorId");

-- CreateIndex
CREATE INDEX "jobs_companyId_creatorId_idx" ON "jobs"("companyId", "creatorId");

-- CreateIndex
CREATE INDEX "jobs_status_applicationDeadline_idx" ON "jobs"("status", "applicationDeadline");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
