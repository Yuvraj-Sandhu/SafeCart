/**
 * FDA Alerts & Press Releases Scraper
 * 
 * This script scrapes the FDA Recalls, Market Withdrawals & Safety Alerts page
 * for press releases about food recalls that haven't been classified yet.
 * These alerts appear before they make it to the IRES enforcement reports.
 * 
 * URL: https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts
 * 
 * Installation:
 *   npm install playwright
 *   npx playwright install chromium
 */

// Load environment variables first
require('dotenv').config();

const { storage } = require('firebase-admin');
// Import OpenAI service for LLM title generation
const { openAIService } = require('../../openai.service');

// Dynamically load playwright or playwright-extra based on requirements
let chromium;
let useStealthMode = false;

try {
  // Try to load playwright-extra with stealth plugin
  const { chromium: playwrightChromium } = require('playwright-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  
  // Add stealth plugin
  playwrightChromium.use(StealthPlugin());
  
  chromium = playwrightChromium;
  useStealthMode = true;
  console.log('Stealth mode available - will use enhanced evasion techniques');
} catch (error) {
  // Fallback to regular playwright
  chromium = require('playwright').chromium;
  console.log('Using standard Playwright (stealth mode not available)');
}

const fs = require('fs').promises;
const path = require('path');

// Firebase Admin SDK initialization
let admin;
let db;
let saveToDatabase = true; // Default mode

try {
  admin = require('firebase-admin');
  
  // Initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
  }
  
  db = admin.firestore();
  console.log('Firebase initialized successfully');
} catch (error) {
  console.log('Firebase initialization failed - will save to JSON files only');
  console.log('Error:', error.message);
  saveToDatabase = false;
}

// US state abbreviations and full names mapping
const US_STATES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
  'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
  'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
  'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
  'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
  'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

const STATE_NAMES_TO_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
  'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
  'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
  'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
  'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
};

class FDAAlertscraper {
  constructor(options = {}) {
    this.baseUrl = 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts';
    this.headless = options.headless !== undefined ? options.headless : false;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.debug = options.debug || false;
    this.maxDaysToScrape = options.maxDaysToScrape || 60; // Default to 60 days
  }

  /**
   * Initialize browser with proper settings
   */
  async init() {
    console.log('Initializing browser...');
    console.log(`Mode: ${this.headless ? 'Headless' : 'Headed'}, Stealth: ${useStealthMode && this.headless ? 'Enabled' : 'Disabled'}`);
    
    // Enhanced args for stealth mode
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-webgl',
      '--disable-webgl2',
      '--disable-3d-apis'
    ];
    
    // Add stealth-specific args when in headless mode with stealth
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
    } else if (!this.headless) {
      // Non-stealth args for headed mode
      browserArgs.push(
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
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

    // Enhanced context options for stealth
    const contextOptions = {
      viewport: { width: 1920, height: 1080 },
      storageState: null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation']
    };
    
    // Add more realistic headers when using stealth
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
    
    // Apply additional evasions to context BEFORE creating page when in stealth mode
    if (this.headless && useStealthMode) {
      await this.applyStealthEvasions();
    }
    
    this.page = await this.context.newPage();

    // Log console messages for debugging (filter out font/resource errors)
    if (this.debug) {
      this.page.on('console', msg => {
        const text = msg.text();
        // Filter out common font and resource loading errors
        if (!text.includes('Failed to decode downloaded font') && 
            !text.includes('OTS parsing error') &&
            !text.includes('Failed to load resource')) {
          console.log('PAGE LOG:', text);
        }
      });
      this.page.on('pageerror', error => console.log('PAGE ERROR:', error.toString()));
    }

    console.log('Browser initialized');
  }

  /**
   * Apply additional stealth evasions beyond the stealth plugin
   */
  async applyStealthEvasions() {
    console.log('Applying additional stealth evasions...');
    
    // Apply to context so it affects all pages created from this context
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
      
      // Mock permissions
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ? 
            Promise.resolve({ state: 'granted' }) : 
            originalQuery(parameters)
        );
      }
      
      // Mock plugins to look more realistic
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' }
        ]
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });
  }

  /**
   * Navigate to FDA Alerts page
   */
  async navigateToAlerts() {
    console.log(`Navigating to ${this.baseUrl}...`);
    
    try {
      const response = await this.page.goto(this.baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      if (response) {
        console.log(`Response status: ${response.status()}`);
      }
      
      // Wait for page to fully load
      await this.page.waitForTimeout(2000);
      
      // Check if we're on the right page
      const pageTitle = await this.page.title();
      console.log(`Page title: ${pageTitle}`);
      
      return true;
    } catch (error) {
      console.error('Error navigating to FDA Alerts:', error);
      throw error;
    }
  }

  /**
   * Filter by Food & Beverages product type
   */
  async filterByFoodAndBeverages() {
    console.log('Filtering by Food & Beverages...');
    
    try {
      // Wait for the Product Type select element - using the correct selector
      const productTypeSelect = await this.page.waitForSelector('#edit-field-regulated-product-field', {
        timeout: 10000
      });
      
      if (productTypeSelect) {
        console.log('Found Product Type dropdown');
        
        // Select Food & Beverages option
        await this.page.selectOption('#edit-field-regulated-product-field', { label: 'Food & Beverages' });
        console.log('Selected Food & Beverages');
        
        // Wait for the page to update
        await this.page.waitForTimeout(1000);
        await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
        
        console.log('Filter applied successfully');
        return true;
      } else {
        throw new Error('Could not find Product Type dropdown');
      }
    } catch (error) {
      console.error('Error filtering by Food & Beverages:', error);
      throw error;
    }
  }

  /**
   * Extract alerts from the current page table
   */
  async extractAlertsFromTable() {
    console.log('Extracting alerts from table...');
    
    try {
      // Wait for the table to be present
      await this.page.waitForSelector('table.lcds-datatable', { timeout: 10000 });
      
      // Extract alert data from the table
      const alerts = await this.page.evaluate(() => {
        const table = document.querySelector('table.lcds-datatable');
        if (!table) return [];
        
        const rows = table.querySelectorAll('tbody tr');
        const alertsData = [];
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            // Extract data from each cell - matching actual table structure
            const dateCell = cells[0];
            const brandCell = cells[1];
            const productCell = cells[2];
            const productTypeCell = cells[3];
            const reasonCell = cells[4];
            const companyCell = cells[5];
            
            // Get the brand name link
            const brandLink = brandCell.querySelector('a');
            
            if (brandLink) {
              // Extract date from time element
              const timeElement = dateCell.querySelector('time');
              const dateText = timeElement ? timeElement.textContent.trim() : dateCell?.textContent?.trim();
              
              alertsData.push({
                date: dateText || '',
                brandName: brandLink?.textContent?.trim() || '',
                brandUrl: brandLink?.href || '',
                product: productCell?.textContent?.trim() || '',
                company: companyCell?.textContent?.trim() || '',
                productType: productTypeCell?.textContent?.trim() || '',
                reason: reasonCell?.textContent?.trim() || ''
              });
            }
          }
        });
        
        return alertsData;
      });
      
      console.log(`Found ${alerts.length} alerts on current page`);
      return alerts;
      
    } catch (error) {
      console.error('Error extracting alerts from table:', error);
      return [];
    }
  }

  /**
   * Check if an alert is within the date range (last N days)
   */
  isWithinDateRange(dateStr) {
    try {
      // Parse the date (format: MM/DD/YYYY)
      const parts = dateStr.split('/');
      if (parts.length !== 3) return false;
      
      const alertDate = new Date(parts[2], parts[0] - 1, parts[1]);
      const currentDate = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(currentDate.getDate() - this.maxDaysToScrape);
      
      return alertDate >= cutoffDate;
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return false;
    }
  }

  /**
   * Navigate to next page if available
   */
  async goToNextPage() {
    try {
      // Check if the Next button exists and is not disabled
      const nextButtonExists = await this.page.evaluate(() => {
        const nextButton = document.querySelector('li.paginate_button.next');
        return nextButton && !nextButton.classList.contains('disabled');
      });
      
      if (!nextButtonExists) {
        console.log('No more pages available (Next button disabled or not found)');
        return false;
      }
      
      // Click the Next button
      console.log('Navigating to next page...');
      await this.page.click('li.paginate_button.next a');
      
      // Wait for the table to update
      await this.page.waitForTimeout(1500); // Give DataTable time to update
      
      // Wait for the table to be present again
      await this.page.waitForSelector('table.lcds-datatable', { timeout: 10000 });
      
      // Get the current page number after navigation
      const currentPage = await this.page.evaluate(() => {
        const activeButton = document.querySelector('li.paginate_button.active a');
        return activeButton ? activeButton.textContent : 'unknown';
      });
      console.log(`Now on page ${currentPage}`);
      
      return true;
      
    } catch (error) {
      console.log('Error navigating to next page:', error.message);
      return false;
    }
  }

  /**
   * Extract press release content from a detail page
   */
  async extractPressReleaseContent(url) {
    // console.log(`Extracting content from: ${url}`);
    
    let newPage = null;
    
    try {
      // Open press release in a new tab to preserve filter state
      newPage = await this.context.newPage();
      
      // Navigate to the press release page in the new tab
      await newPage.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      // Wait for content to load
      await newPage.waitForTimeout(1000);
      
      // Extract the article content
      const content = await newPage.evaluate(() => {
        // Try multiple selectors for the main content
        const contentSelectors = [
          '.main-content',
          'main',
          '#main-content',
          'article',
          '.field--name-body',
          '.content',
          '[role="main"]'
        ];
        
        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = document.querySelector(selector);
          if (contentElement) break;
        }
        
        if (!contentElement) {
          // Fallback to body if no specific content area found
          contentElement = document.body;
        }
        
        // Extract text content
        const extractedContent = {
          title: '',
          paragraphs: [],
          lists: []
        };
        
        // Get title
        const titleElement = document.querySelector('h1');
        if (titleElement) {
          extractedContent.title = titleElement.textContent.trim();
        }
        
        // Get all paragraphs
        const paragraphs = contentElement.querySelectorAll('p');
        paragraphs.forEach(p => {
          const text = p.textContent.trim();
          if (text && text.length > 10) {
            extractedContent.paragraphs.push(text);
          }
        });
        
        // Get list items
        const listItems = contentElement.querySelectorAll('li');
        listItems.forEach(li => {
          const text = li.textContent.trim();
          if (text) {
            extractedContent.lists.push(text);
          }
        });
        
        return extractedContent;
      });
      
      // Close the new tab - no need to navigate back since we used a new tab
      await newPage.close();
      
      return content;
      
    } catch (error) {
      console.error('Error extracting press release content:', error);
      
      // Make sure to close the new tab if it was created
      if (newPage) {
        try {
          await newPage.close();
        } catch (closeError) {
          console.error('Error closing new tab:', closeError);
        }
      }
      
      return null;
    }
  }

  /**
   * Main scraping method
   */
  async scrape() {
    try {
      await this.init();
      await this.navigateToAlerts();
      await this.filterByFoodAndBeverages();
      
      const allAlerts = [];
      let continueScanning = true;
      
      // Get initial page number
      let pageNumber = await this.page.evaluate(() => {
        const activeButton = document.querySelector('li.paginate_button.active a');
        return activeButton ? activeButton.textContent : '1';
      });
      
      while (continueScanning) {
        console.log(`\n═══ Processing page ${pageNumber} ═══`);
        
        // Extract alerts from current page
        const pageAlerts = await this.extractAlertsFromTable();
        
        if (pageAlerts.length === 0) {
          console.log('No alerts found on this page');
          break;
        }
        
        // Process each alert
        for (const alert of pageAlerts) {
          // Check if alert is within date range
          if (!this.isWithinDateRange(alert.date)) {
            console.log(`Alert from ${alert.date} is outside ${this.maxDaysToScrape} day range, stopping scan`);
            continueScanning = false;
            break;
          }
          
          console.log(`\nProcessing: ${alert.brandName} (${alert.date})`);
          
          // Extract press release content
          const content = await this.extractPressReleaseContent(alert.brandUrl);
          
          if (content) {
            // Add content to alert object
            alert.pressRelease = content;
            allAlerts.push(alert);
            
            // Display summary
            // console.log(`  Title: ${content.title || 'N/A'}`);
            // console.log(`  Paragraphs: ${content.paragraphs.length}`);
            // console.log(`  List items: ${content.lists.length}`);
          } else {
            console.log('  Failed to extract content');
          }
          
          // Small delay between alerts to avoid overwhelming the server
          await this.page.waitForTimeout(500);
        }
        
        // Try to go to next page if we should continue
        if (continueScanning) {
          const hasNextPage = await this.goToNextPage();
          if (!hasNextPage) {
            console.log('No more pages to process');
            break;
          }
          // Update page number from the actual page
          pageNumber = await this.page.evaluate(() => {
            const activeButton = document.querySelector('li.paginate_button.active a');
            return activeButton ? activeButton.textContent : 'unknown';
          });
        }
      }
      
      console.log(`\n═══ Scraping Complete ═══`);
      console.log(`Total alerts extracted: ${allAlerts.length}`);
      
      return allAlerts;
      
    } catch (error) {
      console.error('Scraping failed:', error);
      
      if (this.debug) {
        const screenshotPath = path.join(__dirname, 'debug-alerts-error.png');
        await this.page.screenshot({ path: screenshotPath });
        console.log(`Error screenshot saved: ${screenshotPath}`);
      }
      
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Extract states from text using pattern matching
   * Enhanced version that parses distribution sentences to avoid false positives
   * Returns full state names instead of abbreviations for database consistency
   */
  extractStatesFromText(text) {
    const fullStateNames = new Set();
    
    // Check for nationwide indicators first
    const upperText = text.toUpperCase();
    const nationwidePatterns = [
      'NATIONWIDE',
      'NATION WIDE',
      'NATIONAL',
      'ALL STATES',
      'THROUGHOUT THE US',
      'THROUGHOUT THE UNITED STATES',
      'ACROSS THE US',
      'ACROSS THE USA',
      'ACROSS THE U.S.',
      'ACROSS UNITED STATES',
      'ACROSS THE UNITED STATES',
      'THROUGHOUT USA',
      'THROUGHOUT U.S.A',
      'ACROSS AMERICA',
      'THROUGHOUT AMERICA'
    ];
    
    for (const pattern of nationwidePatterns) {
      if (upperText.includes(pattern)) {
        return ['Nationwide'];
      }
    }
    
    // FIRST: Check for Washington D.C. in the entire text and handle it specially
    let hasWashingtonDC = false;
    const dcPatterns = [
      /\bWashington,?\s+D\.?\s*C\.?\b/gi,
      /\bD\.?\s*C\.?\b/gi
    ];
    
    for (const pattern of dcPatterns) {
      if (pattern.test(text)) {
        fullStateNames.add('District of Columbia');
        hasWashingtonDC = true;
        break;
      }
    }
    
    // Create a modified text with all D.C. references removed for other state processing
    let textForOtherStates = text;
    if (hasWashingtonDC) {
      textForOtherStates = text
        .replace(/\bWashington,?\s+D\.?\s*C\.?\b/gi, ' ')
        .replace(/\bD\.?\s*C\.?\b/gi, ' ');
    }
    
    // Find sentences containing distribution keywords in the modified text
    const distributionKeywords = /(?:distributed|sold|shipped|available|recalled products were)(?:\s+[^.]*)/gi;
    let match;
    
    while ((match = distributionKeywords.exec(textForOtherStates)) !== null) {
      // Extract the sentence up to the next period
      const sentenceStart = match.index;
      const periodIndex = textForOtherStates.indexOf('.', sentenceStart);
      let sentence = periodIndex !== -1 
        ? textForOtherStates.substring(sentenceStart, periodIndex + 1)
        : textForOtherStates.substring(sentenceStart);
      
      // Look for full state names in this sentence
      for (const [stateName, abbr] of Object.entries(STATE_NAMES_TO_ABBR)) {
        // EXPLICITLY skip Washington state if we found D.C. in the original text
        if (hasWashingtonDC && stateName === 'washington') {
          continue;
        }
        const statePattern = new RegExp(`\\b${stateName.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        if (statePattern.test(sentence)) {
          fullStateNames.add(US_STATES[abbr]);
        }
      }
      
      // Look for state codes only in specific safe contexts within the sentence
      // Pattern 1: State codes followed by comma (e.g., "CA, TX, FL")
      const stateCodeWithComma = /\b([A-Z]{2})\s*,/g;
      let codeMatch;
      while ((codeMatch = stateCodeWithComma.exec(sentence)) !== null) {
        const code = codeMatch[1];
        if (US_STATES[code] && !(hasWashingtonDC && code === 'WA')) {
          fullStateNames.add(US_STATES[code]);
        }
      }
      
      // Pattern 2: State codes before "and" or "&" (handles "TX and FL", "TX, and FL", "TX & FL")
      const stateCodeBeforeConjunction = /\b([A-Z]{2})\s*,?\s+(?:and|&)\s+/g;
      while ((codeMatch = stateCodeBeforeConjunction.exec(sentence)) !== null) {
        const code = codeMatch[1];
        if (US_STATES[code] && !(hasWashingtonDC && code === 'WA')) {
          fullStateNames.add(US_STATES[code]);
        }
      }
      
      // Pattern 3: Last state code after "and" or "&" (e.g., "and FL.", "& WI.", "& WI through")
      const lastStateCodeWithConjunction = /(?:and|&)\s+([A-Z]{2})\b/g;
      while ((codeMatch = lastStateCodeWithConjunction.exec(sentence)) !== null) {
        const code = codeMatch[1];
        if (US_STATES[code] && !(hasWashingtonDC && code === 'WA')) {
          fullStateNames.add(US_STATES[code]);
        }
      }
      
      // Pattern 4: Last state code in a list without "and" (e.g., "MD, DC, FL through" or "MD, DC, FL.")
      const lastStateCodeInList = /,\s*([A-Z]{2})\b(?:\s+(?:through|between|from|during|since|via|by)|\.|\s*$)/g;
      while ((codeMatch = lastStateCodeInList.exec(sentence)) !== null) {
        const code = codeMatch[1];
        if (US_STATES[code] && !(hasWashingtonDC && code === 'WA')) {
          fullStateNames.add(US_STATES[code]);
        }
      }
      
      // Pattern 5: CATCH-ALL - Any standalone two-letter state code in distribution sentences
      // This is less strict and catches cases we might have missed
      const anyStateCode = /\b([A-Z]{2})\b/g;
      while ((codeMatch = anyStateCode.exec(sentence)) !== null) {
        const code = codeMatch[1];
        // Only add if it's a valid state and not a common word
        if (US_STATES[code] && 
            !['IN', 'OR', 'ME', 'IT', 'IS', 'AS', 'AT', 'BY', 'IF', 'NO', 'OF', 'ON', 'SO', 'TO', 'UP', 'WE'].includes(code) &&
            !(hasWashingtonDC && code === 'WA')) {
          fullStateNames.add(US_STATES[code]);
        }
      }
      
      // Pattern 6: State codes in addresses or after location keywords
      // Handles: "Brooklyn NY", "Dallas, TX 75201", "located in NY", "based in CA"
      const locationPatterns = [
        // Address format: City/Place + State (e.g., "Brooklyn NY" or "Brooklyn, NY")
        /\b[A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s*,?\s+([A-Z]{2})\b(?:\s+\d{5}|\.|,|;|$)/g,
        // After location keywords (e.g., "located in NY", "based in CA")
        /\b(?:located|based|headquartered|situated)\s+(?:in|at)\s+([A-Z]{2})\b/gi,
        // State with zip code (e.g., "TX 75201")
        /\b([A-Z]{2})\s+\d{5}\b/g,
        // LLC/Inc/Corp followed by state (e.g., "LLC, NY" or "Inc., CA")
        /\b(?:LLC|Inc|Corp|Co|Company|Store|Market)\s*[,.]?\s*([A-Z]{2})\b(?:\.|,|;|$)/g
      ];
      
      for (const pattern of locationPatterns) {
        pattern.lastIndex = 0;
        while ((codeMatch = pattern.exec(sentence)) !== null) {
          const code = codeMatch[1];
          if (US_STATES[code] && 
              !['IN', 'OR', 'ME', 'IT', 'IS', 'AS', 'AT', 'BY', 'IF', 'NO', 'OF', 'ON', 'SO', 'TO', 'UP', 'WE', 'CO'].includes(code) &&
              !(hasWashingtonDC && code === 'WA')) {
            fullStateNames.add(US_STATES[code]);
          }
        }
      }
      
      // Pattern 7: States explicitly listed after keywords
      const explicitStateList = /(?:in|to|throughout|across)\s+the\s+following\s+states?:?\s*([^.]+)/i;
      const explicitMatch = sentence.match(explicitStateList);
      if (explicitMatch) {
        const stateList = explicitMatch[1];
        // In explicit lists, we can be more liberal with state code matching
        const stateCodeInList = /\b([A-Z]{2})\b/g;
        while ((codeMatch = stateCodeInList.exec(stateList)) !== null) {
          const code = codeMatch[1];
          // But still exclude common words that happen to be state codes and Washington if D.C. found
          if (US_STATES[code] && 
              !['IN', 'OR', 'ME', 'IT', 'IS', 'AS', 'AT', 'BY', 'IF', 'NO', 'OF', 'ON', 'SO', 'TO', 'UP', 'WE'].includes(code) &&
              !(hasWashingtonDC && code === 'WA')) {
            fullStateNames.add(US_STATES[code]);
          }
        }
      }
    }
    
    // Also check for state listings in specific formats in the modified text
    const stateListingPatterns = [
      // Pattern: "States: CA, TX, FL"
      /states?\s*:\s*([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)/gi,
      // Pattern: "Following states: California, Texas, Florida"
      /following\s+states?\s*:?\s*([^.]+)/gi,
      // Pattern in parentheses: "(CA, TX, FL)"
      /\(([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)\)/g
    ];
    
    for (const pattern of stateListingPatterns) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(textForOtherStates)) !== null) {
        const content = match[1];
        
        // Check for full state names
        for (const [stateName, abbr] of Object.entries(STATE_NAMES_TO_ABBR)) {
          // Skip Washington state if we found D.C.
          if (hasWashingtonDC && stateName === 'washington') {
            continue;
          }
          const statePattern = new RegExp(`\\b${stateName.replace(/\s+/g, '\\s+')}\\b`, 'gi');
          if (statePattern.test(content)) {
            fullStateNames.add(US_STATES[abbr]);
          }
        }
        
        // Check for state codes in these explicit listings
        const codes = content.match(/\b[A-Z]{2}\b/g) || [];
        for (const code of codes) {
          if (US_STATES[code] && 
              !['IN', 'OR', 'ME', 'IT', 'IS', 'AS', 'AT', 'BY', 'IF', 'NO', 'OF', 'ON', 'SO', 'TO', 'UP', 'WE'].includes(code) &&
              !(hasWashingtonDC && code === 'WA')) {
            fullStateNames.add(US_STATES[code]);
          }
        }
      }
    }
    
    return Array.from(fullStateNames).sort();
  }

  /**
   * Format alert data for database storage
   */
  formatAlertForDatabase(alert) {
    // Convert date from MM/DD/YYYY to YYYY-MM-DD format
    const dateParts = alert.date.split('/');
    const formattedDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
    
    const formattedAlert = {
      // Alert identification
      alert_url: alert.brandUrl,
      alert_date: formattedDate,
      
      // Company information
      recalling_firm: alert.company,
      brand_name: alert.brandName,
      
      // Product information
      product_description: alert.product,
      product_title: alert.pressRelease?.title || `${alert.brandName} - ${alert.product}`,
      
      // Recall details
      reason_for_recall: alert.reason,
      
      // Extract states from press release content
      affected_states: [],
      distribution_pattern: ''
    };
    
    // Extract states if press release content is available
    if (alert.pressRelease && alert.pressRelease.paragraphs) {
      // Find the distribution pattern paragraph FIRST
      // Look for paragraphs that contain distribution keywords AND location information
      let bestDistributionParagraph = '';
      let bestScore = 0;
      
      for (const paragraph of alert.pressRelease.paragraphs) {
        if (/distributed|sold|shipped|available/i.test(paragraph)) {
          let score = 0;
          
          // Count actual state codes/names for distribution locations
          const stateCodeMatches = paragraph.match(/\b[A-Z]{2}\b/g) || [];
          const validStateCodes = stateCodeMatches.filter(code => US_STATES[code]);
          score += validStateCodes.length * 3; // Higher weight for each state code found
          
          // Check for state names
          let stateNameCount = 0;
          for (const stateName of Object.keys(STATE_NAMES_TO_ABBR)) {
            const regex = new RegExp(`\\b${stateName}\\b`, 'i');
            if (regex.test(paragraph)) {
              stateNameCount++;
            }
          }
          score += stateNameCount * 3; // Higher weight for each state name
          
          // Prioritize paragraphs with store/retail/location keywords
          if (/\b(retail|store|stores|market|markets|location|locations|outlet|outlets)\b/i.test(paragraph)) {
            score += 4;
          }
          
          // Check for location indicators
          if (/\b(state|states|nationwide|throughout)\b/i.test(paragraph)) score += 1;
          if (/\b(between|from|through|during)\b.*\d{4}/i.test(paragraph)) score += 1; // Date ranges
          
          // Prioritize shorter, more focused paragraphs about distribution
          if (paragraph.length < 500) score += 1;
          
          // Deprioritize paragraphs that are primarily about health risks
          if (/listeria|salmonella|e\.?\s*coli|illness|infection|symptoms|fever|diarrhea/i.test(paragraph)) {
            score -= 5;
          }
          
          // Deprioritize paragraphs about testing/sampling/regulatory actions
          if (/routine sampling|analysis|laboratory|inspector|department of|initiated after|revealed that/i.test(paragraph)) {
            score -= 5;
          }
          
          // Deprioritize paragraphs about suppliers/manufacturers
          if (/supplied by|manufacturer|initiated a recall|notified by/i.test(paragraph)) {
            score -= 3;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestDistributionParagraph = paragraph;
          }
        }
      }
      
      formattedAlert.distribution_pattern = bestDistributionParagraph;
      
      // Extract states ONLY from the distribution pattern paragraph
      // This avoids picking up supplier locations like Georgia
      if (bestDistributionParagraph) {
        formattedAlert.affected_states = this.extractStatesFromText(bestDistributionParagraph);
      } else {
        // Fallback: if no good distribution paragraph found, search all paragraphs
        // but only in sentences that contain distribution keywords
        const distributionSentences = [];
        for (const paragraph of alert.pressRelease.paragraphs) {
          const sentences = paragraph.split(/\.\s+/);
          for (const sentence of sentences) {
            if (/distributed|sold|shipped|available/i.test(sentence) && 
                !/supplied by|manufacturer|initiated a recall/i.test(sentence)) {
              distributionSentences.push(sentence);
            }
          }
        }
        const distributionText = distributionSentences.join(' ');
        formattedAlert.affected_states = distributionText ? 
          this.extractStatesFromText(distributionText) : [];
      }
      
      // SAFETY: If no states could be determined, default to Nationwide
      // Better to notify all users than to miss affected consumers
      if (formattedAlert.affected_states.length === 0) {
        formattedAlert.affected_states = ['Nationwide'];
        // console.log(`Warning: No states detected for recall ${alert.brandUrl} - defaulting to Nationwide`);
      }
      
      // Store paragraphs but not fullText
      formattedAlert.press_release_paragraphs = alert.pressRelease.paragraphs;
    }
    
    return formattedAlert;
  }

  /**
   * Clean up browser resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }
}

/**
 * Save alerts to Firebase database
 */
async function saveToFirebase(formattedAlerts) {
  const collection = db.collection('temp_fda_recalls');
  let savedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Array to collect recalls that need LLM title processing
  const recallsForLLM = [];

  // Array to collect new recalls with URLs for image processing
  const recallsWithUrls = [];
  
  for (const alert of formattedAlerts) {
    try {
      // Generate document ID: YYYYMMDD_randomtext
      const dateForId = alert.alert_date.replace(/-/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
      const randomText = Math.random().toString(36).substring(2, 10); // 8 char random string
      const docId = `${dateForId}_${randomText}`;
      
      // Check if alert already exists based on URL
      const existingQuery = await collection
        .where('alert_url', '==', alert.alert_url)
        .limit(1)
        .get();
      
      let isNewAlert = existingQuery.empty;
      let existingData = null;
      let existingDocId = null;
      
      if (!isNewAlert) {
        // Get the existing document data
        existingData = existingQuery.docs[0].data();
        existingDocId = existingQuery.docs[0].id;
      }
      
      // Map to TempFDARecall structure
      const tempFDARecall = {
        // Don't store id in document data - Firestore document ID is the source of truth
        alert_url: alert.alert_url,
        alert_date: alert.alert_date,
        date: alert.alert_date,  // Same as alert_date for consistency
        status: 'pending',
        classification: 'Unclassified',
        product_type: 'Food',
        recalling_firm: alert.recalling_firm,
        brand_name: alert.brand_name,
        product_description: alert.product_description,
        product_title: alert.product_title,
        reason_for_recall: alert.reason_for_recall,
        distribution_pattern: alert.distribution_pattern,
        source: 'FDA',
        api_version: 'FDA_ALERTS',
        last_synced: admin.firestore.FieldValue.serverTimestamp(),
        affectedStatesArray: alert.affected_states || ['Nationwide']
      };
      
      // Handle timestamp fields
      if (isNewAlert) {
        // New alert - set imported_at
        tempFDARecall.imported_at = admin.firestore.FieldValue.serverTimestamp();
        savedCount++;

        // Collect new recall with URL for image processing
        if (alert.alert_url) {
          recallsWithUrls.push({
            id: docId,
            url: alert.alert_url
          });
          console.log(`  New temp recall: ID: ${docId}, URL: ${alert.alert_url}`);
        }
      } else {
        // Existing alert - preserve imported_at if it exists
        if (existingData.imported_at) {
          tempFDARecall.imported_at = existingData.imported_at;
        } else {
          // Fallback for old data that doesn't have imported_at
          tempFDARecall.imported_at = admin.firestore.FieldValue.serverTimestamp();
        }
        
        // Preserve manual overrides and display data
        if (existingData.display) {
          tempFDARecall.display = existingData.display;
        }
        if (existingData.llmTitle) {
          tempFDARecall.llmTitle = existingData.llmTitle;
        }
        
        skippedCount++; // Count as updated, not new
      }
      
      // Save to Firestore
      const docRef = collection.doc(isNewAlert ? docId : existingDocId);
      await docRef.set(tempFDARecall, { merge: true });
      // console.log(`${isNewAlert ? 'Saved' : 'Updated'}: ${alert.product_title}`);
      
      // Add to LLM processing queue only if it's new or doesn't have llmTitle
      if (isNewAlert || !existingData.llmTitle) {
        recallsForLLM.push({
          id: isNewAlert ? docId : existingDocId,
          title: alert.product_title || `${alert.brand_name} - ${alert.product_description}`,
          reason: alert.reason_for_recall
        });
      }
      
    } catch (error) {
      console.error(`Error saving alert: ${error.message}`);
      console.error(`Alert URL: ${alert.alert_url}`);
      errorCount++;
    }
  }
  
  console.log('\n═══ Database Save Summary ═══');
  console.log(`Total alerts: ${formattedAlerts.length}`);
  console.log(`Saved: ${savedCount}`);
  console.log(`Skipped (already exists): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Collection: temp_fda_recalls`);

  // Output recalls with URLs for image processing service
  if (recallsWithUrls.length > 0) {
    console.log(`\nNew temp recalls: ${recallsWithUrls.length}`);
    // Output JSON for parsing by sync service
    console.log(`ALERTS_RESULT:${JSON.stringify({ recalls: recallsWithUrls })}ALERTS_RESULT_END`);
  }

  // Process LLM titles asynchronously if any new recalls were saved
  if (recallsForLLM.length > 0) {
    console.log(`\nQueuing ${recallsForLLM.length} recalls for LLM title generation...`);
    processLLMTitlesForTempRecalls(recallsForLLM).catch(error => {
      console.error('Error processing LLM titles:', error);
    });
  }
}

/**
 * Process LLM titles for temp FDA recalls asynchronously
 * Similar to processLLMTitlesForIRESRecalls in fda-ires-to-firebase.js
 */
async function processLLMTitlesForTempRecalls(recallsToProcess) {
  if (!openAIService || !openAIService.isAvailable || !openAIService.isAvailable()) {
    console.log('OpenAI service not available, skipping LLM title processing');
    return;
  }

  try {
    console.log(`Processing LLM titles for ${recallsToProcess.length} temp FDA recalls`);
    
    let processedCount = 0;
    let errorCount = 0;

    // Process each recall
    for (const recall of recallsToProcess) {
      try {
        // Add delay to avoid rate limiting
        if (processedCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
        }

        // Get enhanced title from OpenAI
        const enhancedTitle = await openAIService.enhanceRecallTitle(recall.title, recall.reason);
        
        if (enhancedTitle) {
          // Update the recall with the enhanced title
          await db.collection('temp_fda_recalls').doc(recall.id).update({
            llmTitle: enhancedTitle
          });
          processedCount++;
          console.log(`LLM title processed for recall ${recall.id}`);
        }
      } catch (error) {
        console.error(`Error processing LLM title for recall ${recall.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`LLM title processing complete: ${processedCount} processed, ${errorCount} errors`);
  } catch (error) {
    console.error('Error in processLLMTitlesForTempRecalls:', error);
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    days: 60,  // Default value
    headless: true,  // Default to headless mode for production
    debug: false,     // Default to no debug
    save: true        // Default to save to database
  };
  
  for (const arg of args) {
    // Handle --save flag (database saving mode)
    if (arg === '--save=false') {
      options.save = false;
      saveToDatabase = false;
    }
    else if (arg === '--save=true') {
      options.save = true;
      saveToDatabase = true && db; // Only if Firebase is initialized
    }
    // Handle --debug flag (shows browser and enables debug)
    else if (arg === '--debug') {
      options.debug = true;
      options.headless = false; // Show browser in debug mode
    }
    // Handle --headless=false format (exact match from IRES scraper)
    else if (arg === '--headless=false') {
      options.headless = false;
    }
    // Handle --headless=true format
    else if (arg === '--headless=true' || arg === '--headless') {
      options.headless = true;
    }
    // Handle --days=60 format
    else if (arg.startsWith('--days=')) {
      const value = parseInt(arg.split('=')[1]);
      if (!isNaN(value) && value > 0) {
        options.days = value;
      } else {
        console.error(`Invalid days value: ${arg.split('=')[1]}`);
        process.exit(1);
      }
    }
    // Handle -d 60 format
    else if (arg === '-d' || arg === '--days') {
      const nextIndex = args.indexOf(arg) + 1;
      if (nextIndex < args.length) {
        const value = parseInt(args[nextIndex]);
        if (!isNaN(value) && value > 0) {
          options.days = value;
        } else {
          console.error(`Invalid days value: ${args[nextIndex]}`);
          process.exit(1);
        }
      }
    }
    // Handle --help flag
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node fda-alerts-scraper.js [options]');
      console.log('\nOptions:');
      console.log('  --days=N, -d N        Number of days to scan (default: 60)');
      console.log('  --headless=true|false Run in headless mode (default: true)');
      console.log('  --save=true|false     Save to Firebase (true) or JSON files (false) (default: true)');
      console.log('  --debug               Debug mode (shows browser, enables logging)');
      console.log('  --help, -h            Show this help message');
      console.log('\nExamples:');
      console.log('  node fda-alerts-scraper.js                      # Save to Firebase, scan last 60 days');
      console.log('  node fda-alerts-scraper.js --save=false         # Save to JSON files');
      console.log('  node fda-alerts-scraper.js --days=30            # Save to Firebase, scan last 30 days');
      console.log('  node fda-alerts-scraper.js --headless=false     # Run with visible browser');
      console.log('  node fda-alerts-scraper.js --debug              # Debug mode with visible browser');
      console.log('\nNote: Headless mode with stealth is recommended for production to avoid bot detection.');
      process.exit(0);
    }
  }
  
  console.log('\n═══ Configuration ═══');
  console.log(`Days to check: ${options.days}`);
  console.log(`Mode: ${options.headless ? 'Headless' : 'Visible'}`);
  console.log(`Save to: ${options.save ? 'Firebase Database' : 'JSON Files'}`);
  if (options.debug) console.log(`Debug: Enabled`);
  
  return options;
}

// Main execution
async function main() {
  const options = parseArguments();
  
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     FDA Alerts & Press Releases Scraper  ║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log(`Configuration:`);
  console.log(`  Days to scan: ${options.days}`);
  console.log(`  Headless mode: ${options.headless}`);
  console.log(`  Debug mode: ${options.debug}\n`);

  const scraper = new FDAAlertscraper({
    headless: options.headless,
    debug: options.debug,
    maxDaysToScrape: options.days
  });

  try {
    const alerts = await scraper.scrape();
    
    // Format data for database storage
    const formattedAlerts = alerts.map(alert => scraper.formatAlertForDatabase(alert));
    
    // Check save mode
    if (saveToDatabase && db) {
      // Save to Firebase database
      console.log('\n═══ Saving to Firebase Database ═══');
      await saveToFirebase(formattedAlerts);
    } else {
      // Save to JSON files (original behavior)
      console.log('\n═══ Saving to JSON Files ═══');
      
      // Save raw results
      const rawOutputPath = path.join(__dirname, 'fda-alerts-results.json');
      await fs.writeFile(rawOutputPath, JSON.stringify(alerts, null, 2));
      console.log(`Raw results saved to ${rawOutputPath}`);
      
      // Save formatted results
      const formattedOutputPath = path.join(__dirname, 'fda-alerts-formatted.json');
      await fs.writeFile(formattedOutputPath, JSON.stringify(formattedAlerts, null, 2));
      console.log(`Formatted results saved to ${formattedOutputPath}`);
    }
    
    // Display sample results
    if (formattedAlerts.length > 0) {
      // console.log('\n═══ Sample Alert (Formatted) ═══');
      // const sample = formattedAlerts[0];
      // console.log(`Date: ${sample.date}`);
      // console.log(`Title: ${sample.title}`);
      // console.log(`Recalling Firm: ${sample.recalling_firm}`);
      // console.log(`Recall URL: ${sample.recall_url}`);
      // console.log(`Recall Reason: ${sample.recall_reason}`);
      // console.log(`Affected States: ${sample.affected_states.join(', ') || 'None detected'}`);
      // if (sample.distribution_pattern) {
      //   console.log(`\nDistribution Pattern: ${sample.distribution_pattern.substring(0, 200)}...`);
      // }
      
      // Show scraping summary
      console.log('\n═══ Scraping Summary ═══');
      console.log(`Configuration: Last ${options.days} days`);
      
      // Calculate the requested date range
      const today = new Date();
      const requestedStartDate = new Date();
      requestedStartDate.setDate(today.getDate() - options.days);
      
      console.log(`Requested range: ${requestedStartDate.toLocaleDateString('en-US')} to ${today.toLocaleDateString('en-US')}`);
      
      // Show actual alerts found
      if (formattedAlerts.length > 0) {
        // Parse dates properly (YYYY-MM-DD format from alert_date)
        const dates = formattedAlerts.map(a => {
          if (a.alert_date) {
            // alert_date is in YYYY-MM-DD format
            return new Date(a.alert_date);
          }
          return null;
        }).filter(d => d !== null);
        
        if (dates.length > 0) {
          const oldestDate = new Date(Math.min(...dates));
          const newestDate = new Date(Math.max(...dates));
          
          console.log(`Alerts found from: ${newestDate.toLocaleDateString('en-US')} to ${oldestDate.toLocaleDateString('en-US')}`);
        }
      }
      
      console.log(`Total alerts found: ${formattedAlerts.length}`);
    }
    
  } catch (error) {
    console.error('\nScript failed:', error);
    process.exit(1);
  }
}

// Check if playwright is installed
try {
  require('playwright');
  
  // Run the scraper
  if (require.main === module) {
    main().catch(console.error);
  }
  
} catch (error) {
  console.log('\nPlaywright is not installed.');
  console.log('Please install it first by running:');
  console.log('\n  npm install playwright');
  console.log('  npx playwright install chromium\n');
  process.exit(1);
}

module.exports = FDAAlertscraper;