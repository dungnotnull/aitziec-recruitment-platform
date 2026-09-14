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
  BadRequestException,
  ConflictException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { QueueService, QueueInfrastructureError } from '../../src/queues/queue.service';
import { CvExtractionProcessor } from '../../src/cvs/workers/cv-extraction.processor';
import { IdempotencyService } from '../../src/idempotency';

describe('CvsService (Unit)', () => {
  let service: CvsService;
  let inMemoryPrisma: InMemoryPrismaService;
  let storageService: StorageService;
  let queueServiceMock: any;
  let outboxServiceMock: any;
  let processor: CvExtractionProcessor;

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

  const adminUser: AuthenticatedUser = {
    id: 'admin-user-1',
    email: 'admin@test.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  const hrUser: AuthenticatedUser = {
    id: 'hr-user-1',
    email: 'hr@test.com',
    role: 'HR',
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

    queueServiceMock = {
      addJob: jest.fn().mockResolvedValue({ id: 'mock-bull-job-1' }),
      registerWorker: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvsService,
        StorageService,
        AuditService,
        CompanyScopeService,
        CvExtractionProcessor,
        IdempotencyService,
        {
          provide: QueueService,
          useValue: queueServiceMock,
        },
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
    processor = module.get<CvExtractionProcessor>(CvExtractionProcessor);
    outboxServiceMock = module.get<OutboxService>(OutboxService);
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

    it('should successfully upload valid PDF, store in storage, and record metadata asynchronously', async () => {
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
      expect(result.cv.processingStatus).toBe('UPLOADED');
      expect(result.cv.checksumSha256).toBeDefined();
      expect(result.cv.latestOperationId).toBeDefined();
      expect(result.operation).toBeDefined();
      expect(result.operation.status).toBe('QUEUED');
      expect(queueServiceMock.addJob).toHaveBeenCalledWith(
        'cv-extraction-queue',
        'extract-cv-text',
        expect.objectContaining({
          cvId: result.cv.id,
          operationId: result.operation.id,
          actorId: candidateUser.id,
        }),
        expect.objectContaining({
          jobId: `cv-extraction:${result.operation.id}`,
        }),
      );

      // Verify in DB
      const dbCv = await inMemoryPrisma.cv.findUnique({ where: { id: result.cv.id } });
      expect(dbCv).not.toBeNull();
      expect(dbCv.candidateProfileId).toBe(candidateProfile.id);
      expect(dbCv.processingStatus).toBe('UPLOADED');
      expect(dbCv.isDefault).toBe(true);

      // Verify profile defaultCvId is synchronized on first upload
      const refreshedProfile = await inMemoryPrisma.candidateProfile.findUnique({
        where: { id: candidateProfile.id },
      });
      expect(refreshedProfile.defaultCvId).toBe(result.cv.id);

      // Second upload should NOT become default
      const secondFile = {
        originalname: 'resume2.pdf',
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        buffer: validPdfBuffer,
      };
      const secondResult = await service.uploadCv(candidateUser, secondFile as any);
      expect(secondResult.cv.isDefault).toBe(false);

      const profileAfterSecond = await inMemoryPrisma.candidateProfile.findUnique({
        where: { id: candidateProfile.id },
      });
      expect(profileAfterSecond.defaultCvId).toBe(result.cv.id);
    });
  });

  describe('setDefaultCv & Default-CV Invariant (BE-10-003)', () => {
    it('should reject setting a non-READY CV as default with CV_NOT_READY', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'unready.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-unready',
          storageKey: 'key-unready',
          processingStatus: 'UPLOADED',
          isDefault: false,
          version: 1,
        },
      });

      await expect(service.setDefaultCv(candidateUser, cv.id, 1)).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.setDefaultCv(candidateUser, cv.id, 1);
      } catch (err: any) {
        expect(err.response?.code).toBe('CV_NOT_READY');
      }
    });

    it('should reject non-existent, soft-deleted, or cross-owner CV with 404 RESOURCE_NOT_FOUND', async () => {
      inMemoryPrisma.candidateProfiles.push({
        id: 'cand-prof-other',
        userId: otherCandidateUser.id,
        fullName: 'Other Candidate',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const otherCv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: 'cand-prof-other',
          originalFileName: 'other.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-other',
          storageKey: 'key-other',
          processingStatus: 'READY',
          isDefault: false,
          version: 1,
        },
      });

      const deletedCv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'deleted.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-del',
          storageKey: 'key-del',
          processingStatus: 'DELETED',
          isDefault: false,
          version: 1,
        },
      });

      // Cross-owner -> 404 without existence leakage
      await expect(service.setDefaultCv(candidateUser, otherCv.id, 1)).rejects.toThrow(
        NotFoundException,
      );

      // Soft-deleted -> 404
      await expect(service.setDefaultCv(candidateUser, deletedCv.id, 1)).rejects.toThrow(
        NotFoundException,
      );

      // Non-existent UUID -> 404
      await expect(
        service.setDefaultCv(candidateUser, '00000000-0000-0000-0000-000000000000', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce version check on setDefaultCv', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-ver',
          storageKey: 'key-ver',
          processingStatus: 'READY',
          isDefault: false,
          version: 2,
        },
      });

      await expect(service.setDefaultCv(candidateUser, cv.id, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should toggle default CV and synchronize CandidateProfile.defaultCvId', async () => {
      const cv1 = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv1.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha1',
          storageKey: 'key1',
          processingStatus: 'READY',
          isDefault: true,
          version: 1,
        },
      });

      await inMemoryPrisma.candidateProfile.update({
        where: { id: candidateProfile.id },
        data: { defaultCvId: cv1.id },
      });

      const cv2 = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv2.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha2',
          storageKey: 'key2',
          processingStatus: 'READY',
          isDefault: false,
          version: 1,
        },
      });

      // Successful update
      const updated = await service.setDefaultCv(candidateUser, cv2.id, 1);
      expect(updated.isDefault).toBe(true);
      expect(updated.version).toBe(2);

      const refreshedCv1 = await inMemoryPrisma.cv.findUnique({ where: { id: cv1.id } });
      expect(refreshedCv1.isDefault).toBe(false);

      const refreshedProfile = await inMemoryPrisma.candidateProfile.findUnique({
        where: { id: candidateProfile.id },
      });
      expect(refreshedProfile.defaultCvId).toBe(cv2.id);
    });

    it('should reject two default CVs for one candidate at database constraint level', async () => {
      await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'def1.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-def1',
          storageKey: 'key-def1',
          processingStatus: 'READY',
          isDefault: true,
          version: 1,
        },
      });

      await expect(
        inMemoryPrisma.cv.create({
          data: {
            candidateProfileId: candidateProfile.id,
            originalFileName: 'def2.pdf',
            sizeBytes: 1000,
            checksumSha256: 'sha-def2',
            storageKey: 'key-def2',
            processingStatus: 'READY',
            isDefault: true,
            version: 1,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('deleteCv & Default Fallback Invariant (BE-10-003, BEI-002)', () => {
    it('should hard-delete unreferenced non-default CV and leave default untouched', async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/unref.pdf', buffer, 'application/pdf');

      const defaultCv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'default.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-def',
          storageKey: 'cvs/default.pdf',
          processingStatus: 'READY',
          isDefault: true,
          version: 1,
        },
      });

      await inMemoryPrisma.candidateProfile.update({
        where: { id: candidateProfile.id },
        data: { defaultCvId: defaultCv.id },
      });

      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'unref.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-unref',
          storageKey: 'cvs/unref.pdf',
          processingStatus: 'READY',
          isDefault: false,
          version: 1,
        },
      });

      await service.deleteCv(candidateUser, cv.id);

      const dbCv = await inMemoryPrisma.cv.findUnique({ where: { id: cv.id } });
      expect(dbCv).toBeNull();

      const profile = await inMemoryPrisma.candidateProfile.findUnique({
        where: { id: candidateProfile.id },
      });
      expect(profile.defaultCvId).toBe(defaultCv.id);
    });

    it('should fall back to newest eligible READY CV by createdAt DESC, id ASC when default CV is deleted', async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/old-default.pdf', buffer, 'application/pdf');

      // Older READY CV
      const olderReadyCv = await inMemoryPrisma.cv.create({
        data: {
          id: 'b-older-ready-cv',
          candidateProfileId: candidateProfile.id,
          originalFileName: 'older-ready.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-older',
          storageKey: 'cvs/older.pdf',
          processingStatus: 'READY',
          isDefault: false,
          version: 1,
        },
      });
      // Ensure older timestamp
      const olderCvRecord = inMemoryPrisma.cvs.find((c) => c.id === olderReadyCv.id);
      olderCvRecord.createdAt = new Date(Date.now() - 60000);

      // Newer READY CV
      const newerReadyCv = await inMemoryPrisma.cv.create({
        data: {
          id: 'a-newer-ready-cv',
          candidateProfileId: candidateProfile.id,
          originalFileName: 'newer-ready.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-newer',
          storageKey: 'cvs/newer.pdf',
          processingStatus: 'READY',
          isDefault: false,
          version: 1,
        },
      });
      const newerCvRecord = inMemoryPrisma.cvs.find((c) => c.id === newerReadyCv.id);
      newerCvRecord.createdAt = new Date(Date.now() - 10000);

      // Non-ready CV (should NOT be picked as default)
      await inMemoryPrisma.cv.create({
        data: {
          id: 'c-unready-cv',
          candidateProfileId: candidateProfile.id,
          originalFileName: 'unready.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-unready',
          storageKey: 'cvs/unready.pdf',
          processingStatus: 'UPLOADED',
          isDefault: false,
          version: 1,
        },
      });

      // Current default CV to be deleted
      const currentDefault = await inMemoryPrisma.cv.create({
        data: {
          id: 'd-current-default',
          candidateProfileId: candidateProfile.id,
          originalFileName: 'current-default.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-curr',
          storageKey: 'cvs/old-default.pdf',
          processingStatus: 'READY',
          isDefault: true,
          version: 1,
        },
      });

      await inMemoryPrisma.candidateProfile.update({
        where: { id: candidateProfile.id },
        data: { defaultCvId: currentDefault.id },
      });

      // Delete current default CV
      await service.deleteCv(candidateUser, currentDefault.id);

      // Verify newest READY CV (newerReadyCv) was selected as default
      const refreshedNewer = await inMemoryPrisma.cv.findUnique({ where: { id: newerReadyCv.id } });
      expect(refreshedNewer.isDefault).toBe(true);

      const refreshedOlder = await inMemoryPrisma.cv.findUnique({ where: { id: olderReadyCv.id } });
      expect(refreshedOlder.isDefault).toBe(false);

      const refreshedProfile = await inMemoryPrisma.candidateProfile.findUnique({
        where: { id: candidateProfile.id },
      });
      expect(refreshedProfile.defaultCvId).toBe(newerReadyCv.id);
    });

    it('should clear defaultCvId when default CV is deleted and no eligible READY CV exists', async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/lone-default.pdf', buffer, 'application/pdf');

      // Non-ready CV remaining
      const unreadyCv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'failed.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-failed',
          storageKey: 'cvs/failed.pdf',
          processingStatus: 'FAILED',
          isDefault: false,
          version: 1,
        },
      });

      const currentDefault = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'lone-default.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-lone',
          storageKey: 'cvs/lone-default.pdf',
          processingStatus: 'READY',
          isDefault: true,
          version: 1,
        },
      });

      await inMemoryPrisma.candidateProfile.update({
        where: { id: candidateProfile.id },
        data: { defaultCvId: currentDefault.id },
      });

      await service.deleteCv(candidateUser, currentDefault.id);

      const profile = await inMemoryPrisma.candidateProfile.findUnique({
        where: { id: candidateProfile.id },
      });
      expect(profile.defaultCvId).toBeNull();

      const remainingCv = await inMemoryPrisma.cv.findUnique({ where: { id: unreadyCv.id } });
      expect(remainingCv.isDefault).toBe(false);
    });

    it('should soft-delete CV to DELETED if referenced in an existing application and reconcile default', async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/referenced.pdf', buffer, 'application/pdf');

      const backupCv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'backup.pdf',
          sizeBytes: 1000,
          checksumSha256: 'sha-backup',
          storageKey: 'cvs/backup.pdf',
          processingStatus: 'READY',
          isDefault: false,
          version: 1,
        },
      });

      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'referenced.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-ref',
          storageKey: 'cvs/referenced.pdf',
          processingStatus: 'READY',
          isDefault: true,
          version: 1,
        },
      });

      await inMemoryPrisma.candidateProfile.update({
        where: { id: candidateProfile.id },
        data: { defaultCvId: cv.id },
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

      // Default should have fallen back to backupCv
      const profile = await inMemoryPrisma.candidateProfile.findUnique({
        where: { id: candidateProfile.id },
      });
      expect(profile.defaultCvId).toBe(backupCv.id);

      const refreshedBackup = await inMemoryPrisma.cv.findUnique({ where: { id: backupCv.id } });
      expect(refreshedBackup.isDefault).toBe(true);

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

  describe('getSignedDownloadUrl & CV Retention Reconciliation (BE-8-020)', () => {
    it('allows candidate to get signed download URL for their active CV', async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/active.pdf', buffer, 'application/pdf');

      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'active.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-active',
          storageKey: 'cvs/active.pdf',
          processingStatus: 'READY',
          isDefault: true,
          version: 1,
        },
      });

      const res = await service.getSignedDownloadUrl(candidateUser, cv.id);
      expect(res.url).toBeDefined();
      expect(res.expiresAt).toBeDefined();
    });

    it('denies candidate from downloading a soft-deleted CV', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'deleted.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-del',
          storageKey: 'cvs/deleted.pdf',
          processingStatus: 'DELETED',
          isDefault: false,
          version: 2,
        },
      });

      await expect(service.getSignedDownloadUrl(candidateUser, cv.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows authorized HR to download a soft-deleted CV referenced by their job application', async () => {
      const companyId = 'comp-cv-1';
      inMemoryPrisma.companies.push({
        id: companyId,
        slug: 'comp-cv-1',
        name: 'Comp CV',
        status: 'ACTIVE',
      });
      inMemoryPrisma.companyMemberships.push({
        id: 'mem-cv-1',
        companyId,
        userId: hrUser.id,
        role: 'RECRUITER',
      });

      const buffer = Buffer.from('%PDF-1.4 test');
      await storageService.putObject('cvs/soft-del.pdf', buffer, 'application/pdf');

      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'soft-del.pdf',
          sizeBytes: buffer.length,
          checksumSha256: 'sha-soft',
          storageKey: 'cvs/soft-del.pdf',
          processingStatus: 'DELETED',
          isDefault: false,
          version: 2,
        },
      });

      const job = await inMemoryPrisma.job.create({
        data: {
          id: 'job-cv-1',
          companyId,
          title: 'Dev',
          slug: 'dev-cv',
          description: 'd',
          requirements: 'r',
          location: 'Remote',
          workplaceType: 'REMOTE',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
          applicationDeadline: new Date(Date.now() + 86400000),
          status: 'PUBLISHED',
        },
      });

      await inMemoryPrisma.application.create({
        data: {
          id: 'app-cv-1',
          candidateId: candidateProfile.id,
          jobId: job.id,
          submittedCvId: cv.id,
          status: 'REVIEWING',
        },
      });

      const res = await service.getSignedDownloadUrl(hrUser, cv.id);
      expect(res.url).toBeDefined();
      expect(res.expiresAt).toBeDefined();
    });

    it('allows ADMIN to download a soft-deleted CV', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'soft-del-admin.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-admin',
          storageKey: 'cvs/soft-del-admin.pdf',
          processingStatus: 'DELETED',
          isDefault: false,
          version: 2,
        },
      });

      const res = await service.getSignedDownloadUrl(adminUser, cv.id);
      expect(res.url).toBeDefined();
      expect(res.expiresAt).toBeDefined();
    });
  });

  describe('CvExtractionProcessor', () => {
    it('should process job successfully and update cv to READY and operation to SUCCEEDED', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-processor-test',
          storageKey: 'cvs/test-proc.pdf',
          processingStatus: 'UPLOADED',
          extractionAttempts: 0,
        },
      });

      await storageService.uploadFile(
        cv.storageKey,
        Buffer.from(
          '%PDF-1.4\n1 0 obj\n<< /Title (My CV) >>\nendobj\n%%EOF Hello World CV Text Content',
        ),
        'application/pdf',
      );

      const op = await inMemoryPrisma.operation.create({
        data: {
          type: 'CV_TEXT_EXTRACTION',
          status: 'QUEUED',
          resultResourceType: 'CV',
          resultResourceId: cv.id,
          idempotencyKey: 'op-proc-test',
        },
      });

      await inMemoryPrisma.cv.update({
        where: { id: cv.id },
        data: { latestOperationId: op.id },
      });

      const job = {
        id: `cv-extraction:${op.id}`,
        data: {
          cvId: cv.id,
          operationId: op.id,
          actorId: candidateUser.id,
          requestId: 'req-proc-1',
        },
      };

      await processor.processJob(job as any);

      const updatedCv = await inMemoryPrisma.cv.findUnique({ where: { id: cv.id } });
      expect(updatedCv.processingStatus).toBe('READY');

      const updatedOp = await inMemoryPrisma.operation.findUnique({ where: { id: op.id } });
      expect(updatedOp.status).toBe('SUCCEEDED');
    });

    it('should handle extraction failure, set cv to FAILED and operation to FAILED', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-fail.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-processor-fail',
          storageKey: 'cvs/test-fail.pdf',
          processingStatus: 'UPLOADED',
          extractionAttempts: 0,
        },
      });

      const op = await inMemoryPrisma.operation.create({
        data: {
          type: 'CV_TEXT_EXTRACTION',
          status: 'QUEUED',
          resultResourceType: 'CV',
          resultResourceId: cv.id,
          idempotencyKey: 'op-fail-test',
        },
      });

      // Force getFile to reject with error
      jest
        .spyOn(storageService, 'getFile')
        .mockRejectedValueOnce(new Error('PDF extraction simulated crash'));

      const job = {
        id: `cv-extraction:${op.id}`,
        data: {
          cvId: cv.id,
          operationId: op.id,
          actorId: candidateUser.id,
          requestId: 'req-proc-fail',
        },
      };

      await processor.processJob(job as any);

      const failedCv = await inMemoryPrisma.cv.findUnique({ where: { id: cv.id } });
      expect(failedCv.processingStatus).toBe('FAILED');
      expect(failedCv.failureCode).toBe('EXTRACTION_FAILED');

      const failedOp = await inMemoryPrisma.operation.findUnique({ where: { id: op.id } });
      expect(failedOp.status).toBe('FAILED');

      jest.restoreAllMocks();
    });
  });

  describe('retryProcessing', () => {
    it('should reject if caller is not owner and not admin', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-other.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-other',
          storageKey: 'cvs/other.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      await expect(
        service.retryProcessing(otherCandidateUser, cv.id, 'idem-key-unauth-attempt-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if cv status is not FAILED (e.g. READY)', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-ready.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-ready',
          storageKey: 'cvs/ready.pdf',
          processingStatus: 'READY',
          extractionAttempts: 1,
        },
      });

      await expect(
        service.retryProcessing(candidateUser, cv.id, 'idem-key-ready-status-chk-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if cv is already processing (UPLOADED)', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-proc.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-proc',
          storageKey: 'cvs/proc.pdf',
          processingStatus: 'UPLOADED',
          extractionAttempts: 1,
        },
      });

      await expect(
        service.retryProcessing(candidateUser, cv.id, 'idem-key-proc-status-chk-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if extraction attempts reached maximum (3)', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-max.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-max',
          storageKey: 'cvs/max.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 3,
        },
      });

      await expect(
        service.retryProcessing(candidateUser, cv.id, 'idem-key-max-attempts-chk-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should replay existing operation if same idempotencyKey is used', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-idem.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-idem',
          storageKey: 'cvs/idem.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      const op = await inMemoryPrisma.operation.create({
        data: {
          type: 'CV_TEXT_EXTRACTION',
          status: 'QUEUED',
          resultResourceType: 'CV',
          resultResourceId: cv.id,
          idempotencyKey: 'idem-key-repeat-attempt-1',
        },
      });

      await inMemoryPrisma.cv.update({
        where: { id: cv.id },
        data: { latestOperationId: op.id },
      });

      const res = await service.retryProcessing(candidateUser, cv.id, 'idem-key-repeat-attempt-1');
      expect(res.operation.id).toBe(op.id);
      expect(res.cv.id).toBe(cv.id);
      expect(queueServiceMock.addJob).not.toHaveBeenCalledWith(
        'cv-extraction-queue',
        'extract-cv-text',
        expect.objectContaining({ operationId: op.id }),
        expect.anything(),
      );
    });

    it('should successfully schedule retry, create new operation, and enqueue job', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-valid-retry.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-valid-retry',
          storageKey: 'cvs/valid-retry.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      const result = await service.retryProcessing(
        candidateUser,
        cv.id,
        'idem-key-fresh-attempt-1',
      );

      expect(result.cv.processingStatus).toBe('UPLOADED');
      expect(result.operation.status).toBe('QUEUED');
      expect(result.operation.idempotencyKey).toBe('idem-key-fresh-attempt-1');
      expect(queueServiceMock.addJob).toHaveBeenCalledWith(
        'cv-extraction-queue',
        'extract-cv-text',
        expect.objectContaining({
          cvId: cv.id,
          operationId: result.operation.id,
          actorId: candidateUser.id,
        }),
        expect.objectContaining({
          jobId: `cv-extraction:${result.operation.id}`,
        }),
      );

      const dbCv = await inMemoryPrisma.cv.findUnique({ where: { id: cv.id } });
      expect(dbCv.processingStatus).toBe('UPLOADED');
      expect(dbCv.latestOperationId).toBe(result.operation.id);

      // Replay check via IdempotencyService
      const replayed = await service.retryProcessing(
        candidateUser,
        cv.id,
        'idem-key-fresh-attempt-1',
      );
      expect(replayed.operation.id).toBe(result.operation.id);
      expect(replayed.cv.id).toBe(result.cv.id);
    });

    it('should allow admin to retry processing for candidate cv', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-admin-retry.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-admin-retry',
          storageKey: 'cvs/admin-retry.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      const result = await service.retryProcessing(adminUser, cv.id, 'idem-key-admin-attempt-1');
      expect(result.cv.processingStatus).toBe('UPLOADED');
      expect(result.operation.status).toBe('QUEUED');
    });

    it('should reject with 400 VALIDATION_ERROR on short or invalid idempotency key', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-short.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-short',
          storageKey: 'cvs/short.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      await expect(service.retryProcessing(candidateUser, cv.id, 'short-key')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject with 409 IDEMPOTENCY_KEY_REUSED if same key used for different cv', async () => {
      const cv1 = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-tamper-1.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-tamper-1',
          storageKey: 'cvs/tamper-1.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      const cv2 = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-tamper-2.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-tamper-2',
          storageKey: 'cvs/tamper-2.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      const key = 'idem-key-cross-cv-attempt-1';
      await service.retryProcessing(candidateUser, cv1.id, key);

      // Now reuse same key for cv2
      await expect(service.retryProcessing(candidateUser, cv2.id, key)).rejects.toThrow(
        ConflictException,
      );
    });

    it('handles queue infrastructure failure during retryProcessing: persists QUEUED operation and outbox, does not fail HTTP request (BE-10-009)', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-qfail.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-qfail',
          storageKey: 'cvs/qfail.pdf',
          processingStatus: 'FAILED',
          extractionAttempts: 1,
        },
      });

      // Simulate Redis / BullMQ failure
      queueServiceMock.addJob.mockRejectedValueOnce(
        new QueueInfrastructureError('cv-extraction-queue', new Error('Redis connection refused')),
      );

      const res = await service.retryProcessing(
        candidateUser,
        cv.id,
        'idem-key-redis-down-attempt-1',
      );

      expect(res.cv.processingStatus).toBe('UPLOADED');
      expect(res.operation.status).toBe('QUEUED');

      // Verify outbox event is recorded and pending
      expect(outboxServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventName: 'CvExtractionRetryQueued',
          aggregateId: cv.id,
          payload: expect.objectContaining({
            operationId: res.operation.id,
          }),
        }),
      );
    });

    it('reconciles stale QUEUED operations without creating new logical runs (BE-10-009)', async () => {
      const cv = await inMemoryPrisma.cv.create({
        data: {
          candidateProfileId: candidateProfile.id,
          originalFileName: 'cv-stale.pdf',
          sizeBytes: 100,
          checksumSha256: 'sha-stale',
          storageKey: 'cvs/stale.pdf',
          processingStatus: 'UPLOADED',
          extractionAttempts: 1,
        },
      });

      const staleDate = new Date(Date.now() - 120000); // 2 minutes ago
      const op = await inMemoryPrisma.operation.create({
        data: {
          userId: candidateUser.id,
          type: 'CV_TEXT_EXTRACTION',
          status: 'QUEUED',
          resultResourceType: 'CV',
          resultResourceId: cv.id,
          idempotencyKey: 'op-stale-test-1',
        },
      });
      // Set createdAt to stale past
      op.createdAt = staleDate;

      const reconciledCount = await service.reconcileStaleQueuedOperations(60000);
      expect(reconciledCount).toBe(1);

      // Verify job republished with same operationId and deterministic jobId
      expect(queueServiceMock.addJob).toHaveBeenCalledWith(
        'cv-extraction-queue',
        'extract-cv-text',
        expect.objectContaining({
          cvId: cv.id,
          operationId: op.id,
          actorId: candidateUser.id,
        }),
        expect.objectContaining({
          jobId: `cv-extraction:${op.id}`,
        }),
      );

      // Total operations count remains 1 (no new logical run created)
      const allOps = inMemoryPrisma.operations.filter((o: any) => o.resultResourceId === cv.id);
      expect(allOps.length).toBe(1);
      expect(allOps[0].id).toBe(op.id);
    });
  });
});
