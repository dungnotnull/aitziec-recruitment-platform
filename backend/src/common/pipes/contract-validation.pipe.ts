import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes';
import { FieldError } from '../dto/response.dto';

export class ContractValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const fieldErrors: FieldError[] = [];

        const extractErrors = (errs: ValidationError[], parent = '') => {
          for (const err of errs) {
            const fieldPath = parent ? `${parent}.${err.property}` : err.property;
            if (err.constraints) {
              for (const [rule, msg] of Object.entries(err.constraints)) {
                fieldErrors.push({
                  field: fieldPath,
                  code: rule.toUpperCase(),
                  message: msg,
                });
              }
            }
            if (err.children && err.children.length > 0) {
              extractErrors(err.children, fieldPath);
            }
          }
        };

        extractErrors(errors);

        return new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'The request contains invalid fields.',
          details: fieldErrors,
        });
      },
      ...options,
    });
  }
}
