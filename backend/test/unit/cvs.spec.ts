import { Test, TestingModule } from '@nestjs/testing';
import { CvsService } from '../../src/cvs/cvs.service';
import { StorageService } from '../../src/storage/storage.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CompanyScopeService } from '../../src/companies/company-scope.service';
import { AuditService } from '../../src/audit/audit.service';
import { OutboxService } from '../../src/outbox/outbox.service';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';
import {
  ConflictException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

describe('CvsService (Unit)', () => {
  let service: CvsService;
  let inMemoryPrisma: InMemoryPrismaService;
  let storageService: StorageService;

  const candidateUser: AuthenticatedUser = {
    id: 'cand-user-1',
    email: 'cand@test.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const otherCandidateUser: AuthenticatedUser = {
    id: 'cand-user-2',
    email: 'cand2@test.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const candidateProfile = {
    id: 'cand-prof-1',
    userId: 'cand-user-1',
    fullName: 'Test Candidate',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    inMemoryPrisma = new InMemoryPrismaService();
    inMemoryPrisma.candidateProfiles.push({ ...candidateProfile });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvsService,
        StorageService,
        AuditService,
        CompanyScopeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: any) => defaultVal),
          },
        },
        {
          provide: OutboxService,
          useValue: {
            recordEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
            emitEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
          },
        },
        {
          provide: PrismaService,
          useValue: inMemoryPrisma,
        },
      ],
    }).compile();

    service = module.get<CvsService>(CvsService);
    storageService = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    inMemoryPrisma.reset();
  });

  describe('uploadCv', () => {
    it('should reject non-PDF file extension or mimetype', async () => {
      const txtFile = {
        originalname: 'cv.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Plain text content'),
      };

      await expect(service.uploadCv(candidateUser, txtFile as any)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('should reject file that has .pdf extension but lacks %PDF magic bytes', async () => {
      const fakePdf = {
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('NOT A PDF FILE BUFFER'),
      };

      await expect(service.uploadCv(candidateUser, fakePdf as any)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reject file exceeding 10 MiB limit', async () => {
      const largePdf = {
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024,
        buffer: Buffer.concat([Buffer.from('%PDF-1.4 header'), Buffer.alloc(100)]),
      };

      await expect(service.uploadCv(candidateUser, largePdf as any)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('should successfully upload valid PDF, store in storage, and record metadata', async () => {
      const validPdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (My CV) >>\nendobj\n%%EOF'),
      ]);

      const file = {
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        buffer: validPdfBuffer,
      };

      const result = await service.uploadCv(candidateUser, file as any);

      expect(result.cv).toBeDefined();
      expect(result.cv.originalFileName).toBe('resume.pdf');
      expect(result.cv.mimeType).toBe('application/pdf');
      expect(result.cv.processingStatus).toBe('READY');
      expect(result.cv.checksumSha256).toBeDefined();
      expect(result.operation).toBeDefined();

      // Verify in DB
      const dbCv = await inMemoryPrisma.cv.findUnique({ where: { id: result.cv.id } });
      expect(dbCv).not.toBeNull();
      expect(dbCv.candidateProfileId).toBe(candidateProfile.id);
    });
  });

  describe('setDefaultCv', () => {
    it('should toggle default CV and enforce version check', async () => {
      const cv1 = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv1.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha1',
          storageKey: 'key1',
          isDefault: true,
          version: 1,
        },
      });

      const cv2 = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv2.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha2',
          storageKey: 'key2',
          isDefault: false,
          version: 1,
        },
      });

      // Wrong expectedVersion -> 409
      await expect(service.setDefaultCv(candidateUser, cv2.id, 99)).rejects.toThrow(
        ConflictException,
      );

      // Successful update
      const updated = await service.setDefaultCv(candidateUser, cv2.id, 1);
      expect(updated.isDefault).toBe(true);

      const refreshedCv1 = await inMemoryPrisma.cv.findUnique({ where: { id: cv1.id } });
      expect(refreshedCv1.isDefault).toBe(false);
    });
  });

  describe('deleteCv (BEI-002 decision)', () => {
    it('should hard-delete unreferenced CV from database and storage', async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/unref.pdf', buffer, 'application/pdf');

      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'unref.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-unref',
          storageKey: 'cvs/unref.pdf',
          isDefault: false,
          version: 1,
        },
      });

      await service.deleteCv(candidateUser, cv.id);

      const dbCv = await inMemoryPrisma.cv.findUnique({ where: { id: cv.id } });
      expect(dbCv).toBeNull();
    });

    it('should soft-delete CV to DELETED if referenced in an existing application', async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/referenced.pdf', buffer, 'application/pdf');

      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'referenced.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-ref',
          storageKey: 'cvs/referenced.pdf',
          isDefault: true,
          version: 1,
        },
      });

      // Create referencing application
      await inMemoryPrisma.application.create({
        data: {
          candidateId: candidateProfile.id,
          jobId: 'job-1',
          submittedCvId: cv.id,
          status: 'APPLIED',
        },
      });

      await service.deleteCv(candidateUser, cv.id);

      const dbCv = await inMemoryPrisma.cv.findUnique({ where: { id: cv.id } });
      expect(dbCv).not.toBeNull();
      expect(dbCv.processingStatus).toBe('DELETED');
      expect(dbCv.isDefault).toBe(false);

      // File in storage is retained for recruiter inspection
      const exists = await storageService.objectExists('cvs/referenced.pdf');
      expect(exists).toBe(true);
    });

    it('should forbid candidate from deleting another candidate CV', async () => {
      inMemoryPrisma.candidateProfiles.push({
        id: 'cand-prof-2',
        userId: otherCandidateUser.id,
        fullName: 'Other Candidate',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cand1.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha',
          storageKey: 'key',
        },
      });

      await expect(service.deleteCv(otherCandidateUser, cv.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should generate signed URL for candidate owner', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cand1.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha',
          storageKey: 'key-1',
        },
      });

      const res = await service.getSignedDownloadUrl(candidateUser, cv.id);
      expect(res.url).toBeDefined();
      expect(res.expiresAt).toBeDefined();
    });
  });
});
