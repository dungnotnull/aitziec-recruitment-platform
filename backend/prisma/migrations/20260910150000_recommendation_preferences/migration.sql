-- CreateTable
CREATE TABLE "recommendation_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consentPolicyVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_preferences_userId_key" ON "recommendation_preferences"("userId");

-- CreateIndex
CREATE INDEX "recommendation_preferences_userId_idx" ON "recommendation_preferences"("userId");

-- AddForeignKey
ALTER TABLE "recommendation_preferences" ADD CONSTRAINT "recommendation_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
