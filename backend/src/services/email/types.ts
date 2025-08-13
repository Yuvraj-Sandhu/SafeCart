export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  trackingId?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'resend' | 'sendgrid';
}

export interface BatchEmailResult {
  successful: number;
  failed: number;
  results: EmailResult[];
}

export interface EmailStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unknown';
  timestamp?: Date;
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