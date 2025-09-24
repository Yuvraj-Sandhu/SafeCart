/**
 * Historical URL Fetcher for IRES Recalls (Jan-Aug 2025)
 *
 * This script fetches recall URLs from the FDA IRES website for historical recalls
 * and updates only the recall_url field and scrapped_images in existing Firebase records.
 *
 * Usage:
 *   node historical-url-fetcher.js --month=january [--limit=1]
 *   node historical-url-fetcher.js --month=may --limit=5
 *
 * Available months: january, february, march, april, may, june, july, august, september
 */

const { chromium } = require('playwright');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: require('path').resolve(__dirname, '../../../../.env') });

// Initialize Firebase Admin FIRST before importing any services that use it
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

// Now import FDAImageService after Firebase is initialized
const { FDAImageService } = require('../image.service');

const db = admin.firestore();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    month: null,
    limit: null
  };

  args.forEach(arg => {
    if (arg.startsWith('--month=')) {
      options.month = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    }
  });

  // Validate month
  const validMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september'];
  if (!options.month || !validMonths.includes(options.month)) {
    console.error('Error: Invalid or missing month. Use --month=[january-september]');
    process.exit(1);
  }

  return options;
}

/**
 * IRES Historical Scraper Class
 */
class IRESHistoricalScraper {
  constructor() {
    this.baseUrl = 'https://www.accessdata.fda.gov/scripts/ires/index.cfm';
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Progressive wait with retry logic - starts with very short timeout
   */
  async progressiveWait(selector, options = {}) {
    const waitTimes = options.waitTimes || [50, 200, 500, 1000, 2000];
    const isFunction = typeof selector === 'function';

    for (let i = 0; i < waitTimes.length; i++) {
      const waitTime = waitTimes[i];

      if (i === 0) {
        await this.page.waitForTimeout(waitTime);
      } else {
        if (options.debug) {
          console.log(`Retry ${i}: waiting additional ${waitTime}ms...`);
        }
        await this.page.waitForTimeout(waitTime);
      }

      // Check if condition is met
      let conditionMet = false;

      if (isFunction) {
        conditionMet = await selector().catch(() => false);
      } else if (selector) {
        conditionMet = await this.page.locator(selector).isVisible({ timeout: 50 }).catch(() => false);
      } else {
        // Just waiting, no condition to check
        return true;
      }

      if (conditionMet) {
        if (options.debug) {
          console.log(`Condition met after ${i === 0 ? waitTime : 'retry ' + i}`);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Initialize browser
   */
  async init() {
    console.log('Initializing browser with stealth mode...');

    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--start-maximized',
      '--disable-infobars',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];

    this.browser = await chromium.launch({
      headless: true, // Run in headless mode for speed
      args: browserArgs,
      ignoreDefaultArgs: ['--enable-automation']
    });

    const contextOptions = {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      screen: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      extraHTTPHeaders: {
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
      }
    };

    this.context = await this.browser.newContext(contextOptions);

    // Apply stealth evasions before creating page
    await this.applyStealthEvasions();

    this.page = await this.context.newPage();
    console.log('Browser initialized with stealth evasions');
  }

  /**
   * Apply stealth evasions to avoid bot detection
   */
  async applyStealthEvasions() {
    await this.context.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Mock chrome runtime
      if (!window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          connect: () => {},
          sendMessage: () => {},
          onMessage: { addListener: () => {} }
        };
      }

      // Override plugins to look realistic
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            length: 1,
            name: 'Chrome PDF Plugin'
          },
          {
            0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
            length: 1,
            name: 'Native Client'
          }
        ]
      });

      // Override permissions API
      if (window.navigator.permissions && window.navigator.permissions.query) {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
          if (parameters.name === 'notifications') {
            return Promise.resolve({ state: 'granted' });
          }
          return originalQuery(parameters);
        };
      }

      // Add chrome.loadTimes
      if (window.chrome) {
        window.chrome.loadTimes = () => ({
          requestTime: Date.now() / 1000 - 100,
          startLoadTime: Date.now() / 1000 - 99,
          commitLoadTime: Date.now() / 1000 - 98,
          finishDocumentLoadTime: Date.now() / 1000 - 97,
          finishLoadTime: Date.now() / 1000 - 96,
          navigationStart: Date.now() / 1000 - 100
        });
      }

      // Mock battery API
      if (!navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: Infinity,
          dischargingTime: Infinity,
          level: 1.0,
          addEventListener: () => {},
          removeEventListener: () => {}
        });
      }
    });
  }

  /**
   * Navigate to IRES website
   */
  async navigateToIRES() {
    await this.page.goto(this.baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Progressive wait for JavaScript to load - start with 50ms
    await this.progressiveWait('#accordion', { waitTimes: [50, 200, 500, 1000] });
    console.log('Navigated to IRES website');
  }

  /**
   * Select month and year in IRES
   */
  async expandMonthAndGetReports(month) {
    console.log(`Expanding ${month} section...`);

    const monthMap = {
      'january': 'January',
      'february': 'February',
      'march': 'March',
      'april': 'April',
      'may': 'May',
      'june': 'June',
      'july': 'July',
      'august': 'August',
      'september': 'September'
    };

    // Month ID mapping for onclick="populateWeeks(ID)"
    const monthIdMap = {
      'january': 0,
      'february': 1,
      'march': 2,
      'april': 3,
      'may': 4,
      'june': 5,
      'july': 6,
      'august': 7,
      'september': 8
    };

    const monthName = monthMap[month];
    const monthId = monthIdMap[month];

    try {
      // Wait for accordion to load - quick check first
      await this.page.waitForSelector('#accordion', { timeout: 5000 });
      await this.progressiveWait(null, { waitTimes: [50, 200, 500] });

      // Find the month accordion header - it's an anchor tag with onclick="populateWeeks(monthId)"
      const monthAccordion = await this.page.locator(`a[onclick="populateWeeks(${monthId});"]`).first();

      if (await monthAccordion.count() === 0) {
        // Try alternative selector - look for the accordion_head div with the month name
        const altSelector = await this.page.locator(`div.accordion_head:has-text("${monthName}")`).locator('..').first();

        if (await altSelector.count() > 0) {
          await altSelector.click();
          console.log(`Clicked ${monthName} using alternative selector`);
        } else {
          console.log(`Could not find ${monthName} accordion`);
          return [];
        }
      } else {
        // Click the accordion to expand it
        await monthAccordion.click();
        console.log(`Clicked ${monthName} accordion`);
      }

      // Progressive wait for the populateWeeks function to complete
      const monthDivId = `#monthDiv${monthId}`;
      const monthDivFound = await this.progressiveWait(monthDivId, {
        waitTimes: [50, 200, 500, 1000, 2000]
      });

      if (!monthDivFound) {
        console.log('Month div not visible after retries');
        return [];
      }

      // Now find all enforcement report links within this month's div
      const enforcementReports = [];
      const monthDiv = await this.page.locator(monthDivId);
      const allLinks = await monthDiv.locator('a.weeklyReportUrl').all();

      console.log(`Found ${allLinks.length} enforcement report links in ${monthName}`);

      for (const link of allLinks) {
        const text = await link.textContent().catch(() => '');
        if (text && text.includes('2025')) {
          enforcementReports.push({ text: text.trim(), link });
          console.log(`  Found: ${text.trim()}`);
        }
      }

      // Also check for daily report link
      const dailyLink = await monthDiv.locator('a.dailyReportUrl').first();
      if (await dailyLink.count() > 0) {
        const dailyText = await dailyLink.textContent();
        if (dailyText) {
          enforcementReports.push({ text: dailyText.trim(), link: dailyLink });
          console.log(`  Found: ${dailyText.trim()}`);
        }
      }

      return enforcementReports;

    } catch (error) {
      console.log(`Error expanding month: ${error.message}`);
      return [];
    }
  }

  /**
   * Process a single enforcement report
   */
  async processEnforcementReport(reportText) {
    console.log(`\nProcessing: ${reportText}`);

    // Click on the enforcement report link
    const reportLink = await this.page.locator(`a:has-text("${reportText}")`).first();
    if (await reportLink.isVisible()) {
      await reportLink.click();

      // Progressive wait for page to load - start with 50ms
      await this.progressiveWait('#fda_table', { waitTimes: [50, 200, 500, 1000] });

      // Now we're on the enforcement report page with the recalls table
      await this.filterByFood();
      return await this.extractRecalls();
    }

    return [];
  }

  /**
   * Filter by Food products
   */
  async filterByFood() {
    console.log('Filtering by Food products...');

    try {
      // Progressive wait for form elements to load
      await this.progressiveWait('select', { waitTimes: [50, 200, 500, 1000] });

      // Look for Product Type dropdown
      const selects = await this.page.locator('select').all();

      for (const select of selects) {
        const options = await select.locator('option').allTextContents();
        if (options.some(opt => opt.toLowerCase().includes('food'))) {
          await select.selectOption({ label: 'Food' });
          console.log('Selected Food from Product Type dropdown');
          break;
        }
      }

      // Progressive wait for results to update
      await this.progressiveWait(null, { waitTimes: [50, 200, 500] });

      // Select "All" from page size dropdown to get all recalls
      try {
        await this.page.waitForSelector('#fda_table_length select', { timeout: 2000 });
        await this.page.selectOption('#fda_table_length select', '-1');
        console.log('Selected "All" from page size dropdown');
        // Quick wait for table to update with all records
        await this.progressiveWait(null, { waitTimes: [50, 200, 500, 1000] });
      } catch (error) {
        console.log('Could not find page size dropdown, continuing...');
      }

    } catch (error) {
      console.log('Could not filter by Food, continuing with all products');
    }
  }

  /**
   * Extract recalls from current page
   */
  async extractRecalls(limit) {
    console.log('Extracting recall data...');

    const recalls = await this.page.evaluate(() => {
      const data = [];
      const fdaTable = document.querySelector('#fda_table');

      if (fdaTable) {
        const rows = fdaTable.querySelectorAll('tbody tr');

        rows.forEach((row, index) => {
          const viewDetailsLink = row.querySelector('td.productType a');
          if (viewDetailsLink) {
            // Extract basic info from the table row
            const cells = row.querySelectorAll('td');
            const recallInfo = {
              rowIndex: index,
              hasViewDetails: true
            };

            // Try to extract recall ID from the row if visible
            if (cells.length > 0) {
              recallInfo.recallNumber = cells[0]?.textContent?.trim() || '';
            }

            data.push(recallInfo);
          }
        });
      }

      return data;
    });

    console.log(`Found ${recalls.length} recalls`);

    // Apply limit if specified
    if (limit && limit > 0) {
      return recalls.slice(0, limit);
    }

    return recalls;
  }

  /**
   * Extract detailed info including URL for a recall
   */
  async extractDetailedInfo(recall, index) {
    try {
      // Click View Details link
      const fdaTable = this.page.locator('#fda_table');
      const tableRows = await fdaTable.locator('tbody tr').all();

      if (recall.rowIndex < tableRows.length) {
        const targetRow = tableRows[recall.rowIndex];
        const targetLink = await targetRow.locator('td.productType a').first();

        if (await targetLink.isVisible({ timeout: 1000 })) {
          await targetLink.click();

          // Progressive wait for modal to appear - start with 50ms
          const modalFound = await this.progressiveWait('#productData', {
            waitTimes: [50, 100, 200, 500, 1000, 2000]
          });

          if (!modalFound) {
            console.log('Modal not found after retries');
            return {};
          }

          // Extract modal content
          const modalData = await this.page.evaluate(() => {
            const data = {};
            const productData = document.querySelector('#productData');

            if (productData) {
              const rows = productData.querySelectorAll('.row.displayDetailsColumn');

              rows.forEach(row => {
                const columns = row.querySelectorAll('[class*="col-md"]');

                columns.forEach(column => {
                  const boldDiv = column.querySelector('div.boldFont');
                  if (boldDiv) {
                    const labelP = boldDiv.querySelector('p[aria-label]');
                    if (labelP) {
                      const labelText = labelP.getAttribute('aria-label') || '';

                      // Look for URL fields specifically
                      if (labelText.toLowerCase().includes('url') ||
                          labelText.toLowerCase().includes('press release')) {
                        const link = column.querySelector('a[href]');
                        if (link) {
                          data.url = link.href;
                        }
                      }

                      // Get recall number
                      if (labelText.toLowerCase().includes('recall number')) {
                        // The value is in a p element that's a sibling of boldDiv
                        const nextP = boldDiv.nextElementSibling;
                        if (nextP && nextP.tagName === 'P') {
                          data.recallNumber = nextP.textContent?.trim() || '';
                        } else {
                          // Try finding it in the parent column
                          const parentCol = boldDiv.closest('.col-md-5, .col-md-6');
                          if (parentCol) {
                            const valueParagraphs = parentCol.querySelectorAll('p');
                            for (const p of valueParagraphs) {
                              const text = p.textContent?.trim() || '';
                              // Skip the label paragraph
                              if (text && !text.includes(':') && text !== 'Recall Number') {
                                data.recallNumber = text;
                                break;
                              }
                            }
                          }
                        }
                      }

                      // Get report date
                      if (labelText.toLowerCase().includes('report date')) {
                        const valueP = boldDiv.nextElementSibling;
                        if (valueP) {
                          data.reportDate = valueP.textContent?.trim() || '';
                        }
                      }
                    }
                  }
                });
              });
            }

            // Event ID has a special structure - it's in an anchor with id="eventIdPopup"
            const eventIdLink = document.querySelector('#eventIdPopup');
            if (eventIdLink) {
              data.eventId = eventIdLink.textContent?.trim() || '';
            }

            // Also check event data section for additional URLs
            const eventData = document.querySelector('#eventData');
            if (eventData && !data.url) {
              const links = eventData.querySelectorAll('a[href]');
              links.forEach(link => {
                const href = link.href;
                if (href && href.includes('fda.gov')) {
                  data.url = href;
                }
              });
            }

            return data;
          });

          // Close modal
          await this.closeModal();

          return modalData;
        }
      }
    } catch (error) {
      console.error(`Error extracting details for recall ${index}:`, error.message);
    }

    return {};
  }

  /**
   * Close modal
   */
  async closeModal() {
    try {
      // Try multiple close methods
      const closeButton = await this.page.locator('.ui-dialog-titlebar-close').first();
      if (await closeButton.isVisible({ timeout: 100 })) {
        await closeButton.click();
      } else {
        // Press Escape key
        await this.page.keyboard.press('Escape');
      }
      // Quick wait for modal to close
      await this.progressiveWait(null, { waitTimes: [50, 100] });
    } catch (error) {
      console.log('Could not close modal');
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

/**
 * Process recalls and update Firebase
 */
async function processRecalls(recalls, month) {
  const imageService = new FDAImageService();
  const stats = {
    processed: 0,
    urlsFound: 0,
    imagesProcessed: 0,
    errors: 0
  };

  console.log(`Processing ${recalls.length} recalls for ${month} 2025...`);

  for (const recall of recalls) {
    try {
      // Generate composite recall ID: recallNumber_eventId
      let recallId = recall.recallNumber;
      let eventId = recall.eventId;

      // Check we have both parts
      if (!recallId || !eventId) {
        console.log(`Skipping recall - missing recallNumber (${recallId}) or eventId (${eventId})`);
        continue;
      }

      // If we have a report date, use it to filter for 2025
      if (recall.reportDate) {
        const dateStr = recall.reportDate;
        if (!dateStr.includes('2025')) {
          console.log(`Skipping recall ${recallId}_${eventId} - not from 2025`);
          continue;
        }
      }

      // Create composite ID matching Firebase format
      const compositeId = `${recallId}_${eventId}`.replace(/[\/\\]/g, '_').trim();

      // Check if recall exists in fda_recalls collection using composite ID
      const fdaRecallRef = db.collection('fda_recalls').doc(compositeId);
      const fdaRecallDoc = await fdaRecallRef.get();

      if (!fdaRecallDoc.exists) {
        console.log(`Recall ${compositeId} not found in database`);
        continue;
      }

      const existingData = fdaRecallDoc.data();

      // Skip if recall already has both recall_url and scrapped_images
      if (existingData.recall_url && existingData.recall_url !== 'N/A' &&
          existingData.scrapped_images && existingData.scrapped_images.count > 0) {
        console.log(`Recall ${recallId} already has URL and images, skipping`);
        continue;
      }

      // Process FDA recall
      await processRecallUpdate(fdaRecallDoc, recall, imageService, stats, 'fda_recalls');

      stats.processed++;

    } catch (error) {
      console.error(`Error processing recall:`, error.message);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Update a single recall document
 */
async function processRecallUpdate(recallDoc, recallData, imageService, stats, collection) {
  const existingData = recallDoc.data();
  const recallId = recallDoc.id;

  // Only update if URL is found and not already present
  if (recallData.url) {
    const updateData = {};

    // Only update recall_url if not already set
    if (!existingData.recall_url || existingData.recall_url === 'N/A') {
      updateData.recall_url = recallData.url;
      stats.urlsFound++;
      console.log(`Recall ${recallId}: URL updated`);
    }

    // Process images if URL exists and scrapped_images not already set
    if (!existingData.scrapped_images || existingData.scrapped_images.count === 0) {
      try {
        console.log(`Recall ${recallId}: Processing images...`);
        // Use the document ID (which is the composite ID) for image processing
        const imageResult = await imageService.processRecallImages(
          recallDoc.id,  // Use the actual document ID
          recallData.url,
          'fda_recalls'
        );

        if (imageResult.success && imageResult.imagesUploaded > 0) {
          stats.imagesProcessed++;
          console.log(`Recall ${recallId}: ${imageResult.imagesUploaded} images processed`);
        }
      } catch (error) {
        console.error(`Recall ${recallId}: Image processing failed - ${error.message}`);
      }
    }

    // Update only the recall_url field if we have changes
    if (Object.keys(updateData).length > 0) {
      await recallDoc.ref.update(updateData);
    }

  } else {
    console.log(`Recall ${recallId}: No URL found`);
  }
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();
  const scraper = new IRESHistoricalScraper();

  console.log(`Starting historical URL fetch for ${options.month} 2025`);
  if (options.limit) {
    console.log(`Limit: ${options.limit} recalls`);
  }

  try {
    // Initialize scraper
    await scraper.init();
    await scraper.navigateToIRES();

    // Expand month and get enforcement reports
    const enforcementReports = await scraper.expandMonthAndGetReports(options.month);

    if (enforcementReports.length === 0) {
      console.log('No enforcement reports found for this month');
      return;
    }

    console.log(`\nProcessing ${enforcementReports.length} enforcement reports...`);
    const allDetailedRecalls = [];

    // Process each enforcement report
    for (const report of enforcementReports) {
      // Navigate to the enforcement report
      const recalls = await scraper.processEnforcementReport(report.text);

      if (recalls.length > 0) {
        // Extract detailed info for each recall
        for (let i = 0; i < recalls.length; i++) {
          const details = await scraper.extractDetailedInfo(recalls[i], allDetailedRecalls.length);
          if (details && details.recallNumber) {
            allDetailedRecalls.push(details);

            if (options.limit && allDetailedRecalls.length >= options.limit) {
              console.log(`\nReached limit of ${options.limit} recalls`);
              break;
            }
          }
        }

        if (options.limit && allDetailedRecalls.length >= options.limit) {
          break;
        }
      }

      // Go back to the main page for the next report
      await scraper.page.goto(scraper.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // Quick wait for page to be ready - start with 50ms
      await scraper.progressiveWait('#accordion', { waitTimes: [50, 200, 500, 1000] });

      // Re-expand the month since going back collapses it
      if (enforcementReports.indexOf(report) < enforcementReports.length - 1) {
        await scraper.expandMonthAndGetReports(options.month);
      }
    }

    // Process recalls and update Firebase
    const stats = await processRecalls(allDetailedRecalls, options.month);

    // Print summary
    console.log('\n--- Summary ---');
    console.log(`Total processed: ${stats.processed}`);
    console.log(`URLs found and updated: ${stats.urlsFound}`);
    console.log(`Images processed: ${stats.imagesProcessed}`);
    console.log(`Errors: ${stats.errors}`);

  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await scraper.cleanup();
  }
}

// Run the script
main().catch(console.error);