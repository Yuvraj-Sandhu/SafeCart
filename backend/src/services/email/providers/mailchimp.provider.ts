/**
 * Mailchimp Transactional (Mandrill) Email Provider Implementation
 * 
 * Concrete implementation of the EmailProvider interface using Mailchimp Transactional.
 * This provider handles SafeCart's email delivery for user notifications and digest emails.
 * 
 * Key Features:
 * - Pre-built templates with merge variables
 * - Advanced analytics and tracking built-in
 * - Reliable delivery infrastructure
 * - Template versioning and A/B testing capabilities
 * - Automatic retry and bounce handling
 * 
 * Architecture Benefits:
 * - Implements EmailProvider interface for easy provider switching
 * - Consistent error handling and response format
 * - Environment-aware configuration
 * - Support for both HTML content and template-based sending
 * 
 * Mailchimp Advantages over Resend:
 * - Better analytics dashboard
 * - Template management UI
 * - More detailed delivery tracking
 * - Built-in unsubscribe management
 * - Better scalability for growth
 * 
 * @author Yuvraj
 */

const Mailchimp = require('@mailchimp/mailchimp_transactional');
import { EmailProvider, EmailOptions, EmailResult, BatchEmailResult, EmailStatus } from '../types';
import logger from '../../../utils/logger';

/**
 * Mailchimp Provider Class
 * 
 * Handles all email operations through Mailchimp Transactional API (Mandrill).
 */
export class MailchimpProvider implements EmailProvider {
  name = 'mailchimp';
  private client: any;

  /**
   * Initialize Mailchimp Provider
   * 
   * @param config - Configuration object containing API key
   */
  constructor(config: { apiKey: string }) {
    if (!config.apiKey) {
      throw new Error('Mailchimp API key is required');
    }

    // Initialize Mailchimp Transactional client
    this.client = Mailchimp(config.apiKey);
  }

  /**
   * Send Single Email
   * 
   * Sends an individual email through Mailchimp Transactional.
   * Can use either HTML content or Mailchimp templates.
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // Prepare the message object for Mailchimp
      const message: any = {
        // Using your verified domain
        from_email: this.extractEmail(options.from || 'digest@remote-login.org'),
        from_name: this.extractName(options.from || 'SafeCart'),
        to: [{
          email: options.to,
          type: 'to'
        }],
        subject: options.subject,
        html: options.html,
        text: options.text,
        important: false,
        track_opens: true,
        track_clicks: true,
        auto_text: true,
        auto_html: false,
        inline_css: true,
        url_strip_qs: false,
        preserve_recipients: false,
        view_content_link: false,
        merge: true,
        merge_language: 'handlebars'
      };

      // Add custom headers
      message.headers = {};
      
      // Add reply-to if provided
      if (options.replyTo) {
        message.headers['Reply-To'] = options.replyTo;
      }

      // Convert tags to Mailchimp format (metadata)
      if (options.tags) {
        message.metadata = options.tags;
        
        // Also add as tags array for filtering
        message.tags = Object.keys(options.tags);
      }

      // Add digest ID to metadata for analytics tracking (headers aren't included in webhooks)
      if (options.digestId) {
        if (!message.metadata) {
          message.metadata = {};
        }
        message.metadata['digest_id'] = options.digestId;
      }

      // Send the email via Mailchimp Transactional
      const response = await this.client.messages.send({
        message,
        async: false,
        ip_pool: 'Main Pool'
      });

      // Check response status
      if (response && response[0]) {
        const result = response[0];
        
        if (result.status === 'sent' || result.status === 'queued') {
          logger.info(`Email sent successfully via Mailchimp to ${options.to}`);
          return {
            success: true,
            messageId: result._id,
            provider: 'mailchimp'
          };
        } else {
          logger.error(`Mailchimp send failed: ${result.reject_reason || result.status}`);
          return {
            success: false,
            error: result.reject_reason || `Failed with status: ${result.status}`,
            provider: 'mailchimp'
          };
        }
      }

      return {
        success: false,
        error: 'No response from Mailchimp',
        provider: 'mailchimp'
      };

    } catch (error: any) {
      logger.error('Mailchimp send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email via Mailchimp',
        provider: 'mailchimp'
      };
    }
  }

  /**
   * Send Batch Emails
   * 
   * Sends multiple emails concurrently through Mailchimp.
   * Uses Promise.allSettled for fault tolerance.
   */
  async sendBatch(emailOptions: EmailOptions[]): Promise<BatchEmailResult> {
    logger.info(`Sending batch of ${emailOptions.length} emails via Mailchimp`);

    // Send all emails concurrently
    const sendPromises = emailOptions.map(options => this.sendEmail(options));
    const results = await Promise.allSettled(sendPromises);

    // Process results
    const emailResults: EmailResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Batch email ${index} failed:`, result.reason);
        return {
          success: false,
          error: result.reason?.message || 'Unknown error',
          provider: 'mailchimp'
        };
      }
    });

    // Calculate statistics
    const successful = emailResults.filter(r => r.success).length;
    const failed = emailResults.filter(r => !r.success).length;

    logger.info(`Batch send complete: ${successful} successful, ${failed} failed`);

    return {
      successful,
      failed,
      results: emailResults,
      provider: 'mailchimp'
    };
  }

  /**
   * Check Email Status
   * 
   * Retrieves the delivery status of a previously sent email.
   * Uses Mailchimp's message info API.
   */
  async checkStatus(messageId: string): Promise<EmailStatus> {
    try {
      const response = await this.client.messages.info({
        id: messageId
      });

      if (response) {
        // Map Mailchimp status to our standard status
        const status = this.mapMailchimpStatus(response.state);
        
        return {
          messageId,
          status,
          provider: 'mailchimp',
          timestamp: response.ts ? new Date(response.ts * 1000).toISOString() : undefined,
          opens: response.opens || 0,
          clicks: response.clicks || 0
        };
      }

      return {
        messageId,
        status: 'unknown',
        provider: 'mailchimp'
      };

    } catch (error: any) {
      logger.error(`Failed to check status for ${messageId}:`, error);
      return {
        messageId,
        status: 'unknown',
        provider: 'mailchimp',
        error: error.message
      };
    }
  }

  /**
   * Send Using Template
   * 
   * Sends an email using a Mailchimp template with merge variables.
   * This allows using pre-designed templates from Mailchimp dashboard.
   */
  async sendWithTemplate(
    templateName: string,
    to: string,
    mergeVars: Record<string, any>,
    options?: Partial<EmailOptions>
  ): Promise<EmailResult> {
    try {
      const message: any = {
        from_email: this.extractEmail(options?.from || 'digest@safecart.app'),
        from_name: this.extractName(options?.from || 'SafeCart'),
        to: [{
          email: to,
          type: 'to'
        }],
        subject: options?.subject || '',
        merge_vars: [{
          rcpt: to,
          vars: Object.entries(mergeVars).map(([name, content]) => ({
            name,
            content
          }))
        }],
        important: false,
        track_opens: true,
        track_clicks: true,
        merge: true,
        merge_language: 'handlebars'
      };

      // Add tags if provided
      if (options?.tags) {
        message.metadata = options.tags;
        message.tags = Object.keys(options.tags);
      }

      // Send using template
      const response = await this.client.messages.sendTemplate({
        template_name: templateName,
        template_content: [],
        message,
        async: false
      });

      if (response && response[0]) {
        const result = response[0];
        
        if (result.status === 'sent' || result.status === 'queued') {
          return {
            success: true,
            messageId: result._id,
            provider: 'mailchimp'
          };
        }
      }

      return {
        success: false,
        error: 'Failed to send template email',
        provider: 'mailchimp'
      };

    } catch (error: any) {
      logger.error('Mailchimp template send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send template email',
        provider: 'mailchimp'
      };
    }
  }

  /**
   * Helper: Extract email address from "Name <email>" format
   */
  private extractEmail(from: string): string {
    const match = from.match(/<(.+)>/);
    return match ? match[1] : from;
  }

  /**
   * Helper: Extract name from "Name <email>" format
   */
  private extractName(from: string): string {
    const match = from.match(/^([^<]+)/);
    return match ? match[1].trim() : 'SafeCart';
  }

  /**
   * Helper: Map Mailchimp status to standard status
   */
  private mapMailchimpStatus(state: string): EmailStatus['status'] {
    switch (state) {
      case 'sent':
        return 'delivered';
      case 'queued':
      case 'scheduled':
        return 'sent';
      case 'rejected':
      case 'invalid':
        return 'failed';
      case 'bounced':
        return 'bounced';
      case 'soft-bounced':
        return 'bounced';
      case 'spam':
        return 'complained';
      case 'unsub':
        return 'unsubscribed';
      case 'deferred':
        return 'deferred';
      default:
        return 'unknown';
    }
  }
}