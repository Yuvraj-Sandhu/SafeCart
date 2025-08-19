/**
 * Email Queue Service
 * 
 * Manages email queue operations for USDA Daily and FDA Weekly digests.
 * Handles queue creation, management, and digest sending operations.
 * 
 * @author Yuvraj
 */

import * as admin from 'firebase-admin';
import { EmailService } from './email.service';
import { EmailDigestService, RecallData } from './digest.service';
import { EmailRenderService } from './render.service';
import logger from '../../utils/logger';

const db = admin.firestore();

/**
 * Email Queue Interface
 */
export interface EmailQueue {
  id: string;
  type: 'USDA_DAILY' | 'FDA_WEEKLY';
  status: 'pending' | 'processing' | 'sent' | 'cancelled';
  recallIds: string[];
  scheduledFor: string | null; // ISO string
  createdAt: string; // ISO string
  lastUpdated: string; // ISO string
}

/**
 * Email Digest Record Interface
 */
export interface EmailDigestRecord {
  id: string;
  type: 'manual' | 'usda_daily' | 'fda_weekly' | 'test';
  sentAt: Date;
  sentBy: string;
  recallCount: number;
  totalRecipients: number;
  recalls: Array<{
    id: string;
    title: string;
    source: 'USDA' | 'FDA';
  }>;
  emailHtml?: string;
  queueId?: string;
}

/**
 * Email Queue Service Class
 */
export class EmailQueueService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Get all queues (USDA and FDA)
   */
  async getQueues(): Promise<{ usda: EmailQueue | null; fda: EmailQueue | null }> {
    try {
      // Get today's USDA queue
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '_');
      const usdaQueueId = `usda_daily_${today}`;
      
      const usdaDoc = await db.collection('email_queues').doc(usdaQueueId).get();
      let usdaQueue: EmailQueue | null = null;
      
      if (usdaDoc.exists) {
        const data = usdaDoc.data()!;
        usdaQueue = {
          id: usdaDoc.id,
          type: data.type,
          status: data.status,
          recallIds: data.recallIds || [],
          scheduledFor: data.scheduledFor ? this.convertFirestoreTimestamp(data.scheduledFor) : null,
          createdAt: data.createdAt ? this.convertFirestoreTimestamp(data.createdAt) : new Date().toISOString(),
          lastUpdated: data.lastUpdated ? this.convertFirestoreTimestamp(data.lastUpdated) : new Date().toISOString()
        } as any;
      }

      // Get current week's FDA queue
      const week = this.getWeekNumber(new Date());
      const year = new Date().getFullYear();
      const fdaQueueId = `fda_weekly_${year}_w${String(week).padStart(2, '0')}`;
      
      const fdaDoc = await db.collection('email_queues').doc(fdaQueueId).get();
      let fdaQueue: EmailQueue | null = null;
      
      if (fdaDoc.exists) {
        const data = fdaDoc.data()!;
        fdaQueue = {
          id: fdaDoc.id,
          type: data.type,
          status: data.status,
          recallIds: data.recallIds || [],
          scheduledFor: data.scheduledFor ? this.convertFirestoreTimestamp(data.scheduledFor) : null,
          createdAt: data.createdAt ? this.convertFirestoreTimestamp(data.createdAt) : new Date().toISOString(),
          lastUpdated: data.lastUpdated ? this.convertFirestoreTimestamp(data.lastUpdated) : new Date().toISOString()
        } as any;
      }

      return { usda: usdaQueue, fda: fdaQueue };
    } catch (error) {
      logger.error('Error getting queues:', error);
      throw error;
    }
  }

  /**
   * Get queue preview with full recall details
   */
  async getQueuePreview(queueType: 'USDA_DAILY' | 'FDA_WEEKLY'): Promise<{
    queue: EmailQueue;
    recalls: RecallData[];
    imageStats: { total: number; withImages: number };
  }> {
    try {
      const queues = await this.getQueues();
      const queue = queueType === 'USDA_DAILY' ? queues.usda : queues.fda;
      
      if (!queue) {
        throw new Error(`No ${queueType} queue found`);
      }

      // Fetch all recalls by their IDs
      const recalls = await this.getRecallsByIds(queue.recallIds);
      
      // Calculate image stats
      const imageStats = {
        total: recalls.length,
        withImages: recalls.filter(r => r.primaryImage).length
      };

      return { queue, recalls, imageStats };
    } catch (error) {
      logger.error('Error getting queue preview:', error);
      throw error;
    }
  }

  /**
   * Update queue (remove recalls)
   */
  async updateQueue(queueType: 'USDA_DAILY' | 'FDA_WEEKLY', recallIds: string[]): Promise<void> {
    try {
      const queues = await this.getQueues();
      const queue = queueType === 'USDA_DAILY' ? queues.usda : queues.fda;
      
      if (!queue) {
        throw new Error(`No ${queueType} queue found`);
      }

      await db.collection('email_queues').doc(queue.id).update({
        recallIds,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Error updating queue:', error);
      throw error;
    }
  }

  /**
   * Send queue to all subscribers
   */
  async sendQueue(queueType: 'USDA_DAILY' | 'FDA_WEEKLY', sentBy: string = 'system'): Promise<EmailDigestRecord> {
    try {
      const queues = await this.getQueues();
      const queue = queueType === 'USDA_DAILY' ? queues.usda : queues.fda;
      
      if (!queue) {
        throw new Error(`No ${queueType} queue found`);
      }

      // Update queue status to processing
      await db.collection('email_queues').doc(queue.id).update({
        status: 'processing'
      });

      // Fetch recalls
      const recalls = await this.getRecallsByIds(queue.recallIds);
      
      // Get all subscribed users grouped by state
      const subscribersByState = await this.getSubscribersByState();
      
      // Debug logging
      logger.info(`Found ${Object.keys(subscribersByState).length} states with subscribers`);
      logger.info(`Total recalls in queue: ${recalls.length}`);
      for (const [state, subscribers] of Object.entries(subscribersByState)) {
        logger.info(`State ${state}: ${subscribers.length} subscribers`);
      }
      
      let totalRecipients = 0;
      const failedSends: string[] = [];

      // Generate email HTML for storage (using first state with recalls as template)
      let digestHtml = '';
      const statesWithRecalls = Object.entries(subscribersByState).find(([state, subscribers]) => {
        const stateRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          return affectedStates.includes(state);
        });
        return stateRecalls.length > 0 && subscribers.length > 0;
      });

      if (statesWithRecalls) {
        const [sampleState, sampleSubscribers] = statesWithRecalls;
        const sampleRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          return affectedStates.includes(sampleState);
        });

        const sampleDigestData = {
          user: {
            name: sampleSubscribers[0].name || 'SafeCart User',
            email: sampleSubscribers[0].email,
            unsubscribeToken: sampleSubscribers[0].emailPreferences?.unsubscribeToken || ''
          },
          state: sampleState,
          recalls: sampleRecalls,
          digestDate: new Date().toISOString(),
          isTest: false
        };

        const sampleEmailOptions = await EmailRenderService.renderRecallDigest(sampleDigestData);
        digestHtml = sampleEmailOptions.html;
        logger.info(`Generated email HTML length: ${digestHtml?.length || 0} characters`);
      } else {
        logger.warn('No states with both recalls and subscribers found for email HTML generation');
      }

      // Send state-specific emails
      for (const [state, subscribers] of Object.entries(subscribersByState)) {
        // Filter recalls affecting this state
        const stateRecalls = recalls.filter(recall => {
          // Check if recall affects this state
          const affectedStates = this.getAffectedStates(recall);
          return affectedStates.includes(state);
        });

        if (stateRecalls.length > 0) {
          logger.info(`Sending ${stateRecalls.length} recalls to ${subscribers.length} subscribers in ${state}`);
          // Send to all subscribers in this state
          for (const subscriber of subscribers) {
            try {
              const digestData = {
                user: {
                  name: subscriber.name || 'SafeCart User',
                  email: subscriber.email,
                  unsubscribeToken: subscriber.emailPreferences?.unsubscribeToken || ''
                },
                state,
                recalls: stateRecalls,
                digestDate: new Date().toISOString(),
                isTest: false
              };

              const emailOptions = await EmailRenderService.renderRecallDigest(digestData);
              const result = await this.emailService.sendEmail(emailOptions);
              
              if (result.success) {
                logger.info(`Email sent successfully to ${subscriber.email}`);
                totalRecipients++;
              } else {
                logger.error(`Email failed to ${subscriber.email}: ${result.error}`);
                failedSends.push(subscriber.email);
              }
            } catch (error) {
              logger.error(`Failed to send email to ${subscriber.email}:`, error);
              failedSends.push(subscriber.email);
            }
          }
        } else {
          logger.info(`No recalls for state ${state}, skipping ${subscribers.length} subscribers`);
        }
      }

      // Retry failed sends after 3 seconds
      if (failedSends.length > 0) {
        setTimeout(async () => {
          for (const email of failedSends) {
            try {
              // Retry logic here
              logger.info(`Retrying email to ${email}`);
            } catch (error) {
              logger.error(`Retry failed for ${email}:`, error);
            }
          }
        }, 3000);
      }

      // Create digest record
      const digestRecord: EmailDigestRecord = {
        id: `digest_${Date.now()}`,
        type: queueType === 'USDA_DAILY' ? 'usda_daily' : 'fda_weekly',
        sentAt: new Date(),
        sentBy,
        recallCount: recalls.length,
        totalRecipients,
        recalls: recalls.map(r => ({
          id: r.id,
          title: r.title,
          source: r.source
        })),
        emailHtml: digestHtml, // Store sample email HTML for preview
        queueId: queue.id
      };

      // Save to email_digests collection
      await db.collection('email_digests').doc(digestRecord.id).set(digestRecord);

      // Delete the queue
      await db.collection('email_queues').doc(queue.id).delete();

      return digestRecord;
    } catch (error) {
      logger.error('Error sending queue:', error);
      throw error;
    }
  }

  /**
   * Cancel/delete a queue
   */
  async cancelQueue(queueType: 'USDA_DAILY' | 'FDA_WEEKLY'): Promise<void> {
    try {
      const queues = await this.getQueues();
      const queue = queueType === 'USDA_DAILY' ? queues.usda : queues.fda;
      
      if (!queue) {
        throw new Error(`No ${queueType} queue found`);
      }

      await db.collection('email_queues').doc(queue.id).delete();
    } catch (error) {
      logger.error('Error canceling queue:', error);
      throw error;
    }
  }

  /**
   * Send manual digest (no queue)
   */
  async sendManualDigest(
    recallIds: string[], 
    sentBy: string
  ): Promise<EmailDigestRecord> {
    try {
      // Fetch recalls
      const recalls = await this.getRecallsByIds(recallIds);
      
      // Get all subscribed users grouped by state
      const subscribersByState = await this.getSubscribersByState();
      
      let totalRecipients = 0;

      // Generate email HTML for storage (using first state with recalls as template)
      let digestHtml = '';
      const statesWithRecalls = Object.entries(subscribersByState).find(([state, subscribers]) => {
        const stateRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          return affectedStates.includes(state);
        });
        return stateRecalls.length > 0 && subscribers.length > 0;
      });

      if (statesWithRecalls) {
        const [sampleState, sampleSubscribers] = statesWithRecalls;
        const sampleRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          return affectedStates.includes(sampleState);
        });

        const sampleDigestData = {
          user: {
            name: sampleSubscribers[0].name || 'SafeCart User',
            email: sampleSubscribers[0].email,
            unsubscribeToken: sampleSubscribers[0].emailPreferences?.unsubscribeToken || ''
          },
          state: sampleState,
          recalls: sampleRecalls,
          digestDate: new Date().toISOString(),
          isTest: false
        };

        const sampleEmailOptions = await EmailRenderService.renderRecallDigest(sampleDigestData);
        digestHtml = sampleEmailOptions.html;
        logger.info(`Generated email HTML length: ${digestHtml?.length || 0} characters`);
      } else {
        logger.warn('No states with both recalls and subscribers found for email HTML generation');
      }

      // Send state-specific emails
      for (const [state, subscribers] of Object.entries(subscribersByState)) {
        // Filter recalls affecting this state
        const stateRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          return affectedStates.includes(state);
        });

        if (stateRecalls.length > 0) {
          // Send to all subscribers in this state
          for (const subscriber of subscribers) {
            try {
              const digestData = {
                user: {
                  name: subscriber.name || 'SafeCart User',
                  email: subscriber.email,
                  unsubscribeToken: subscriber.emailPreferences?.unsubscribeToken || ''
                },
                state,
                recalls: stateRecalls,
                digestDate: new Date().toISOString(),
                isTest: false
              };

              const emailOptions = await EmailRenderService.renderRecallDigest(digestData);
              await this.emailService.sendEmail(emailOptions);
              
              totalRecipients++;
            } catch (error) {
              logger.error(`Failed to send manual digest to ${subscriber.email}:`, error);
            }
          }
        }
      }

      // Create digest record
      const digestRecord: EmailDigestRecord = {
        id: `digest_${Date.now()}`,
        type: 'manual',
        sentAt: new Date(),
        sentBy,
        recallCount: recalls.length,
        totalRecipients,
        recalls: recalls.map(r => ({
          id: r.id,
          title: r.title,
          source: r.source
        })),
        emailHtml: digestHtml // Store sample email HTML for preview
      };

      // Save to email_digests collection
      await db.collection('email_digests').doc(digestRecord.id).set(digestRecord);

      return digestRecord;
    } catch (error) {
      logger.error('Error sending manual digest:', error);
      throw error;
    }
  }

  /**
   * Get email history
   */
  async getEmailHistory(page: number = 1, limit: number = 10): Promise<{
    digests: EmailDigestRecord[];
    totalPages: number;
  }> {
    try {
      // Get total count
      const totalSnapshot = await db.collection('email_digests').get();
      const total = totalSnapshot.size;
      const totalPages = Math.ceil(total / limit);

      // Get paginated results
      const offset = (page - 1) * limit;
      const snapshot = await db.collection('email_digests')
        .orderBy('sentAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const digests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmailDigestRecord[];

      return { digests, totalPages };
    } catch (error) {
      logger.error('Error getting email history:', error);
      throw error;
    }
  }

  /**
   * Private helper: Get recalls by IDs
   */
  private async getRecallsByIds(recallIds: string[]): Promise<RecallData[]> {
    const recalls: RecallData[] = [];

    for (const recallId of recallIds) {
      try {
        // Try USDA collection first
        const usdaDoc = await db.collection('recalls').doc(recallId).get();
        if (usdaDoc.exists) {
          const data = usdaDoc.data();
          recalls.push({
            id: usdaDoc.id,
            title: data?.display?.previewTitle || data?.llmTitle || data?.field_title || 'Food Recall',
            company: EmailDigestService.extractCompanyName(data?.field_summary),
            recallDate: data?.field_recall_date,
            classification: data?.field_risk_level,
            description: data?.field_summary || 'No description available',
            reason: data?.field_product_items || 'Contamination concerns',
            primaryImage: EmailDigestService.getPrimaryImage(data),
            recallUrl: data?.display?.previewUrl,
            source: 'USDA' as const,
            affectedStates: data?.affectedStatesArray || []
          });
          continue;
        }

        // Try FDA collection
        const fdaDoc = await db.collection('fda_recalls').doc(recallId).get();
        if (fdaDoc.exists) {
          const data = fdaDoc.data();
          recalls.push({
            id: fdaDoc.id,
            title: data?.display?.previewTitle || data?.llmTitle || data?.product_description || 'Food Recall',
            company: data?.recalling_firm || 'Unknown Company',
            recallDate: data?.report_date,
            classification: data?.classification,
            description: data?.product_description || 'No description available',
            reason: data?.reason_for_recall || 'Safety concerns',
            primaryImage: EmailDigestService.getPrimaryImage(data),
            recallUrl: data?.display?.previewUrl,
            source: 'FDA' as const,
            affectedStates: data?.manualStatesOverride || data?.affectedStatesArray || []
          });
        }
      } catch (error) {
        logger.error(`Error fetching recall ${recallId}:`, error);
      }
    }

    return recalls;
  }

  /**
   * Private helper: Get subscribers grouped by state
   */
  private async getSubscribersByState(): Promise<{ [state: string]: any[] }> {
    logger.info('Querying for subscribed users...');
    
    const snapshot = await db.collection('users')
      .where('emailPreferences.subscribed', '==', true)
      .get();

    logger.info(`Found ${snapshot.size} users with subscribed=true`);

    const subscribersByState: { [state: string]: any[] } = {};

    snapshot.docs.forEach(doc => {
      const user = doc.data();
      const userEmail = user.email || doc.id;
      
      logger.info(`Processing user: ${userEmail}`);
      logger.info(`User emailPreferences:`, JSON.stringify(user.emailPreferences, null, 2));
      
      const states = user.emailPreferences?.states || [];
      logger.info(`User ${userEmail} subscribed to states: [${states.join(', ')}]`);
      
      states.forEach((state: string) => {
        if (!subscribersByState[state]) {
          subscribersByState[state] = [];
        }
        subscribersByState[state].push(user);
        logger.info(`Added user ${userEmail} to state ${state}`);
      });
    });

    logger.info(`Final subscriber distribution:`, Object.keys(subscribersByState).map(state => 
      `${state}: ${subscribersByState[state].length} subscribers`
    ));

    return subscribersByState;
  }

  /**
   * Private helper: Get affected states from recall
   */
  private getAffectedStates(recall: RecallData): string[] {
    return recall.affectedStates || [];
  }

  /**
   * Private helper: Get week number
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Private helper: Convert Firestore timestamp to ISO string
   */
  private convertFirestoreTimestamp(timestamp: any): string {
    // Handle Firestore Timestamp objects that have been serialized
    if (timestamp && timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000).toISOString();
    }
    // Handle native Firestore Timestamp objects (if they have toDate method)
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    // Handle regular Date objects
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    // Handle ISO strings (already converted)
    if (typeof timestamp === 'string') {
      return timestamp;
    }
    // Fallback
    return new Date().toISOString();
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();