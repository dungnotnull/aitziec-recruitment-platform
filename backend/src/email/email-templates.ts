export interface EmailTemplateResult {
  subject: string;
  text: string;
  html: string;
}

export const EmailTemplates = {
  applicationSubmitted(jobTitle: string, companyName: string): EmailTemplateResult {
    const subject = `[AitZiec] Application Received: ${jobTitle} at ${companyName}`;
    const text = `Thank you for applying to ${jobTitle} at ${companyName}. Your application has been successfully submitted and is under review.`;
    const html = `<h2>Application Received</h2><p>Thank you for applying for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p><p>We will review your application and keep you updated on next steps.</p>`;
    return { subject, text, html };
  },

  applicationStatusChanged(
    jobTitle: string,
    companyName: string,
    status: string,
  ): EmailTemplateResult {
    const subject = `[AitZiec] Application Update: ${jobTitle} at ${companyName} (${status})`;
    const text = `Your application for ${jobTitle} at ${companyName} has been updated to: ${status}. Please log in to check the details.`;
    const html = `<h2>Application Status Update</h2><p>Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been updated to: <strong>${status}</strong>.</p>`;
    return { subject, text, html };
  },

  interviewScheduled(
    jobTitle: string,
    companyName: string,
    startsAt: string,
    endsAt: string,
    locationOrUrl: string,
    instructions?: string | null,
  ): EmailTemplateResult {
    const subject = `[AitZiec] Interview Scheduled: ${jobTitle} at ${companyName}`;
    const text = `An interview for ${jobTitle} at ${companyName} has been scheduled.\nStarts: ${startsAt}\nEnds: ${endsAt}\nLocation/Meeting: ${locationOrUrl}\nInstructions: ${instructions || 'N/A'}`;
    const html = `<h2>Interview Scheduled</h2><p>You have an interview scheduled for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p><ul><li><strong>Start:</strong> ${startsAt}</li><li><strong>End:</strong> ${endsAt}</li><li><strong>Location / Meeting URL:</strong> ${locationOrUrl}</li><li><strong>Instructions:</strong> ${instructions || 'None'}</li></ul>`;
    return { subject, text, html };
  },

  interviewRescheduled(
    jobTitle: string,
    companyName: string,
    startsAt: string,
    endsAt: string,
    locationOrUrl: string,
    instructions?: string | null,
  ): EmailTemplateResult {
    const subject = `[AitZiec] Interview Rescheduled: ${jobTitle} at ${companyName}`;
    const text = `Your interview for ${jobTitle} at ${companyName} has been rescheduled.\nNew Start: ${startsAt}\nNew End: ${endsAt}\nLocation/Meeting: ${locationOrUrl}\nInstructions: ${instructions || 'N/A'}`;
    const html = `<h2>Interview Rescheduled</h2><p>Your interview for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been updated.</p><ul><li><strong>New Start:</strong> ${startsAt}</li><li><strong>New End:</strong> ${endsAt}</li><li><strong>Location / Meeting URL:</strong> ${locationOrUrl}</li><li><strong>Instructions:</strong> ${instructions || 'None'}</li></ul>`;
    return { subject, text, html };
  },

  interviewCancelled(jobTitle: string, companyName: string, reason: string): EmailTemplateResult {
    const subject = `[AitZiec] Interview Cancelled: ${jobTitle} at ${companyName}`;
    const text = `Your interview for ${jobTitle} at ${companyName} has been cancelled.\nReason: ${reason}`;
    const html = `<h2>Interview Cancelled</h2><p>Your interview for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been cancelled.</p><p><strong>Reason:</strong> ${reason}</p>`;
    return { subject, text, html };
  },

  companyMemberAdded(companyName: string, role: string): EmailTemplateResult {
    const subject = `[AitZiec] Added to ${companyName} as ${role}`;
    const text = `You have been added to ${companyName} with the role of ${role}. Log in to access the recruiter workspace.`;
    const html = `<h2>Welcome to ${companyName}</h2><p>You have been added to <strong>${companyName}</strong> with the role of <strong>${role}</strong>.</p><p>Please log in to your account to access your workspace.</p>`;
    return { subject, text, html };
  },

  companyInvitation(companyName: string, role: string): EmailTemplateResult {
    const subject = `[AitZiec] Invitation to join ${companyName} as ${role}`;
    const text = `You have been invited to join ${companyName} as ${role}. Please create an account or sign in with this email to accept the invitation.`;
    const html = `<h2>Company Invitation</h2><p>You have been invited to join <strong>${companyName}</strong> as <strong>${role}</strong>.</p><p>Please register or sign in using this email address to accept your invitation.</p>`;
    return { subject, text, html };
  },
};
