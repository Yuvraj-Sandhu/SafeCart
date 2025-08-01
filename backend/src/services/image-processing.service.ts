import admin from 'firebase-admin';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

// Types to match the original JS file structure
interface ProcessedImage {
  originalFilename: string;
  type: 'pdf-page' | 'image' | 'error';
  page?: number;
  sourceUrl: string;
  storageUrl?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  downloadedAt?: string;
  error?: string;
  attemptedUrl?: string;
}

interface ProcessingResult {
  recallId: string;
  status: 'completed' | 'error' | 'no_labels';
  successCount: number;
  errorCount: number;
  processedImages: ProcessedImage[];
  error?: string;
}

interface DownloadResult {
  size: number;
}

interface ImageInfo {
  path: string;
  page: number;
  originalSize: number;
}

interface OptimizationResult {
  success: boolean;
  size: number;
}

export class ImageProcessingService {
  private storage: any;
  private tempDir: string;
  private db: admin.firestore.Firestore;

  constructor() {
    // Initialize Firebase if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    }

    this.storage = admin.storage().bucket();
    this.tempDir = path.join(__dirname, '../../temp-images');
    this.db = admin.firestore();
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
        logger.info(`Created temp directory: ${this.tempDir}`);
      }
    } catch (error) {
      logger.error(`Failed to create temp directory ${this.tempDir}:`, error);
      throw error;
    }
  }

  /**
   * Extract label URLs from field_summary HTML - exact match to original
   */
  private extractLabelUrls(fieldSummary: string): string[] {
    if (!fieldSummary || fieldSummary.trim() === '') return [];
    
    const urls: string[] = [];
    
    // Pattern 1: Original href regex for labels
    const hrefRegex = /href=["']([^"']*labels[^"']*)["']/gi;
    let match;
    
    while ((match = hrefRegex.exec(fieldSummary)) !== null) {
      let url = match[1];
      if (url.startsWith('/')) {
        url = `https://www.fsis.usda.gov${url}`;
      }
      if (url.toLowerCase().includes('labels')) {
        urls.push(url);
      }
    }
    
    // Pattern 2: Look for <a href="...">view label</a> or <a href="...">view labels</a> (both singular and plural)
    // Updated to handle href not being the first attribute
    const viewLabelRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*view\s+labels?\s*<\/a>/gi;
    
    while ((match = viewLabelRegex.exec(fieldSummary)) !== null) {
      let url = match[1];
      
      // Handle relative URLs
      if (url.startsWith('/')) {
        url = `https://www.fsis.usda.gov${url}`;
      }
      
      // Handle HTML entities
      url = url.replace(/&amp;/g, '&');
      
      // Handle Outlook safe links
      if (url.includes('safelinks.protection.outlook.com')) {
        const urlMatch = url.match(/url=([^&]+)/);
        if (urlMatch) {
          url = decodeURIComponent(urlMatch[1]);
        }
      }
      
      // Only add if it's not already in the array
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    
    // Pattern 3: Also catch [<a href="...">view label</a>] or [<a href="...">view labels</a>] format (with brackets outside)
    const bracketViewLabelRegex = /\[<a[^>]*href=["']([^"']+)["'][^>]*>\s*view\s+labels?\s*<\/a>\]/gi;
    
    while ((match = bracketViewLabelRegex.exec(fieldSummary)) !== null) {
      let url = match[1];
      
      // Handle relative URLs
      if (url.startsWith('/')) {
        url = `https://www.fsis.usda.gov${url}`;
      }
      
      // Handle HTML entities
      url = url.replace(/&amp;/g, '&');
      
      // Handle Outlook safe links
      if (url.includes('safelinks.protection.outlook.com')) {
        const urlMatch = url.match(/url=([^&]+)/);
        if (urlMatch) {
          url = decodeURIComponent(urlMatch[1]);
        }
      }
      
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    
    // Pattern 4: Also catch <a href="...">[view label]</a> or <a href="...">[view labels]</a> format (with brackets inside)
    const insideBracketViewLabelRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*\[\s*view\s+labels?\s*\]\s*<\/a>/gi;
    
    while ((match = insideBracketViewLabelRegex.exec(fieldSummary)) !== null) {
      let url = match[1];
      
      // Handle relative URLs
      if (url.startsWith('/')) {
        url = `https://www.fsis.usda.gov${url}`;
      }
      
      // Handle HTML entities
      url = url.replace(/&amp;/g, '&');
      
      // Handle Outlook safe links
      if (url.includes('safelinks.protection.outlook.com')) {
        const urlMatch = url.match(/url=([^&]+)/);
        if (urlMatch) {
          url = decodeURIComponent(urlMatch[1]);
        }
      }
      
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    
    // Pattern 5: Links with "here" text pointing to PDF files
    const hereLinksRegex = /<a[^>]*href=["']([^"']*\.pdf[^"']*)["'][^>]*>\s*here\s*<\/a>/gi;
    
    while ((match = hereLinksRegex.exec(fieldSummary)) !== null) {
      let url = match[1];
      
      // Handle relative URLs
      if (url.startsWith('/')) {
        url = `https://www.fsis.usda.gov${url}`;
      }
      
      // Handle HTML entities
      url = url.replace(/&amp;/g, '&');
      
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    
    // Pattern 6: Links with "product list" or similar text
    const productListRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*[^<]*product[^<]*list[^<]*<\/a>/gi;
    
    while ((match = productListRegex.exec(fieldSummary)) !== null) {
      let url = match[1];
      
      // Handle relative URLs
      if (url.startsWith('/')) {
        url = `https://www.fsis.usda.gov${url}`;
      }
      
      // Handle HTML entities
      url = url.replace(/&amp;/g, '&');
      
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    
    // Pattern 7: PDF URLs containing relevant keywords (label, product, recall)
    const relevantPdfRegex = /<a[^>]*href=["']([^"']*(?:label|product|recall)[^"']*\.pdf[^"']*)["'][^>]*>/gi;
    
    while ((match = relevantPdfRegex.exec(fieldSummary)) !== null) {
      let url = match[1];
      
      // Handle relative URLs
      if (url.startsWith('/')) {
        url = `https://www.fsis.usda.gov${url}`;
      }
      
      // Handle HTML entities
      url = url.replace(/&amp;/g, '&');
      
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    
    return [...new Set(urls)];
  }

  /**
   * Download file with retry logic - exact match to original
   */
  private async downloadFile(url: string, filepath: string, retries: number = 3): Promise<DownloadResult> {
    // Ensure temp directory exists before downloading
    this.ensureTempDir();
    
    // Also ensure the specific directory for this file exists
    const fileDir = path.dirname(filepath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        fs.writeFileSync(filepath, response.data);
        return { size: response.data.length };
        
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  /**
   * Get PDF page count - exact match to original
   */
  private async getPdfPageCount(pdfPath: string): Promise<number> {
    try {
      const pdfLib = require('pdf-lib');
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdf = await pdfLib.PDFDocument.load(pdfBytes);
      return pdf.getPageCount();
    } catch (error) {
      logger.warn('pdf-lib not available, using ImageMagick for page count');
      try {
        const output = execSync(`magick identify "${pdfPath}"`, { encoding: 'utf8' });
        const pages = output.trim().split('\n').length;
        return pages;
      } catch (magickError) {
        logger.warn('ImageMagick page count failed, defaulting to 1');
        return 1;
      }
    }
  }

  /**
   * Convert PDF to images - exact match to original
   */
  private async convertPdfToImages(pdfPath: string, recallId: string): Promise<ImageInfo[] | null> {
    try {
      const pageCount = await this.getPdfPageCount(pdfPath);
      logger.info(`PDF has ${pageCount} pages`);
      
      const images: ImageInfo[] = [];
      
      for (let page = 1; page <= pageCount; page++) {
        try {
          logger.info(`Converting page ${page}/${pageCount}...`);
          
          // Use direct ImageMagick command first since it's more reliable
          const outputPath = path.join(this.tempDir, `${recallId}_page_${page}.png`);
          
          try {
            let conversionSucceeded = false;
            
            // First attempt: 400 DPI for high quality
            try {
              execSync(`magick -density 400 "${pdfPath}[${page-1}]" -trim +repage -quality 95 -strip "${outputPath}"`, { 
                stdio: 'pipe',
                timeout: 120000 
              });
              conversionSucceeded = true;
              logger.info(`Page ${page} converted at 400 DPI (${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB)`);
            } catch (highDpiError) {
              logger.warn(`400 DPI conversion timed out or failed for page ${page}, trying 300 DPI fallback...`);
              
              // Fallback attempt: 300 DPI for faster processing
              try {
                // Remove any partial file from failed attempt
                if (fs.existsSync(outputPath)) {
                  fs.unlinkSync(outputPath);
                }
                
                execSync(`magick -density 300 "${pdfPath}[${page-1}]" -trim +repage -quality 95 -strip "${outputPath}"`, { 
                  stdio: 'pipe',
                  timeout: 180000
                });
                conversionSucceeded = true;
                logger.info(`Page ${page} converted at 300 DPI fallback (${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB)`);
              } catch (fallbackError) {
                logger.error(`Both 400 DPI and 300 DPI conversion failed for page ${page}:`, fallbackError);
              }
            }
            
            if (conversionSucceeded && fs.existsSync(outputPath)) {
              images.push({
                path: outputPath,
                page: page,
                originalSize: fs.statSync(outputPath).size
              });
            } else {
              logger.warn(`⚠ Page ${page} conversion failed - no output file`);
            }
          } catch (directError) {
            logger.error(`✗ ImageMagick processing failed for page ${page}:`, directError);
          }
        } catch (pageError) {
          logger.error(`✗ Page ${page} error:`, pageError);
        }
      }
      
      return images.length > 0 ? images : null;
      
    } catch (error) {
      logger.error('PDF conversion failed:', error);
      return null;
    }
  }

  /**
   * Optimize image using sharp - preserve original quality, no upscaling needed
   */
  private async optimizeImage(inputPath: string, outputPath: string): Promise<OptimizationResult> {
    try {
      const sharp = require('sharp');
      
      // Get original image metadata
      const metadata = await sharp(inputPath).metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;
      
      logger.info(`Original image: ${originalWidth}x${originalHeight}`);
      
      // Keep original size - high DPI PDF conversion already provides good quality
      logger.info(`Keeping original size for maximum quality: ${originalWidth}x${originalHeight}`);
      
      const result = await sharp(inputPath)
        .png({ 
          quality: 100,           // Maximum quality for text readability
          compressionLevel: 1,    // Minimal compression for best quality
          adaptiveFiltering: true // Better compression efficiency at high quality
        })
        .toFile(outputPath);
      
      logger.info(`✓ Image processed: ${(result.size / 1024).toFixed(2)} KB (${result.width}x${result.height})`);
      return { success: true, size: result.size };
      
    } catch (error) {
      logger.error('Image optimization failed:', error);
      // Fallback to copying original file
      fs.copyFileSync(inputPath, outputPath);
      return { success: true, size: fs.statSync(outputPath).size };
    }
  }

  /**
   * Upload file to Firebase Storage - exact match to original
   */
  private async uploadToStorage(filePath: string, destination: string): Promise<string> {
    try {
      // Check if bucket exists
      const [bucketExists] = await this.storage.exists();
      if (!bucketExists) {
        logger.info('Creating Firebase Storage bucket...');
        await this.storage.create();
      }
      
      const [file] = await this.storage.upload(filePath, {
        destination: destination,
        metadata: {
          contentType: this.getContentType(filePath)
        }
      });
      
      // Make file public
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${this.storage.name}/${destination}`;
      
      return publicUrl;
      
    } catch (error) {
      logger.error('Storage upload failed:', error);
      throw error;
    }
  }

  /**
   * Get content type based on file extension - exact match to original
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf': return 'application/pdf';
      case '.jpg': case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Process a single recall - exact match to original
   */
  private async processRecall(recallDoc: admin.firestore.DocumentSnapshot): Promise<ProcessingResult> {
    const recall = recallDoc.data();
    const recallId = recallDoc.id;
    
    if (!recall) {
      return {
        recallId,
        status: 'error',
        successCount: 0,
        errorCount: 0,
        processedImages: [],
        error: 'No recall data found'
      };
    }
    
    logger.info(`Processing recall ${recall.field_recall_number} (${recallId})`);
    
    const labelUrls = this.extractLabelUrls(recall.field_summary);
    
    if (labelUrls.length === 0) {
      logger.info('No label URLs found in field_summary');
      return { recallId, status: 'no_labels', successCount: 0, errorCount: 0, processedImages: [] };
    }
    
    logger.info(`Found ${labelUrls.length} label URL(s):`);
    labelUrls.forEach((url, index) => {
      logger.info(`  ${index + 1}. ${url}`);
    });
    
    const processedImages: ProcessedImage[] = [];
    
    for (let i = 0; i < labelUrls.length; i++) {
      const url = labelUrls[i];
      // Decode URL-encoded characters in filename to avoid file system issues
      const filename = decodeURIComponent(path.basename(url));
      
      try {
        logger.info(`--- Processing ${filename} ---`);
        
        const tempFilePath = path.join(this.tempDir, `${recallId}_${filename}`);
        
        // Download file
        logger.info('1. Downloading file...');
        const downloadResult = await this.downloadFile(url, tempFilePath);
        logger.info(`✓ Downloaded: ${(downloadResult.size / 1024).toFixed(2)} KB`);
        
        const isPdf = filename.toLowerCase().endsWith('.pdf');
        
        if (isPdf) {
          logger.info('2. Processing PDF...');
          
          // Try to convert PDF to images
          const pdfImages = await this.convertPdfToImages(tempFilePath, recallId);
          
          if (pdfImages && pdfImages.length > 0) {
            logger.info(`3. Optimizing and uploading ${pdfImages.length} PDF pages...`);
            
            // Process each page
            for (const imageInfo of pdfImages) {
              try {
                const optimizedPath = path.join(this.tempDir, `${recallId}_page_${imageInfo.page}_optimized.png`);
                
                // Optimize image
                await this.optimizeImage(imageInfo.path, optimizedPath);
                
                // Upload to storage
                const storagePath = `recall-images/${recallId}/${filename}_page_${imageInfo.page}.png`;
                const storageUrl = await this.uploadToStorage(optimizedPath, storagePath);
                
                processedImages.push({
                  originalFilename: filename,
                  type: 'pdf-page',
                  page: imageInfo.page,
                  sourceUrl: url,
                  storageUrl: storageUrl,
                  storagePath: storagePath,
                  mimeType: 'image/png',
                  sizeBytes: fs.statSync(optimizedPath).size,
                  downloadedAt: new Date().toISOString()
                });
                
                logger.info(`✓ Page ${imageInfo.page} uploaded: ${storageUrl}`);
                
                // Clean up temp files
                fs.unlinkSync(imageInfo.path);
                fs.unlinkSync(optimizedPath);
                
              } catch (pageError) {
                logger.error(`✗ Failed to process page ${imageInfo.page}:`, pageError);
                processedImages.push({
                  originalFilename: filename,
                  type: 'error',
                  page: imageInfo.page,
                  sourceUrl: url,
                  error: pageError instanceof Error ? pageError.message : 'Unknown error',
                  attemptedUrl: url
                });
              }
            }
          } else {
            logger.warn('PDF conversion failed, storing as PDF');
            
            // Store original PDF
            const storagePath = `recall-images/${recallId}/${filename}`;
            const storageUrl = await this.uploadToStorage(tempFilePath, storagePath);
            
            processedImages.push({
              originalFilename: filename,
              type: 'pdf-page',
              sourceUrl: url,
              storageUrl: storageUrl,
              storagePath: storagePath,
              mimeType: 'application/pdf',
              sizeBytes: fs.statSync(tempFilePath).size,
              downloadedAt: new Date().toISOString()
            });
          }
        } else {
          logger.info('2. Processing as image...');
          
          const optimizedPath = path.join(this.tempDir, `${recallId}_${filename}_optimized.png`);
          
          // Optimize image
          await this.optimizeImage(tempFilePath, optimizedPath);
          
          // Upload to storage
          const storagePath = `recall-images/${recallId}/${filename}_optimized.png`;
          const storageUrl = await this.uploadToStorage(optimizedPath, storagePath);
          
          processedImages.push({
            originalFilename: filename,
            type: 'image',
            sourceUrl: url,
            storageUrl: storageUrl,
            storagePath: storagePath,
            mimeType: 'image/png',
            sizeBytes: fs.statSync(optimizedPath).size,
            downloadedAt: new Date().toISOString()
          });
          
          logger.info(`✓ Image uploaded: ${storageUrl}`);
          
          // Clean up temp files
          fs.unlinkSync(optimizedPath);
        }
        
        // Clean up original temp file
        fs.unlinkSync(tempFilePath);
        
      } catch (error) {
        logger.error(`✗ Error processing ${filename}:`, error);
        processedImages.push({
          originalFilename: filename,
          type: 'error',
          sourceUrl: url,
          error: error instanceof Error ? error.message : 'Unknown error',
          attemptedUrl: url
        });
      }
    }

    // Update Firestore document
    if (processedImages.length > 0) {
      const updateData = {
        processedImages: processedImages,
        imagesProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalImageCount: processedImages.filter(img => img.type !== 'error').length,
        hasErrors: processedImages.some(img => img.type === 'error'),
        extractedUrls: labelUrls
      };

      await recallDoc.ref.update(updateData);
    }

    const successCount = processedImages.filter(img => img.type !== 'error').length;
    const errorCount = processedImages.filter(img => img.type === 'error').length;

    return {
      recallId,
      status: 'completed',
      successCount,
      errorCount,
      processedImages
    };
  }

  /**
   * Process images for recent recalls passed as parameter
   */
  async processRecentRecalls(recentRecalls: any[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    // Get recall documents from Firestore for the recent recalls
    const recallsToProcess: admin.firestore.DocumentSnapshot[] = [];
    
    for (const recall of recentRecalls) {
      try {
        // Find the recall document in Firestore
        const snapshot = await this.db.collection('recalls')
          .where('field_recall_number', '==', recall.field_recall_number)
          .where('langcode', '==', recall.langcode)
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          const labelUrls = this.extractLabelUrls(data.field_summary);
          
          if (labelUrls.length > 0) {
            // Check if images were actually processed successfully
            let needsProcessing = !data.imagesProcessedAt || 
                                  !data.processedImages || 
                                  data.processedImages.length === 0 ||
                                  data.totalImageCount === 0;
            
            // Additional check for partial failures
            if (!needsProcessing && data.processedImages && data.hasErrors) {
              // Count how many non-error items we have (PDFs and successful images)
              const nonErrorCount = data.processedImages.filter((img: any) => img.type !== 'error').length;
              // If we have fewer successful/PDF items than URLs, we have partial failure
              if (nonErrorCount < labelUrls.length) {
                needsProcessing = true;
              }
              // Also check if the successful image count matches what we actually converted
              const successfulImages = data.processedImages.filter((img: any) => 
                img.type === 'pdf-page' || img.type === 'image'
              ).length;
              if (data.totalImageCount !== successfulImages) {
                needsProcessing = true;
              }
            }
            
            if (needsProcessing) {
              recallsToProcess.push(doc);
            }
          }
        }
      } catch (error) {
        logger.error(`Error finding recall ${recall.field_recall_number}:`, error);
      }
    }
    
    logger.info(`Found ${recallsToProcess.length} recent recalls to process for images`);
    
    // Process each recall
    for (const recallDoc of recallsToProcess) {
      try {
        const result = await this.processRecall(recallDoc);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to process recall ${recallDoc.id}:`, error);
        results.push({
          recallId: recallDoc.id,
          status: 'error',
          successCount: 0,
          errorCount: 0,
          processedImages: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Clean up temp directory
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        // Give some time for file handles to close
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          // First attempt: standard cleanup
          fs.rmSync(this.tempDir, { recursive: true, force: true });
        } catch (error: any) {
          if (error.code === 'EPERM' || error.code === 'EBUSY') {
            logger.warn('Initial cleanup failed, attempting delayed cleanup...');
            
            // Wait longer and try again
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
              fs.rmSync(this.tempDir, { recursive: true, force: true });
            } catch (retryError) {
              logger.warn('Delayed cleanup failed, trying process.nextTick approach...');
              
              // Use process.nextTick to ensure all operations complete
              await new Promise(resolve => {
                process.nextTick(() => {
                  setTimeout(() => {
                    try {
                      fs.rmSync(this.tempDir, { recursive: true, force: true });
                      resolve(undefined);
                    } catch (finalError) {
                      logger.warn('Final cleanup attempt failed, leaving temp directory for manual cleanup:', this.tempDir);
                      logger.warn('You can manually delete this directory when the process completes.');
                      resolve(undefined);
                    }
                  }, 3000);
                });
              });
            }
          } else {
            logger.warn('Cleanup failed with unexpected error:', error);
          }
        }
      }
    } catch (error) {
      logger.warn('Cleanup error:', error);
    }
  }
}