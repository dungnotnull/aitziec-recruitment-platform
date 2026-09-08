import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api/v1';

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsInt()
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters long' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters long' })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  REFRESH_COOKIE_NAME: string = 'itziec_refresh';

  @IsString()
  @IsOptional()
  REFRESH_COOKIE_SAME_SITE: 'lax' | 'strict' | 'none' = 'lax';

  @IsBoolean()
  @IsOptional()
  REFRESH_COOKIE_SECURE: boolean = false;

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:5173,http://localhost:3000';
}

export function validateConfig(config: Record<string, unknown>): EnvironmentVariables {
  // Coerce types before validation
  const transformed = plainToInstance(
    EnvironmentVariables,
    {
      ...config,
      PORT: config.PORT ? Number(config.PORT) : 4000,
      REDIS_PORT: config.REDIS_PORT ? Number(config.REDIS_PORT) : 6379,
      REFRESH_COOKIE_SECURE:
        config.REFRESH_COOKIE_SECURE === 'true' || config.REFRESH_COOKIE_SECURE === true,
    },
    { enableImplicitConversion: true },
  );

  const errors = validateSync(transformed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const sanitizedErrorMessages = errors
      .map((err) => {
        const constraints = Object.values(err.constraints || {}).join(', ');
        return `Property "${err.property}": ${constraints}`;
      })
      .join('; ');

    throw new Error(
      `[ConfigValidation] Invalid application environment: ${sanitizedErrorMessages}`,
    );
  }

  return transformed;
}
