import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ERROR_CODES, ErrorCode } from '../constants/error-codes';
import { ErrorResponse, FieldError } from '../dto/response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      request.requestId ||
      (typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : uuidv4());

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = 'An unexpected internal error occurred.';
    let details: FieldError[] | Record<string, unknown> | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (resObj.code && typeof resObj.code === 'string') {
          code = resObj.code as ErrorCode;
        } else {
          code = this.mapStatusToErrorCode(status);
        }

        if (resObj.message) {
          if (Array.isArray(resObj.message)) {
            message = 'The request contains invalid fields.';
            details = (resObj.details || resObj.message) as FieldError[] | Record<string, unknown>;
          } else {
            message = String(resObj.message);
          }
        }
        if (resObj.details) {
          details = resObj.details as FieldError[] | Record<string, unknown>;
        }
      }
    } else {
      this.logger.error(
        `[UnhandledException] requestId=${requestId} url=${request.url} method=${request.method}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Ensure header X-Request-Id is sent
    response.setHeader('X-Request-Id', requestId);

    const errorBody: ErrorResponse = {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(status).json(errorBody);
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.AUTHENTICATION_REQUIRED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.VERSION_CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMITED;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }
}
