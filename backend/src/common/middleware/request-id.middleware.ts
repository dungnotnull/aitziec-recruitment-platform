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

    req.requestId = effectiveId;
    res.setHeader('X-Request-Id', effectiveId);
    next();
  }
}
