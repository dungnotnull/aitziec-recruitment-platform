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
    } catch (err: any) {
      this.logger.warn(`Failed to initialize Nodemailer transport: ${err.message}`);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
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
    } catch (err: any) {
      this.logger.warn(`Email delivery attempt failed for ${options.to}: ${err.message}`);
      return {
        success: false,
        error: err.message,
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
