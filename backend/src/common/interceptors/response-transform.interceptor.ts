import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((body) => {
        // If 204 No Content, do not transform or send body
        if (res.statusCode === 204 || body === null || body === undefined) {
          return body;
        }

        const requestId = req.requestId;

        // If body already formatted with data & meta (e.g. CollectionResponse or custom)
        if (body && typeof body === 'object' && 'data' in body) {
          return {
            ...body,
            meta: {
              ...(body.meta || {}),
              requestId,
            },
          };
        }

        // Standard SuccessResponse wrap
        return {
          data: body,
          meta: {
            requestId,
          },
        };
      }),
    );
  }
}
