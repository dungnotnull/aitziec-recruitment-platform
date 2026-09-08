import { redactSensitiveData } from '../../src/logging/logging.service';

describe('LoggingRedaction (BE-1-013)', () => {
  it('redacts sensitive fields in shallow and deeply nested objects', () => {
    const sensitivePayload = {
      user: {
        email: 'candidate@itziec.com',
        password: 'PlainTextPassword123!',
        passwordHash: '$argon2id$v=19$m=65536...',
      },
      session: {
        token: 'access.jwt.token',
        refreshToken: 'refresh-session-token',
        cookie: 'itziec_refresh=secret',
      },
      cv: {
        filename: 'resume.pdf',
        cvText: 'Very sensitive private CV body text',
        extractedText: 'Extracted CV experience and personal phone',
      },
      apiKey: 'gemini-secret-key-xyz',
    };

    const redacted = redactSensitiveData(sensitivePayload);

    expect(redacted.user.email).toBe('candidate@itziec.com');
    expect(redacted.user.password).toBe('[REDACTED]');
    expect(redacted.user.passwordHash).toBe('[REDACTED]');
    expect(redacted.session.token).toBe('[REDACTED]');
    expect(redacted.session.refreshToken).toBe('[REDACTED]');
    expect(redacted.session.cookie).toBe('[REDACTED]');
    expect(redacted.cv.filename).toBe('resume.pdf');
    expect(redacted.cv.cvText).toBe('[REDACTED]');
    expect(redacted.cv.extractedText).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
  });

  it('handles arrays and primitive values safely without mutation', () => {
    const arrayData = [{ password: '123' }, { name: 'safe' }];
    const redacted = redactSensitiveData(arrayData);

    expect(redacted[0].password).toBe('[REDACTED]');
    expect(redacted[1].name).toBe('safe');
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData('string-value')).toBe('string-value');
  });
});
