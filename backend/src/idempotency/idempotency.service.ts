import { Injectable, ConflictException, Logger, Optional, Inject } from '@nestjs/common';
import { Prisma, IdempotencyRecord } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import {
  ClaimIdempotencyParams,
  ClaimResult,
  computeRequestHash,
  validateIdempotencyKey,
} from './idempotency.types';

export const IDEMPOTENCY_CLOCK = 'IDEMPOTENCY_CLOCK';

export interface Clock {
  now(): Date;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_ABANDON_TIMEOUT_MS = 30 * 1000; // 30 seconds
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_WAIT_TIMEOUT_MS = 3000;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly clock: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(IDEMPOTENCY_CLOCK) clock?: Clock,
  ) {
    this.clock = clock || { now: () => new Date() };
  }

  validateKey(key?: string): string {
    return validateIdempotencyKey(key);
  }

  computeHash(params?: Record<string, unknown>, body?: unknown): string {
    return computeRequestHash(params, body);
  }

  async claimOrReplay(params: ClaimIdempotencyParams): Promise<ClaimResult> {
    const validatedKey = this.validateKey(params.key);
    const requestHash = this.computeHash(params.params, params.body);
    const normalizedMethod = params.method.toUpperCase();
    const normalizedRoute = params.route.toLowerCase();

    const ttl = params.ttlMs ?? DEFAULT_TTL_MS;
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + ttl);

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_method_route_key: {
          actorId: params.actorId,
          method: normalizedMethod,
          route: normalizedRoute,
          key: validatedKey,
        },
      },
    });

    if (!existing) {
      try {
        const created = await this.prisma.idempotencyRecord.create({
          data: {
            actorId: params.actorId,
            method: normalizedMethod,
            route: normalizedRoute,
            key: validatedKey,
            requestHash,
            status: 'IN_PROGRESS',
            expiresAt,
          },
        });
        return { type: 'CLAIMED', recordId: created.id };
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === 'P2002') {
          return this.handleExisting(
            params,
            validatedKey,
            normalizedMethod,
            normalizedRoute,
            requestHash,
            now,
            expiresAt,
          );
        }
        throw err;
      }
    }

    return this.handleExistingRecord(existing, params, requestHash, now, expiresAt);
  }

  private async handleExisting(
    params: ClaimIdempotencyParams,
    validatedKey: string,
    method: string,
    route: string,
    requestHash: string,
    now: Date,
    expiresAt: Date,
  ): Promise<ClaimResult> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_method_route_key: {
          actorId: params.actorId,
          method,
          route,
          key: validatedKey,
        },
      },
    });

    if (!existing) {
      const created = await this.prisma.idempotencyRecord.create({
        data: {
          actorId: params.actorId,
          method,
          route,
          key: validatedKey,
          requestHash,
          status: 'IN_PROGRESS',
          expiresAt,
        },
      });
      return { type: 'CLAIMED', recordId: created.id };
    }

    return this.handleExistingRecord(existing, params, requestHash, now, expiresAt);
  }

  private async handleExistingRecord(
    existing: IdempotencyRecord,
    params: ClaimIdempotencyParams,
    requestHash: string,
    now: Date,
    expiresAt: Date,
  ): Promise<ClaimResult> {
    // 1. Check if record has expired past the 24-hour retention window
    if (new Date(existing.expiresAt) <= now) {
      const updated = await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: {
          requestHash,
          status: 'IN_PROGRESS',
          responseStatus: null,
          responseBody: Prisma.DbNull,
          expiresAt,
        },
      });
      return { type: 'CLAIMED', recordId: updated.id };
    }

    // 2. Different request hash with the same key -> 409 IDEMPOTENCY_KEY_REUSED
    if (existing.requestHash !== requestHash) {
      throw new ConflictException({
        code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        message: 'Idempotency key has already been used with a different request payload.',
      });
    }

    // 3. Identical request hash
    if (existing.status === 'COMPLETED') {
      return {
        type: 'REPLAY',
        recordId: existing.id,
        responseStatus: existing.responseStatus ?? 200,
        responseBody: existing.responseBody,
      };
    }

    if (existing.status === 'FAILED') {
      // Prior mutation failed, allow safe retry with the same key
      const updated = await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: {
          status: 'IN_PROGRESS',
          expiresAt,
        },
      });
      return { type: 'CLAIMED', recordId: updated.id };
    }

    // 4. Record is currently IN_PROGRESS
    const abandonTimeout = params.abandonTimeoutMs ?? DEFAULT_ABANDON_TIMEOUT_MS;
    const updatedAt = new Date(existing.updatedAt).getTime();
    const isAbandoned = now.getTime() - updatedAt > abandonTimeout;

    if (isAbandoned) {
      // Deterministically recover abandoned claim without logging key or body
      this.logger.warn('Recovered abandoned in-progress idempotency claim');
      const updated = await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: {
          status: 'IN_PROGRESS',
          expiresAt,
        },
      });
      return { type: 'CLAIMED', recordId: updated.id };
    }

    // Poll briefly for in-progress completion
    const waitTimeout = DEFAULT_WAIT_TIMEOUT_MS;
    const startTime = Date.now();
    let current: IdempotencyRecord | null = existing;

    while (Date.now() - startTime < waitTimeout) {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
      current = await this.prisma.idempotencyRecord.findUnique({
        where: { id: existing.id },
      });

      if (!current || current.status !== 'IN_PROGRESS') {
        break;
      }
    }

    if (current && current.status === 'COMPLETED') {
      return {
        type: 'REPLAY',
        recordId: current.id,
        responseStatus: current.responseStatus ?? 200,
        responseBody: current.responseBody,
      };
    }

    throw new ConflictException({
      code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      message: 'A request with this idempotency key is currently in progress.',
    });
  }

  async complete(
    recordId: string,
    responseStatus: number,
    responseBody: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    await client.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'COMPLETED',
        responseStatus,
        responseBody: (responseBody as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  }

  async fail(recordId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'FAILED',
      },
    });
  }

  async cleanupExpired(now?: Date): Promise<number> {
    const cutoff = now || this.clock.now();
    const res = await this.prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: { lt: cutoff },
      },
    });
    return res.count;
  }
}
