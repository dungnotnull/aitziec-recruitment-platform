import { PasswordService } from '../../src/auth/password.service';

describe('PasswordService (BE-2-003, BEI-007)', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes password with Argon2id and verifies correctly', async () => {
    const plainPassword = 'StrongPassword123!@#';
    const hash = await service.hash(plainPassword);

    expect(hash).toContain('$argon2id$');
    expect(hash).not.toContain(plainPassword);

    const isValid = await service.verify(hash, plainPassword);
    expect(isValid).toBe(true);

    const isWrongValid = await service.verify(hash, 'WrongPassword456!');
    expect(isWrongValid).toBe(false);
  });

  it('detects rehash requirements based on versioned parameters', async () => {
    const plainPassword = 'AnotherPassword999';
    const hash = await service.hash(plainPassword);

    // Current parameters should not need rehash immediately
    const needsRehash = service.needsRehash(hash);
    expect(needsRehash).toBe(false);
  });
});
