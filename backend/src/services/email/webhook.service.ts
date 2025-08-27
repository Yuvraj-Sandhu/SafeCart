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
  MailchimpEventType
} from '../../types/email-analytics.types';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

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
      const recipientEmail = payload.data.email;
      if (!recipientEmail) {
        logger.warn('No recipient email found in webhook payload');
        return { success: false, error: 'Missing recipient email' };
      }

      // Extract message ID for duplicate prevention
      const messageId = payload.data.id;
      if (!messageId) {
        logger.warn('No message ID found in webhook payload');
        return { success: false, error: 'Missing message ID' };
      }

      // Extract digest ID from metadata (headers aren't included in Mandrill webhooks)
      let digestId = payload.data.metadata?.['digest_id'] || payload.data.metadata?.digest_id;
      
      // If no digest ID in metadata, try time-based matching as fallback
      if (!digestId) {
        const foundDigestId = await this.findDigestForEmail(recipientEmail, payload.fired_at || new Date().toISOString());
        if (!foundDigestId) {
          logger.warn(`No digest found for analytics event from ${recipientEmail}`);
          return { success: true, processed: false };
        }
        digestId = foundDigestId;
        // logger.info(`Analytics event matched to digest via time: ${digestId}`);
      } else {
        // logger.info(`Analytics event matched to digest via metadata: ${digestId}`);
      }

      // Directly update digest analytics with bulletproof duplicate prevention
      const result = await this.updateDigestAnalyticsDirect(digestId, eventType, messageId, recipientEmail);
      
      if (result.success) {
        // logger.info(`Processed ${eventType} event for ${recipientEmail} (digest: ${digestId}, duplicate: ${result.isDuplicate})`);
      } else {
        logger.error(`Failed to update analytics for digest ${digestId}: ${result.error}`);
      }

      return { success: result.success, processed: !result.isDuplicate };
    } catch (error) {
      logger.error('Error processing webhook:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get analytics summary for a specific digest (reads directly from digest)
   */
  async getDigestAnalytics(digestId: string): Promise<any | null> {
    try {
      const digestDoc = await db.collection('email_digests').doc(digestId).get();
      
      if (!digestDoc.exists) {
        return null;
      }

      return digestDoc.data()?.analytics || null;
    } catch (error) {
      logger.error(`Error getting digest analytics for ${digestId}:`, error);
      return null;
    }
  }

  /**
   * Validate webhook signature from Mailchimp/Mandrill
   * Note: This method needs the raw request data for Mandrill signatures
   */
  private validateSignature(payload: MailchimpWebhookPayload, signature: string): boolean {
    // This is handled differently for Mandrill - see validateMandrillSignature
    return true;
  }

  /**
   * Validate Mandrill webhook signature
   * Per Mandrill docs:
   * 1. Start with webhook URL exactly as entered in Mailchimp
   * 2. Append each POST variable's key and value with NO delimiter
   * 3. Hash with HMAC-SHA1 using webhook authentication key
   * 4. Base64 encode the result
   */
  validateMandrillSignature(webhookUrl: string, params: Record<string, any>, signature: string): boolean {
    try {
      const webhookSecret = process.env.MAILCHIMP_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn('MAILCHIMP_WEBHOOK_SECRET not configured, skipping signature validation');
        return true; // Allow if not configured (development)
      }

      // Start with the webhook URL
      let signedData = webhookUrl;

      // Sort POST parameters alphabetically by key
      // Append each key and value with NO delimiter (no = or &)
      const sortedKeys = Object.keys(params).sort();
      for (const key of sortedKeys) {
        const value = typeof params[key] === 'string' ? params[key] : JSON.stringify(params[key]);
        signedData += key + value;
      }

      // Generate HMAC-SHA1 signature
      const expectedSignature = crypto
        .createHmac('sha1', webhookSecret)
        .update(signedData)
        .digest('base64');

      // Log signature details for debugging
      // logger.info('Mandrill signature validation:', {
      //   webhookUrl,
      //   paramKeys: sortedKeys,
      //   signedDataPreview: signedData.substring(0, 200) + '...',
      //   signedDataLength: signedData.length,
      //   receivedSignature: signature.substring(0, 10) + '...',
      //   expectedSignature: expectedSignature.substring(0, 10) + '...',
      //   match: signature === expectedSignature
      // });

      // Compare signatures
      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error validating Mandrill webhook signature:', error);
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
        // logger.info(`Associated email event with digest ${mostRecentDigest.id} for ${email}`);
        return mostRecentDigest.id;
      }

      return null;
    } catch (error) {
      logger.error('Error finding digest for email:', error);
      return null;
    }
  }

  /**
   * Directly update digest analytics with bulletproof duplicate prevention
   * Uses atomic operations to prevent race conditions
   * Uses separate collection for processed events (future-proof approach)
   */
  private async updateDigestAnalyticsDirect(
    digestId: string, 
    eventType: MailchimpEventType, 
    messageId: string,
    recipientEmail: string
  ): Promise<{ success: boolean; isDuplicate?: boolean; error?: string }> {
    try {
      // Create a unique event key with recipient email hash to prevent duplicate processing
      // This ensures each recipient's events are tracked separately
      const emailHash = this.hashEmail(recipientEmail);
      const eventKey = `${digestId}_${messageId}_${eventType}_${emailHash}`;
      
      // Use a transaction for atomic operations and duplicate prevention
      const result = await db.runTransaction(async (transaction) => {
        // Check for duplicate in processed_events collection
        const processedEventRef = db.collection('processed_events').doc(eventKey);
        const processedEventDoc = await transaction.get(processedEventRef);
        
        // If event already processed, return as duplicate
        if (processedEventDoc.exists) {
          return { isDuplicate: true };
        }
        
        // Get the digest document
        const digestRef = db.collection('email_digests').doc(digestId);
        const digestDoc = await transaction.get(digestRef);
        
        // Check if digest exists
        if (!digestDoc.exists) {
          throw new Error(`Digest ${digestId} does not exist`);
        }
        
        const digestData = digestDoc.data();
        
        // Ensure digestData exists (TypeScript safety)
        if (!digestData) {
          throw new Error(`Digest ${digestId} data is undefined`);
        }
        
        // Initialize analytics structure if it doesn't exist
        if (!digestData.analytics) {
          const initialAnalytics = {
            totalSent: 0,
            delivered: 0,
            bounced: 0,
            opened: 0,
            clicked: 0,
            unsubscribed: 0,
            complained: 0,
            rejected: 0,
            deliveryRate: 0,
            openRate: 0,
            clickRate: 0,
            bounceRate: 0,
            lastUpdated: new Date().toISOString()
          };
          
          // Set initial analytics structure
          transaction.update(digestRef, { analytics: initialAnalytics });
        }
        
        // Mark this event as processed in the processed_events collection
        transaction.set(processedEventRef, {
          digestId: digestId,
          messageId: messageId,
          eventType: eventType,
          recipientEmail: recipientEmail,
          processedAt: new Date().toISOString()
        });
        
        // Update the specific counter based on event type
        const updates: any = {
          'analytics.lastUpdated': new Date().toISOString()
        };
        
        // Increment the appropriate counter atomically
        switch (eventType) {
          case 'sent':
            updates['analytics.totalSent'] = FieldValue.increment(1);
            break;
          case 'delivered':
            updates['analytics.delivered'] = FieldValue.increment(1);
            break;
          case 'bounced':
            updates['analytics.bounced'] = FieldValue.increment(1);
            break;
          case 'opened':
            updates['analytics.opened'] = FieldValue.increment(1);
            break;
          case 'clicked':
            updates['analytics.clicked'] = FieldValue.increment(1);
            break;
          case 'unsubscribed':
            updates['analytics.unsubscribed'] = FieldValue.increment(1);
            break;
          case 'complained':
            updates['analytics.complained'] = FieldValue.increment(1);
            break;
          case 'rejected':
            updates['analytics.rejected'] = FieldValue.increment(1);
            break;
        }
        
        // Update the document
        transaction.update(digestRef, updates);
        
        // After updating counts, recalculate rates
        // Note: This requires a second transaction since we need the updated values
        return { isDuplicate: false };
      });
      
      // If not a duplicate, update the calculated rates
      if (!result.isDuplicate) {
        await this.updateAnalyticsRates(digestId);
      }
      
      return { success: true, isDuplicate: result.isDuplicate };
    } catch (error) {
      logger.error(`Error updating digest analytics for ${digestId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Update calculated analytics rates (delivery rate, open rate, etc.)
   * Called after counters are updated
   */
  private async updateAnalyticsRates(digestId: string): Promise<void> {
    try {
      const digestDoc = await db.collection('email_digests').doc(digestId).get();
      if (!digestDoc.exists) return;
      
      const analytics = digestDoc.data()?.analytics;
      if (!analytics) return;
      
      // Calculate rates safely (avoid division by zero)
      const totalSent = Math.max(analytics.totalSent || 0, 1);
      const delivered = Math.max(analytics.delivered || 0, 1);
      
      const rates = {
        'analytics.deliveryRate': Math.round((analytics.delivered / totalSent) * 100),
        'analytics.openRate': Math.round((analytics.opened / delivered) * 100),
        'analytics.clickRate': Math.round((analytics.clicked / delivered) * 100),
        'analytics.bounceRate': Math.round((analytics.bounced / totalSent) * 100)
      };
      
      await db.collection('email_digests').doc(digestId).update(rates);
    } catch (error) {
      logger.error(`Error updating analytics rates for ${digestId}:`, error);
    }
  }

  /**
   * Generate a consistent hash for email addresses
   * Creates a short, privacy-friendly identifier
   */
  private hashEmail(email: string): string {
    // Use crypto to create a consistent hash
    // Take first 8 characters for reasonable document ID length
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Optional: Clean up old processed events (can be run periodically)
   * Removes processed events older than specified days
   */
  async cleanupOldProcessedEvents(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTimestamp = cutoffDate.toISOString();
      
      // Query for old processed events
      const snapshot = await db.collection('processed_events')
        .where('processedAt', '<', cutoffTimestamp)
        .limit(500) // Process in batches to avoid timeouts
        .get();
      
      if (snapshot.empty) {
        return 0;
      }
      
      // Delete in batches
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      // logger.info(`Cleaned up ${snapshot.size} old processed events`);
      return snapshot.size;
    } catch (error) {
      logger.error('Error cleaning up processed events:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const emailWebhookService = new EmailWebhookService();