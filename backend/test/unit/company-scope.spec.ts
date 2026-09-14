import { CompanyScopeService } from '../../src/companies/company-scope.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CompanyScopeService (BE-2-019, BE-2-020)', () => {
  let service: CompanyScopeService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      company: {
        findUnique: jest.fn(),
      },
      companyMembership: {
        findUnique: jest.fn(),
      },
    };
    service = new CompanyScopeService(mockPrisma);
  });

  const activeCompany = {
    id: 'comp-1',
    name: 'Tech Corp',
    status: 'ACTIVE',
  };

  const suspendedCompany = {
    id: 'comp-2',
    name: 'Suspended Corp',
    status: 'SUSPENDED',
  };

  it('allows company owner to access owner-scoped operations', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(activeCompany);
    mockPrisma.companyMembership.findUnique.mockResolvedValue({
      role: 'OWNER',
    });

    const user: any = { id: 'user-owner', role: 'HR' };
    const company = await service.assertOwnerOrAdmin('comp-1', user);

    expect(company).toBeDefined();
    expect(company.id).toBe('comp-1');
  });

  it('allows system administrator to access company operations unconditionally', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(activeCompany);

    const user: any = { id: 'admin-1', role: 'ADMIN' };
    const company = await service.assertOwnerOrAdmin('comp-1', user);

    expect(company).toBeDefined();
  });

  it('rejects recruiter from owner-only operations with 403 Forbidden', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(activeCompany);
    mockPrisma.companyMembership.findUnique.mockResolvedValue({
      role: 'RECRUITER',
    });

    const user: any = { id: 'user-recruiter', role: 'HR' };
    await expect(service.assertOwnerOrAdmin('comp-1', user)).rejects.toThrow(ForbiddenException);
  });

  it('rejects outsider from company member operations with 403 Forbidden', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(activeCompany);
    mockPrisma.companyMembership.findUnique.mockResolvedValue(null);

    const user: any = { id: 'outsider', role: 'HR' };
    await expect(service.assertMemberOrAdmin('comp-1', user)).rejects.toThrow(ForbiddenException);
  });

  it('rejects any mutation on a suspended company', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(suspendedCompany);

    const user: any = { id: 'user-owner', role: 'HR' };
    await expect(service.assertOwnerOrAdmin('comp-2', user)).rejects.toThrow(ForbiddenException);
  });

  it('throws 404 NotFound when company does not exist', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(null);

    const user: any = { id: 'user-owner', role: 'HR' };
    await expect(service.assertOwnerOrAdmin('unknown-comp', user)).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('assertMemberOrAdminReadOnly (BE-8-009)', () => {
    it('allows company member to read company data even if company is SUSPENDED', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(suspendedCompany);
      mockPrisma.companyMembership.findUnique.mockResolvedValue({
        role: 'RECRUITER',
      });

      const user: any = { id: 'user-recruiter', role: 'HR' };
      const res = await service.assertMemberOrAdminReadOnly('comp-2', user);
      expect(res).toBeDefined();
      expect(res.id).toBe('comp-2');
      expect(res.status).toBe('SUSPENDED');
    });

    it('rejects outsider from read-only operations with 403 Forbidden', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(suspendedCompany);
      mockPrisma.companyMembership.findUnique.mockResolvedValue(null);

      const user: any = { id: 'outsider', role: 'HR' };
      await expect(service.assertMemberOrAdminReadOnly('comp-2', user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertMemberOrAdminWithRole (BE-11-002)', () => {
    it('returns role OWNER for company owner', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(activeCompany);
      mockPrisma.companyMembership.findUnique.mockResolvedValue({ role: 'OWNER' });

      const user: any = { id: 'user-owner', role: 'HR' };
      const ctx = await service.assertMemberOrAdminWithRole('comp-1', user);
      expect(ctx.company.id).toBe('comp-1');
      expect(ctx.role).toBe('OWNER');
    });

    it('returns role RECRUITER for company recruiter', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(activeCompany);
      mockPrisma.companyMembership.findUnique.mockResolvedValue({ role: 'RECRUITER' });

      const user: any = { id: 'user-recruiter', role: 'HR' };
      const ctx = await service.assertMemberOrAdminWithRole('comp-1', user);
      expect(ctx.company.id).toBe('comp-1');
      expect(ctx.role).toBe('RECRUITER');
    });

    it('returns role ADMIN for system administrator', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(activeCompany);

      const user: any = { id: 'admin-1', role: 'ADMIN' };
      const ctx = await service.assertMemberOrAdminWithRole('comp-1', user);
      expect(ctx.company.id).toBe('comp-1');
      expect(ctx.role).toBe('ADMIN');
    });

    it('rejects suspended company when allowSuspended is false', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(suspendedCompany);
      const user: any = { id: 'user-recruiter', role: 'HR' };
      await expect(
        service.assertMemberOrAdminWithRole('comp-2', user, { allowSuspended: false }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows suspended company when allowSuspended is true', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(suspendedCompany);
      mockPrisma.companyMembership.findUnique.mockResolvedValue({ role: 'RECRUITER' });

      const user: any = { id: 'user-recruiter', role: 'HR' };
      const ctx = await service.assertMemberOrAdminWithRole('comp-2', user, {
        allowSuspended: true,
      });
      expect(ctx.company.id).toBe('comp-2');
      expect(ctx.role).toBe('RECRUITER');
    });
  });
});
