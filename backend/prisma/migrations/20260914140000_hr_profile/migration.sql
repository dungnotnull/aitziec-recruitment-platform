-- CreateTable
CREATE TABLE "hr_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_profiles_userId_key" ON "hr_profiles"("userId");

-- AddForeignKey
ALTER TABLE "hr_profiles" ADD CONSTRAINT "hr_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill for existing HR users (without inferring names from email)
INSERT INTO "hr_profiles" ("id", "userId", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE "role" = 'HR'
ON CONFLICT ("userId") DO NOTHING;
