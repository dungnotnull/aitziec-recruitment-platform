-- AlterTable: add columns to skills
ALTER TABLE "skills" ADD COLUMN "normalizedName" TEXT;
ALTER TABLE "skills" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "skills" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill normalizedName for existing skills
UPDATE "skills" SET "normalizedName" = LOWER(TRIM("name")) WHERE "normalizedName" IS NULL;

-- Enforce NOT NULL on normalizedName
ALTER TABLE "skills" ALTER COLUMN "normalizedName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "skills_normalizedName_key" ON "skills"("normalizedName");

-- CreateIndex
CREATE INDEX "skills_active_normalizedName_idx" ON "skills"("active", "normalizedName");

-- CreateTable
CREATE TABLE "skill_aliases" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_aliases_normalizedName_key" ON "skill_aliases"("normalizedName");

-- CreateIndex
CREATE INDEX "skill_aliases_skillId_idx" ON "skill_aliases"("skillId");

-- AddForeignKey
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
