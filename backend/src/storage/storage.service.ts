import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucket: string;
  private assetsBucket: string;
  private publicBaseUrl: string;
  private memoryStore = new Map<string, { buffer: Buffer; mimeType: string }>();

  constructor(private readonly configService: ConfigService) {
    this.bucket =
      this.configService.get<string>('STORAGE_BUCKET') ||
      this.configService.get<string>('MINIO_BUCKET', 'itziec-cvs');

    this.assetsBucket =
      this.configService.get<string>('STORAGE_ASSETS_BUCKET') ||
      this.configService.get<string>('MINIO_ASSETS_BUCKET', 'itziec-assets');

    const region = this.configService.get<string>('STORAGE_REGION', 'us-east-1');
    const endpoint =
      this.configService.get<string>('STORAGE_ENDPOINT') ||
      (this.configService.get<string>('MINIO_ENDPOINT')
        ? `http://${this.configService.get<string>('MINIO_ENDPOINT')}:${this.configService.get<number>('MINIO_PORT', 9000)}`
        : 'http://localhost:9000');

    const accessKey =
      this.configService.get<string>('STORAGE_ACCESS_KEY') ||
      this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey =
      this.configService.get<string>('STORAGE_SECRET_KEY') ||
      this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin');

    this.publicBaseUrl =
      this.configService.get<string>('STORAGE_PUBLIC_URL') ||
      `${endpoint.replace(/\/+$/, '')}/${this.assetsBucket}`;

    try {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`S3 initialization fallback to in-memory store: ${msg}`);
      this.s3Client = null;
    }
  }

  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    this.memoryStore.set(key, { buffer, mimeType });
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`S3 upload failed for ${key}, relying on local copy: ${msg}`);
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Storage upload failed: ${msg}`);
        }
      }
    }
  }

  async uploadPublicAsset(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    this.memoryStore.set(`${this.assetsBucket}/${key}`, { buffer, mimeType });
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.assetsBucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`S3 public asset upload failed for ${key}: ${msg}`);
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Public asset storage upload failed: ${msg}`);
        }
      }
    }
    return `${this.publicBaseUrl}/${key}`;
  }

  async deletePublicAsset(key: string): Promise<void> {
    this.memoryStore.delete(`${this.assetsBucket}/${key}`);
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.assetsBucket,
            Key: key,
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`S3 public asset delete failed for ${key}: ${msg}`);
      }
    }
  }

  getAssetsBucket(): string {
    return this.assetsBucket;
  }

  getPublicBaseUrl(): string {
    return this.publicBaseUrl;
  }

  async getFile(key: string): Promise<Buffer> {
    const mem = this.memoryStore.get(key);
    if (mem) return mem.buffer;

    if (this.s3Client) {
      const res = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      const stream = res.Body as AsyncIterable<Uint8Array | string> | null;
      if (!stream) {
        throw new Error(`File not found in storage: ${key}`);
      }
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    throw new Error(`File not found in storage: ${key}`);
  }

  async getSignedDownloadUrl(
    key: string,
    originalFileName: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    if (this.s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFileName)}"`,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Failed to generate S3 presigned URL: ${msg}`);
      }
    }

    // Local / test fallback URL
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    return `http://localhost:3000/api/v1/storage/download?key=${encodeURIComponent(key)}&expiresAt=${expiresAt}`;
  }

  async deleteFile(key: string): Promise<void> {
    this.memoryStore.delete(key);
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`S3 delete failed for ${key}: ${msg}`);
      }
    }
  }

  async headFile(key: string): Promise<{ size: number; mimeType: string } | null> {
    const mem = this.memoryStore.get(key);
    if (mem) {
      return { size: mem.buffer.length, mimeType: mem.mimeType };
    }

    if (this.s3Client) {
      try {
        const res = await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );
        return {
          size: res.ContentLength || 0,
          mimeType: res.ContentType || 'application/octet-stream',
        };
      } catch {
        return null;
      }
    }

    return null;
  }

  async putObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    return this.uploadFile(key, buffer, mimeType);
  }

  async objectExists(key: string): Promise<boolean> {
    const head = await this.headFile(key);
    return head !== null;
  }
}
