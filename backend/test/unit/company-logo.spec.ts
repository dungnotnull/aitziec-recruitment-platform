import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { CompaniesService } from '../../src/companies/companies.service';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { UploadedLogoFile } from '../../src/companies/dto/company.dto';

describe('CompanyLogoUpload (Unit - BE-12-001)', () => {
  let service: CompaniesService;
  let mockPrisma: any;
  let mockScopeService: any;
  let mockAuditService: any;
  let mockOutboxService: any;
  let mockStorageService: any;
  let mockSecretAdapter: any;

  const ownerUser: AuthenticatedUser = {
    id: 'user-owner-1',
    email: 'owner@techcorp.vn',
    role: 'HR',
    status: 'ACTIVE',
  };

  const recruiterUser: AuthenticatedUser = {
    id: 'user-recruiter-1',
    email: 'recruiter@techcorp.vn',
    role: 'HR',
    status: 'ACTIVE',
  };

  const adminUser: AuthenticatedUser = {
    id: 'user-admin-1',
    email: 'admin@system.local',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  const companyId = '11111111-1111-1111-1111-111111111111';

  const mockCompany = {
    id: companyId,
    name: 'TechCorp Vietnam',
    slug: 'techcorp-vietnam',
    status: 'ACTIVE',
    version: 3,
    logoUrl: null as string | null,
  };

  // Valid binary buffers with appropriate magic bytes
  const validPngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(100, 0),
  ]);

  const validJpgBuffer = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(100, 0),
  ]);

  const validWebpBuffer = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x20, 0x00, 0x00, 0x00]), // chunk size
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(100, 0),
  ]);

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
      company: {
        update: jest.fn().mockImplementation(async (args: any) => ({
          ...mockCompany,
          ...args.data,
          version: mockCompany.version + 1,
          logoUrl: args.data.logoUrl,
        })),
      },
    };

    mockScopeService = {
      assertOwnerOrAdmin: jest
        .fn()
        .mockImplementation(async (cId: string, user: AuthenticatedUser) => {
          if (cId !== companyId) {
            throw new NotFoundException({ message: 'Company not found.' });
          }
          if (user.role === 'ADMIN') {
            return { ...mockCompany };
          }
          if (user.id === ownerUser.id) {
            return { ...mockCompany };
          }
          throw new ForbiddenException({
            message: 'Only company owner or administrator is authorized.',
          });
        }),
    };

    mockAuditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockOutboxService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };

    mockStorageService = {
      uploadPublicAsset: jest.fn().mockImplementation(async (key: string) => {
        return `http://localhost:9000/itziec-assets/${key}`;
      }),
      deletePublicAsset: jest.fn().mockResolvedValue(undefined),
      getAssetsBucket: jest.fn().mockReturnValue('itziec-assets'),
      getPublicBaseUrl: jest.fn().mockReturnValue('http://localhost:9000/itziec-assets'),
    };

    mockSecretAdapter = {};

    service = new CompaniesService(
      mockPrisma,
      mockScopeService,
      mockAuditService,
      mockOutboxService,
      mockSecretAdapter,
      mockStorageService,
    );
  });

  it('uploads valid PNG logo successfully and increments version', async () => {
    const file: UploadedLogoFile = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: validPngBuffer.length,
      buffer: validPngBuffer,
    };

    const res = await service.uploadCompanyLogo(companyId, ownerUser, file, { expectedVersion: 3 });

    expect(res.version).toBe(4);
    expect(res.logoUrl).toContain('itziec-assets/companies/');
    expect(res.logoUrl).toMatch(/\.png$/);
    expect(mockStorageService.uploadPublicAsset).toHaveBeenCalledTimes(1);
    expect(mockPrisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: companyId, version: 3 },
        data: expect.objectContaining({
          version: { increment: 1 },
        }),
      }),
    );
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_LOGO_UPDATED',
        actorId: ownerUser.id,
        targetId: companyId,
      }),
      mockPrisma,
    );
  });

  it('uploads valid JPEG logo successfully with admin role', async () => {
    const file: UploadedLogoFile = {
      originalname: 'logo.jpg',
      mimetype: 'image/jpeg',
      size: validJpgBuffer.length,
      buffer: validJpgBuffer,
    };

    const res = await service.uploadCompanyLogo(companyId, adminUser, file);

    expect(res.version).toBe(4);
    expect(res.logoUrl).toMatch(/\.jpg$/);
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_LOGO_UPDATED',
        actorId: adminUser.id,
      }),
      mockPrisma,
    );
  });

  it('uploads valid WebP logo successfully', async () => {
    const file: UploadedLogoFile = {
      originalname: 'logo.webp',
      mimetype: 'image/webp',
      size: validWebpBuffer.length,
      buffer: validWebpBuffer,
    };

    const res = await service.uploadCompanyLogo(companyId, ownerUser, file);

    expect(res.version).toBe(4);
    expect(res.logoUrl).toMatch(/\.webp$/);
  });

  it('rejects missing or empty file with 400 VALIDATION_ERROR', async () => {
    await expect(service.uploadCompanyLogo(companyId, ownerUser, null as any)).rejects.toThrow(
      BadRequestException,
    );

    await expect(
      service.uploadCompanyLogo(companyId, ownerUser, {
        originalname: 'empty.png',
        mimetype: 'image/png',
        size: 0,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects file larger than 5 MiB with 413 FILE_TOO_LARGE', async () => {
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    // Add PNG header
    validPngBuffer.copy(oversizedBuffer, 0, 0, 8);

    const file: UploadedLogoFile = {
      originalname: 'huge.png',
      mimetype: 'image/png',
      size: oversizedBuffer.length,
      buffer: oversizedBuffer,
    };

    await expect(service.uploadCompanyLogo(companyId, ownerUser, file)).rejects.toThrow(
      PayloadTooLargeException,
    );
  });

  it('rejects unsupported MIME type with 415 INVALID_FILE_TYPE', async () => {
    const file: UploadedLogoFile = {
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
      size: validPngBuffer.length,
      buffer: validPngBuffer,
    };

    await expect(service.uploadCompanyLogo(companyId, ownerUser, file)).rejects.toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('rejects spoofed file where magic bytes do not match declared MIME type with 415', async () => {
    // Declared as image/png but payload is JPEG magic bytes
    const file: UploadedLogoFile = {
      originalname: 'fake.png',
      mimetype: 'image/png',
      size: validJpgBuffer.length,
      buffer: validJpgBuffer,
    };

    await expect(service.uploadCompanyLogo(companyId, ownerUser, file)).rejects.toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('rejects corrupted binary with invalid signature with 415', async () => {
    const corruptedBuffer = Buffer.from('NOT_AN_IMAGE_AT_ALL_JUST_RANDOM_TEXT');
    const file: UploadedLogoFile = {
      originalname: 'corrupt.png',
      mimetype: 'image/png',
      size: corruptedBuffer.length,
      buffer: corruptedBuffer,
    };

    await expect(service.uploadCompanyLogo(companyId, ownerUser, file)).rejects.toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('rejects stale expectedVersion with 409 VERSION_CONFLICT', async () => {
    const file: UploadedLogoFile = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: validPngBuffer.length,
      buffer: validPngBuffer,
    };

    await expect(
      service.uploadCompanyLogo(companyId, ownerUser, file, { expectedVersion: 1 }), // current is 3
    ).rejects.toThrow(ConflictException);

    expect(mockStorageService.uploadPublicAsset).not.toHaveBeenCalled();
  });

  it('rejects recruiter without OWNER role with 403 FORBIDDEN', async () => {
    const file: UploadedLogoFile = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: validPngBuffer.length,
      buffer: validPngBuffer,
    };

    await expect(service.uploadCompanyLogo(companyId, recruiterUser, file)).rejects.toThrow(
      ForbiddenException,
    );

    expect(mockStorageService.uploadPublicAsset).not.toHaveBeenCalled();
  });

  it('executes storage compensation if database update fails', async () => {
    mockPrisma.company.update.mockRejectedValue(new Error('Database deadlock'));

    const file: UploadedLogoFile = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: validPngBuffer.length,
      buffer: validPngBuffer,
    };

    await expect(service.uploadCompanyLogo(companyId, ownerUser, file)).rejects.toThrow(
      'Database deadlock',
    );

    // Verification: Newly uploaded asset must be cleaned up via deletePublicAsset
    expect(mockStorageService.uploadPublicAsset).toHaveBeenCalledTimes(1);
    expect(mockStorageService.deletePublicAsset).toHaveBeenCalledTimes(1);
    expect(mockStorageService.deletePublicAsset).toHaveBeenCalledWith(
      expect.stringMatching(/^companies\/11111111-1111-1111-1111-111111111111\//),
    );
  });

  it('cleans up old managed logo asset when replacing logo', async () => {
    const oldManagedLogo =
      'http://localhost:9000/itziec-assets/companies/11111111-1111-1111-1111-111111111111/old-logo-123.png';

    mockScopeService.assertOwnerOrAdmin.mockResolvedValue({
      ...mockCompany,
      logoUrl: oldManagedLogo,
    });

    const file: UploadedLogoFile = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: validPngBuffer.length,
      buffer: validPngBuffer,
    };

    await service.uploadCompanyLogo(companyId, ownerUser, file);

    // Verification: old logo asset must be deleted
    expect(mockStorageService.deletePublicAsset).toHaveBeenCalledWith(
      'companies/11111111-1111-1111-1111-111111111111/old-logo-123.png',
    );
  });
});
