import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  IdempotencyService,
  IDEMPOTENCY_CLOCK,
  Clock,
} from '../../src/idempotency/idempotency.service';
import {
  computeRequestHash,
  validateIdempotencyKey,
} from '../../src/idempotency/idempotency.types';
import { PrismaService } from '../../src/database/prisma.service';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';

describe('IdempotencyService (Unit) — BE-10-004', () => {
  let service: IdempotencyService;
  let inMemoryPrisma: InMemoryPrismaService;
  let currentTime: Date;

  const mockClock: Clock = {
    now: () => currentTime,
  };

  const actorId = 'user-actor-1';
  const otherActorId = 'user-actor-2';
  const method = 'POST';
  const route = '/api/v1/jobs/123/applications';
  const validKey = 'idempotency-key-test-123456'; // 27 chars, printable ASCII

  beforeEach(async () => {
    inMemoryPrisma = new InMemoryPrismaService();
    currentTime = new Date('2026-09-12T10:00:00.000Z');
    inMemoryPrisma.clock = () => currentTime;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: PrismaService,
          useValue: inMemoryPrisma,
        },
        {
          provide: IDEMPOTENCY_CLOCK,
          useValue: mockClock,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  describe('Key Validation & Canonical Hashing', () => {
    it('should reject missing or whitespace-only key with 400 IDEMPOTENCY_KEY_REQUIRED', () => {
      expect(() => validateIdempotencyKey(undefined)).toThrow(BadRequestException);
      expect(() => validateIdempotencyKey('')).toThrow(BadRequestException);
      expect(() => validateIdempotencyKey('   ')).toThrow(BadRequestException);

      try {
        validateIdempotencyKey('');
      } catch (err: any) {
        expect(err.response?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      }
    });

    it('should reject keys with fewer than 16 or more than 128 characters with 400 VALIDATION_ERROR', () => {
      // 15 characters (too short)
      expect(() => validateIdempotencyKey('123456789012345')).toThrow(BadRequestException);

      // 129 characters (too long)
      const longKey = 'a'.repeat(129);
      expect(() => validateIdempotencyKey(longKey)).toThrow(BadRequestException);

      try {
        validateIdempotencyKey('short');
      } catch (err: any) {
        expect(err.response?.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject keys with non-printable ASCII or control characters', () => {
      // Key with spaces inside
      expect(() => validateIdempotencyKey('key with spaces 123456')).toThrow(BadRequestException);

      // Key with Unicode characters
      expect(() => validateIdempotencyKey('key-with-unicode-⚡-1234')).toThrow(BadRequestException);

      // Key with tab / newline
      expect(() => validateIdempotencyKey('key-with-\t-tab-123456')).toThrow(BadRequestException);
    });

    it('should accept valid 16-128 printable ASCII keys', () => {
      const minKey = '1234567890123456'; // 16 chars
      expect(validateIdempotencyKey(minKey)).toBe(minKey);

      const maxKey = 'x'.repeat(128); // 128 chars
      expect(validateIdempotencyKey(maxKey)).toBe(maxKey);

      const complexKey = 'my-App:client-uuid_1234~v1.0';
      expect(validateIdempotencyKey(complexKey)).toBe(complexKey);
    });

    it('should produce identical hash regardless of key order in params or body', () => {
      const hash1 = computeRequestHash(
        { b: 'val-b', a: 'val-a' },
        { z: 1, y: { nestedB: true, nestedA: false } },
      );

      const hash2 = computeRequestHash(
        { a: 'val-a', b: 'val-b' },
        { y: { nestedA: false, nestedB: true }, z: 1 },
      );

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // SHA-256 hex
    });

    it('should produce different hash when payload changes', () => {
      const hash1 = computeRequestHash(undefined, { field: 'value1' });
      const hash2 = computeRequestHash(undefined, { field: 'value2' });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Claim, Replay & Lifecycle Flow', () => {
    it('should claim key on first attempt and return CLAIMED with recordId', async () => {
      const result = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { note: 'test' },
      });

      expect(result.type).toBe('CLAIMED');
      expect(result.recordId).toBeDefined();

      const record = await inMemoryPrisma.idempotencyRecord.findUnique({
        where: { id: result.recordId },
      });
      expect(record).not.toBeNull();
      expect(record.status).toBe('IN_PROGRESS');
      expect(record.actorId).toBe(actorId);
      expect(record.method).toBe(method);
      expect(record.route).toBe(route);
      expect(record.key).toBe(validKey);
    });

    it('should replay original response for identical completed request', async () => {
      const claim = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { candidateNote: 'hello' },
      });
      expect(claim.type).toBe('CLAIMED');

      const responsePayload = { id: 'app-created-1', status: 'APPLIED' };
      await service.complete(claim.recordId, 201, responsePayload);

      // Replay with identical body and key
      const replay = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { candidateNote: 'hello' },
      });

      expect(replay.type).toBe('REPLAY');
      if (replay.type === 'REPLAY') {
        expect(replay.responseStatus).toBe(201);
        expect(replay.responseBody).toEqual(responsePayload);
      }
    });

    it('should reject reused key with different payload with 409 IDEMPOTENCY_KEY_REUSED', async () => {
      const claim = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { candidateNote: 'original' },
      });
      await service.complete(claim.recordId, 201, { success: true });

      // Reuse key with different payload
      await expect(
        service.claimOrReplay({
          actorId,
          method,
          route,
          key: validKey,
          body: { candidateNote: 'tampered' },
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.claimOrReplay({
          actorId,
          method,
          route,
          key: validKey,
          body: { candidateNote: 'tampered' },
        });
      } catch (err: any) {
        expect(err.response?.code).toBe('IDEMPOTENCY_KEY_REUSED');
      }
    });

    it('should allow two different actors to safely use the same key without conflict', async () => {
      const claim1 = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { note: 'actor 1' },
      });
      expect(claim1.type).toBe('CLAIMED');
      await service.complete(claim1.recordId, 200, { user: 1 });

      const claim2 = await service.claimOrReplay({
        actorId: otherActorId,
        method,
        route,
        key: validKey,
        body: { note: 'actor 2' },
      });
      expect(claim2.type).toBe('CLAIMED');
      await service.complete(claim2.recordId, 200, { user: 2 });

      expect(claim1.recordId).not.toBe(claim2.recordId);
    });

    it('should allow the same actor to use the same key on different routes or methods', async () => {
      const claimRoute1 = await service.claimOrReplay({
        actorId,
        method: 'POST',
        route: '/api/v1/jobs/1/applications',
        key: validKey,
      });
      expect(claimRoute1.type).toBe('CLAIMED');
      await service.complete(claimRoute1.recordId, 201, { res: 1 });

      const claimRoute2 = await service.claimOrReplay({
        actorId,
        method: 'POST',
        route: '/api/v1/jobs/2/applications',
        key: validKey,
      });
      expect(claimRoute2.type).toBe('CLAIMED');
      await service.complete(claimRoute2.recordId, 201, { res: 2 });
    });

    it('should allow retry if previous attempt failed via fail()', async () => {
      const claim = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { attempt: 1 },
      });
      expect(claim.type).toBe('CLAIMED');

      // Mark failed
      await service.fail(claim.recordId);

      // Subsequent call with same key and body should succeed claiming
      const retryClaim = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { attempt: 1 },
      });
      expect(retryClaim.type).toBe('CLAIMED');
    });
  });

  describe('Concurrency, Recovery & Expiry', () => {
    it('should recover from abandoned in-progress claim past abandonTimeoutMs', async () => {
      // First claim at T0
      const claim1 = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { task: 'heavy' },
        abandonTimeoutMs: 10000, // 10s
      });
      expect(claim1.type).toBe('CLAIMED');

      // Simulate crash: process never called complete() or fail()
      // Advance clock by 15 seconds (past 10s abandon timeout)
      currentTime = new Date(currentTime.getTime() + 15000);

      // New claim with same key and body should take over the abandoned record
      const claim2 = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { task: 'heavy' },
        abandonTimeoutMs: 10000,
      });

      expect(claim2.type).toBe('CLAIMED');
      expect(claim2.recordId).toBe(claim1.recordId);
    });

    it('should allow new claim when previous record has expired past 24 hours', async () => {
      const claim1 = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { msg: 'day 1' },
      });
      await service.complete(claim1.recordId, 200, { day: 1 });

      // Advance clock by 24 hours + 1 minute
      currentTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000 + 60000);

      // Now the key is past expiry: can be claimed anew even with a different payload
      const claim2 = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { msg: 'day 2 new payload' },
      });

      expect(claim2.type).toBe('CLAIMED');
    });

    it('should cleanup expired records with cleanupExpired()', async () => {
      const claim1 = await service.claimOrReplay({
        actorId,
        method,
        route,
        key: validKey,
        body: { test: 1 },
        ttlMs: 1000, // 1s TTL
      });
      await service.complete(claim1.recordId, 200, {});

      // Advance clock past 1s TTL
      currentTime = new Date(currentTime.getTime() + 2000);

      const deletedCount = await service.cleanupExpired(currentTime);
      expect(deletedCount).toBe(1);

      const record = await inMemoryPrisma.idempotencyRecord.findUnique({
        where: { id: claim1.recordId },
      });
      expect(record).toBeNull();
    });
  });
});
