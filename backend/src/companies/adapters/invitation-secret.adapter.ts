import * as crypto from 'crypto';
import { Buffer } from 'node:buffer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EncryptedSecretPayload {
  encryptedToken: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class InvitationSecretAdapter {
  private readonly logger = new Logger(InvitationSecretAdapter.name);
  private readonly keyBuffer: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('INVITATION_TOKEN_ENCRYPTION_KEY');
    if (!rawKey) {
      this.logger.warn('INVITATION_TOKEN_ENCRYPTION_KEY not set. Using test fallback buffer.');
      this.keyBuffer = Buffer.alloc(32, 'a');
    } else {
      const decoded = Buffer.from(rawKey, 'base64');
      if (decoded.length !== 32) {
        throw new Error(
          '[InvitationSecretAdapter] INVITATION_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes from base64.',
        );
      }
      this.keyBuffer = decoded;
    }
  }

  isConfigured(): boolean {
    const rawKey = this.configService.get<string>('INVITATION_TOKEN_ENCRYPTION_KEY');
    if (!rawKey) return false;
    try {
      const decoded = Buffer.from(rawKey, 'base64');
      return decoded.length === 32;
    } catch {
      return false;
    }
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        '[InvitationSecretAdapter] INVITATION_TOKEN_ENCRYPTION_KEY is missing or invalid base64 32-byte key.',
      );
    }
  }

  encryptToken(plainToken: string): EncryptedSecretPayload {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedToken: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decryptToken(encryptedTokenHex: string, ivHex: string, authTagHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.keyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedTokenHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
