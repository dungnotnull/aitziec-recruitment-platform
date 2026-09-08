import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  // Configured parameters for Argon2id
  private readonly argonOptions: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB for high security within web server resource bounds
    timeCost: 2,
    parallelism: 1,
    version: 0x13, // 19
  };

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.argonOptions);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.argonOptions);
  }
}
