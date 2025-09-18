/**
 * FDA Recall Image Scraper
 * Extracts and processes images from FDA recall pages using Playwright
 *
 * Installation:
 *   npm install playwright playwright-extra puppeteer-extra-plugin-stealth sharp
 *   npx playwright install chromium
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Image processing with Sharp
let sharp;
let sharpAvailable = false;
try {
  sharp = require('sharp');
  sharpAvailable = true;
  console.log('Image Scraper: Sharp available for image processing');
} catch (error) {
  console.log('Image Scraper: Sharp not available - images will be saved as-is');
}

// Dynamically load playwright or playwright-extra based on requirements
let chromium;
let useStealthMode = false;

try {
  // Try to load playwright-extra with stealth plugin
  const { chromium: playwrightChromium } = require('playwright-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');

  // Add stealth plugin with all evasions
  playwrightChromium.use(StealthPlugin());

  chromium = playwrightChromium;
  useStealthMode = true;
  console.log('Image Scraper: Stealth mode available - using enhanced evasion techniques');
} catch (error) {
  // Fallback to regular playwright if stealth dependencies not installed
  chromium = require('playwright').chromium;
  console.log('Image Scraper: Using standard Playwright');
}

class FDARecallImageScraper {
  constructor(options = {}) {
    this.browser = null;
    this.context = null;
    this.headless = options.headless !== undefined ? options.headless : true;
    this.debug = options.debug || false;
    this.tempImagesDir = path.join(__dirname, 'temp-images');
    this.downloadImages = options.downloadImages !== undefined ? options.downloadImages : false;
    this.minWidth = options.minWidth || 800; // Minimum width for processed images

    // Ensure temp-images directory exists
    this.ensureTempDirectory();
  }

  /**
   * Ensure the temp-images directory exists
   */
  ensureTempDirectory() {
    if (!fs.existsSync(this.tempImagesDir)) {
      fs.mkdirSync(this.tempImagesDir, { recursive: true });
      console.log(`Image Scraper: Created temp directory: ${this.tempImagesDir}`);
    }
  }

  /**
   * Clean up temp directory (optional - call when needed)
   */
  cleanTempDirectory() {
    try {
      const files = fs.readdirSync(this.tempImagesDir);
      files.forEach(file => {
        const filePath = path.join(this.tempImagesDir, file);
        fs.unlinkSync(filePath);
      });
      console.log(`Image Scraper: Cleaned ${files.length} files from temp directory`);
    } catch (error) {
      console.error(`Image Scraper: Error cleaning temp directory:`, error.message);
    }
  }

  /**
   * Generate a unique filename for downloaded images
   */
  generateImageFilename(url, recallId = 'unknown', processed = false) {
    const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const suffix = processed ? '_processed' : '';
    return `recall_${recallId}_${timestamp}_${urlHash}${suffix}${ext}`;
  }

  /**
   * Process image to ensure quality and minimum dimensions
   * @param {Buffer} buffer - Original image buffer
   * @returns {Object} Processed image buffer and metadata
   */
  async processImage(buffer) {
    try {
      if (!sharpAvailable) {
        return { buffer, processed: false };
      }

      const image = sharp(buffer);
      const metadata = await image.metadata();
      const { width, height } = metadata;

      let pipeline = image;
      let processed = false;

      // Ensure minimum width of 800px for readability
      if (width < this.minWidth) {
        const scaleFactor = this.minWidth / width;
        const newWidth = Math.round(width * scaleFactor);
        const newHeight = Math.round(height * scaleFactor);

        console.log(`Image Scraper: Resizing from ${width}x${height} to ${newWidth}x${newHeight}`);

        pipeline = pipeline.resize(newWidth, newHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false
        });
        processed = true;
      }

      // Apply sharpening for better text clarity
      pipeline = pipeline.sharpen({
        sigma: 0.8,
        m1: 1.0,
        m2: 0.5,
        x1: 2,
        y2: 10,
        y3: 5
      });

      // Optimize for web delivery
      if (metadata.channels === 4) {
        // Has alpha channel - keep as PNG
        pipeline = pipeline.png({
          quality: 95,
          compressionLevel: 6,
          progressive: true
        });
      } else {
        // No alpha - convert to optimized JPEG
        pipeline = pipeline.jpeg({
          quality: 95,
          progressive: true,
          mozjpeg: true
        });
      }

      const processedBuffer = await pipeline.toBuffer();
      const processedMetadata = await sharp(processedBuffer).metadata();

      console.log(`Image Scraper: Processed image - Final size: ${processedMetadata.width}x${processedMetadata.height}`);

      return {
        buffer: processedBuffer,
        processed: true,
        width: processedMetadata.width,
        height: processedMetadata.height,
        size: processedBuffer.length
      };

    } catch (error) {
      console.error('Image Scraper: Error processing image:', error.message);
      return { buffer, processed: false };
    }
  }

  /**
   * Initialize browser with proper settings
   */
  async init() {
    if (!this.browser) {
      console.log('Image Scraper: Initializing browser...');
      console.log(`Mode: ${this.headless ? 'Headless' : 'Headed'}, Stealth: ${useStealthMode && this.headless ? 'Enabled' : 'Disabled'}`);

      // Browser args for stability and stealth
      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ];

      // Add stealth-specific args when in headless mode
      if (this.headless && useStealthMode) {
        browserArgs.push(
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
          '--start-maximized',
          '--disable-infobars',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        );
      }

      const launchOptions = {
        headless: this.headless,
        args: browserArgs
      };

      // Remove automation flag when using stealth
      if (this.headless && useStealthMode) {
        launchOptions.ignoreDefaultArgs = ['--enable-automation'];
      }

      this.browser = await chromium.launch(launchOptions);

      // Browser context options
      const contextOptions = {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation']
      };

      // Add realistic headers when using stealth
      if (this.headless && useStealthMode) {
        contextOptions.screen = { width: 1920, height: 1080 };
        contextOptions.deviceScaleFactor = 1;
        contextOptions.hasTouch = false;
        contextOptions.isMobile = false;
        contextOptions.permissions = ['geolocation', 'notifications'];
        contextOptions.extraHTTPHeaders = {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-User': '?1',
          'Sec-Fetch-Dest': 'document',
          'Upgrade-Insecure-Requests': '1'
        };
      } else {
        contextOptions.extraHTTPHeaders = {
          'Accept-Language': 'en-US,en;q=0.9'
        };
      }

      this.context = await this.browser.newContext(contextOptions);
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Extract images from a single FDA recall URL
   * @param {string} url - The FDA recall URL
   * @param {Object} options - Additional options for extraction
   * @returns {Object} Object containing recall images and metadata
   */
  async extractImagesFromURL(url, options = {}) {
    const { recallId = null, downloadImages = this.downloadImages } = options;

    try {
      await this.init();

      const page = await this.context.newPage();

      // Add evasions for stealth mode
      if (this.headless && useStealthMode) {
        await page.addInitScript(() => {
          // Override webdriver detection
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
          });

          // Override permissions query
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
        });
      }

      console.log(`Image Scraper: Navigating to: ${url}`);

      // Random delay to mimic human behavior
      await page.waitForTimeout(Math.random() * 2000 + 1000);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for main content to load
      await page.waitForSelector('main', { timeout: 10000 }).catch(() => {
        console.log('Image Scraper: Main element not found, continuing...');
      });

      // Give images time to load
      await page.waitForTimeout(2000);

      // Extract images from the page
      const imageData = await page.evaluate(() => {
        const images = [];

        // Get all images in the main content area
        const mainContent = document.querySelector('main') || document.querySelector('.main-content') || document.querySelector('#main-content') || document.body;

        if (mainContent) {
          const imgElements = mainContent.querySelectorAll('img');

          imgElements.forEach((img) => {
            // Skip small images (likely icons) and FDA logo
            const width = img.naturalWidth || img.width || 0;
            const height = img.naturalHeight || img.height || 0;
            const src = img.src;
            const alt = img.alt || '';

            // Filter out common non-product images
            const isLikelyIcon = width < 100 || height < 100;
            const isFDALogo = src.includes('fda-logo') || alt.toLowerCase().includes('fda logo');
            const isSocialIcon = src.includes('social') || src.includes('twitter') || src.includes('facebook');

            if (src && !isLikelyIcon && !isFDALogo && !isSocialIcon) {
              // Make sure we have absolute URLs
              const absoluteUrl = src.startsWith('http') ? src : new URL(src, window.location.origin).href;

              images.push({
                url: absoluteUrl,
                alt: alt,
                width: width,
                height: height,
                title: img.title || ''
              });
            }
          });
        }

        // Also check for images in figure elements (common for product photos)
        const figures = document.querySelectorAll('figure img');
        figures.forEach((img) => {
          const src = img.src;
          const alt = img.alt || '';

          if (src) {
            const absoluteUrl = src.startsWith('http') ? src : new URL(src, window.location.origin).href;

            // Check if this image is already in our list
            const exists = images.some(i => i.url === absoluteUrl);

            if (!exists) {
              images.push({
                url: absoluteUrl,
                alt: alt,
                width: img.naturalWidth || img.width || 0,
                height: img.naturalHeight || img.height || 0,
                title: img.title || '',
                inFigure: true
              });
            }
          }
        });

        // Extract page title for context
        const pageTitle = document.querySelector('h1')?.textContent?.trim() ||
                         document.querySelector('title')?.textContent?.trim() || '';

        return {
          images,
          pageTitle,
          totalImagesFound: images.length
        };
      });

      await page.close();

      // Download and process images if requested
      if (downloadImages && imageData.images && imageData.images.length > 0) {
        console.log(`Image Scraper: Downloading ${imageData.images.length} images...`);
        const downloadedImages = [];

        for (let i = 0; i < imageData.images.length; i++) {
          const img = imageData.images[i];
          try {
            // Download the image
            let buffer = await this.downloadImage(img.url);

            // Process the image (resize if needed, optimize)
            const processResult = await this.processImage(buffer);
            buffer = processResult.buffer;

            // Generate filename
            const filename = this.generateImageFilename(img.url, recallId, processResult.processed);
            const filepath = path.join(this.tempImagesDir, filename);

            // Save the processed image
            fs.writeFileSync(filepath, buffer);

            downloadedImages.push({
              ...img,
              localPath: filepath,
              filename: filename,
              fileSize: buffer.length,
              processed: processResult.processed,
              width: processResult.width || img.width,
              height: processResult.height || img.height
            });

            const status = processResult.processed ? ' [PROCESSED]' : '';
            console.log(`Image Scraper: Downloaded ${i + 1}/${imageData.images.length}: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)${status}`);
          } catch (downloadError) {
            console.error(`Image Scraper: Failed to download image ${i + 1}:`, downloadError.message);
            downloadedImages.push({
              ...img,
              downloadError: downloadError.message
            });
          }
        }

        imageData.downloadedImages = downloadedImages;
        imageData.downloadedCount = downloadedImages.filter(img => img.localPath).length;
      }

      return {
        success: true,
        url,
        ...imageData,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Image Scraper: Error extracting images from ${url}:`, error.message);
      return {
        success: false,
        url,
        error: error.message,
        images: [],
        totalImagesFound: 0,
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Extract images from multiple FDA recall URLs
   * @param {string[]} urls - Array of FDA recall URLs
   * @param {Object} options - Options for batch processing
   * @returns {Object[]} Array of results for each URL
   */
  async extractImagesFromMultipleURLs(urls, options = {}) {
    const {
      batchSize = 3,  // Process 3 URLs concurrently
      delay = 2000     // Delay between batches in ms
    } = options;

    try {
      await this.init();

      const results = [];

      // Process URLs in batches
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);

        console.log(`Image Scraper: Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(urls.length/batchSize)}`);

        const batchPromises = batch.map((url, index) =>
          this.extractImagesFromURL(url, {
            recallId: options.recallIds ? options.recallIds[i + index] : undefined,
            downloadImages: options.downloadImages
          })
        );
        const batchResults = await Promise.allSettled(batchPromises);

        // Process results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              url: batch[index],
              error: result.reason?.message || 'Unknown error',
              images: [],
              totalImagesFound: 0,
              scrapedAt: new Date().toISOString()
            });
          }
        });

        // Random delay between batches
        if (i + batchSize < urls.length) {
          const randomDelay = delay + Math.random() * 1000;
          console.log(`Image Scraper: Waiting ${Math.round(randomDelay)}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, randomDelay));
        }
      }

      return results;

    } finally {
      // Close browser after batch processing
      await this.close();
    }
  }

  /**
   * Download image from URL
   * @param {string} imageUrl - URL of the image to download
   * @returns {Buffer} Image buffer
   */
  async downloadImage(imageUrl) {
    try {
      // Try to load node-fetch
      let fetch;
      try {
        fetch = require('node-fetch');
      } catch (e) {
        // If node-fetch is not available, try to use the global fetch (Node 18+)
        if (typeof globalThis.fetch !== 'undefined') {
          fetch = globalThis.fetch;
        } else {
          throw new Error('node-fetch is not installed and native fetch is not available');
        }
      }

      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get buffer depending on fetch implementation
      let buffer;
      if (response.buffer) {
        // node-fetch
        buffer = await response.buffer();
      } else {
        // native fetch
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      return buffer;

    } catch (error) {
      console.error(`Image Scraper: Error downloading image from ${imageUrl}:`, error.message);
      throw error;
    }
  }

  /**
   * Scrape recall images - main public interface
   * @param {string} url - FDA recall URL
   * @param {Object} options - Scraping options
   * @returns {Object} Scraping results
   */
  async scrapeRecallImages(url, options = {}) {
    const defaultOptions = {
      downloadImages: true,
      ...options
    };

    const result = await this.extractImagesFromURL(url, defaultOptions);

    // Format response for consistency
    if (result.success && result.downloadedImages) {
      return {
        success: true,
        images: result.downloadedImages.filter(img => img.localPath).map(img => ({
          filename: img.filename,
          path: img.localPath,
          size: img.fileSize,
          width: img.width,
          height: img.height,
          processed: img.processed,
          alt: img.alt,
          originalUrl: img.url
        })),
        totalFound: result.totalImagesFound,
        downloadedCount: result.downloadedCount
      };
    }

    return {
      success: false,
      images: [],
      error: result.error || 'Failed to scrape images'
    };
  }
}

// Example usage and testing
if (require.main === module) {
  (async () => {
    // Initialize with headless mode and download enabled
    const scraper = new FDARecallImageScraper({
      headless: true,
      downloadImages: true,
      minWidth: 800  // Ensure images are at least 800px wide
    });

    try {
      // Test with sample URLs
      const testUrl = 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/one-frozen-llc-voluntarily-recalls-good-gathertm-southwest-style-burrito-bowl-blend-frozen-12oz-bags';

      console.log('\n====================================================');
      console.log('FDA Recall Image Scraper Test');
      console.log('====================================================\n');

      const result = await scraper.scrapeRecallImages(testUrl, {
        recallId: 'test_recall_001'
      });

      if (result.success) {
        console.log(`\n✓ Successfully scraped: ${testUrl}`);
        console.log(`Total Images Found: ${result.totalFound}`);
        console.log(`Downloaded: ${result.downloadedCount}`);

        if (result.images && result.images.length > 0) {
          console.log('\n--- Downloaded Images ---');
          result.images.forEach((img, index) => {
            console.log(`\n${index + 1}. ${img.filename}`);
            console.log(`   Size: ${(img.size / 1024).toFixed(1)} KB`);
            console.log(`   Dimensions: ${img.width}x${img.height}`);
            console.log(`   Processed: ${img.processed ? 'Yes' : 'No'}`);
            console.log(`   Path: ${img.path}`);
          });
        }
      } else {
        console.error('\n✗ Failed to extract images:', result.error);
      }

    } catch (error) {
      console.error('\n✗ Error during testing:', error);
    } finally {
      await scraper.close();
      console.log('\n✓ Browser closed');
    }
  })();
}

module.exports = FDARecallImageScraper;