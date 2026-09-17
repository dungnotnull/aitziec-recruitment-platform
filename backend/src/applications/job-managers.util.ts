import { CompanyMemberRole, Prisma, UserStatus } from '@prisma/client';

export interface ManagerResolutionClient {
  companyMembership?: {
    findMany: (args: Prisma.CompanyMembershipFindManyArgs) => Promise<Array<{ userId: string }>>;
    findFirst: (args: Prisma.CompanyMembershipFindFirstArgs) => Promise<{
      userId: string;
      role: CompanyMemberRole;
      user?: { status: UserStatus } | null;
    } | null>;
  };
}

/**
 * Resolves active manager user IDs for job notifications (BE-21-001).
 *
 * Rules:
 * 1. Includes active company OWNERs.
 * 2. Includes the job creator if their user status is ACTIVE and their membership
 *    in the company is currently OWNER or RECRUITER.
 * 3. Excludes the applicant (candidateUserId).
 * 4. Deduplicates recipient IDs (if creator is an owner, they only appear once).
 * 5. Excludes suspended/disabled users and other non-creator recruiters.
 */
export async function resolveJobManagerRecipients(
  prisma: ManagerResolutionClient,
  companyId: string,
  jobCreatorId?: string | null,
  candidateUserId?: string | null,
): Promise<string[]> {
  if (!prisma?.companyMembership) {
    return [];
  }

  const managerIds = new Set<string>();

  // 1. Fetch all active company OWNERs
  const ownerMemberships = await prisma.companyMembership.findMany({
    where: {
      companyId,
      role: CompanyMemberRole.OWNER,
      user: { status: UserStatus.ACTIVE },
    },
    select: { userId: true },
  });

  for (const m of ownerMemberships) {
    if (m?.userId) {
      managerIds.add(m.userId);
    }
  }

  // 2. If creatorId is provided, check if they are still an active OWNER or RECRUITER in this company
  if (jobCreatorId) {
    const creatorMembership = await prisma.companyMembership.findFirst({
      where: {
        companyId,
        userId: jobCreatorId,
      },
      include: {
        user: true,
      },
    });

    if (
      creatorMembership &&
      creatorMembership.user?.status === UserStatus.ACTIVE &&
      (creatorMembership.role === CompanyMemberRole.OWNER ||
        creatorMembership.role === CompanyMemberRole.RECRUITER)
    ) {
      managerIds.add(jobCreatorId);
    }
  }

  // 3. Exclude the candidate
  if (candidateUserId) {
    managerIds.delete(candidateUserId);
  }

  return Array.from(managerIds);
}
