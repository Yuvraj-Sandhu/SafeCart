/**
 * FDA Alerts Sync Service
 *
 * Automated service to scrape FDA alerts website daily for new recalls
 * and process images for each recall
 */

import * as cron from 'node-cron';
import logger from '../../utils/logger';
import { spawn } from 'child_process';
import path from 'path';
import { fdaImageService } from './image.service';

interface AlertsRecall {
  id: string;
  url: string;
  title: string;
  date: string;
}

export class FDAAlertsSyncService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastSyncTime: Date | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_FAILURES = 3;
  private currentSyncStartTime: Date | null = null;
  private recentLogs: string[] = [];

  /**
   * Initialize the alerts sync service
   * Schedules daily sync at 8:30 AM ET (30 minutes before IRES)
   */
  public initialize(): void {
    // Schedule for 8:30 AM ET every day (30 minutes before IRES sync)
    const cronSchedule = '30 8 * * *'; // 8:30 AM in server timezone

    logger.info('[Alerts Sync] Initializing FDA Alerts sync service');

    this.cronJob = cron.schedule(cronSchedule, async () => {
      await this.performSync();
    }, {
      scheduled: true,
      timezone: "America/New_York" // Run in ET timezone
    });

    logger.info('[Alerts Sync] Scheduled daily sync at 8:30 AM ET');
  }

  /**
   * Perform alerts sync with image processing
   * @param daysBack Number of days to look back (default 7)
   */
  public async performSync(daysBack: number = 7): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Alerts Sync] Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    this.currentSyncStartTime = new Date();
    this.recentLogs = [];
    const startTime = Date.now();

    try {
      logger.info('[Alerts Sync] Starting FDA Alerts sync...');
      this.addLog(`Starting FDA Alerts sync with daysBack=${daysBack}`);

      // Step 1: Run the alerts scraper
      const recalls = await this.runAlertsScraper(daysBack);

      if (recalls.length === 0) {
        logger.info('[Alerts Sync] No new recalls found');
        this.lastSyncTime = new Date();
        this.consecutiveFailures = 0;
        return;
      }

      logger.info(`[Alerts Sync] Found ${recalls.length} recalls to process`);

      // Step 2: Process images for each recall
      const imageResults = await this.processRecallImages(recalls);

      // Log results
      const duration = Math.round((Date.now() - startTime) / 1000);
      const successfulImages = imageResults.filter(r => r.success).length;
      const totalImagesUploaded = imageResults.reduce((sum, r) => sum + r.imagesUploaded, 0);

      logger.info(`[Alerts Sync] Sync completed in ${duration}s`, {
        recallsFound: recalls.length,
        imagesProcessed: successfulImages,
        totalImagesUploaded: totalImagesUploaded,
        failures: recalls.length - successfulImages
      });

      // Update success metrics
      this.lastSyncTime = new Date();
      this.consecutiveFailures = 0;

      // Log summary
      if (totalImagesUploaded > 0) {
        logger.info(`[Alerts Sync] Successfully uploaded ${totalImagesUploaded} images for ${successfulImages} recalls`);
      }

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.consecutiveFailures++;

      logger.error(`[Alerts Sync] Sync failed after ${duration}s`, {
        error: error instanceof Error ? error.message : String(error),
        consecutiveFailures: this.consecutiveFailures
      });

      // Alert if too many consecutive failures
      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        logger.error(`[Alerts Sync] CRITICAL: ${this.consecutiveFailures} consecutive sync failures!`);
      }

      throw error;
    } finally {
      this.isRunning = false;
      this.currentSyncStartTime = null;
    }
  }

  /**
   * Run the FDA alerts scraper script
   * @param daysBack Number of days to look back
   * @returns Array of recalls with URLs
   */
  private async runAlertsScraper(daysBack: number): Promise<AlertsRecall[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'fda-alerts/fda-alerts-scraper.js');

      logger.info(`[Alerts Sync] Executing alerts scraper with daysBack=${daysBack}...`);
      this.addLog(`Executing scraper script: ${scriptPath}`);

      const child = spawn('npx', ['tsx', scriptPath, `--days=${daysBack}`, '--headless=true'], {
        cwd: process.cwd(),
        env: process.env,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      // Handle stdout - log in real-time
      child.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        output.split('\n').forEach((line: string) => {
          if (line.trim()) {
            logger.info(`[Alerts Scraper] ${line.trim()}`);
            this.addLog(line.trim());
          }
        });
      });

      // Handle stderr
      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        output.split('\n').forEach((line: string) => {
          if (line.trim() && !line.includes('ExperimentalWarning')) {
            logger.warn(`[Alerts Scraper Warning] ${line.trim()}`);
          }
        });
      });

      // Set timeout of 30 minutes
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Alerts scraper timeout after 30 minutes'));
      }, 1800000);

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`Alerts scraper exited with code ${code}`));
          return;
        }

        try {
          // Parse the output to extract recalls with URLs
          const recalls = this.parseScraperOutput(stdout);
          resolve(recalls);
        } catch (error) {
          reject(error);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Parse scraper output to extract recalls with URLs
   */
  private parseScraperOutput(output: string): AlertsRecall[] {
    const recalls: AlertsRecall[] = [];

    try {
      // Look for JSON output in the scraper logs
      const jsonMatch = output.match(/ALERTS_RESULT:(.+)ALERTS_RESULT_END/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[1]);
        return result.recalls || [];
      }

      // Fallback: Parse structured log output
      const lines = output.split('\n');
      const recallPattern = /New recall saved:\s+ID:\s+([^\s]+).*URL:\s+([^\s]+)/;
      const tempRecallPattern = /New temp recall:\s+ID:\s+([^\s]+).*URL:\s+([^\s]+)/;

      for (const line of lines) {
        let match = line.match(recallPattern) || line.match(tempRecallPattern);
        if (match) {
          recalls.push({
            id: match[1],
            url: match[2],
            title: '',
            date: new Date().toISOString()
          });
        }
      }

      // Also look for summary stats
      const newRecordsMatch = output.match(/New temp recalls:\s+(\d+)/);
      if (newRecordsMatch && parseInt(newRecordsMatch[1]) > 0) {
        logger.info(`[Alerts Sync] Detected ${newRecordsMatch[1]} new recalls from scraper output`);
      }

    } catch (error) {
      logger.error('[Alerts Sync] Error parsing scraper output:', error);
    }

    return recalls;
  }

  /**
   * Process images for all recalls
   */
  private async processRecallImages(recalls: AlertsRecall[]): Promise<any[]> {
    const results = [];

    logger.info(`[Alerts Sync] Processing images for ${recalls.length} recalls`);

    for (const recall of recalls) {
      try {
        // Skip if no URL
        if (!recall.url || recall.url === 'N/A') {
          logger.info(`[Alerts Sync] Skipping recall ${recall.id} - no URL`);
          continue;
        }

        // Process images using the shared image service
        const result = await fdaImageService.processRecallImages(
          recall.id,
          recall.url,
          'temp_fda_recalls' // Alerts go to temp collection
        );

        results.push(result);

        if (result.success) {
          logger.info(`[Alerts Sync] Processed ${result.imagesUploaded} images for recall ${recall.id}`);
        } else {
          logger.error(`[Alerts Sync] Failed to process images for recall ${recall.id}: ${result.error}`);
        }

        // Small delay between recalls
        await this.delay(1000);

      } catch (error) {
        logger.error(`[Alerts Sync] Error processing recall ${recall.id}:`, error);
        results.push({
          success: false,
          recallId: recall.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Add a log entry to recent logs
   */
  private addLog(message: string): void {
    const timestamp = new Date().toISOString();
    this.recentLogs.push(`[${timestamp}] ${message}`);
    if (this.recentLogs.length > 100) {
      this.recentLogs.shift();
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manually trigger alerts sync
   * @param daysBack Number of days to look back (default 7)
   */
  public async triggerManualSync(daysBack: number = 7): Promise<{
    success: boolean;
    message: string;
    stats?: any;
  }> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Alerts sync is already in progress',
        stats: {
          daysBack,
          lastSyncTime: this.lastSyncTime,
          consecutiveFailures: this.consecutiveFailures,
          isRunning: this.isRunning
        }
      };
    }

    logger.info(`[Alerts Sync] Manual sync triggered with daysBack=${daysBack}`);

    // Start sync in the background
    this.performSync(daysBack)
      .then(() => {
        logger.info(`[Alerts Sync] Background sync completed successfully (${daysBack} days)`);
      })
      .catch((error) => {
        logger.error(`[Alerts Sync] Background sync failed: ${error instanceof Error ? error.message : String(error)}`);
      });

    return {
      success: true,
      message: `Alerts sync started in background (${daysBack} days)`,
      stats: {
        daysBack,
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
    currentSync?: any;
  } {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(8, 30, 0, 0);  // 8:30 AM
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const status: any = {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      consecutiveFailures: this.consecutiveFailures,
      nextScheduledRun: nextRun.toISOString()
    };

    if (this.isRunning && this.currentSyncStartTime) {
      const runningSeconds = Math.floor((Date.now() - this.currentSyncStartTime.getTime()) / 1000);
      const minutes = Math.floor(runningSeconds / 60);
      const seconds = runningSeconds % 60;

      status.currentSync = {
        startTime: this.currentSyncStartTime,
        runningTime: `${minutes}m ${seconds}s`,
        recentLogs: this.recentLogs.slice(-20)
      };
    }

    return status;
  }

  /**
   * Stop the sync service
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('[Alerts Sync] FDA Alerts sync service stopped');
    }
  }
}

// Create singleton instance
export const fdaAlertsSyncService = new FDAAlertsSyncService();