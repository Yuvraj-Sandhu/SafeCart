import cron from 'node-cron';
import { USDAApiService } from './usda-api.service';
import { FirebaseService } from './firebase.service';
import { ImageProcessingService } from './image-processing.service';
import logger from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Service for synchronizing USDA recall data with Firebase
 * 
 * This service orchestrates the data flow between USDA API and Firebase:
 * - Scheduled automatic syncing every 12 hours (configurable)
 * - Manual sync triggering via API endpoints
 * - Historical data backfill for initial setup
 * - Rate limiting to respect USDA API usage
 * 
 * The sync process:
 * 1. Fetches recent recalls from USDA API
 * 2. Fetches high-risk recalls separately (to ensure nothing is missed)
 * 3. Processes and saves data to Firebase
 * 4. Logs performance metrics and errors
 * 
 * @example
 * ```typescript
 * const syncService = new SyncService();
 * syncService.startAutoSync(); // Start scheduled syncing
 * await syncService.performSync(); // Manual sync
 * ```
 */
export class SyncService {
  private usdaService: USDAApiService;
  private firebaseService: FirebaseService;
  private imageProcessingService: ImageProcessingService;
  private syncTask: cron.ScheduledTask | null = null;

  /**
   * Initializes the sync service with USDA API and Firebase services
   */
  constructor() {
    this.usdaService = new USDAApiService();
    this.firebaseService = new FirebaseService();
    this.imageProcessingService = new ImageProcessingService();
  }

  /**
   * Performs a regular sync of recent recalls
   * 
   * This method is called both on schedule and when manually triggered.
   * It fetches recent data to ensure the Firebase database is up-to-date.
   * 
   * @returns Promise that resolves when sync is complete
   * @throws Error if sync fails at any stage
   */
  async performSync(): Promise<void> {
    logger.info('Starting data sync...');
    const startTime = Date.now();

    try {
      // Fetch recent recalls (last 60 days)
      const recentRecalls = await this.usdaService.fetchRecentRecalls(60);
      logger.info(`Fetched ${recentRecalls.length} recent recalls`);

      // Save to Firebase
      await this.firebaseService.saveRecalls(recentRecalls);

      // Process images for recent recalls
      logger.info('Processing images for recent recalls...');
      const imageResults = await this.imageProcessingService.processRecentRecalls(recentRecalls);
      const successfulImages = imageResults.filter(r => r.status === 'completed').length;
      const totalImages = imageResults.reduce((sum, r) => sum + r.successCount, 0);
      logger.info(`Image processing completed: ${successfulImages} recalls processed, ${totalImages} images stored`);

      // Cleanup temp files
      await this.imageProcessingService.cleanup();

      const duration = Date.now() - startTime;
      logger.info(`Sync completed in ${duration}ms`);
    } catch (error) {
      logger.error('Sync failed:', error);
      // Ensure cleanup happens even if sync fails
      try {
        await this.imageProcessingService.cleanup();
      } catch (cleanupError) {
        logger.warn('Cleanup after sync failure failed:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Performs historical data backfill for initial database setup
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
   * Stops the automatic synchronization task
   * 
   * Useful for graceful shutdown or when disabling auto-sync
   */
  stopAutoSync(): void {
    if (this.syncTask) {
      this.syncTask.stop();
      logger.info('Auto-sync stopped');
    }
  }
}