import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxRequests = 20; // 20 requests per minute
  private readonly hits = new Map<string, RateLimitRecord>();

  canActivate(context: ExecutionContext): boolean {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = this.hits.get(ip);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.hits.set(ip, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, this.maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > this.maxRequests) {
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Rate limit exceeded. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
