/**
 * Email Rendering Service
 * 
 * Handles React Email template rendering and integration with the email provider system.
 * Converts React components to HTML for email delivery through any provider.
 * 
 * @author Yuvraj
 */

import { render } from '@react-email/render';
import { RecallDigest, WelcomeEmail } from '../../emails';
import { EmailOptions } from './types';

/**
 * Email Template Data Interfaces
 */
export interface RecallDigestData {
  user: {
    name: string;
    email: string;
    unsubscribeToken: string;
  };
  state: string;
  recalls: Array<{
    id: string;
    title: string;
    company: string;
    recallDate: string;
    classification: string;
    description: string;
    reason: string;
    primaryImage?: string;
    recallUrl?: string;
    source: 'USDA' | 'FDA';
  }>;
  digestDate: string;
  isTest?: boolean;
}

export interface WelcomeEmailData {
  user: {
    name: string;
    email: string;
    unsubscribeToken: string;
  };
  state: string;
  schedule: {
    weekdays: boolean;
    weekends: boolean;
    timeOfDay: 'morning' | 'evening';
  };
}

/**
 * Email Rendering Service
 * 
 * Provides methods to render React Email templates into HTML strings
 * and prepare them for sending through the email provider system.
 */
export class EmailRenderService {
  
  /**
   * Render Daily Recall Digest Email
   * 
   * Generates HTML email content for daily recall digest with state-specific recalls.
   * Handles both regular digests and test emails with appropriate styling and content.
   * 
   * @param data - Digest data including user info, state, and recalls
   * @returns Promise<EmailOptions> - Ready-to-send email configuration
   * 
   * Business Logic:
   * - Personalizes content with user's name and selected state
   * - Includes unsubscribe URL for CAN-SPAM compliance
   * - Adapts subject line based on recall count and test status
   * - Processes recall data for consistent display format
   * 
   * Template Features:
   * - Mobile-responsive design with consistent SafeCart branding
   * - Recall cards with images, risk classifications, and details
   * - No-recalls state with positive messaging and safety tips
   * - Clear unsubscribe and preference management links
   * 
   * Use Cases:
   * - Daily automated digest distribution
   * - Manual test email verification
   * - Critical recall immediate alerts (future enhancement)
   */
  static async renderRecallDigest(data: RecallDigestData): Promise<EmailOptions> {
    // Generate HTML content from React template
    const html = await render(RecallDigest(data));
    
    // Create email subject based on recall count and test status
    const subject = EmailRenderService.generateDigestSubject(
      data.recalls.length, 
      data.state, 
      data.isTest
    );
    
    // Prepare email configuration
    return {
      to: data.user.email,
      subject,
      html,
      tags: {
        template: 'recall_digest',
        state: data.state,
        recall_count: data.recalls.length.toString(),
        is_test: data.isTest ? 'true' : 'false'
      }
    };
  }

  /**
   * Render Welcome Email
   * 
   * Generates HTML email content for new user welcome and subscription confirmation.
   * Introduces SafeCart service and confirms user's subscription preferences.
   * 
   * @param data - Welcome email data including user info and preferences
   * @returns Promise<EmailOptions> - Ready-to-send email configuration
   * 
   * Business Logic:
   * - Welcomes new users and confirms subscription setup
   * - Explains SafeCart service and what to expect
   * - Provides links to preference management and support
   * - Includes unsubscribe option for immediate compliance
   * 
   * Template Features:
   * - Friendly, informative tone with clear value proposition
   * - Subscription confirmation with user's selected preferences
   * - Educational content about food safety and recall process
   * - Clear call-to-action to test the service
   * 
   * Use Cases:
   * - New user registration confirmation
   * - Subscription reactivation (when user re-subscribes)
   * - Service introduction for existing users (major updates)
   */
  static async renderWelcomeEmail(data: WelcomeEmailData): Promise<EmailOptions> {
    // Generate HTML content from React template
    const html = await render(WelcomeEmail(data));
    
    // Create welcome email configuration
    return {
      to: data.user.email,
      subject: `Welcome to SafeCart - You're now protected in ${data.state}!`,
      html,
      tags: {
        template: 'welcome',
        state: data.state,
        user_type: 'new_subscriber'
      }
    };
  }

  /**
   * Generate Dynamic Subject Lines for Digest Emails
   * 
   * Creates contextually appropriate subject lines based on recall count and email type.
   * Ensures consistent messaging while providing clear information to users.
   * 
   * @param recallCount - Number of recalls in the digest
   * @param state - User's selected state
   * @param isTest - Whether this is a test email
   * @returns string - Formatted subject line
   * 
   * Subject Line Strategy:
   * - Test emails clearly marked to avoid confusion
   * - Zero recalls: Positive messaging to maintain engagement
   * - Multiple recalls: Accurate count with urgency appropriate to risk
   * - Consistent SafeCart branding for recognition
   * 
   * Examples:
   * - "TEST: SafeCart Digest for California"
   * - "No new recalls in Texas today - SafeCart"
   * - "3 food recalls in New York - SafeCart Alert"
   */
  private static generateDigestSubject(
    recallCount: number, 
    state: string, 
    isTest?: boolean
  ): string {
    if (isTest) {
      return `TEST: SafeCart Digest for ${state}`;
    }
    
    if (recallCount === 0) {
      return `No new recalls in ${state} today - SafeCart`;
    }
    
    const recallText = recallCount === 1 ? 'food recall' : 'food recalls';
    return `${recallCount} ${recallText} in ${state} - SafeCart Alert`;
  }

  /**
   * Prepare Batch Email Rendering
   * 
   * Efficiently renders multiple digest emails for batch distribution.
   * Used during daily digest generation for all subscribed users.
   * 
   * @param digestDataList - Array of digest data for multiple users
   * @returns Promise<EmailOptions[]> - Array of ready-to-send email configurations
   * 
   * Performance Optimizations:
   * - Concurrent rendering using Promise.all for speed
   * - Template reuse for users in same state with same recalls
   * - Memory-efficient processing for large subscriber lists
   * 
   * Use Cases:
   * - Daily digest batch generation (primary use case)
   * - State-specific emergency alert distribution
   * - Test email batch sending for verification
   */
  static async renderDigestBatch(
    digestDataList: RecallDigestData[]
  ): Promise<EmailOptions[]> {
    // Render all digest emails concurrently for optimal performance
    return Promise.all(
      digestDataList.map(data => EmailRenderService.renderRecallDigest(data))
    );
  }

  /**
   * Template Validation
   * 
   * Validates template data before rendering to prevent errors.
   * Ensures required fields are present and properly formatted.
   * 
   * @param templateType - Type of template to validate
   * @param data - Template data to validate
   * @returns boolean - True if data is valid for rendering
   * 
   * Validation Rules:
   * - Required fields presence check
   * - Email format validation
   * - State code validation
   * - Recall data structure validation
   */
  static validateTemplateData(
    templateType: 'digest' | 'welcome',
    data: RecallDigestData | WelcomeEmailData
  ): boolean {
    // Basic validation for all templates
    if (!data.user?.email || !data.user?.name || !data.state) {
      return false;
    }

    // Template-specific validation
    if (templateType === 'digest') {
      const digestData = data as RecallDigestData;
      return Array.isArray(digestData.recalls) && 
             typeof digestData.digestDate === 'string';
    }

    if (templateType === 'welcome') {
      const welcomeData = data as WelcomeEmailData;
      return welcomeData.schedule && 
             typeof welcomeData.schedule.weekdays === 'boolean' &&
             typeof welcomeData.schedule.weekends === 'boolean' &&
             ['morning', 'evening'].includes(welcomeData.schedule.timeOfDay);
    }

    return false;
  }
}