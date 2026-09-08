import { Injectable, LoggerService } from '@nestjs/common';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'jwt_secret',
  'cvtext',
  'extractedtext',
  'apikey',
]);

export function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

@Injectable()
export class StructuredLogger implements LoggerService {
  private serviceName = 'itziec-api';

  log(message: any, ...optionalParams: any[]) {
    this.print('info', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.print('error', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.print('warn', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.print('debug', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.print('verbose', message, optionalParams);
  }

  private print(level: string, message: any, optionalParams: any[]) {
    let context = 'App';
    let meta: Record<string, any> = {};

    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string') {
        context = lastParam;
      }
      if (typeof optionalParams[0] === 'object' && optionalParams[0] !== null) {
        meta = redactSensitiveData(optionalParams[0]);
      }
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      context,
      message: typeof message === 'object' ? redactSensitiveData(message) : message,
      ...(Object.keys(meta).length > 0 ? { meta } : {}),
    };

    if (process.env.NODE_ENV === 'test') {
      // In test mode, keep stdout clean unless debugging
      return;
    }

    const json = JSON.stringify(logEntry);
    if (level === 'error') {
      process.stderr.write(json + '\n');
    } else {
      process.stdout.write(json + '\n');
    }
  }
}
