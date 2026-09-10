import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../common/constants/error-codes';

export class CvNotReadyException extends HttpException {
  constructor(message = 'CV text extraction has not completed yet.') {
    super(
      {
        code: ERROR_CODES.CV_NOT_READY,
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class AiOutputInvalidException extends HttpException {
  constructor(message = 'AI model response could not be validated against required schema.') {
    super(
      {
        code: ERROR_CODES.AI_OUTPUT_INVALID,
        message,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class AiUpstreamUnavailableException extends HttpException {
  constructor(message = 'AI service provider is temporarily unavailable.') {
    super(
      {
        code: ERROR_CODES.UPSTREAM_UNAVAILABLE,
        message,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class AiRateLimitedException extends HttpException {
  constructor(message = 'AI service rate limit exceeded. Please retry later.') {
    super(
      {
        code: ERROR_CODES.RATE_LIMITED,
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
