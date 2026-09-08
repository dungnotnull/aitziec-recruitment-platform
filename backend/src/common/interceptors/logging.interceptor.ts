import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url, requestId } = req;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${url} ${res.statusCode} +${duration}ms [requestId=${requestId}]`,
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ${err.status || 500} +${duration}ms [requestId=${requestId}]: ${err.message}`,
          );
        },
      }),
    );
  }
}
