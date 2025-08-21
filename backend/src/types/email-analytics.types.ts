/**
 * Email Analytics Types
 * 
 * Types for tracking email performance metrics via Mailchimp webhooks
 * 
 * @author Yuvraj
 */

/**
 * Mailchimp webhook event types we track
 */
export type MailchimpEventType = 
  | 'sent'      // Email was sent successfully
  | 'delivered' // Email was delivered to inbox
  | 'bounced'   // Email bounced (hard/soft)
  | 'opened'    // User opened the email
  | 'clicked'   // User clicked a link in email
  | 'unsubscribed' // User unsubscribed
  | 'complained'   // User marked as spam
  | 'rejected';    // Email was rejected

/**
 * Email analytics record stored in Firestore
 */
export interface EmailAnalyticsRecord {
  id: string;                    // Auto-generated document ID
  messageId: string;             // Mailchimp message ID
  digestId?: string;             // Reference to email_digests document
  recipientEmail: string;        // Email address of recipient
  eventType: MailchimpEventType; // Type of event
  timestamp: string;             // ISO timestamp when event occurred
  eventData?: any;               // Raw Mailchimp webhook data
  processed: boolean;            // Whether event was processed successfully
  createdAt: string;             // When record was created
}

/**
 * Mailchimp webhook payload structure
 */
export interface MailchimpWebhookPayload {
  type: string;                  // Event type from Mailchimp
  fired_at: string;              // When event fired
  data: {
    id?: string;                 // Message ID
    email?: string;              // Recipient email
    metadata?: Record<string, string>; // Custom metadata including digest_id
    timestamp?: string;          // Event timestamp
    reason?: string;             // Bounce/rejection reason
    url?: string;                // Clicked URL (for click events)
    [key: string]: any;          // Other Mailchimp fields
  };
}

/**
 * Email analytics summary for a digest (direct approach)
 */
export interface EmailAnalyticsSummary {
  totalSent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  complained: number;
  rejected: number;
  deliveryRate: number;    // delivered / totalSent * 100
  openRate: number;        // opened / delivered * 100
  clickRate: number;       // clicked / delivered * 100
  bounceRate: number;      // bounced / totalSent * 100
  lastUpdated: string;     // ISO timestamp
}

/**
 * Processed event record for duplicate prevention
 * Stored in processed_events collection
 */
export interface ProcessedEventRecord {
  digestId: string;        // Reference to email_digests document
  messageId: string;       // Mailchimp message ID
  eventType: string;       // Event type (sent, opened, etc.)
  processedAt: string;     // ISO timestamp when processed
}

/**
 * Extended email digest record with analytics
 */
export interface EmailDigestWithAnalytics {
  id: string;
  type: 'manual' | 'usda_daily' | 'fda_weekly' | 'test';
  sentAt: string;
  sentBy: string;
  recallCount: number;
  totalRecipients: number;
  recalls: Array<{
    id: string;
    title: string;
    source: 'USDA' | 'FDA';
  }>;
  emailHtml?: string;
  analytics?: EmailAnalyticsSummary;
}