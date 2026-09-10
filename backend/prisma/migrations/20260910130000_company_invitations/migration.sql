-- CreateEnum
CREATE TYPE "CompanyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPANY_INVITATION_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'COMPANY_MEMBER_ADDED';

-- CreateTable
CREATE TABLE "company_invitations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'RECRUITER',
    "invitedById" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "CompanyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_invitations_tokenHash_key" ON "company_invitations"("tokenHash");

-- CreateIndex: Partial unique index for one pending invitation per company and email
CREATE UNIQUE INDEX "company_invitations_companyId_email_pending_key" ON "company_invitations"("companyId", "email") WHERE "status" = 'PENDING';

-- CreateIndex
CREATE INDEX "company_invitations_companyId_idx" ON "company_invitations"("companyId");

-- CreateIndex
CREATE INDEX "company_invitations_email_idx" ON "company_invitations"("email");

-- CreateIndex
CREATE INDEX "company_invitations_status_idx" ON "company_invitations"("status");

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
