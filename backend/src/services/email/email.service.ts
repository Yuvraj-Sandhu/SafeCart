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
 * - Start with Resend (0-50K emails/month): Developer-friendly, cost-effective
 * - Migrate to SendGrid (50K+ emails/month): Enterprise features, lower cost at scale
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
import { ResendProvider } from './providers/resend.provider';

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
   * - EMAIL_PROVIDER: 'resend' (current) or 'sendgrid' (future)
   * - RESEND_API_KEY: Required when using Resend
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
        
      case 'resend':
      default:
        // Validate required configuration
        if (!process.env.RESEND_API_KEY) {
          throw new Error('RESEND_API_KEY environment variable is required');
        }
        
        return new ResendProvider({
          apiKey: process.env.RESEND_API_KEY
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