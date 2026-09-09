-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiAnalysisType" AS ENUM ('CV_JOB_MATCH', 'CV_GAP_ANALYSIS', 'CV_JOB_ANALYSIS');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "operations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'QUEUED',
    "progressPercent" INTEGER,
    "resultResourceType" TEXT,
    "resultResourceId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "type" "AiAnalysisType" NOT NULL,
    "candidateId" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "overallScore" INTEGER,
    "components" JSONB NOT NULL DEFAULT '[]',
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "unmetRequirements" TEXT[],
    "suggestions" TEXT[],
    "limitations" TEXT[],
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operations_userId_idx" ON "operations"("userId");

-- CreateIndex
CREATE INDEX "operations_status_idx" ON "operations"("status");

-- CreateIndex
CREATE INDEX "ai_analyses_candidateId_idx" ON "ai_analyses"("candidateId");

-- CreateIndex
CREATE INDEX "ai_analyses_cvId_idx" ON "ai_analyses"("cvId");

-- CreateIndex
CREATE INDEX "ai_analyses_jobId_idx" ON "ai_analyses"("jobId");

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "cvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
