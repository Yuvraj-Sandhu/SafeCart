export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  trackingId?: string;
  digestId?: string; // For linking emails to digest records for analytics
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'mailchimp' | 'sendgrid' | 'resend';
}

export interface BatchEmailResult {
  successful: number;
  failed: number;
  results: EmailResult[];
  provider: 'mailchimp' | 'sendgrid' | 'resend';
}

export interface EmailStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'deferred' | 'failed' | 'unknown';
  timestamp?: string;
  provider: 'mailchimp' | 'sendgrid' | 'resend';
  opens?: number;
  clicks?: number;
  error?: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(options: EmailOptions): Promise<EmailResult>;
  sendBatch?(emails: EmailOptions[]): Promise<BatchEmailResult>;
  getStatus?(messageId: string): Promise<EmailStatus>;
  validateWebhook?(signature: string, body: any): boolean;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}