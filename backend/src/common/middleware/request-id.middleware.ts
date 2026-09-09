import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-request-id'];
    let effectiveId: string;

    if (typeof rawHeader === 'string' && validateUuid(rawHeader)) {
      effectiveId = rawHeader;
    } else {
      effectiveId = uuidv4();
    }

    const rawTraceHeader = req.headers['x-trace-id'];
    const effectiveTraceId =
      typeof rawTraceHeader === 'string' && rawTraceHeader.trim()
        ? rawTraceHeader.trim()
        : effectiveId;

    req.requestId = effectiveId;
    (req as any).traceId = effectiveTraceId;
    res.setHeader('X-Request-Id', effectiveId);
    res.setHeader('X-Trace-Id', effectiveTraceId);
    next();
  }
}
