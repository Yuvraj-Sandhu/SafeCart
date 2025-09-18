/**
 * Image Service for FDA Recalls
 *
 * Shared service for scraping, uploading, and managing recall images
 * Used by both IRES and Alerts sync services
 */

import * as admin from 'firebase-admin';
import logger from '../../utils/logger';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export interface RecallImageMetadata {
  urls: string[];
  count: number;
  processedAt: string;
  sourceUrls: string[];
}

export interface ImageProcessingResult {
  success: boolean;
  recallId: string;
  url: string;
  imagesFound: number;
  imagesUploaded: number;
  metadata?: RecallImageMetadata;
  error?: string;
}

export class FDAImageService {
  private readonly storage = admin.storage();
  private readonly db = admin.firestore();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000;

  // Scraper path relative to backend root
  private readonly scraperPath = path.join(__dirname, 'image-scrapper', 'fda-recall-image-scraper.js');

  /**
   * Process images for a single recall
   * @param recallId - The recall ID
   * @param recallUrl - The FDA recall URL to scrape
   * @param source - 'fda_recalls' or 'temp_fda_recalls'
   * @param retryAttempt - Current retry attempt (internal use)
   */
  public async processRecallImages(
    recallId: string,
    recallUrl: string,
    source: 'fda_recalls' | 'temp_fda_recalls' = 'fda_recalls',
    retryAttempt: number = 0
  ): Promise<ImageProcessingResult> {
    try {
      logger.info(`[Image Service] Processing images for recall ${recallId} from ${recallUrl}`);

      // Step 1: Scrape images from the URL
      const scrapedImages = await this.scrapeImages(recallId, recallUrl);

      if (!scrapedImages.success) {
        throw new Error(`Failed to scrape images: ${scrapedImages.error}`);
      }

      if (!scrapedImages.images || scrapedImages.images.length === 0) {
        logger.info(`[Image Service] No images found for recall ${recallId}`);
        return {
          success: true,
          recallId,
          url: recallUrl,
          imagesFound: 0,
          imagesUploaded: 0
        };
      }

      logger.info(`[Image Service] Found ${scrapedImages.images.length} images for recall ${recallId}`);

      // Step 2: Upload images to Firebase Storage
      const uploadedUrls = await this.uploadImagesToFirebase(
        recallId,
        scrapedImages.images,
        source
      );

      // Step 3: Update Firestore with metadata
      const metadata: RecallImageMetadata = {
        urls: uploadedUrls,
        count: uploadedUrls.length,
        processedAt: new Date().toISOString(),
        sourceUrls: [recallUrl]
      };

      await this.updateFirestoreMetadata(recallId, metadata, source);

      // Step 4: Clean up temp files
      await this.cleanupTempFiles(scrapedImages.images);

      logger.info(`[Image Service] Successfully processed ${uploadedUrls.length} images for recall ${recallId}`);

      return {
        success: true,
        recallId,
        url: recallUrl,
        imagesFound: scrapedImages.images.length,
        imagesUploaded: uploadedUrls.length,
        metadata
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[Image Service] Error processing images for recall ${recallId}: ${errorMessage}`);

      // Retry logic
      if (retryAttempt < this.MAX_RETRIES - 1) {
        logger.info(`[Image Service] Retrying (${retryAttempt + 1}/${this.MAX_RETRIES}) for recall ${recallId}`);
        await this.delay(this.RETRY_DELAY_MS);
        return this.processRecallImages(recallId, recallUrl, source, retryAttempt + 1);
      }

      return {
        success: false,
        recallId,
        url: recallUrl,
        imagesFound: 0,
        imagesUploaded: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Process images for multiple recalls
   * @param recalls - Array of {recallId, url} objects
   * @param source - 'fda_recalls' or 'temp_fda_recalls'
   */
  public async processMultipleRecalls(
    recalls: Array<{ recallId: string; url: string }>,
    source: 'fda_recalls' | 'temp_fda_recalls' = 'fda_recalls'
  ): Promise<ImageProcessingResult[]> {
    const results: ImageProcessingResult[] = [];

    logger.info(`[Image Service] Processing images for ${recalls.length} recalls`);

    for (const recall of recalls) {
      const result = await this.processRecallImages(recall.recallId, recall.url, source);
      results.push(result);

      // Small delay between recalls to avoid overwhelming the FDA server
      await this.delay(1000);
    }

    const successful = results.filter(r => r.success).length;
    const totalImages = results.reduce((sum, r) => sum + r.imagesUploaded, 0);

    logger.info(`[Image Service] Completed processing: ${successful}/${recalls.length} successful, ${totalImages} total images uploaded`);

    return results;
  }

  /**
   * Scrape images from FDA recall URL using the image scraper
   */
  private async scrapeImages(recallId: string, url: string): Promise<{
    success: boolean;
    images?: Array<{
      filename: string;
      path: string;
      size: number;
      width: number;
      height: number;
    }>;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const args = [
        this.scraperPath,
        '--url=' + url,
        '--recallId=' + recallId,
        '--download=true',
        '--headless=true'
      ];

      logger.info(`[Image Service] Running scraper: node ${args.join(' ')}`);

      const child = spawn('node', args, {
        cwd: process.cwd(),
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          logger.error(`[Image Service] Scraper exited with code ${code}`);
          resolve({
            success: false,
            error: `Scraper exited with code ${code}: ${stderr}`
          });
          return;
        }

        try {
          // Parse the scraper output to get image paths
          const result = this.parseScraperOutput(stdout);
          resolve(result);
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse scraper output: ${error}`
          });
        }
      });

      child.on('error', (error) => {
        logger.error(`[Image Service] Scraper error: ${error.message}`);
        resolve({
          success: false,
          error: error.message
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!child.killed) {
          child.kill();
          resolve({
            success: false,
            error: 'Scraper timeout after 5 minutes'
          });
        }
      }, 300000);
    });
  }

  /**
   * Parse scraper output to extract image information
   */
  private parseScraperOutput(output: string): {
    success: boolean;
    images?: Array<{
      filename: string;
      path: string;
      size: number;
      width: number;
      height: number;
    }>;
    error?: string;
  } {
    try {
      // Look for JSON output in the scraper logs
      const jsonMatch = output.match(/SCRAPER_RESULT:(.+)SCRAPER_RESULT_END/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[1]);
        return {
          success: result.success,
          images: result.images,
          error: result.error
        };
      }

      // Fallback: Parse structured log output
      const images: Array<any> = [];
      const lines = output.split('\n');

      for (const line of lines) {
        if (line.includes('Downloaded') && line.includes('Path:')) {
          const pathMatch = line.match(/Path:\s*(.+)/);
          if (pathMatch) {
            const imagePath = pathMatch[1].trim();
            if (fs.existsSync(imagePath)) {
              const stats = fs.statSync(imagePath);
              const filename = path.basename(imagePath);

              images.push({
                filename,
                path: imagePath,
                size: stats.size,
                width: 0, // Will be set from actual metadata
                height: 0
              });
            }
          }
        }
      }

      if (images.length > 0) {
        return { success: true, images };
      }

      // Check if scraper indicated success but no images found
      if (output.includes('Total Images Found: 0')) {
        return { success: true, images: [] };
      }

      return {
        success: false,
        error: 'Could not parse scraper output'
      };

    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error}`
      };
    }
  }

  /**
   * Upload scraped images to Firebase Storage
   */
  private async uploadImagesToFirebase(
    recallId: string,
    images: Array<{ filename: string; path: string; size: number }>,
    source: 'fda_recalls' | 'temp_fda_recalls'
  ): Promise<string[]> {
    const bucket = this.storage.bucket();
    const uploadedUrls: string[] = [];

    // Determine storage path based on source
    const storagePath = source === 'fda_recalls'
      ? `fda-recall-images/${recallId}`
      : `temp-recall-images/${recallId}`;

    for (const image of images) {
      try {
        if (!fs.existsSync(image.path)) {
          logger.warn(`[Image Service] Image file not found: ${image.path}`);
          continue;
        }

        const fileBuffer = fs.readFileSync(image.path);
        const fileName = `${Date.now()}_${image.filename}`;
        const filePath = `${storagePath}/${fileName}`;

        const file = bucket.file(filePath);

        await file.save(fileBuffer, {
          metadata: {
            contentType: this.getContentType(image.filename),
            metadata: {
              recallId,
              originalFilename: image.filename,
              uploadedAt: new Date().toISOString(),
              source: 'scraper'
            }
          }
        });

        // Make file publicly accessible
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        uploadedUrls.push(publicUrl);

        logger.info(`[Image Service] Uploaded image: ${filePath}`);

      } catch (error) {
        logger.error(`[Image Service] Failed to upload image ${image.filename}: ${error}`);
      }
    }

    return uploadedUrls;
  }

  /**
   * Update Firestore with image metadata
   */
  private async updateFirestoreMetadata(
    recallId: string,
    metadata: RecallImageMetadata,
    source: 'fda_recalls' | 'temp_fda_recalls'
  ): Promise<void> {
    try {
      const collection = source === 'fda_recalls' ? 'fda_recalls' : 'temp_fda_recalls';
      const docRef = this.db.collection(collection).doc(recallId);

      await docRef.update({
        scrapped_images: metadata,
        lastUpdated: new Date().toISOString()
      });

      logger.info(`[Image Service] Updated metadata for recall ${recallId} in ${collection}`);

    } catch (error) {
      logger.error(`[Image Service] Failed to update metadata for recall ${recallId}: ${error}`);
      throw error;
    }
  }

  /**
   * Clean up temporary files created by the scraper
   */
  private async cleanupTempFiles(images: Array<{ path: string }>): Promise<void> {
    for (const image of images) {
      try {
        if (fs.existsSync(image.path)) {
          fs.unlinkSync(image.path);
        }
      } catch (error) {
        logger.warn(`[Image Service] Failed to delete temp file ${image.path}: ${error}`);
      }
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const fdaImageService = new FDAImageService();