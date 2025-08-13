import cron from 'node-cron';
import { USDAApiService } from './usda-api.service';
import { FirebaseService } from './firebase.service';
import { ImageProcessingService } from './image-processing.service';
import { FDASyncService } from './fda/sync.service';
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
  private syncTask: cron.ScheduledTask | null = null;
  private fdaSyncTask: cron.ScheduledTask | null = null;

  /**
   * Initializes the sync service with USDA/FDA API and Firebase services
   */
  constructor() {
    this.usdaService = new USDAApiService();
    this.firebaseService = new FirebaseService();
    this.imageProcessingService = new ImageProcessingService();
    this.fdaSyncService = new FDASyncService();
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

      // Save to Firebase
      await this.firebaseService.saveRecalls(recentRecalls);

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
      await this.fdaSyncService.performSync(days);
      
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
  }
}