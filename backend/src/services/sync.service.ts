import cron from 'node-cron';
import { USDAApiService } from './usda-api.service';
import { FirebaseService } from './firebase.service';
import { ImageProcessingService } from './image-processing.service';
import { FDASyncService } from './fda/sync.service';
import { fdaIRESSyncService } from './fda/ires-sync.service';
import { EmailQueueService } from './email/queue.service';
import logger from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Service for synchronizing USDA and FDA recall data with Firebase
 * 
 * This service orchestrates the data flow between USDA/FDA APIs and Firebase:
 * - Scheduled automatic syncing every 12 hours (configurable)
 * - Manual sync triggering via API endpoints
 * - Historical data backfill for initial setup
 * - Rate limiting to respect API usage
 * 
 * The sync process:
 * 1. Fetches recent recalls from USDA API
 * 2. Fetches recent recalls from FDA API
 * 3. Processes and saves data to Firebase
 * 4. Logs performance metrics and errors
 * 
 * @example
 * ```typescript
 * const syncService = new SyncService();
 * syncService.startAutoSync(); // Start scheduled syncing
 * await syncService.performSync(); // Manual sync for both USDA and FDA
 * ```
 */
export class SyncService {
  private usdaService: USDAApiService;
  private firebaseService: FirebaseService;
  private imageProcessingService: ImageProcessingService;
  private fdaSyncService: FDASyncService;
  private emailQueueService: EmailQueueService;
  private syncTask: cron.ScheduledTask | null = null;
  private fdaSyncTask: cron.ScheduledTask | null = null;
  private usdaEmailTask: cron.ScheduledTask | null = null;

  /**
   * Initializes the sync service with USDA/FDA API and Firebase services
   */
  constructor() {
    this.usdaService = new USDAApiService();
    this.firebaseService = new FirebaseService();
    this.imageProcessingService = new ImageProcessingService();
    this.fdaSyncService = new FDASyncService();
    this.emailQueueService = new EmailQueueService();
  }

  /**
   * Performs a regular sync of recent USDA recalls
   * 
   * This method is called both on schedule and when manually triggered.
   * It fetches recent data to ensure the Firebase database is up-to-date.
   * 
   * @returns Promise that resolves when sync is complete
   * @throws Error if sync fails at any stage
   */
  async performSync(): Promise<void> {
    logger.info('Starting USDA data sync...');
    const startTime = Date.now();

    try {
      // Fetch recent recalls (last 60 days)
      const recentRecalls = await this.usdaService.fetchRecentRecalls(60);
      logger.info(`Fetched ${recentRecalls.length} recent USDA recalls`);

      // Save to Firebase and get new recall IDs
      const newRecallIds = await this.firebaseService.saveRecalls(recentRecalls);
      
      // Queue new recalls if any were created
      if (newRecallIds.length > 0) {
        logger.info(`Queueing ${newRecallIds.length} new USDA recalls for email digest`);
        await this.queueUsdaRecalls(newRecallIds);
      }

      // Process images for recent recalls
      logger.info('Processing images for USDA recalls...');
      const imageResults = await this.imageProcessingService.processRecentRecalls(recentRecalls);
      const successfulImages = imageResults.filter(r => r.status === 'completed').length;
      const totalImages = imageResults.reduce((sum, r) => sum + r.successCount, 0);
      logger.info(`USDA image processing completed: ${successfulImages} recalls processed, ${totalImages} images stored`);

      // Cleanup temp files
      await this.imageProcessingService.cleanup();

      const duration = Date.now() - startTime;
      logger.info(`USDA sync completed in ${duration}ms`);
    } catch (error) {
      logger.error('USDA sync failed:', error);
      // Ensure cleanup happens even if sync fails
      try {
        await this.imageProcessingService.cleanup();
      } catch (cleanupError) {
        logger.warn('Cleanup after USDA sync failure failed:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Performs a sync of recent FDA recalls
   * 
   * This method fetches FDA recall data from the last 60 days and updates
   * the Firebase database while preserving custom fields like display data.
   * 
   * @param days - Number of days to sync (default: 60)
   * @returns Promise that resolves when FDA sync is complete
   * @throws Error if sync fails
   */
  async performFDASync(days: number = 60): Promise<void> {
    logger.info(`Starting FDA data sync for last ${days} days...`);
    const startTime = Date.now();

    try {
      const newRecallIds = await this.fdaSyncService.performSync(days);
      
      // Queue new recalls if any were created
      if (newRecallIds.length > 0) {
        logger.info(`Queueing ${newRecallIds.length} new FDA recalls for email digest`);
        await this.queueFdaRecalls(newRecallIds);
      }
      
      const duration = Date.now() - startTime;
      logger.info(`FDA sync completed in ${duration}ms`);
    } catch (error) {
      logger.error('FDA sync failed:', error);
      throw error;
    }
  }

  /**
   * Performs FDA historical data sync
   * 
   * @param days - Number of days to sync (default: 365 for one year)
   * @returns Promise that resolves when FDA historical sync is complete
   */
  async performFDAHistoricalSync(days: number = 365): Promise<void> {
    logger.info(`Starting FDA historical sync for ${days} days...`);
    
    try {
      await this.fdaSyncService.performHistoricalSync(days);
      logger.info('FDA historical sync completed');
    } catch (error) {
      logger.error('FDA historical sync failed:', error);
      throw error;
    }
  }

  /**
   * Performs historical data backfill for initial database setup (USDA)
   * 
   * This method is typically run once when setting up SafeCart to populate
   * the database with historical recall data. It fetches data for key states
   * over the specified number of years.
   * 
   * Key states: California, Texas, Florida, New York, and Nationwide recalls
   * 
   * @param years - Number of years to backfill (default: 2)
   * @returns Promise that resolves when historical sync is complete
   */
  async performHistoricalSync(years: number = 2): Promise<void> {
    logger.info(`Starting historical sync for ${years} years...`);
    
    try {
      // Method 1: Get ALL data at once (most efficient)
      logger.info('Fetching complete USDA dataset...');
      const allRecalls = await this.usdaService.fetchRecalls(); // No filters = all data
      logger.info(`Found ${allRecalls.length} total recalls`);
      
      // Save all data to Firebase
      await this.firebaseService.saveRecalls(allRecalls);
      logger.info('Complete dataset saved to Firebase');
      
    } catch (error) {
      logger.error('Failed to fetch complete dataset, falling back to year-by-year sync:', error);
      
      // Method 2: Fallback - year by year sync
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - years;
      
      for (let year = currentYear; year >= startYear; year--) {
        try {
          logger.info(`Fetching recalls for year ${year}`);
          const yearRecalls = await this.usdaService.fetchRecallsByState(0, year); // 0 = all states
          await this.firebaseService.saveRecalls(yearRecalls);
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`Failed to sync year ${year}:`, error);
        }
      }
    }

    logger.info('Historical sync completed');
  }

  /**
   * Starts automatic synchronization using cron scheduling
   * 
   * The sync frequency is controlled by the SYNC_INTERVAL_HOURS environment variable.
   * Auto-sync can be disabled by setting ENABLE_AUTO_SYNC to false.
   * Timezone can be configured with SYNC_TIMEZONE environment variable.
   * 
   * Cron expression: `0 /{intervalHours} * * *`
   * - Runs at minute 0 of every nth hour
   * - Default: every 12 hours (00:00 and 12:00)
   * - Default timezone: America/New_York (US Eastern Time)
   */
  startAutoSync(): void {
    if (process.env.ENABLE_AUTO_SYNC !== 'true') {
      logger.info('Auto-sync is disabled');
      return;
    }

    const intervalHours = parseInt(process.env.SYNC_INTERVAL_HOURS || '12');
    const timezone = process.env.SYNC_TIMEZONE || 'America/New_York';
    const cronExpression = `0 */${intervalHours} * * *`;

    this.syncTask = cron.schedule(cronExpression, async () => {
      const now = new Date();
      const timeString = now.toLocaleString('en-US', { 
        timeZone: timezone,
        dateStyle: 'short',
        timeStyle: 'medium'
      });
      logger.info(`Running scheduled sync at ${timeString} (${timezone})`);
      
      try {
        await this.performSync();
      } catch (error) {
        logger.error('Scheduled sync failed:', error);
      }
    }, {
      timezone: timezone
    });

    logger.info(`Auto-sync scheduled every ${intervalHours} hours in ${timezone} timezone`);
    
    // Log the next few scheduled runs for clarity
    const nextRuns = this.getNextScheduledRuns(cronExpression, timezone, 3);
    logger.info('Next scheduled sync times:');
    nextRuns.forEach((run, index) => {
      logger.info(`  ${index + 1}. ${run}`);
    });
  }

  /**
   * Get the next scheduled run times for logging purposes
   * 
   * @param cronExpression - The cron expression
   * @param timezone - The timezone to use
   * @param count - Number of next runs to return
   * @returns Array of formatted date strings
   */
  private getNextScheduledRuns(cronExpression: string, timezone: string, count: number): string[] {
    const runs: string[] = [];
    const now = new Date();
    
    // Simple calculation for next runs based on interval
    const intervalHours = parseInt(process.env.SYNC_INTERVAL_HOURS || '12');
    
    for (let i = 0; i < count; i++) {
      const nextRun = new Date(now);
      
      // Calculate next run time
      const currentHour = now.getHours();
      const nextHour = Math.ceil(currentHour / intervalHours) * intervalHours + (i * intervalHours);
      
      nextRun.setHours(nextHour, 0, 0, 0);
      
      // If the calculated time is in the past, move to next day
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      const timeString = nextRun.toLocaleString('en-US', {
        timeZone: timezone,
        dateStyle: 'short',
        timeStyle: 'medium'
      });
      
      runs.push(`${timeString} (${timezone})`);
    }
    
    return runs;
  }

  /**
   * Starts automatic FDA synchronization
   * 
   * Runs daily at 8:00 AM Eastern Time
   * Can be disabled by setting ENABLE_FDA_AUTO_SYNC to false
   */
  startFDAAutoSync(): void {
    if (process.env.ENABLE_FDA_AUTO_SYNC === 'false') {
      logger.info('FDA auto-sync is disabled');
      return;
    }

    const timezone = process.env.SYNC_TIMEZONE || 'America/New_York';
    // Cron expression for 8:00 AM every day
    const cronExpression = '0 8 * * *'; // minute=0, hour=8, every day

    this.fdaSyncTask = cron.schedule(cronExpression, async () => {
      const now = new Date();
      const timeString = now.toLocaleString('en-US', { 
        timeZone: timezone,
        dateStyle: 'short',
        timeStyle: 'medium'
      });
      logger.info(`Running scheduled FDA sync at ${timeString} (${timezone})`);
      
      try {
        await this.performFDASync(60); // Sync last 60 days
      } catch (error) {
        logger.error('Scheduled FDA sync failed:', error);
      }
    }, {
      timezone: timezone
    });

    logger.info(`FDA auto-sync scheduled for 8:00 AM daily in ${timezone} timezone`);
    
    // Log the next scheduled run
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const nextRunString = tomorrow.toLocaleString('en-US', {
      timeZone: timezone,
      dateStyle: 'short',
      timeStyle: 'medium'
    });
    logger.info(`Next FDA sync scheduled for: ${nextRunString} (${timezone})`);
  }

  /**
   * Starts FDA IRES automatic synchronization
   * 
   * Runs daily at 3:00 AM Eastern Time to scrape FDA IRES website
   * for the most recent enforcement reports
   */
  startFDAIRESAutoSync(): void {
    // Initialize the IRES sync service
    fdaIRESSyncService.initialize();
    logger.info('FDA IRES sync service initialized');
  }

  /**
   * Starts automatic USDA email sending at 5 PM ET daily
   * 
   * This task runs daily at 5:00 PM Eastern Time to automatically
   * send the USDA daily queue if it exists and is in pending status.
   */
  startUsdaEmailAutoSend(): void {
    const timezone = process.env.SYNC_TIMEZONE || 'America/New_York';
    // Cron expression for 5:00 PM every day
    const cronExpression = '0 17 * * *'; // minute=0, hour=17 (5 PM), every day

    this.usdaEmailTask = cron.schedule(cronExpression, async () => {
      const now = new Date();
      const timeString = now.toLocaleString('en-US', { 
        timeZone: timezone,
        dateStyle: 'short',
        timeStyle: 'medium'
      });
      logger.info(`Running scheduled USDA email send at ${timeString} (${timezone})`);
      
      try {
        await this.sendUsdaDailyQueue();
      } catch (error) {
        logger.error('Scheduled USDA email send failed:', error);
      }
    }, {
      timezone: timezone
    });

    logger.info(`USDA email auto-send scheduled for 5:00 PM daily in ${timezone} timezone`);
    
    // Log the next scheduled run
    const tomorrow = new Date();
    tomorrow.setHours(17, 0, 0, 0); // 5 PM
    if (tomorrow <= new Date()) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const nextRunString = tomorrow.toLocaleString('en-US', {
      timeZone: timezone,
      dateStyle: 'short',
      timeStyle: 'medium'
    });
    logger.info(`Next USDA email send scheduled for: ${nextRunString} (${timezone})`);
  }

  /**
   * Send USDA daily queue if it exists and is pending
   * 
   * This method checks for today's USDA queue and sends it if:
   * - The queue exists
   * - The queue status is 'pending'
   * - The queue has recalls
   */
  private async sendUsdaDailyQueue(): Promise<void> {
    try {
      // Get today's USDA queue
      const today = new Date();
      const queueDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const queueId = `USDA_DAILY_${queueDate}`;
      
      // Check if queue exists
      const queue = await this.emailQueueService.getQueueById(queueId);
      
      if (!queue) {
        logger.info(`No USDA queue found for ${queueDate}, skipping auto-send`);
        return;
      }

      // Check if queue is pending
      if (queue.status !== 'pending') {
        logger.info(`USDA queue ${queueId} status is '${queue.status}', skipping auto-send`);
        return;
      }

      // Check if queue has recalls
      if (!queue.recallIds || queue.recallIds.length === 0) {
        logger.info(`USDA queue ${queueId} has no recalls, skipping auto-send`);
        return;
      }

      logger.info(`Sending USDA queue ${queueId} with ${queue.recallIds.length} recalls`);
      
      // Send the queue
      const result = await this.emailQueueService.sendQueue('USDA_DAILY', 'system');
      
      logger.info(`USDA queue ${queueId} sent successfully to ${result.totalRecipients} recipients`);
    } catch (error) {
      logger.error('Error in sendUsdaDailyQueue:', error);
      // Don't throw - let the scheduler continue running
    }
  }

  /**
   * Stops the automatic synchronization task
   * 
   * Useful for graceful shutdown or when disabling auto-sync
   */
  stopAutoSync(): void {
    if (this.syncTask) {
      this.syncTask.stop();
      logger.info('USDA auto-sync stopped');
    }
    if (this.fdaSyncTask) {
      this.fdaSyncTask.stop();
      logger.info('FDA auto-sync stopped');
    }
    if (this.usdaEmailTask) {
      this.usdaEmailTask.stop();
      logger.info('USDA email auto-send stopped');
    }
    // Stop FDA IRES sync service
    fdaIRESSyncService.stop();
  }

  /**
   * Retry a function with exponential backoff
   * 
   * @param fn - Function to retry
   * @param retries - Number of retries (default: 3)
   * @param delay - Initial delay in ms (default: 1000)
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | unknown;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        logger.warn(`Retry attempt ${i + 1}/${retries} failed:`, error);
        
        if (i < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const waitTime = delay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Queue USDA recalls for daily email digest
   * Creates or updates today's USDA daily queue
   * Email will be sent automatically at 5 PM ET
   * 
   * @param newRecallIds - Array of new recall IDs to add to queue
   */
  private async queueUsdaRecalls(newRecallIds: string[]): Promise<void> {
    try {
      // Get or create today's USDA daily queue
      const today = new Date();
      const queueDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const queueId = `USDA_DAILY_${queueDate}`;
      
      // Get existing queue or create new one with retry
      let queue = await this.withRetry(() => 
        this.emailQueueService.getQueueById(queueId)
      );
      
      if (queue) {
        // Update existing queue with new recalls (deduplication handled by Set)
        const existingRecallIds = new Set(queue.recallIds);
        newRecallIds.forEach(id => existingRecallIds.add(id));
        
        await this.withRetry(() => 
          this.emailQueueService.updateQueueById(queueId, {
            recallIds: Array.from(existingRecallIds),
            lastUpdated: new Date().toISOString()
          })
        );
        
        logger.info(`Updated USDA daily queue ${queueId} with ${newRecallIds.length} new recalls`);
      } else {
        // Create new daily queue scheduled for 5 PM ET
        const scheduledTime = new Date(today);
        scheduledTime.setHours(17, 0, 0, 0); // 5 PM in local time
        
        // If it's already past 5 PM, schedule for tomorrow
        if (scheduledTime <= new Date()) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        await this.withRetry(() => 
          this.emailQueueService.createQueue({
            id: queueId,
            type: 'USDA_DAILY',
            status: 'pending',
            recallIds: newRecallIds,
            scheduledFor: scheduledTime.toISOString(),
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          })
        );
        
        logger.info(`Created new USDA daily queue ${queueId} with ${newRecallIds.length} recalls, scheduled for ${scheduledTime.toISOString()}`);
      }
    } catch (error) {
      logger.error('Failed to queue USDA recalls:', error);
      // Don't throw - allow sync to complete even if queueing fails
    }
  }

  /**
   * Queue FDA recalls for weekly email digest
   * Creates or updates current week's FDA queue (Monday start)
   * Email requires manual trigger to send
   * 
   * @param newRecallIds - Array of new recall IDs to add to queue
   */
  private async queueFdaRecalls(newRecallIds: string[]): Promise<void> {
    try {
      // Get current week's Monday
      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      // If today is Sunday (0), go back 6 days, otherwise go back (dayOfWeek - 1) days
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      monday.setDate(monday.getDate() - daysToSubtract);
      monday.setHours(0, 0, 0, 0);
      
      const weekStart = monday.toISOString().split('T')[0]; // YYYY-MM-DD format
      const queueId = `FDA_WEEKLY_${weekStart}`;
      
      // Get existing queue or create new one with retry
      let queue = await this.withRetry(() => 
        this.emailQueueService.getQueueById(queueId)
      );
      
      if (queue) {
        // Update existing queue with new recalls (deduplication handled by Set)
        const existingRecallIds = new Set(queue.recallIds);
        newRecallIds.forEach(id => existingRecallIds.add(id));
        
        await this.withRetry(() => 
          this.emailQueueService.updateQueueById(queueId, {
            recallIds: Array.from(existingRecallIds),
            lastUpdated: new Date().toISOString()
          })
        );
        
        logger.info(`Updated FDA weekly queue ${queueId} with ${newRecallIds.length} new recalls`);
      } else {
        // Create new weekly queue (no scheduled time - manual send)
        await this.withRetry(() => 
          this.emailQueueService.createQueue({
            id: queueId,
            type: 'FDA_WEEKLY',
            status: 'pending',
            recallIds: newRecallIds,
            scheduledFor: null, // Manual trigger required
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          })
        );
        
        logger.info(`Created new FDA weekly queue ${queueId} with ${newRecallIds.length} recalls (manual send required)`);
      }
    } catch (error) {
      logger.error('Failed to queue FDA recalls:', error);
      // Don't throw - allow sync to complete even if queueing fails
    }
  }
}