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
import { EmailAnalyticsSummary } from '../../types/email-analytics.types';
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
  sentAt: Date | string; // Date when stored, string (ISO) when returned from API
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
  analytics?: EmailAnalyticsSummary; // Analytics from Mailchimp webhooks
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
   * Get all queues (USDA and FDA) - Updated to match sync service naming convention
   */
  async getQueues(): Promise<{ usda: EmailQueue | null; fda: EmailQueue | null }> {
    try {
      // Get today's USDA queue (matches sync service naming: USDA_DAILY_YYYY-MM-DD)
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const usdaQueueId = `USDA_DAILY_${todayString}`;
      
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

      // Get current week's FDA queue (matches sync service naming: FDA_WEEKLY_YYYY-MM-DD where date is Monday)
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      // If today is Sunday (0), go back 6 days, otherwise go back (dayOfWeek - 1) days
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      monday.setDate(monday.getDate() - daysToSubtract);
      monday.setHours(0, 0, 0, 0);
      
      const weekStart = monday.toISOString().split('T')[0]; // YYYY-MM-DD format for Monday
      const fdaQueueId = `FDA_WEEKLY_${weekStart}`;
      
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
      
      // // Debug logging
      // logger.info(`Found ${Object.keys(subscribersByState).length} states with subscribers`);
      // logger.info(`Total recalls in queue: ${recalls.length}`);
      // for (const [state, subscribers] of Object.entries(subscribersByState)) {
      //   logger.info(`State ${state}: ${subscribers.length} subscribers`);
      // }
      
      let totalRecipients = 0;
      const failedSends: string[] = [];

      // Generate email HTML for storage (using first state with recalls as template)
      let digestHtml = '';
      const statesWithRecalls = Object.entries(subscribersByState).find(([state, subscribers]) => {
        const stateRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          const isStateSpecific = affectedStates.includes(state);
          const isNationwide = affectedStates.includes('Nationwide');
          const isAllStatesSubscription = state === 'ALL';
          
          // Include recall if:
          // 1. It specifically affects this state, OR
          // 2. It's a nationwide recall (affects all states), OR  
          // 3. User subscribed to "ALL" states (receives everything)
          return isStateSpecific || isNationwide || isAllStatesSubscription;
        });
        return stateRecalls.length > 0 && subscribers.length > 0;
      });

      if (statesWithRecalls) {
        const [sampleState, sampleSubscribers] = statesWithRecalls;
        const sampleRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          const isStateSpecific = affectedStates.includes(sampleState);
          const isNationwide = affectedStates.includes('Nationwide');
          const isAllStatesSubscription = sampleState === 'ALL';
          
          // Include recall if:
          // 1. It specifically affects this state, OR
          // 2. It's a nationwide recall (affects all states), OR  
          // 3. User subscribed to "ALL" states (receives everything)
          return isStateSpecific || isNationwide || isAllStatesSubscription;
        });

        const sampleDigestData = {
          user: {
            name: sampleSubscribers[0].name || 'SafeCart User',
            email: sampleSubscribers[0].email,
            unsubscribeToken: sampleSubscribers[0].emailPreferences?.unsubscribeToken || ''
          },
          state: 'ALL', // Use 'ALL' to show all recalls in preview HTML
          states: ['ALL'], // Pass as array for consistency
          recalls: recalls, // Include all recalls, not just state-filtered ones
          digestDate: new Date().toISOString(),
          isTest: false
        };

        const sampleEmailOptions = await EmailRenderService.renderRecallDigest(sampleDigestData);
        digestHtml = sampleEmailOptions.html;
      } else {
        logger.warn('No states with both recalls and subscribers found for email HTML generation');
      }

      // Generate digest ID first for analytics tracking
      const digestId = this.generateDigestId();

      // Collect all unique subscribers from all states
      const allSubscribers: any[] = [];
      for (const stateSubscribers of Object.values(subscribersByState)) {
        allSubscribers.push(...stateSubscribers);
      }

      // Process each subscriber individually (one email per user with all their relevant recalls)
      const processedEmails = new Set<string>(); // Track processed emails to avoid duplicates
      
      for (const subscriber of allSubscribers) {
        // Skip if we've already processed this email (user might be in multiple state groups)
        if (processedEmails.has(subscriber.email)) {
          continue;
        }
        processedEmails.add(subscriber.email);
        
        // Get user's subscribed states
        const userStates = subscriber.emailPreferences?.states || [];
        
        // Skip if user has no state preferences
        if (userStates.length === 0) {
          logger.warn(`Skipping ${subscriber.email} - no state preferences`);
          continue;
        }
        
        // Get all unique recalls relevant to this user's subscribed states
        const userRecalls = this.getRecallsForUser(recalls, userStates);
        
        // Skip if no recalls affect user's states
        if (userRecalls.length === 0) {
          logger.info(`No recalls for ${subscriber.email} in states: ${userStates.join(', ')}`);
          continue;
        }
        
        try {
          // Generate smart email title based on affected states
          const emailTitle = this.generateEmailTitle(userRecalls, userStates);
          
          // Create digest data with all user's recalls
          const digestData = {
            user: {
              name: subscriber.name || 'SafeCart User',
              email: subscriber.email,
              unsubscribeToken: subscriber.emailPreferences?.unsubscribeToken || ''
            },
            state: userStates.join(', '), // Show all user's states
            states: userStates, // Pass the array of states for the template
            recalls: userRecalls,
            digestDate: new Date().toISOString(),
            isTest: false
          };

          const emailOptions = await EmailRenderService.renderRecallDigest(digestData);
          
          // Override the subject with our smart title
          emailOptions.subject = `${emailTitle} - SafeCart Alert`;
          
          // Add digest ID for analytics tracking
          emailOptions.digestId = digestId;
          
          const result = await this.sendEmailWithRetry(emailOptions, subscriber.email);
          
          if (result.success) {
            logger.info(`Sent ${userRecalls.length} recalls to ${subscriber.email} for states: ${userStates.join(', ')}`);
            totalRecipients++;
          } else {
            logger.error(`Email failed to ${subscriber.email} after retries: ${result.error}`);
            failedSends.push(subscriber.email);
          }
        } catch (error) {
          logger.error(`Failed to send email to ${subscriber.email}:`, error);
          failedSends.push(subscriber.email);
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

      const digestRecord: EmailDigestRecord = {
        id: digestId,
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
          const isStateSpecific = affectedStates.includes(state);
          const isNationwide = affectedStates.includes('Nationwide');
          const isAllStatesSubscription = state === 'ALL';
          
          // Include recall if:
          // 1. It specifically affects this state, OR
          // 2. It's a nationwide recall (affects all states), OR  
          // 3. User subscribed to "ALL" states (receives everything)
          return isStateSpecific || isNationwide || isAllStatesSubscription;
        });
        return stateRecalls.length > 0 && subscribers.length > 0;
      });

      if (statesWithRecalls) {
        const [sampleState, sampleSubscribers] = statesWithRecalls;
        const sampleRecalls = recalls.filter(recall => {
          const affectedStates = this.getAffectedStates(recall);
          const isStateSpecific = affectedStates.includes(sampleState);
          const isNationwide = affectedStates.includes('Nationwide');
          const isAllStatesSubscription = sampleState === 'ALL';
          
          // Include recall if:
          // 1. It specifically affects this state, OR
          // 2. It's a nationwide recall (affects all states), OR  
          // 3. User subscribed to "ALL" states (receives everything)
          return isStateSpecific || isNationwide || isAllStatesSubscription;
        });

        const sampleDigestData = {
          user: {
            name: sampleSubscribers[0].name || 'SafeCart User',
            email: sampleSubscribers[0].email,
            unsubscribeToken: sampleSubscribers[0].emailPreferences?.unsubscribeToken || ''
          },
          state: 'ALL', // Use 'ALL' to show all recalls in preview HTML
          states: ['ALL'], // Pass as array for consistency
          recalls: recalls, // Include all recalls, not just state-filtered ones
          digestDate: new Date().toISOString(),
          isTest: false
        };

        const sampleEmailOptions = await EmailRenderService.renderRecallDigest(sampleDigestData);
        digestHtml = sampleEmailOptions.html;
      } else {
        logger.warn('No states with both recalls and subscribers found for email HTML generation');
      }

      // Generate digest ID first for analytics tracking
      const digestId = this.generateDigestId();

      // Collect all unique subscribers from all states
      const allSubscribers: any[] = [];
      for (const stateSubscribers of Object.values(subscribersByState)) {
        allSubscribers.push(...stateSubscribers);
      }

      // Process each subscriber individually (one email per user with all their relevant recalls)
      const processedEmails = new Set<string>(); // Track processed emails to avoid duplicates
      
      for (const subscriber of allSubscribers) {
        // Skip if we've already processed this email
        if (processedEmails.has(subscriber.email)) {
          continue;
        }
        processedEmails.add(subscriber.email);
        
        // Get user's subscribed states
        const userStates = subscriber.emailPreferences?.states || [];
        
        // Skip if user has no state preferences
        if (userStates.length === 0) {
          logger.warn(`Skipping ${subscriber.email} - no state preferences`);
          continue;
        }
        
        // Get all unique recalls relevant to this user's subscribed states
        const userRecalls = this.getRecallsForUser(recalls, userStates);
        
        // Skip if no recalls affect user's states
        if (userRecalls.length === 0) {
          logger.info(`No recalls for ${subscriber.email} in states: ${userStates.join(', ')}`);
          continue;
        }
        
        try {
          // Generate smart email title based on affected states
          const emailTitle = this.generateEmailTitle(userRecalls, userStates);
          
          // Create digest data with all user's recalls
          const digestData = {
            user: {
              name: subscriber.name || 'SafeCart User',
              email: subscriber.email,
              unsubscribeToken: subscriber.emailPreferences?.unsubscribeToken || ''
            },
            state: userStates.join(', '), // Show all user's states
            states: userStates, // Pass the array of states for the template
            recalls: userRecalls,
            digestDate: new Date().toISOString(),
            isTest: false
          };

          const emailOptions = await EmailRenderService.renderRecallDigest(digestData);
          
          // Override the subject with our smart title
          emailOptions.subject = `${emailTitle} - SafeCart Alert`;
          
          // Add digest ID for analytics tracking
          emailOptions.digestId = digestId;
          
          const result = await this.sendEmailWithRetry(emailOptions, subscriber.email);
          
          if (result.success) {
            logger.info(`Sent manual digest with ${userRecalls.length} recalls to ${subscriber.email} for states: ${userStates.join(', ')}`);
            totalRecipients++;
          } else {
            logger.error(`Failed to send manual digest to ${subscriber.email} after retries: ${result.error}`);
          }
        } catch (error) {
          logger.error(`Failed to send manual digest to ${subscriber.email}:`, error);
        }
      }

      // Create digest record
      const digestRecord: EmailDigestRecord = {
        id: digestId,
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
   * Send test digest to admin only
   * Used for testing email templates before sending to real users
   */
  async sendTestDigest(
    recallIds: string[], 
    adminEmail: string,
    adminName: string = 'Admin'
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    recallCount: number;
  }> {
    try {
      // Fetch recalls
      const recalls = await this.getRecallsByIds(recallIds);
      
      if (recalls.length === 0) {
        return {
          success: false,
          error: 'No recalls found with provided IDs',
          recallCount: 0
        };
      }

      // Prepare test email data for admin
      const digestData = {
        user: {
          name: adminName,
          email: adminEmail,
          unsubscribeToken: 'test-unsubscribe-token' // Not functional for test emails
        },
        state: 'ALL', // Show all recalls in test email
        states: ['ALL'], // Pass as array for consistency
        recalls: recalls,
        digestDate: new Date().toISOString(),
        isTest: true // Mark as test email
      };

      // Generate email options with rendered HTML
      const emailOptions = await EmailRenderService.renderRecallDigest(digestData);
      
      // Override the recipient to send only to admin and add TEST prefix to subject
      emailOptions.to = adminEmail;
      emailOptions.subject = `[TEST] SafeCart Recall Digest - ${recalls.length} recalls`;
      // Add test digest ID for analytics tracking
      emailOptions.digestId = this.generateDigestId('test');
      
      // Send test email to admin only with retry logic
      const result = await this.sendEmailWithRetry(emailOptions, adminEmail);

      if (!result.success) {
        logger.error(`Failed to send test email to ${adminEmail}:`, result.error);
        return {
          success: false,
          error: result.error,
          recallCount: recalls.length
        };
      }

      // logger.info(`Test email sent to admin ${adminEmail} with ${recalls.length} recalls`);

      return {
        success: true,
        messageId: result.messageId,
        recallCount: recalls.length
      };
    } catch (error) {
      logger.error('Error sending test digest:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recallCount: 0
      };
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

      const digests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          sentBy: data.sentBy,
          recallCount: data.recallCount,
          totalRecipients: data.totalRecipients,
          recalls: data.recalls || [],
          emailHtml: data.emailHtml,
          queueId: data.queueId,
          analytics: data.analytics, // Include analytics from webhook data
          // Convert Firestore timestamp to ISO string for frontend
          sentAt: data.sentAt ? this.convertFirestoreTimestamp(data.sentAt) : new Date().toISOString()
        };
      }) as EmailDigestRecord[];

      return { digests, totalPages };
    } catch (error) {
      logger.error('Error getting email history:', error);
      throw error;
    }
  }

  /**
   * Public helper: Get recalls by IDs (used for manual digest preview)
   */
  async getRecallsByIds(recallIds: string[]): Promise<RecallData[]> {
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
            recallInitiationDate: data?.field_recall_date, // For USDA, use field_recall_date for relative time
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
            recallDate: this.formatFDADate(data?.report_date),
            recallInitiationDate: data?.recall_initiation_date ? this.formatFDADate(data?.recall_initiation_date) : this.formatFDADate(data?.report_date), // Use recall_initiation_date if available, else report_date
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
   * Private helper: Send email with retry logic
   */
  private async sendEmailWithRetry(
    emailOptions: any,
    recipientEmail: string,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    let lastError = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.emailService.sendEmail(emailOptions);
        
        if (result.success) {
          if (attempt > 1) {
            logger.info(`Email sent successfully to ${recipientEmail} on attempt ${attempt}`);
          }
          return result;
        } else {
          lastError = result.error || 'Unknown error';
          logger.warn(`Email attempt ${attempt}/${maxRetries} failed for ${recipientEmail}: ${lastError}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Email attempt ${attempt}/${maxRetries} threw error for ${recipientEmail}:`, error);
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s, etc.
        logger.info(`Waiting ${delay}ms before retry ${attempt + 1} for ${recipientEmail}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    logger.error(`Failed to send email to ${recipientEmail} after ${maxRetries} attempts. Final error: ${lastError}`);
    return { success: false, error: lastError };
  }

  /**
   * Private helper: Get subscribers grouped by state
   */
  private async getSubscribersByState(): Promise<{ [state: string]: any[] }> {
    
    const snapshot = await db.collection('users')
      .where('emailPreferences.subscribed', '==', true)
      .get();

    const subscribersByState: { [state: string]: any[] } = {};

    snapshot.docs.forEach(doc => {
      const user = doc.data();
      
      const states = user.emailPreferences?.states || [];
      
      states.forEach((state: string) => {
        if (!subscribersByState[state]) {
          subscribersByState[state] = [];
        }
        subscribersByState[state].push(user);
      });
    });

    return subscribersByState;
  }

  /**
   * Private helper: Get affected states from recall
   */
  private getAffectedStates(recall: RecallData): string[] {
    const states = recall.affectedStates || [];
    // Convert full state names to state codes for matching with user subscriptions
    return states.map(state => this.convertStateNameToCode(state));
  }

  /**
   * Private helper: Convert full state name to state code
   */
  private convertStateNameToCode(stateName: string): string {
    const stateMap: { [key: string]: string } = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
      'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
      'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
      'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
      'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
      'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
      'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
      'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
      'District of Columbia': 'DC', 'Puerto Rico': 'PR', 'Virgin Islands': 'VI', 'Guam': 'GU'
    };

    // Return the state code if found, otherwise return the original (might already be a code)
    return stateMap[stateName] || stateName;
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
   * Private helper: Format FDA date from YYYYMMDD to YYYY-MM-DD
   */
  private formatFDADate(dateString: string | undefined): string {
    if (!dateString) return '';
    
    // If already in YYYY-MM-DD format, return as is
    if (dateString.includes('-')) {
      return dateString;
    }
    
    // Convert YYYYMMDD to YYYY-MM-DD
    if (dateString.length === 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    
    // Return original if format is unexpected
    return dateString;
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

  /**
   * Get unique recalls for a user based on their subscribed states
   * Includes recalls that affect any of the user's states or are nationwide
   */
  private getRecallsForUser(recalls: RecallData[], userStates: string[]): RecallData[] {
    // Use a Set to track unique recall IDs (prevent duplicates)
    const uniqueRecallIds = new Set<string>();
    const userRecalls: RecallData[] = [];
    
    for (const recall of recalls) {
      // Skip if we've already included this recall
      if (uniqueRecallIds.has(recall.id)) {
        continue;
      }
      
      const affectedStates = this.getAffectedStates(recall);
      
      // Check if recall affects any of the user's subscribed states
      const affectsUserState = userStates.some(userState => {
        if (userState === 'ALL') {
          // User subscribed to ALL gets everything
          return true;
        }
        // Check if recall affects this specific state or is nationwide
        return affectedStates.includes(userState) || affectedStates.includes('Nationwide');
      });
      
      if (affectsUserState) {
        uniqueRecallIds.add(recall.id);
        userRecalls.push(recall);
      }
    }
    
    return userRecalls;
  }
  
  /**
   * Generate smart email title with proper state list and pluralization
   * Examples:
   * - "1 food recall in CA"
   * - "3 food recalls in CA, TX, WA"
   * - "5 food recalls in CA, TX, WA (and 2 other states)"
   * - "2 food recalls nationwide"
   */
  private generateEmailTitle(recalls: RecallData[], userStates: string[]): string {
    const recallCount = recalls.length;
    const recallText = recallCount === 1 ? 'food recall' : 'food recalls';
    
    // If user subscribed to ALL states
    if (userStates.includes('ALL')) {
      // Check if any recalls are truly nationwide
      const hasNationwideRecall = recalls.some(recall => 
        this.getAffectedStates(recall).includes('Nationwide')
      );
      
      if (hasNationwideRecall && recalls.every(recall => 
        this.getAffectedStates(recall).includes('Nationwide')
      )) {
        // All recalls are nationwide
        return `${recallCount} ${recallText} nationwide`;
      }
      
      // For ALL subscription, list the actual affected states
      const allAffectedStates = new Set<string>();
      recalls.forEach(recall => {
        const states = this.getAffectedStates(recall);
        states.forEach(state => {
          if (state !== 'Nationwide') {
            allAffectedStates.add(state);
          }
        });
      });
      
      const statesList = Array.from(allAffectedStates).sort();
      return this.formatStatesList(recallCount, recallText, statesList);
    }
    
    // For specific state subscriptions, find which of user's states are actually affected
    const affectedUserStates = new Set<string>();
    
    recalls.forEach(recall => {
      const recallStates = this.getAffectedStates(recall);
      
      userStates.forEach(userState => {
        // If recall affects this user state or is nationwide
        if (recallStates.includes(userState) || recallStates.includes('Nationwide')) {
          affectedUserStates.add(userState);
        }
      });
    });
    
    const statesList = Array.from(affectedUserStates).sort();
    return this.formatStatesList(recallCount, recallText, statesList);
  }
  
  /**
   * Format states list with truncation after 3 states
   */
  private formatStatesList(recallCount: number, recallText: string, states: string[]): string {
    if (states.length === 0) {
      return `${recallCount} ${recallText}`;
    }
    
    if (states.length <= 3) {
      // Show all states if 3 or fewer
      return `${recallCount} ${recallText} in ${states.join(', ')}`;
    }
    
    // Show first 3 states and indicate how many more
    const displayStates = states.slice(0, 3);
    const remainingCount = states.length - 3;
    const otherText = remainingCount === 1 ? 'other state' : 'other states';
    
    return `${recallCount} ${recallText} in ${displayStates.join(', ')} (and ${remainingCount} ${otherText})`;
  }

  /**
   * Generate human-readable digest ID with date and time
   * Format: [prefix_]YYYYMMDD-HHMM-random
   * @param prefix Optional prefix (e.g., 'test')
   */
  private generateDigestId(prefix?: string): string {
    const now = new Date();
    
    // Format date as YYYYMMDD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Format time as HHMM
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}${minutes}`;
    
    // Add a short random suffix to avoid collisions
    const randomSuffix = Math.random().toString(36).substr(2, 4);
    
    const baseId = `${dateStr}-${timeStr}-${randomSuffix}`;
    
    return prefix ? `${prefix}_${baseId}` : baseId;
  }

  /**
   * Get a specific queue by ID
   */
  async getQueueById(queueId: string): Promise<EmailQueue | null> {
    try {
      const doc = await db.collection('email_queues').doc(queueId).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() } as EmailQueue;
    } catch (error) {
      logger.error(`Error getting queue ${queueId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new queue
   */
  async createQueue(queue: EmailQueue): Promise<void> {
    try {
      await db.collection('email_queues').doc(queue.id).set(queue);
      // logger.info(`Created queue ${queue.id} with ${queue.recallIds.length} recalls`);
    } catch (error) {
      logger.error(`Error creating queue ${queue.id}:`, error);
      throw error;
    }
  }

  /**
   * Update queue by ID (for sync service integration)
   */
  async updateQueueById(queueId: string, updates: Partial<EmailQueue>): Promise<void> {
    try {
      await db.collection('email_queues').doc(queueId).update(updates);
      // logger.info(`Updated queue ${queueId}`);
    } catch (error) {
      logger.error(`Error updating queue ${queueId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();