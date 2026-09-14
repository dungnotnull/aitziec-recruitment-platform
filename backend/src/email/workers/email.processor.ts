import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService, QUEUES } from '../../queues/queue.service';
import { EmailService } from '../email.service';
import { SendEmailOptions, SendEmailResult } from '../email.interface';

@Injectable()
export class EmailProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerWorker<SendEmailOptions>(
      QUEUES.EMAIL,
      async (job: Job<SendEmailOptions>) => {
        return this.process(job);
      },
    );
  }

  async process(job: Job<SendEmailOptions>): Promise<SendEmailResult> {
    this.logger.debug(`Processing email delivery to ${job.data.to} (subject: ${job.data.subject})`);
    const result = await this.emailService.sendEmail(job.data);
    if (!result.success) {
      throw new Error(`Email delivery failed: ${result.error || 'Unknown error'}`);
    }
    return result;
  }
}
