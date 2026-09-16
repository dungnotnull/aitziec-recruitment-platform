-- AlterTable
ALTER TABLE "companies" ADD COLUMN "companyModel" TEXT,
ADD COLUMN "companySize" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "workingTime" TEXT,
ADD COLUMN "overtimePolicy" TEXT,
ADD COLUMN "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "reasonsToJoin" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "perks" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "company_follows" (
    "id" TEXT NOT NULL,
    "candidateProfileId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_follows_candidateProfileId_idx" ON "company_follows"("candidateProfileId");

-- CreateIndex
CREATE INDEX "company_follows_companyId_idx" ON "company_follows"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_follows_candidateProfileId_companyId_key" ON "company_follows"("candidateProfileId", "companyId");

-- AddForeignKey
ALTER TABLE "company_follows" ADD CONSTRAINT "company_follows_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_follows" ADD CONSTRAINT "company_follows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
