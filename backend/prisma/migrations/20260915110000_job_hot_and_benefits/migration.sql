-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "isHot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "jobs_isHot_idx" ON "jobs"("isHot");
