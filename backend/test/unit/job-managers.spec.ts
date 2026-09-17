import { resolveJobManagerRecipients } from '../../src/applications/job-managers.util';
import { CompanyMemberRole, UserStatus } from '@prisma/client';

describe('resolveJobManagerRecipients (Unit - BE-21-001)', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      companyMembership: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
  });

  it('returns empty array when prisma or companyMembership is not available', async () => {
    const result = await resolveJobManagerRecipients({} as any, 'comp-1');
    expect(result).toEqual([]);
  });

  it('resolves active company owners and active creator recruiter', async () => {
    // 1. Owner memberships
    mockPrisma.companyMembership.findMany.mockResolvedValue([
      { userId: 'owner-1' },
      { userId: 'owner-2' },
    ]);

    // 2. Creator is a recruiter
    mockPrisma.companyMembership.findFirst.mockResolvedValue({
      userId: 'recruiter-creator',
      role: CompanyMemberRole.RECRUITER,
      user: { status: UserStatus.ACTIVE },
    });

    const result = await resolveJobManagerRecipients(
      mockPrisma,
      'comp-1',
      'recruiter-creator',
      'candidate-user-1',
    );

    expect(result).toEqual(expect.arrayContaining(['owner-1', 'owner-2', 'recruiter-creator']));
    expect(result.length).toBe(3);
  });

  it('deduplicates when the creator is also an active owner', async () => {
    mockPrisma.companyMembership.findMany.mockResolvedValue([
      { userId: 'owner-creator' },
      { userId: 'owner-2' },
    ]);

    mockPrisma.companyMembership.findFirst.mockResolvedValue({
      userId: 'owner-creator',
      role: CompanyMemberRole.OWNER,
      user: { status: UserStatus.ACTIVE },
    });

    const result = await resolveJobManagerRecipients(
      mockPrisma,
      'comp-1',
      'owner-creator',
      'cand-1',
    );

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(['owner-creator', 'owner-2']));
  });

  it('excludes candidate even if they hold an owner role', async () => {
    mockPrisma.companyMembership.findMany.mockResolvedValue([
      { userId: 'candidate-who-is-owner' },
      { userId: 'owner-2' },
    ]);

    mockPrisma.companyMembership.findFirst.mockResolvedValue(null);

    const result = await resolveJobManagerRecipients(
      mockPrisma,
      'comp-1',
      null,
      'candidate-who-is-owner',
    );

    expect(result).toEqual(['owner-2']);
  });

  it('excludes creator if creator user status is not ACTIVE', async () => {
    mockPrisma.companyMembership.findMany.mockResolvedValue([{ userId: 'owner-1' }]);

    mockPrisma.companyMembership.findFirst.mockResolvedValue({
      userId: 'disabled-creator',
      role: CompanyMemberRole.RECRUITER,
      user: { status: UserStatus.DISABLED },
    });

    const result = await resolveJobManagerRecipients(mockPrisma, 'comp-1', 'disabled-creator');

    expect(result).toEqual(['owner-1']);
  });

  it('returns empty array when company has no active owners and creator is null', async () => {
    mockPrisma.companyMembership.findMany.mockResolvedValue([]);

    const result = await resolveJobManagerRecipients(mockPrisma, 'comp-1', null);
    expect(result).toEqual([]);
  });
});
