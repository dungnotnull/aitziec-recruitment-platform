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

export function redactSensitiveData<T = unknown>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

@Injectable()
export class StructuredLogger implements LoggerService {
  private serviceName = 'itziec-api';

  log(message: unknown, ...optionalParams: unknown[]) {
    this.print('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.print('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.print('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.print('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.print('verbose', message, optionalParams);
  }

  private print(level: string, message: unknown, optionalParams: unknown[]) {
    let context = 'App';
    let meta: Record<string, unknown> = {};

    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string') {
        context = lastParam;
      }
      if (typeof optionalParams[0] === 'object' && optionalParams[0] !== null) {
        meta = redactSensitiveData(optionalParams[0]) as Record<string, unknown>;
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
