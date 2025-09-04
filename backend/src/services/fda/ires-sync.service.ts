/**
 * FDA IRES Sync Service
 * 
 * Automated service to scrape FDA IRES website daily for new recalls
 * Runs at 9 AM ET and scans last 4 weeks of enforcement reports by default
 */

import * as cron from 'node-cron';
import logger from '../../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class FDAIRESSyncService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastSyncTime: Date | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_FAILURES = 3;
  
  /**
   * Initialize the IRES sync service
   * Schedules daily sync at 9 AM ET
   */
  public initialize(): void {
    // Schedule for 9:00 AM ET every day
    // Note: Server might be in UTC, so adjust accordingly
    // 9 AM ET = 2 PM UTC (during standard time) or 1 PM UTC (during daylight saving)
    const cronSchedule = '0 9 * * *'; // 9 AM in server timezone
    
    logger.info('[IRES Sync] Initializing FDA IRES sync service');
    
    this.cronJob = cron.schedule(cronSchedule, async () => {
      await this.performSync(4); // Default to 4 weeks for scheduled sync
    }, {
      scheduled: true,
      timezone: "America/New_York" // Run in ET timezone
    });
    
    logger.info('[IRES Sync] Scheduled daily sync at 9:00 AM ET');
  }
  
  /**
   * Perform IRES sync
   * Scrapes FDA IRES website and imports new recalls
   * @param weeks Number of past weeks to fetch (default 4, 0 for new recalls only)
   */
  public async performSync(weeks: number = 4): Promise<void> {
    if (this.isRunning) {
      logger.warn('[IRES Sync] Sync already in progress, skipping...');
      return;
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      logger.info('[IRES Sync] Starting FDA IRES sync...');
      
      // Path to the IRES import script
      const scriptPath = path.join(__dirname, 'ires-scripts/fda-ires-to-firebase.js');
      
      // Run the scraper with appropriate options
      // --weeks: Number of past weeks to scan (0 for new recalls only)
      // --headless=true: Run browser in headless mode
      // Using tsx to handle TypeScript imports in the script
      const command = `npx tsx "${scriptPath}" --weeks=${weeks} --headless=true`;
      
      logger.info(`[IRES Sync] Executing scraper command with weeks=${weeks}...`);
      
      // Execute the script with a timeout of 30 minutes
      const { stdout, stderr } = await execAsync(command, {
        timeout: 1800000, // 30 minutes timeout
        maxBuffer: Infinity // No buffer limit for output
      });
      
      // Parse the output to extract statistics
      const stats = this.parseScraperOutput(stdout);
      
      // Log results
      const duration = Math.round((Date.now() - startTime) / 1000);
      logger.info(`[IRES Sync] Sync completed in ${duration}s`, {
        weeks: weeks,
        newRecords: stats.newRecords,
        updatedRecords: stats.updatedRecords,
        totalProcessed: stats.totalProcessed,
        errors: stats.errors
      });
      
      // Log any stderr warnings
      if (stderr) {
        logger.warn('[IRES Sync] Scraper warnings:', stderr);
      }
      
      // Update success metrics
      this.lastSyncTime = new Date();
      this.consecutiveFailures = 0;
      
      // If we imported new recalls, log for monitoring
      if (stats.newRecords > 0) {
        logger.info(`[IRES Sync] Imported ${stats.newRecords} new FDA recalls from IRES`);
      }
      
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.consecutiveFailures++;
      
      // Log full error details for every failure
      logger.error(`[IRES Sync] Sync failed after ${duration}s`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        consecutiveFailures: this.consecutiveFailures,
        lastSyncTime: this.lastSyncTime,
        timestamp: new Date().toISOString()
      });
      
      // Log specific error types for better debugging
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          logger.error('[IRES Sync] Failure type: TIMEOUT - Scraper took longer than 30 minutes');
        } else if (error.message.includes('ENOENT')) {
          logger.error('[IRES Sync] Failure type: FILE_NOT_FOUND - Scraper script not found');
        } else if (error.message.includes('Playwright')) {
          logger.error('[IRES Sync] Failure type: PLAYWRIGHT_ERROR - Browser automation failed');
        } else if (error.message.includes('Firebase')) {
          logger.error('[IRES Sync] Failure type: FIREBASE_ERROR - Database operation failed');
        }
      }
      
      // Alert if too many consecutive failures
      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        logger.error(`[IRES Sync] CRITICAL: ${this.consecutiveFailures} consecutive sync failures!`);
        // TODO: Send alert email to admin
      }
      
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Parse scraper output to extract statistics
   */
  private parseScraperOutput(output: string): {
    newRecords: number;
    updatedRecords: number;
    totalProcessed: number;
    errors: number;
  } {
    const stats = {
      newRecords: 0,
      updatedRecords: 0,
      totalProcessed: 0,
      errors: 0
    };
    
    try {
      // Parse the summary section from output
      const newRecordsMatch = output.match(/New records:\s+(\d+)/);
      const updatedRecordsMatch = output.match(/Updated records:\s+(\d+)/);
      const errorsMatch = output.match(/Errors:\s+(\d+)/);
      const totalMatch = output.match(/Total processed:\s+(\d+)/);
      
      if (newRecordsMatch) stats.newRecords = parseInt(newRecordsMatch[1]);
      if (updatedRecordsMatch) stats.updatedRecords = parseInt(updatedRecordsMatch[1]);
      if (errorsMatch) stats.errors = parseInt(errorsMatch[1]);
      if (totalMatch) stats.totalProcessed = parseInt(totalMatch[1]);
      
      // If total not found, calculate it
      if (!stats.totalProcessed) {
        stats.totalProcessed = stats.newRecords + stats.updatedRecords;
      }
      
    } catch (error) {
      logger.warn('[IRES Sync] Could not parse scraper output statistics');
    }
    
    return stats;
  }
  
  /**
   * Manually trigger IRES sync (for testing or manual runs)
   * @param weeks Number of past weeks to fetch (default 4, 0 for new recalls only)
   */
  public async triggerManualSync(weeks: number = 4): Promise<{
    success: boolean;
    message: string;
    stats?: any;
  }> {
    // Check if sync is already running
    if (this.isRunning) {
      return {
        success: false,
        message: 'IRES sync is already in progress',
        stats: {
          weeks: weeks,
          lastSyncTime: this.lastSyncTime,
          consecutiveFailures: this.consecutiveFailures,
          isRunning: this.isRunning
        }
      };
    }
    
    logger.info(`[IRES Sync] Manual sync triggered with weeks=${weeks}`);
    
    // Start sync in the background without awaiting
    this.performSync(weeks)
      .then(() => {
        logger.info(`[IRES Sync] Background sync completed successfully (${weeks} weeks)`);
      })
      .catch((error) => {
        logger.error(`[IRES Sync] Background sync failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    
    // Return immediately with success status
    return {
      success: true,
      message: `IRES sync started in background (${weeks} weeks)`,
      stats: {
        weeks: weeks,
        lastSyncTime: this.lastSyncTime,
        consecutiveFailures: this.consecutiveFailures,
        isRunning: this.isRunning
      }
    };
  }
  
  /**
   * Get sync status
   */
  public getStatus(): {
    isRunning: boolean;
    lastSyncTime: Date | null;
    consecutiveFailures: number;
    nextScheduledRun: string;
  } {
    // Calculate next scheduled run (9 AM ET tomorrow)
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(9, 0, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      consecutiveFailures: this.consecutiveFailures,
      nextScheduledRun: nextRun.toISOString()
    };
  }
  
  /**
   * Stop the sync service
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('[IRES Sync] FDA IRES sync service stopped');
    }
  }
}

// Create singleton instance
export const fdaIRESSyncService = new FDAIRESSyncService();