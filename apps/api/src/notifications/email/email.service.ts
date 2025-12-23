import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  EmailTemplates,
  ScanCompleteEmailData,
  CriticalFindingEmailData,
  InvitationEmailData,
  WeeklySummaryEmailData,
} from './email.templates';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.get('SMTP_FROM_ADDRESS', 'noreply@threatdiviner.com');
    this.fromName = this.configService.get('SMTP_FROM_NAME', 'ThreatDiviner');
    this.appUrl = this.configService.get('APP_URL', 'http://localhost:3000');

    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = this.configService.get('SMTP_HOST');
    const port = this.configService.get('SMTP_PORT');
    const user = this.configService.get('SMTP_USER');
    const pass = this.configService.get('SMTP_PASS');

    if (!host || !port) {
      this.logger.warn('SMTP not configured - email notifications disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: parseInt(port, 10) === 465,
        auth: user && pass ? { user, pass } : undefined,
      });

      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          this.logger.error(`SMTP connection failed: ${error.message}`);
          this.transporter = null;
        } else {
          this.logger.log('SMTP connection established');
        }
      });
    } catch (error) {
      this.logger.error(`Failed to create SMTP transporter: ${error}`);
      this.transporter = null;
    }
  }

  isAvailable(): boolean {
    return this.transporter !== null;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not available');
      return false;
    }

    try {
      const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;

      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Email sent successfully to ${recipients}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      return false;
    }
  }

  async sendScanComplete(to: string | string[], data: Omit<ScanCompleteEmailData, 'scanUrl'> & { scanId: string }): Promise<boolean> {
    const emailData: ScanCompleteEmailData = {
      ...data,
      scanUrl: `${this.appUrl}/scans/${data.scanId}`,
    };

    const template = EmailTemplates.scanComplete(emailData);
    return this.sendEmail({ to, ...template });
  }

  async sendCriticalFinding(to: string | string[], data: Omit<CriticalFindingEmailData, 'findingUrl'> & { findingId: string }): Promise<boolean> {
    const emailData: CriticalFindingEmailData = {
      ...data,
      findingUrl: `${this.appUrl}/findings/${data.findingId}`,
    };

    const template = EmailTemplates.criticalFinding(emailData);
    return this.sendEmail({ to, ...template });
  }

  async sendInvitation(data: Omit<InvitationEmailData, 'inviteUrl'> & { inviteToken: string }): Promise<boolean> {
    const emailData: InvitationEmailData = {
      tenantName: data.tenantName,
      inviterName: data.inviterName,
      inviteeEmail: data.inviteeEmail,
      role: data.role,
      inviteUrl: `${this.appUrl}/accept-invite?token=${data.inviteToken}`,
    };

    const template = EmailTemplates.invitation(emailData);
    return this.sendEmail({ to: data.inviteeEmail, ...template });
  }

  async sendWeeklySummary(to: string | string[], data: Omit<WeeklySummaryEmailData, 'dashboardUrl'>): Promise<boolean> {
    const emailData: WeeklySummaryEmailData = {
      ...data,
      dashboardUrl: `${this.appUrl}/dashboard`,
    };

    const template = EmailTemplates.weeklySummary(emailData);
    return this.sendEmail({ to, ...template });
  }

  async sendTestEmail(to: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'ThreatDiviner Email Test',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>Email Configuration Test</h1>
          <p>If you're seeing this message, your email notifications are configured correctly!</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
      text: `Email Configuration Test\n\nIf you're seeing this message, your email notifications are configured correctly!\n\nSent at: ${new Date().toISOString()}`,
    });
  }

  async sendGenericEmail(to: string | string[], subject: string, body: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #333;">${subject}</h1>
          <div style="white-space: pre-wrap;">${body.replace(/\n/g, '<br>')}</div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
          <p style="color: #666; font-size: 12px;">
            Sent by ThreatDiviner at ${new Date().toISOString()}
          </p>
        </div>
      `,
      text: `${subject}\n\n${body}\n\nSent by ThreatDiviner at ${new Date().toISOString()}`,
    });
  }
}
