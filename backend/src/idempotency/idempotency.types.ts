import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ERROR_CODES } from '../common/constants/error-codes';

export type IdempotencyStatusType = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface ClaimIdempotencyParams {
  actorId: string;
  method: string;
  route: string;
  key: string;
  params?: Record<string, unknown>;
  body?: unknown;
  ttlMs?: number;
  abandonTimeoutMs?: number;
}

export type ClaimResult =
  | {
      type: 'CLAIMED';
      recordId: string;
    }
  | {
      type: 'REPLAY';
      recordId: string;
      responseStatus: number;
      responseBody: unknown;
    };

const IDEMPOTENCY_KEY_REGEX = /^[\x21-\x7E]{16,128}$/;

export function validateIdempotencyKey(key?: string): string {
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new BadRequestException({
      code: ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      message: 'Idempotency-Key header is required.',
    });
  }

  const trimmed = key.trim();
  if (!IDEMPOTENCY_KEY_REGEX.test(trimmed)) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Idempotency-Key must consist of 16 to 128 printable ASCII characters.',
    });
  }

  return trimmed;
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const k of keys) {
    sortedObj[k] = canonicalize((value as Record<string, unknown>)[k]);
  }
  return sortedObj;
}

export function computeRequestHash(params?: Record<string, unknown>, body?: unknown): string {
  const canonicalParams = params ? canonicalize(params) : {};
  const canonicalBody = body !== undefined ? canonicalize(body) : null;
  const payload = JSON.stringify({
    params: canonicalParams,
    body: canonicalBody,
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}
