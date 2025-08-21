/**
 * Email Webhook Service
 * 
 * Processes Mailchimp webhook events for email analytics tracking
 * 
 * @author Yuvraj
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import logger from '../../utils/logger';
import {
  MailchimpWebhookPayload,
  EmailAnalyticsRecord,
  MailchimpEventType,
  EmailAnalyticsSummary
} from '../../types/email-analytics.types';

const db = admin.firestore();

export class EmailWebhookService {
  
  /**
   * Process incoming Mailchimp webhook
   */
  async processWebhook(payload: MailchimpWebhookPayload, signature?: string): Promise<{
    success: boolean;
    error?: string;
    processed?: boolean;
  }> {
    try {
      // Validate webhook signature if provided
      if (signature && !this.validateSignature(payload, signature)) {
        logger.warn('Invalid webhook signature received');
        return { success: false, error: 'Invalid signature' };
      }

      // Handle webhook validation requests (during setup)
      if (!payload.type || typeof payload.type !== 'string') {
        logger.info('Webhook validation request received (no event type)');
        return { success: true, processed: false };
      }

      // Map Mailchimp event types to our internal types
      const eventType = this.mapMailchimpEventType(payload.type);
      if (!eventType) {
        logger.info(`Ignoring untracked event type: ${payload.type}`);
        return { success: true, processed: false };
      }

      // Extract email address from payload
      const recipientEmail = payload.data.email || payload.data.email_address;
      if (!recipientEmail) {
        logger.warn('No recipient email found in webhook payload');
        return { success: false, error: 'Missing recipient email' };
      }

      // Create analytics record
      const analyticsRecord: EmailAnalyticsRecord = {
        id: this.generateAnalyticsId(),
        messageId: payload.data.id || 'unknown',
        recipientEmail: recipientEmail,
        eventType: eventType,
        timestamp: payload.fired_at || new Date().toISOString(),
        eventData: payload.data,
        processed: false,
        createdAt: new Date().toISOString()
      };

      // Try to find associated digest
      const digestId = await this.findDigestForEmail(recipientEmail, analyticsRecord.timestamp);
      if (digestId) {
        analyticsRecord.digestId = digestId;
      }

      // Store analytics record
      await db.collection('email_analytics').doc(analyticsRecord.id).set(analyticsRecord);
      
      // Update digest analytics if we found the associated digest
      if (digestId) {
        await this.updateDigestAnalytics(digestId);
      }

      // Mark as processed
      await db.collection('email_analytics').doc(analyticsRecord.id).update({
        processed: true
      });

      logger.info(`Processed ${eventType} event for ${recipientEmail} (digest: ${digestId || 'unknown'})`);

      return { success: true, processed: true };
    } catch (error) {
      logger.error('Error processing webhook:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get analytics summary for a specific digest
   */
  async getDigestAnalytics(digestId: string): Promise<EmailAnalyticsSummary | null> {
    try {
      const analyticsSnapshot = await db.collection('email_analytics')
        .where('digestId', '==', digestId)
        .get();

      if (analyticsSnapshot.empty) {
        return null;
      }

      const events = analyticsSnapshot.docs.map(doc => doc.data() as EmailAnalyticsRecord);
      
      return this.calculateAnalyticsSummary(events);
    } catch (error) {
      logger.error(`Error getting digest analytics for ${digestId}:`, error);
      return null;
    }
  }

  /**
   * Validate webhook signature from Mailchimp
   */
  private validateSignature(payload: MailchimpWebhookPayload, signature: string): boolean {
    try {
      const webhookSecret = process.env.MAILCHIMP_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn('MAILCHIMP_WEBHOOK_SECRET not configured, skipping signature validation');
        return true; // Allow if not configured (development)
      }

      // Mailchimp signs the request body
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature.replace('sha256=', ''), 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Map Mailchimp/Mandrill event types to our internal types
   */
  private mapMailchimpEventType(mailchimpType: string): MailchimpEventType | null {
    if (!mailchimpType || typeof mailchimpType !== 'string') {
      return null;
    }

    // Mandrill uses different event names than generic Mailchimp
    const typeMap: { [key: string]: MailchimpEventType } = {
      'send': 'sent',
      'deferral': 'sent', // Temporary failure, will retry
      'delivered': 'delivered',
      'hard_bounce': 'bounced',
      'soft_bounce': 'bounced',
      'bounce': 'bounced',
      'open': 'opened',
      'click': 'clicked',
      'unsubscribe': 'unsubscribed',
      'unsub': 'unsubscribed',
      'spam': 'complained',
      'reject': 'rejected',
      'blacklist': 'rejected',
      'whitelist': 'delivered'
    };

    return typeMap[mailchimpType.toLowerCase()] || null;
  }

  /**
   * Find the digest associated with an email event
   */
  private async findDigestForEmail(email: string, eventTimestamp: string): Promise<string | null> {
    try {
      // Look for digests sent around the same time as the event
      const eventTime = new Date(eventTimestamp);
      const searchStart = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
      const searchEnd = new Date(eventTime.getTime() + 1 * 60 * 60 * 1000);     // 1 hour after

      const digestsSnapshot = await db.collection('email_digests')
        .where('sentAt', '>=', searchStart.toISOString())
        .where('sentAt', '<=', searchEnd.toISOString())
        .orderBy('sentAt', 'desc')
        .limit(10)
        .get();

      // For now, return the most recent digest in the time window
      // TODO: In the future, we could store message IDs to make exact matches
      if (!digestsSnapshot.empty) {
        const mostRecentDigest = digestsSnapshot.docs[0];
        logger.info(`Associated email event with digest ${mostRecentDigest.id} for ${email}`);
        return mostRecentDigest.id;
      }

      return null;
    } catch (error) {
      logger.error('Error finding digest for email:', error);
      return null;
    }
  }

  /**
   * Update aggregate analytics for a digest
   */
  private async updateDigestAnalytics(digestId: string): Promise<void> {
    try {
      // Get all analytics for this digest
      const analyticsSnapshot = await db.collection('email_analytics')
        .where('digestId', '==', digestId)
        .get();

      if (analyticsSnapshot.empty) return;

      const events = analyticsSnapshot.docs.map(doc => doc.data() as EmailAnalyticsRecord);
      const summary = this.calculateAnalyticsSummary(events);

      // Update the digest document
      await db.collection('email_digests').doc(digestId).update({
        analytics: summary
      });

      logger.info(`Updated analytics for digest ${digestId}`);
    } catch (error) {
      logger.error(`Error updating digest analytics for ${digestId}:`, error);
    }
  }

  /**
   * Calculate analytics summary from events
   */
  private calculateAnalyticsSummary(events: EmailAnalyticsRecord[]): EmailAnalyticsSummary {
    const counts = {
      sent: 0,
      delivered: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      unsubscribed: 0,
      complained: 0,
      rejected: 0
    };

    // Count events by type
    events.forEach(event => {
      if (event.eventType === 'sent') counts.sent++;
      else if (event.eventType === 'delivered') counts.delivered++;
      else if (event.eventType === 'bounced') counts.bounced++;
      else if (event.eventType === 'opened') counts.opened++;
      else if (event.eventType === 'clicked') counts.clicked++;
      else if (event.eventType === 'unsubscribed') counts.unsubscribed++;
      else if (event.eventType === 'complained') counts.complained++;
      else if (event.eventType === 'rejected') counts.rejected++;
    });

    // Calculate rates
    const totalSent = Math.max(counts.sent, 1); // Avoid division by zero
    const delivered = Math.max(counts.delivered, 1); // Avoid division by zero

    return {
      totalSent: counts.sent,
      delivered: counts.delivered,
      bounced: counts.bounced,
      opened: counts.opened,
      clicked: counts.clicked,
      unsubscribed: counts.unsubscribed,
      complained: counts.complained,
      rejected: counts.rejected,
      deliveryRate: Math.round((counts.delivered / totalSent) * 100),
      openRate: Math.round((counts.opened / delivered) * 100),
      clickRate: Math.round((counts.clicked / delivered) * 100),
      bounceRate: Math.round((counts.bounced / totalSent) * 100),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Generate unique ID for analytics record
   */
  private generateAnalyticsId(): string {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const emailWebhookService = new EmailWebhookService();