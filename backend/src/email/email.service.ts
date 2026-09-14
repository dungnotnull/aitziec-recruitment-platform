import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IEmailPort, SendEmailOptions, SendEmailResult } from './email.interface';

@Injectable()
export class EmailService implements IEmailPort {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly sentEmails: (SendEmailOptions & { sentAt: Date })[] = [];
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.get<string>('EMAIL_FROM', 'no-reply@aitziec.internal');
    const host = this.configService.get<string>('MAILPIT_HOST', 'localhost');
    const port = Number(this.configService.get<number>('MAILPIT_PORT', 1025));

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        ignoreTLS: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to initialize Nodemailer transport: ${msg}`);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (options.idempotencyKey) {
      const existing = this.sentEmails.find(
        (e) => e.idempotencyKey && e.idempotencyKey === options.idempotencyKey,
      );
      if (existing) {
        this.logger.log(
          `[Email Idempotency Replay] Skipping duplicate email send for key: ${options.idempotencyKey}`,
        );
        return { success: true, messageId: `replayed-${options.idempotencyKey}` };
      }
    }

    this.sentEmails.push({
      ...options,
      sentAt: new Date(),
    });

    if (!this.transporter) {
      this.logger.log(`[Offline Email Mock] To: ${options.to}, Subject: ${options.subject}`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Email delivery attempt failed for ${options.to}: ${msg}`);
      return {
        success: false,
        error: msg,
      };
    }
  }

  getSentEmails(): (SendEmailOptions & { sentAt: Date })[] {
    return [...this.sentEmails];
  }

  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }
}
