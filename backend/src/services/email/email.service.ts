/**
 * Email Service - Provider Abstraction Layer
 * 
 * Central service for managing email operations across SafeCart.
 * Provides a unified interface that abstracts away email provider specifics,
 * enabling easy switching between providers as the application scales.
 * 
 * Key Architecture Benefits:
 * - Provider Independence: Switch from Resend to SendGrid with single env var change
 * - Consistent Interface: Same methods work regardless of underlying provider
 * - Graceful Fallbacks: Built-in fallback logic for missing provider features
 * - Business Logic Centralization: Subject generation, formatting, and rules
 * - Configuration Management: Environment-driven provider selection
 * 
 * Scaling Strategy:
 * - Start with Mailchimp (0-100K emails/month): Pre-built templates, advanced analytics
 * - Migrate to SendGrid (100K+ emails/month): Enterprise features, lower cost at scale
 * - Future: Add Amazon SES or other providers as needed
 * 
 * Usage Patterns:
 * - Single emails: User welcome, test emails, password resets
 * - Batch emails: Daily digest distribution to all subscribers
 * - Status tracking: Delivery confirmation, bounce handling
 * - Webhook processing: Real-time delivery status updates
 * 
 * Security Considerations:
 * - API keys stored in environment variables only
 * - Webhook signature validation prevents spoofing
 * - Error handling prevents sensitive information leakage
 * - Provider isolation prevents vendor lock-in vulnerabilities
 * 
 * @author Yuvraj
 */

import { EmailProvider, EmailOptions, EmailResult, BatchEmailResult } from './types';
import { MailchimpProvider } from './providers/mailchimp.provider';
import { EmailRenderService, RecallDigestData, WelcomeEmailData } from './render.service';

/**
 * Email Service Class
 * 
 * Singleton service that manages email provider operations.
 * Automatically selects and configures the appropriate provider based on environment.
 */
export class EmailService {
  private provider: EmailProvider;

  /**
   * Initialize Email Service
   * 
   * Automatically selects and configures the appropriate email provider
   * based on the EMAIL_PROVIDER environment variable.
   */
  constructor() {
    this.provider = this.initializeProvider();
  }

  /**
   * Provider Factory Method
   * 
   * Creates and configures the appropriate email provider based on environment configuration.
   * This is the central switching mechanism that enables provider migration.
   * 
   * @returns EmailProvider - Configured provider instance
   * @throws Error - If provider is not implemented or configuration is invalid
   * 
   * Environment Variables:
   * - EMAIL_PROVIDER: 'mailchimp' (current) or 'sendgrid' (future)
   * - MAILCHIMP_API_KEY: Required when using Mailchimp
   * - SENDGRID_API_KEY: Required when using SendGrid (future)
   * 
   * Migration Process:
   * 1. Implement SendGrid provider class
   * 2. Add SENDGRID_API_KEY to environment
   * 3. Change EMAIL_PROVIDER=sendgrid
   * 4. Restart application
   * 5. All email functionality switches to SendGrid automatically
   */
  private initializeProvider(): EmailProvider {
    const providerName = process.env.EMAIL_PROVIDER;
    
    switch (providerName) {
      case 'sendgrid':
        // TODO: Implement SendGrid provider for enterprise scale
        // Will be added when monthly volume exceeds 50K emails
        throw new Error('SendGrid provider not implemented yet');
        
      case 'mailchimp':
      default:
        // Validate required configuration
        if (!process.env.MAILCHIMP_API_KEY) {
          throw new Error('MAILCHIMP_API_KEY environment variable is required');
        }
        
        return new MailchimpProvider({
          apiKey: process.env.MAILCHIMP_API_KEY
        });
    }
  }

  /**
   * Send Single Email
   * 
   * Primary method for sending individual emails.
   * Delegates to the configured provider while maintaining consistent interface.
   * 
   * @param options - Email configuration (recipients, subject, content, etc.)
   * @returns Promise<EmailResult> - Standardized result format
   * 
   * Usage Examples:
   * - Welcome emails for new user registrations
   * - Test emails for subscription verification
   * - Admin notifications and alerts
   * - Password reset emails (future feature)
   * 
   * Provider Independence:
   * - Same method signature works with Resend, SendGrid, or future providers
   * - Result format is standardized regardless of underlying provider
   * - Error handling is consistent across all providers
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    return this.provider.sendEmail(options);
  }

  /**
   * Send Batch Emails
   * 
   * Optimized method for sending multiple emails efficiently.
   * Primary use case is daily digest distribution to all subscribers.
   * 
   * @param emails - Array of email configurations to send
   * @returns Promise<BatchEmailResult> - Summary of batch operation with individual results
   * 
   * Implementation Strategy:
   * - Uses provider's native batch API if available (SendGrid has this)
   * - Falls back to concurrent individual sends if no batch API (Resend)
   * - Ensures all emails attempt to send even if some fail
   * - Provides detailed failure reporting for retry logic
   * 
   * Performance Considerations:
   * - Batch size should be limited to prevent memory issues (recommend 1000 max)
   * - Provider rate limits are handled at the provider level
   * - Concurrent sends improve throughput over sequential
   * - Failed emails can be retried without affecting successful ones
   * 
   * Business Logic:
   * - Used for daily digest sends (typically 100-1000 emails)
   * - Each email contains personalized content (user's state recalls)
   * - Failure tracking enables user notification and support escalation
   */
  async sendBatch(emails: EmailOptions[]): Promise<BatchEmailResult> {
    // Use provider's native batch API if available (better performance)
    if (this.provider.sendBatch) {
      return this.provider.sendBatch(emails);
    }

    // Fallback: simulate batch sending with concurrent individual sends
    // This path is used with Resend (no native batch API)
    const results = await Promise.allSettled(
      emails.map(email => this.sendEmail(email))
    );

    // Calculate success/failure counts for summary reporting
    const successful = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;

    // Return standardized batch result format
    return {
      successful,
      failed: emails.length - successful,
      results: results.map(r => 
        r.status === 'fulfilled' ? r.value : {
          success: false,
          error: 'Promise rejected', // Network or other failure
          provider: this.provider.name as any
        }
      )
    };
  }

  /**
   * Get Email Delivery Status
   * 
   * Retrieves current delivery status for a previously sent email.
   * Used for tracking delivery success, bounces, and user engagement.
   * 
   * @param messageId - Unique identifier returned from sendEmail
   * @returns Promise<EmailStatus> - Current delivery and engagement status
   * 
   * Provider Capabilities:
   * - Resend: Limited to webhook-based tracking (no direct status API)
   * - SendGrid: Full status API with detailed delivery information
   * - Future: Will implement webhook-based status caching for all providers
   * 
   * Use Cases:
   * - Detecting bounce emails to clean subscriber lists
   * - Tracking delivery failures for retry logic
   * - Monitoring engagement rates (opens, clicks)
   * - Debugging email delivery issues
   * 
   * Implementation Notes:
   * - Returns 'unknown' status if provider doesn't support status checking
   * - Step 7 will implement webhook-based status tracking for real-time updates
   * - Status information will be cached in database for performance
   */
  async getEmailStatus(messageId: string): Promise<any> {
    if (this.provider.getStatus) {
      return this.provider.getStatus(messageId);
    }
    
    // Fallback for providers without status API
    return { messageId, status: 'unknown' };
  }

  /**
   * Validate Webhook Signature
   * 
   * Security method to verify webhook requests are authentic.
   * Prevents malicious actors from spoofing email delivery events.
   * 
   * @param signature - Webhook signature from request headers
   * @param body - Raw webhook request body
   * @returns boolean - True if signature is valid and webhook is authentic
   * 
   * Security Importance:
   * - Prevents fake bounce notifications that could corrupt subscriber lists
   * - Ensures email engagement metrics are accurate
   * - Required for production webhook processing
   * - Protects against webhook replay attacks
   * 
   * Implementation Status:
   * - Currently delegates to provider-specific validation
   * - Step 7 will implement comprehensive webhook signature verification
   * - Returns false by default if provider doesn't support validation
   */
  validateWebhook(signature: string, body: any): boolean {
    if (this.provider.validateWebhook) {
      return this.provider.validateWebhook(signature, body);
    }
    
    // Fail secure: reject webhooks if validation isn't implemented
    return false;
  }

  /**
   * Generate Email Subject Lines
   * 
   * Business logic for creating consistent, informative email subject lines.
   * Centralizes subject line formatting and ensures brand consistency.
   * 
   * @param recallCount - Number of recalls in the digest
   * @param state - State name for localization
   * @returns string - Formatted subject line with SafeCart branding
   * 
   * Subject Line Strategy:
   * - Clear communication about recall count and location
   * - Consistent SafeCart branding for recognition
   * - Urgency indicators for high-risk situations (future: risk level)
   * - Avoid spam trigger words while maintaining clarity
   * 
   * Business Rules:
   * - Zero recalls: Positive messaging ("No new recalls")
   * - Multiple recalls: Accurate count with plural handling
   * - High-risk recalls: Future enhancement to add urgency indicators
   * - Character limit: Keep under 50 characters for mobile visibility
   * 
   * Examples:
   * - "No new recalls in California today - SafeCart"
   * - "3 food recalls in Texas - SafeCart Alert"
   * - "1 food recall in New York - SafeCart Alert"
   */
  generateSubject(recallCount: number, state: string): string {
    if (recallCount === 0) {
      return `No new recalls in ${state} today - SafeCart`;
    }
    
    // Handle singular vs plural recall grammar
    const recallText = recallCount === 1 ? 'food recall' : 'food recalls';
    return `${recallCount} ${recallText} in ${state} - SafeCart Alert`;
  }

  /**
   * Send Recall Digest Email
   * 
   * High-level method for sending daily recall digest emails using React Email templates.
   * Handles template rendering and email delivery through the configured provider.
   * 
   * @param digestData - Complete digest data including user info and recalls
   * @returns Promise<EmailResult> - Delivery result with tracking information
   * 
   * Business Logic:
   * - Validates template data before rendering
   * - Renders React Email template to HTML
   * - Sends email through configured provider (Resend/SendGrid)
   * - Returns standardized result for tracking and error handling
   * 
   * Use Cases:
   * - Daily automated digest distribution
   * - Manual test email sending
   * - Individual user digest delivery
   */
  async sendRecallDigest(digestData: RecallDigestData): Promise<EmailResult> {
    // Validate template data
    if (!EmailRenderService.validateTemplateData('digest', digestData)) {
      return {
        success: false,
        error: 'Invalid digest data provided',
        provider: this.provider.name as any
      };
    }

    try {
      // Render email template to HTML
      const emailOptions = await EmailRenderService.renderRecallDigest(digestData);
      
      // Send through configured provider
      return await this.sendEmail(emailOptions);
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to render or send digest: ${error.message}`,
        provider: this.provider.name as any
      };
    }
  }

  /**
   * Send Welcome Email
   * 
   * High-level method for sending welcome emails to new subscribers.
   * Introduces SafeCart service and confirms subscription preferences.
   * 
   * @param welcomeData - Welcome email data including user info and preferences
   * @returns Promise<EmailResult> - Delivery result with tracking information
   * 
   * Business Logic:
   * - Validates user and preference data
   * - Renders welcome template with personalized content
   * - Sends email through configured provider
   * - Used for new user onboarding workflow
   * 
   * Use Cases:
   * - New user registration confirmation
   * - Subscription reactivation
   * - Service introduction emails
   */
  async sendWelcomeEmail(welcomeData: WelcomeEmailData): Promise<EmailResult> {
    // Validate template data
    if (!EmailRenderService.validateTemplateData('welcome', welcomeData)) {
      return {
        success: false,
        error: 'Invalid welcome email data provided',
        provider: this.provider.name as any
      };
    }

    try {
      // Render email template to HTML
      const emailOptions = await EmailRenderService.renderWelcomeEmail(welcomeData);
      
      // Send through configured provider
      return await this.sendEmail(emailOptions);
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to render or send welcome email: ${error.message}`,
        provider: this.provider.name as any
      };
    }
  }

  /**
   * Send Digest Batch
   * 
   * Efficiently sends multiple digest emails for daily distribution.
   * Optimized for batch processing of state-based subscriber lists.
   * 
   * @param digestDataList - Array of digest data for multiple users
   * @returns Promise<BatchEmailResult> - Summary of batch operation results
   * 
   * Performance Features:
   * - Concurrent template rendering for speed
   * - Batch email sending through provider
   * - Individual failure tracking for retry logic
   * - Memory-efficient processing for large lists
   * 
   * Use Cases:
   * - Daily digest distribution (primary use case)
   * - State-specific emergency alerts
   * - Test email batch verification
   */
  async sendDigestBatch(digestDataList: RecallDigestData[]): Promise<BatchEmailResult> {
    try {
      // Validate all digest data
      const validData = digestDataList.filter(data => 
        EmailRenderService.validateTemplateData('digest', data)
      );

      if (validData.length === 0) {
        return {
          successful: 0,
          failed: digestDataList.length,
          results: digestDataList.map(() => ({
            success: false,
            error: 'Invalid digest data',
            provider: this.provider.name as any
          }))
        };
      }

      // Render all emails concurrently
      const emailOptions = await EmailRenderService.renderDigestBatch(validData);
      
      // Send batch through provider
      return await this.sendBatch(emailOptions);
    } catch (error: any) {
      // Return failure result for entire batch
      return {
        successful: 0,
        failed: digestDataList.length,
        results: digestDataList.map(() => ({
          success: false,
          error: `Batch processing failed: ${error.message}`,
          provider: this.provider.name as any
        }))
      };
    }
  }
}

/**
 * Singleton Email Service Instance
 * 
 * Pre-configured email service instance ready for use throughout the application.
 * Automatically selects provider based on environment configuration.
 * 
 * Usage in other services:
 * ```typescript
 * import { emailService } from './email/email.service';
 * 
 * // Send welcome email
 * await emailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome to SafeCart',
 *   html: welcomeEmailHtml
 * });
 * 
 * // Send daily digest batch
 * await emailService.sendBatch(dailyDigestEmails);
 * ```
 * 
 * Provider Migration:
 * - No code changes needed when switching providers
 * - Only environment variable change required
 * - All business logic remains identical
 */
export const emailService = new EmailService();