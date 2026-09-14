-- CreateIndex: Partial unique index for one default non-deleted CV per candidate profile
CREATE UNIQUE INDEX "cvs_candidateProfileId_default_key" ON "cvs"("candidateProfileId") WHERE "isDefault" = true AND "processingStatus" != 'DELETED';
