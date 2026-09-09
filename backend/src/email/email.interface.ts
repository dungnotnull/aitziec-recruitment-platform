export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailPort {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}
