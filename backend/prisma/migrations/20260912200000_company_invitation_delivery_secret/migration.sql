-- CreateTable
CREATE TABLE "company_invitation_delivery_secrets" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invitation_delivery_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_invitation_delivery_secrets_invitationId_key" ON "company_invitation_delivery_secrets"("invitationId");

-- AddForeignKey
ALTER TABLE "company_invitation_delivery_secrets" ADD CONSTRAINT "company_invitation_delivery_secrets_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "company_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
