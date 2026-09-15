import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmailTemplates } from '../../email/email-templates';
import { InvitationSecretAdapter } from '../adapters/invitation-secret.adapter';

export interface DeliverInvitationParams {
  invitationId: string;
  companyName?: string;
  role?: string;
  email: string;
}

@Injectable()
export class InvitationDeliveryWorker {
  private readonly logger = new Logger(InvitationDeliveryWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly secretAdapter: InvitationSecretAdapter,
  ) {}

  async deliverInvitation(params: DeliverInvitationParams): Promise<void> {
    const { invitationId, companyName, role, email } = params;

    const invitation = await this.prisma.companyInvitation.findUnique({
      where: { id: invitationId },
    });
    if (invitation && invitation.status !== 'PENDING') {
      this.logger.warn(
        `Skipping invitation delivery: invitation ${invitationId} is not in PENDING status (current=${invitation.status}).`,
      );
      return;
    }

    let acceptUrl: string | undefined;

    const deliverySecret = await this.prisma.companyInvitationDeliverySecret.findUnique({
      where: { invitationId },
    });

    if (deliverySecret) {
      try {
        const rawToken = this.secretAdapter.decryptToken(
          deliverySecret.encryptedToken,
          deliverySecret.iv,
          deliverySecret.authTag,
        );
        const frontendUrl = this.configService.get<string>('FRONTEND_URL');
        if (!frontendUrl) {
          throw new Error('FRONTEND_URL is required for invitation delivery.');
        }

        acceptUrl = `${frontendUrl.replace(/\/$/, '')}/company-invitations/${rawToken}/accept`;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to decrypt invitation secret for invitationId=${invitationId}: ${msg}`,
        );
        throw err;
      }
    } else {
      this.logger.warn(
        `No delivery secret found for invitationId=${invitationId}. Sending email without one-time accept link.`,
      );
    }

    const tmpl = EmailTemplates.companyInvitation(
      companyName || 'Company',
      role || 'RECRUITER',
      acceptUrl,
    );

    const emailResult = await this.emailService.sendEmail({
      to: email,
      subject: tmpl.subject,
      text: tmpl.text,
      html: tmpl.html,
      idempotencyKey: `email-comp-inv-${invitationId}`,
    });

    if (emailResult.success && deliverySecret) {
      try {
        await this.prisma.companyInvitationDeliverySecret.delete({
          where: { invitationId },
        });
        this.logger.debug(
          `Successfully delivered invitation and deleted delivery secret for invitationId=${invitationId}`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to delete delivery secret after email sent for invitationId=${invitationId}: ${msg}`,
        );
      }
    }
  }

  async cleanupExpiredSecrets(): Promise<number> {
    const res = await this.prisma.companyInvitationDeliverySecret.deleteMany({
      where: {
        invitation: {
          expiresAt: {
            lt: new Date(),
          },
        },
      },
    });

    this.logger.log(`Cleaned up ${res.count} expired invitation delivery secrets.`);
    return res.count;
  }
}
