import { validateConfig } from '../../src/config/configuration';

describe('ConfigValidation (BE-1-005)', () => {
  const validBaseEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/itziec?schema=public',
    JWT_ACCESS_SECRET: 'super-secret-access-token-key-at-least-32-chars',
    JWT_REFRESH_SECRET: 'super-secret-refresh-token-key-at-least-32-chars',
    FRONTEND_URL: 'http://localhost:5173',
  };

  it('successfully validates a complete and valid environment configuration', () => {
    const config = validateConfig({
      ...validBaseEnv,
      PORT: '5000',
      REFRESH_COOKIE_SECURE: 'true',
    });

    expect(config.PORT).toBe(5000);
    expect(config.API_PREFIX).toBe('api/v1');
    expect(config.REFRESH_COOKIE_SECURE).toBe(true);
    expect(config.DATABASE_URL).toBe(validBaseEnv.DATABASE_URL);
  });

  it('throws an error with missing required environment variables', () => {
    expect(() => validateConfig({})).toThrow(/ConfigValidation/);
  });

  it('rejects JWT secret shorter than 32 characters and does not expose secret values', () => {
    expect(() =>
      validateConfig({
        ...validBaseEnv,
        JWT_ACCESS_SECRET: 'short',
      }),
    ).toThrow(/JWT_ACCESS_SECRET must be at least 32 characters long/);
  });

  it('rejects FRONTEND_URL that is not an absolute HTTP(S) origin', () => {
    expect(() =>
      validateConfig({
        ...validBaseEnv,
        FRONTEND_URL: 'frontend.local/company-invitations',
      }),
    ).toThrow(/FRONTEND_URL/);
  });

  it('normalizes a trailing slash on FRONTEND_URL to an origin', () => {
    const config = validateConfig({
      ...validBaseEnv,
      FRONTEND_URL: 'https://frontend.example.test/',
    });

    expect(config.FRONTEND_URL).toBe('https://frontend.example.test');
  });
});
