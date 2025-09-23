/**
 * FDA IRES (Import Refusal and Enforcement System) Scraper
 * 
 * This script uses Playwright to scrape the FDA IRES website for the latest enforcement reports.
 * Playwright is more reliable than Puppeteer for complex SPAs and works better with modern web apps.
 * 
 * The IRES system provides weekly enforcement reports that are more up-to-date than the OpenFDA API.
 * 
 * Installation:
 *   npm install playwright playwright-extra puppeteer-extra-plugin-stealth
 *   npx playwright install chromium
 * 
 * Stealth Mode:
 *   When running in headless mode (for Cloud Run), uses playwright-extra with stealth plugin
 *   to evade bot detection mechanisms.
 */

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
  console.log('Stealth mode available - will use enhanced evasion techniques');
} catch (error) {
  // Debug the error
  console.log('Could not load stealth mode:', error.message);
  
  // Fallback to regular playwright if stealth dependencies not installed
  chromium = require('playwright').chromium;
  console.log('Using standard Playwright (stealth mode not available)');
}

const fs = require('fs').promises;
const path = require('path');

class FDAIRESScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://www.accessdata.fda.gov/scripts/ires/index.cfm';
    this.headless = options.headless !== undefined ? options.headless : false;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.debug = options.debug || false;
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
      '--disable-features=VizDisplayCompositor'
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
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
      
      // Override WebGL vendor and renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, arguments);
      };
      
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter2.apply(this, arguments);
      };
    });
  }

  /**
   * Navigate to IRES and wait for it to load
   */
  async navigateToIRES() {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        console.log(`Navigating to ${this.baseUrl} (attempt ${attempt + 1}/${maxRetries})...`);
        
        const response = await this.page.goto(this.baseUrl, {
          waitUntil: 'networkidle',
          timeout: 60000
        });
        
        // Check response status
        if (response) {
          console.log(`Response status: ${response.status()}`);
          
          // Check for bot detection
          if (response.status() === 403 || response.status() === 429) {
            console.warn(`Possible bot detection (HTTP ${response.status()})`);
            
            if (attempt < maxRetries - 1) {
              // Exponential backoff
              const waitTime = Math.pow(2, attempt) * 5000;
              console.log(`Waiting ${waitTime / 1000} seconds before retry...`);
              await this.page.waitForTimeout(waitTime);
              
              // Clear cookies and try again
              await this.context.clearCookies();
              attempt++;
              continue;
            }
          }
        }

        // Wait for the main content to load
        await this.page.waitForSelector('body', { timeout: 30000 });
        
        // Additional wait for dynamic content
        await this.page.waitForTimeout(2000);
        
        // Verify we're on the correct page by checking for specific elements
        const hasTable = await this.page.locator('#fda_table').count() > 0;
        const hasDropdown = await this.page.locator('select[name="month_select"]').count() > 0;
        
        if (hasTable || hasDropdown) {
          console.log('IRES page loaded successfully');
          
          // Take a screenshot for debugging
          if (this.debug) {
            await this.page.screenshot({ path: 'debug-ires-home.png' });
            console.log('Screenshot saved: debug-ires-home.png');
          }
          
          return true;
        } else {
          console.warn('Page loaded but expected elements not found');
          if (attempt < maxRetries - 1) {
            attempt++;
            continue;
          }
        }
        
      } catch (error) {
        console.error(`Navigation attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < maxRetries - 1) {
          attempt++;
          const waitTime = Math.pow(2, attempt) * 3000;
          console.log(`Waiting ${waitTime / 1000} seconds before retry...`);
          await this.page.waitForTimeout(waitTime);
        } else {
          throw new Error(`Failed to navigate to IRES after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
    
    throw new Error(`Failed to load IRES page after ${maxRetries} attempts`);
  }

  /**
   * Select enforcement reports - supports multiple weeks and new recalls
   * @param {Object} options - Selection options
   * @param {string} options.type - 'latest', 'new', or 'weeks'
   * @param {number} options.weeksToScan - Number of past weeks to return (for type='weeks')
   * @returns {Array} Array of report links to process
   */
  async selectEnforcementReports(options = {}) {
    const { 
      type = 'latest',  // 'latest', 'new', or 'weeks'
      weeksToScan = 1 
    } = options;
    
    console.log(`Selecting enforcement reports: type=${type}, weeksToScan=${weeksToScan}`);
    
    try {
      const selectedReports = [];
      
      // For 'new' type, we need to find and expand the correct month
      if (type === 'new') {
        // New recalls are typically in the current month
        const currentMonth = this.getCurrentMonthName();
        console.log(`Looking for New Recalls in ${currentMonth}...`);
        
        // Expand current month
        const monthSection = await this.page.locator(`text=${currentMonth}`).first();
        if (await monthSection.count() > 0) {
          await monthSection.click();
          console.log(`Expanded ${currentMonth} section for New Recalls`);
          await this.page.waitForTimeout(1000);
        }
        
        // Look for the New Recalls link
        const links = await this.page.locator('a').all();
        for (const link of links) {
          const text = await link.textContent().catch(() => '');
          if (text && text.includes('New Recalls Added Since Last Weekly Enforcement Report')) {
            selectedReports.push({ link, text });
            console.log('Found: New Recalls Added Since Last Weekly');
            return selectedReports;
          }
        }
        
        console.log('New Recalls link not found');
        return selectedReports;
      }
      
      // For 'latest' or 'weeks', expand months that might contain the reports
      const monthsToExpand = this.getMonthsToExpand(weeksToScan);
      const enforcementLinks = [];
      
      // Process each month separately since expanding one closes others
      for (const month of monthsToExpand) {
        console.log(`Looking for ${month} section...`);
        
        // Try multiple selectors to find the month header
        const monthSelectors = [
          `text="${month}"`,  // Exact text match
          `text=/^${month}/i`,  // Starts with month name (case insensitive)
          `h3:has-text("${month}")`,  // H3 containing month
          `div:has-text("${month}"):has(a)`,  // Div with month and links
          `[onclick*="${month}"]`,  // Elements with onclick containing month
          `a:has-text("${month}")`  // Anchor with month text
        ];
        
        let monthExpanded = false;
        
        for (const selector of monthSelectors) {
          if (monthExpanded) break;
          
          try {
            const monthSection = await this.page.locator(selector).first();
            
            if (await monthSection.count() > 0) {
              // Check if this is actually clickable
              const isVisible = await monthSection.isVisible({ timeout: 1000 }).catch(() => false);
              
              if (isVisible) {
                await monthSection.click();
                console.log(`Expanded ${month} section using selector: ${selector}`);
                await this.page.waitForTimeout(2000); // Give time for expansion
                monthExpanded = true;
                
                // Now look for all visible links after expansion
                // Wait for links to appear
                await this.page.waitForTimeout(1000);
                
                // Get all anchor tags that are now visible
                const allLinks = await this.page.locator('a:visible').all();
                console.log(`  Found ${allLinks.length} visible links after expanding ${month}`);
                
                for (const link of allLinks) {
                  const text = await link.textContent().catch(() => '');
                  
                  // Look for enforcement reports
                  if (text && (text.includes('Enforcement Report for Week of') || 
                              text.includes('Week of'))) {
                    // Parse the date from the text to verify it's in the right timeframe
                    const dateMatch = text.match(/Week of (\w+)\s+(\d+),\s+(\d+)/);
                    
                    if (dateMatch) {
                      const reportMonth = dateMatch[1];
                      const reportDay = parseInt(dateMatch[2]);
                      const reportYear = parseInt(dateMatch[3]);
                      
                      console.log(`  Found report: ${text.trim()}`);
                      
                      // Check if we already have this link
                      const exists = enforcementLinks.some(el => el.text === text);
                      if (!exists) {
                        // Store the actual link element, not just text
                        enforcementLinks.push({ link, text: text.trim() });
                        console.log(`  ✓ Added to processing queue`);
                      }
                    }
                  }
                }
                
                if (enforcementLinks.length === 0) {
                  console.log(`  No enforcement reports found in expanded ${month} section`);
                }
              }
            }
          } catch (error) {
            // Try next selector
          }
        }
        
        if (!monthExpanded) {
          console.log(`  Could not expand ${month} section - might not exist or already be expanded`);
        }
      }
      
      console.log(`\nTotal enforcement reports found: ${enforcementLinks.length}`);
      
      // Select based on type
      if (type === 'new') {
        // Just return the new recalls link
        if (newRecallsLink.link) {
          selectedReports.push(newRecallsLink);
        }
      } else if (type === 'latest') {
        // Return the most recent week only
        if (enforcementLinks.length > 0) {
          selectedReports.push(enforcementLinks[0]);
        }
      } else if (type === 'weeks') {
        // Return multiple weeks
        const weeksToReturn = Math.min(weeksToScan, enforcementLinks.length);
        for (let i = 0; i < weeksToReturn; i++) {
          selectedReports.push(enforcementLinks[i]);
        }
      }
      
      console.log(`Selected ${selectedReports.length} reports to process`);
      return selectedReports;
      
    } catch (error) {
      console.error('Error selecting enforcement reports:', error);
      throw error;
    }
  }
  
  /**
   * Get current month name
   * @returns {string} Current month name
   */
  getCurrentMonthName() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const today = new Date();
    return months[today.getMonth()];
  }
  
  /**
   * Get which months need to be expanded based on weeks to scan
   * @param {number} weeksToScan - Number of weeks to scan
   * @returns {Array} Array of month names to expand
   */
  getMonthsToExpand(weeksToScan) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    
    const monthsNeeded = new Set();
    
    // Always check current month for recent reports
    monthsNeeded.add(months[currentMonth]);
    
    // If we're early in the month or need multiple weeks, check previous month(s)
    if (weeksToScan > 0 || currentDay <= 7) {
      // Add previous month since reports might span across months
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      monthsNeeded.add(months[prevMonth]);
      
      // For multiple weeks, might need to go back further
      if (weeksToScan > 4) {
        // More than 4 weeks might span 3 months
        const prevPrevMonth = prevMonth === 0 ? 11 : prevMonth - 1;
        monthsNeeded.add(months[prevPrevMonth]);
      }
    }
    
    console.log(`Months to check for ${weeksToScan} weeks: ${Array.from(monthsNeeded).join(', ')}`);
    return Array.from(monthsNeeded);
  }
  
  /**
   * Legacy method for backward compatibility - selects most recent week
   * @param {Date} targetDate - Not used anymore, kept for compatibility
   */
  async selectEnforcementReport(targetDate = new Date()) {
    const reports = await this.selectEnforcementReports({ type: 'latest' });
    
    if (reports.length > 0) {
      await reports[0].link.click();
      console.log(`Clicked on: ${reports[0].text}`);
      
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      
      if (this.debug) {
        await this.page.screenshot({ path: 'debug-enforcement-report.png' });
        console.log('Screenshot saved: debug-enforcement-report.png');
      }
      
      return true;
    }
    
    throw new Error('No enforcement report links found on page');
  }

  /**
   * Try to find and return the Product Type dropdown with Food option
   */
  async findProductTypeDropdown() {
    // Get all select elements and check what we have
    const selects = await this.page.locator('select').all();
    console.log(`Found ${selects.length} select elements on page`);
    
    // Look for the select that contains 'Food' option
    let productTypeSelect = null;
    let selectIndex = -1;
    
    for (let i = 0; i < selects.length; i++) {
      const select = selects[i];
      
      // Check if element is visible and enabled
      const isVisible = await select.isVisible({ timeout: 1000 }).catch(() => false);
      const isEnabled = await select.isEnabled({ timeout: 1000 }).catch(() => false);
      
      if (isVisible && isEnabled) {
        // Click to load options for visible and enabled selects
        await select.click({ timeout: 10000 }).catch(() => {});
        await this.page.waitForTimeout(500);
      }
      
      const options = await select.locator('option').all();
      let hasFoodOption = false;
      
      for (const option of options) {
        const text = await option.textContent().catch(() => '');
        if (text && text.toLowerCase().includes('food')) {
          hasFoodOption = true;
          break;
        }
      }
      
      if (hasFoodOption) {
        productTypeSelect = select;
        selectIndex = i;
        console.log(`Found Product Type dropdown at position ${i + 1}`);
        break;
      }
    }
    
    return productTypeSelect;
  }

  /**
   * Filter the results to show only Food products
   */
  async filterByFoodProducts() {
    console.log('Filtering by Food products...');
    
    try {
      let productTypeSelect = null;
      const waitTimes = [10000, 30000, 60000, 90000]; // 10s, 30s, 60s, 90s
      let totalWaitTime = 0;
      
      // Try to find the dropdown with progressive wait times
      for (let attempt = 0; attempt < waitTimes.length; attempt++) {
        const waitTime = waitTimes[attempt];
        
        if (attempt === 0) {
          console.log(`Waiting ${waitTime / 1000} seconds for form elements to load...`);
        } else {
          console.log(`Retry ${attempt}: Waiting additional ${waitTime / 1000} seconds for slow-loading page...`);
        }
        
        await this.page.waitForTimeout(waitTime);
        totalWaitTime += waitTime;
        
        // Try to find the Product Type dropdown
        productTypeSelect = await this.findProductTypeDropdown();
        
        if (productTypeSelect) {
          console.log(`Successfully found Product Type dropdown after ${totalWaitTime / 1000} seconds total wait`);
          break;
        } else {
          console.log(`Product Type dropdown not found after ${totalWaitTime / 1000} seconds`);
          
          if (attempt < waitTimes.length - 1) {
            // Try refreshing the page state before next attempt
            await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          }
        }
      }
      
      if (productTypeSelect) {
        const isVisible = await productTypeSelect.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (isVisible) {
          // Select the Food option for visible dropdown
          await productTypeSelect.selectOption({ label: 'Food' });
          console.log('Selected Food from Product Type dropdown');
        } else {
          // For invisible multi-select dropdown, try scrolling into view first
          console.log('Product Type dropdown not visible, trying to scroll into view...');
          await productTypeSelect.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
          await this.page.waitForTimeout(1000);
          
          // Check if it's visible now
          const isVisibleAfterScroll = await productTypeSelect.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (isVisibleAfterScroll) {
            await productTypeSelect.selectOption({ label: 'Food' });
            console.log('Selected Food from Product Type dropdown after scrolling');
          } else {
            // Try using JavaScript to select the option directly
            console.log('🔧 Trying JavaScript selection for hidden dropdown...');
            await this.page.evaluate(() => {
              const select = document.getElementById('productType');
              if (select) {
                const options = select.options;
                for (let i = 0; i < options.length; i++) {
                  if (options[i].text.toLowerCase().includes('food')) {
                    options[i].selected = true;
                    // Trigger change event
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                  }
                }
              }
              return false;
            });
            console.log('Attempted JavaScript selection for Food option');
          }
        }
        
        // Wait for the page to update with filtered results
        await this.page.waitForTimeout(3000);
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });
        
        // Take a screenshot to see the filtered results
        if (this.debug) {
          await this.page.screenshot({ path: 'debug-food-filtered.png' });
          console.log('Screenshot saved: debug-food-filtered.png');
        }
      } else {
        // After all retries failed
        const maxWaitTime = waitTimes.reduce((a, b) => a + b, 0) / 1000;
        throw new Error(`Could not find Product Type dropdown with Food option after ${maxWaitTime} seconds of waiting`);
      }

    } catch (error) {
      console.error('Error filtering by Food products:', error);
      console.log('Proceeding with all results');
    }
  }

  /**
   * Extract recall data from the current page
   */
  async extractRecallData() {
    console.log('Extracting recall data...');
    
    try {
      // Wait for the data table to be present
      await this.page.waitForSelector('table', {
        timeout: 10000
      }).catch(() => {});

      // Select "All" from the dropdown to show all recalls instead of just 50
      try {
        // console.log('Attempting to select "All" from the page size dropdown...');

        // Wait for the dropdown to be present
        await this.page.waitForSelector('#fda_table_length select', { timeout: 5000 });

        // Select "All" option (value="-1")
        await this.page.selectOption('#fda_table_length select', '-1');

        console.log('Selected "All" from dropdown, waiting for table to update...');

        // Wait for the table to reload with all data
        await this.page.waitForTimeout(2000); // Give it time to load all records

        // Wait for network to be idle after changing the dropdown
        await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
          console.log('Network not idle after 10s, continuing anyway');
        });

      } catch (error) {
        console.log('Could not select "All" from dropdown, continuing with default page size:', error.message);
      }

      const recalls = await this.page.evaluate(() => {
        const data = [];
        
        // Only identify rows with View Details links, don't extract any table data
        const fdaTable = document.querySelector('#fda_table');
        if (fdaTable) {
          const rows = fdaTable.querySelectorAll('tbody tr');
          // console.log(`Found ${rows.length} data rows in #fda_table tbody`);
          
          // For each row, just check if it has a View Details link
          rows.forEach((row, index) => {
            const viewDetailsLink = row.querySelector('td.productType a');
            if (viewDetailsLink) {
              // Only store a placeholder object to indicate this row has details
              data.push({
                rowIndex: index,
                hasViewDetails: true
              });
            }
          });
        }
        
        return data;
      });

      console.log(`Found ${recalls.length} recalls with View Details links`);
      
      return recalls;

    } catch (error) {
      console.error('Error extracting recall data:', error);
      return [];
    }
  }

  /**
   * Click on View Details and extract detailed information from modal only
   * @param {Object} recall - The recall placeholder object with rowIndex
   * @param {number} recallIndex - Index of the recall (for finding the correct button)
   */
  async extractDetailedInfo(recall, recallIndex) {
    console.log(`Getting details for recall ${recallIndex + 1} (row ${recall.rowIndex})`);
    
    try {
      // Add a small delay between recalls to avoid overwhelming the server
      if (recallIndex > 0) {
        await this.page.waitForTimeout(500);
      }
      
      // Wait for any pending network requests to complete
      // try {
      //   await this.page.waitForLoadState('networkidle', { timeout: 5000 });
      // } catch (e) {
      //   console.log('Network not idle, continuing anyway');
      // }
      
      // The view details are links in the fda_table specifically
      // Target the correct table using its ID
      const fdaTable = this.page.locator('#fda_table');
      const tableRows = await fdaTable.locator('tbody tr').all();
      
      // console.log(`Found ${tableRows.length} data rows in #fda_table tbody`);
      
      if (recall.rowIndex < tableRows.length) {
        const targetRow = tableRows[recall.rowIndex];
        
        // Find the View Details link in the productType column
        try {
          const targetLink = await targetRow.locator('td.productType a').first();
          
          if (await targetLink.isVisible({ timeout: 2000 })) {
            // Scroll to the element and hover (more human-like interaction)
            try {
              await targetLink.scrollIntoViewIfNeeded();
              await this.page.waitForTimeout(100);
              await targetLink.hover();
              await this.page.waitForTimeout(100);
            } catch (e) {
              console.log('Could not scroll/hover, continuing anyway');
            }
            
            // Try multiple click strategies
            let clicked = false;
            let clickAttempt = 0;
            const maxClickAttempts = 3;
            
            while (!clicked && clickAttempt < maxClickAttempts) {
              clickAttempt++;
              console.log(`Click attempt ${clickAttempt}/${maxClickAttempts} for recall ${recallIndex + 1}`);
              
              try {
                if (clickAttempt === 1) {
                  // First attempt: Regular click with shorter timeout
                  await targetLink.click({ timeout: 5000 });
                  clicked = true;
                  console.log('Successfully clicked View Details link (regular click)');
                } else if (clickAttempt === 2) {
                  // Second attempt: Force click to bypass any overlays
                  await targetLink.click({ force: true, timeout: 5000 });
                  clicked = true;
                  console.log('Successfully clicked View Details link (force click)');
                } else {
                  // Third attempt: JavaScript click
                  await this.page.evaluate((rowIdx) => {
                    const rows = document.querySelectorAll('#fda_table tbody tr');
                    const row = rows[rowIdx];
                    if (row) {
                      const link = row.querySelector('td.productType a');
                      if (link) {
                        link.click();
                        return true;
                      }
                    }
                    return false;
                  }, recall.rowIndex);
                  clicked = true;
                  console.log('Successfully clicked View Details link (JavaScript click)');
                }
                
                // If click succeeded, wait for modal
                if (clicked) {
                  // Try to detect modal with retry logic
                  let modalDetected = false;
                  const modalWaitTimes = [100, 500, 1000, 2000]; // 100ms, then 500ms, then 1s, then 2s

                  for (let modalAttempt = 0; modalAttempt < modalWaitTimes.length; modalAttempt++) {
                    const waitTime = modalWaitTimes[modalAttempt];
                    
                    if (modalAttempt === 0) {
                      // First attempt - wait initial time
                      await this.page.waitForTimeout(waitTime);
                    } else {
                      // Retry attempts - wait additional time
                      console.log(`Modal retry ${modalAttempt}: waiting additional ${waitTime}ms...`);
                      await this.page.waitForTimeout(waitTime);
                    }
                    
                    // Check directly if modal content is visible
                    const hasProductData = await this.page.locator('#productData').isVisible({ timeout: 100 }).catch(() => false);
                    const hasDialog = await this.page.locator('.ui-dialog-content, [role="dialog"]').first().isVisible({ timeout: 100 }).catch(() => false);
                    
                    if (hasProductData || hasDialog) {
                      console.log(`Modal detected after ${modalAttempt === 0 ? waitTime : 'retry ' + modalAttempt}`);
                      modalDetected = true;
                      break;
                    }
                  }
                  
                  if (!modalDetected) {
                    console.log('Modal not visible after all retries, trying next click method...');
                    clicked = false;
                  }
                } 
              } catch (clickError) {
                console.log(`Click attempt ${clickAttempt} failed: ${clickError.message}`);
                if (clickAttempt < maxClickAttempts) {
                  // Wait before retry
                  await this.page.waitForTimeout(2000);
                }
              }
            }
            
            if (clicked) {
              // Extract detailed information from the modal ONLY
              const detailedInfo = await this.extractModalContent();
              
              // Close the modal
              await this.closeModal();
              
              // Return ONLY modal data in exact order
              return detailedInfo;
            } else {
              console.log('All click attempts failed for this recall');
              
              // Last resort: Try to extract anyway in case modal is there but detection failed
              console.log('Attempting extraction despite click failure...');
              const detailedInfo = await this.extractModalContent();
              if (detailedInfo && Object.keys(detailedInfo).length > 0) {
                console.log('Successfully extracted data despite click issues');
                await this.closeModal();
                return detailedInfo;
              }
            }
          } else {
            console.log('View Details link not visible');
          }
        } catch (e) {
          console.log('Error processing View Details link:', e.message);
        }
      }

      // Fallback if no link found
      console.log('Could not find View Details link for this recall');
      return {};

    } catch (error) {
      console.error('Error extracting detailed info:', error);
      
      if (this.debug) {
        await this.page.screenshot({ path: `debug-detail-error-${recallIndex}.png` });
        console.log(`Error screenshot saved: debug-detail-error-${recallIndex}.png`);
      }
      
      return {};
    }
  }

  /**
   * Extract content from the Product Details modal
   */
  async extractModalContent() {
    try {
      // Progressive wait for modal content to load
      const contentWaitTimes = [100, 300, 1000]; // 100ms, then 300ms, then 1000ms
      let contentReady = false;
      
      for (let contentAttempt = 0; contentAttempt < contentWaitTimes.length; contentAttempt++) {
        const waitTime = contentWaitTimes[contentAttempt];
        
        if (contentAttempt === 0) {
          // First attempt - wait initial time
          await this.page.waitForTimeout(waitTime);
        } else {
          // Retry attempts - wait additional time
          console.log(`Modal content retry ${contentAttempt}: waiting additional ${waitTime}ms...`);
          await this.page.waitForTimeout(waitTime);
        }
        
        // Check if modal content has loaded by looking for data rows
        const hasContent = await this.page.evaluate(() => {
          const productData = document.querySelector('#productData');
          if (productData) {
            const rows = productData.querySelectorAll('.row.displayDetailsColumn');
            return rows.length > 0;
          }
          return false;
        });
        
        if (hasContent) {
          console.log(`Modal content ready after ${contentAttempt === 0 ? waitTime + 'ms' : 'retry ' + contentAttempt}`);
          contentReady = true;
          break;
        }
      }
      
      if (!contentReady) {
        console.log('Modal content not fully loaded after all retries, extracting anyway...');
      }

      // Extract information from the modal using the specific HTML structure
      const modalData = await this.page.evaluate(() => {
        const data = {};
        
        // Debug: Check what modal elements exist
        const debugInfo = {
          hasProductData: !!document.querySelector('#productData'),
          hasUIDialog: !!document.querySelector('.ui-dialog-content'),
          hasRoleDialog: !!document.querySelector('[role="dialog"]'),
          hasModal: !!document.querySelector('.modal')
        };
        console.log('Modal elements present:', JSON.stringify(debugInfo));
        
        // Target the productData container specifically
        const productData = document.querySelector('#productData');
        
        if (productData) {
          // Get all rows within productData
          const rows = productData.querySelectorAll('.row.displayDetailsColumn');
          
          rows.forEach((row, rowIndex) => {
            // Each row has two columns, each column can have label-value pairs
            const columns = row.querySelectorAll('[class*="col-md"]');
            
            columns.forEach((column, colIndex) => {
              // Look for boldFont (label) and its sibling (value)
              const boldDiv = column.querySelector('div.boldFont');
              if (boldDiv) {
                const labelP = boldDiv.querySelector('p[aria-label]');
                if (labelP) {
                  const labelText = labelP.getAttribute('aria-label') || '';
                  
                  // Try multiple strategies to find the value
                  let valueText = '';
                  
                  // Strategy 1: Check if value paragraph is direct sibling of boldFont div
                  const directSiblingP = boldDiv.nextElementSibling;
                  if (directSiblingP && directSiblingP.tagName === 'P') {
                    // Use textContent which won't be broken by quotes/apostrophes
                    valueText = directSiblingP.textContent?.trim() || '';
                    // If textContent is empty, try aria-label as fallback
                    if (!valueText && directSiblingP.hasAttribute('aria-label')) {
                      const ariaValue = directSiblingP.getAttribute('aria-label') || '';
                      // Check if aria-label seems complete (contains expected content)
                      if (ariaValue.length > valueText.length) {
                        valueText = ariaValue;
                      }
                    }
                  }
                  
                  // Strategy 1b: Next sibling div containing paragraph
                  if (!valueText) {
                    const valueDiv = boldDiv.nextElementSibling;
                    if (valueDiv && valueDiv.tagName === 'DIV') {
                      const valueP = valueDiv.querySelector('p');
                      if (valueP) {
                        // Use textContent first
                        valueText = valueP.textContent?.trim() || '';
                        // Fallback to aria-label if textContent is empty
                        if (!valueText && valueP.hasAttribute('aria-label')) {
                          valueText = valueP.getAttribute('aria-label') || '';
                        }
                      }
                    }
                  }
                  
                  // Strategy 2: Look within the same column for any non-label p element
                  if (!valueText) {
                    const allParagraphs = column.querySelectorAll('p');
                    for (const p of allParagraphs) {
                      // Use textContent first
                      const pText = p.textContent?.trim() || '';
                      // If this paragraph doesn't contain a colon (not a label), it's likely a value
                      if (pText && !pText.includes(':') && pText !== labelText) {
                        valueText = pText;
                        break;
                      }
                    }
                  }
                  
                  // Strategy 3: Look for links (for URLs like Press Release)
                  if (!valueText && labelText.includes('URL')) {
                    const link = column.querySelector('a[href]');
                    if (link) {
                      valueText = link.href || link.textContent || '';
                    }
                  }
                  
                  // Strategy 4: Look within the row for values (cross-column search)
                  if (!valueText) {
                    const parentRow = column.closest('.row');
                    if (parentRow) {
                      const allRowParagraphs = parentRow.querySelectorAll('p');
                      for (const p of allRowParagraphs) {
                        // Use textContent instead of aria-label to avoid broken attributes
                        const pText = p.textContent?.trim() || '';
                        // Skip if this is a label (contains colon) or is empty
                        if (pText && !pText.includes(':') && pText !== labelText) {
                          valueText = pText;
                          break;
                        }
                      }
                    }
                  }
                  
                  if (valueText) {
                    // Store fields using their exact label names from the modal
                    const cleanLabel = labelText.replace(':', '').trim();
                    if (cleanLabel) {
                      // Convert label to camelCase field name
                      const fieldName = cleanLabel
                        .toLowerCase()
                        .replace(/\s+/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                        .replace(/\s/g, '')
                        .replace(/^./, l => l.toLowerCase());
                      
                      data[fieldName] = valueText.trim();
                    }
                  }
                }
              }
            });
          });
          
          // Also look for Event Details section
          const eventData = document.querySelector('#eventData');
          if (eventData) {
            const eventRows = eventData.querySelectorAll('.row.displayDetailsColumn');
            
            eventRows.forEach((row, rowIndex) => {
              const columns = row.querySelectorAll('[class*="col-md"]');
              columns.forEach((column, colIndex) => {
                const boldDiv = column.querySelector('div.boldFont');
                if (boldDiv) {
                  const labelP = boldDiv.querySelector('p[aria-label]');
                  if (labelP) {
                    const labelText = labelP.getAttribute('aria-label') || '';
                    
                    // Try multiple strategies to find the value
                    let valueText = '';
                    
                    // Strategy 1: Check if value paragraph is direct sibling of boldFont div
                    const directSiblingP = boldDiv.nextElementSibling;
                    if (directSiblingP && directSiblingP.tagName === 'P') {
                      // Special handling for fields with addresses (preserve line breaks)
                      if (labelText.includes('Recalling Firm')) {
                        // Get innerHTML and replace <br> tags with double spaces
                        const innerHTML = directSiblingP.innerHTML || '';
                        // Replace <br> tags with double spaces to preserve line breaks
                        const textWithBreaks = innerHTML.replace(/<br\s*\/?>/gi, '  ');
                        // Create a temporary element to extract text
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = textWithBreaks;
                        valueText = tempDiv.textContent?.trim() || '';
                      } else {
                        // Use textContent which won't be broken by quotes/apostrophes
                        valueText = directSiblingP.textContent?.trim() || '';
                      }
                      // If textContent is empty, try aria-label as fallback
                      if (!valueText && directSiblingP.hasAttribute('aria-label')) {
                        valueText = directSiblingP.getAttribute('aria-label') || '';
                      }
                    }
                    
                    // Strategy 1b: Next sibling div containing paragraph
                    if (!valueText) {
                      const valueDiv = boldDiv.nextElementSibling;
                      if (valueDiv && valueDiv.tagName === 'DIV') {
                        const valueP = valueDiv.querySelector('p');
                        if (valueP) {
                          // Special handling for fields with addresses (preserve line breaks)
                          if (labelText.includes('Recalling Firm')) {
                            const innerHTML = valueP.innerHTML || '';
                            const textWithBreaks = innerHTML.replace(/<br\s*\/?>/gi, '  ');
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = textWithBreaks;
                            valueText = tempDiv.textContent?.trim() || '';
                          } else {
                            // Use textContent first
                            valueText = valueP.textContent?.trim() || '';
                          }
                          // Fallback to aria-label if textContent is empty
                          if (!valueText && valueP.hasAttribute('aria-label')) {
                            valueText = valueP.getAttribute('aria-label') || '';
                          }
                        }
                      }
                    }
                    
                    // Strategy 2: Look within the same column for any non-label p element
                    if (!valueText) {
                      const allParagraphs = column.querySelectorAll('p');
                      for (const p of allParagraphs) {
                        let pText = '';
                        // Special handling for fields with addresses (preserve line breaks)
                        if (labelText.includes('Recalling Firm')) {
                          const innerHTML = p.innerHTML || '';
                          const textWithBreaks = innerHTML.replace(/<br\s*\/?>/gi, '  ');
                          const tempDiv = document.createElement('div');
                          tempDiv.innerHTML = textWithBreaks;
                          pText = tempDiv.textContent?.trim() || '';
                        } else {
                          // Use textContent first
                          pText = p.textContent?.trim() || '';
                        }
                        // If this paragraph doesn't contain a colon (not a label), it's likely a value
                        if (pText && !pText.includes(':') && pText !== labelText) {
                          valueText = pText;
                          break;
                        }
                      }
                    }
                    
                    // Strategy 3: Look for links (for URLs like Press Release)
                    if (!valueText && labelText.includes('URL')) {
                      const link = column.querySelector('a[href]');
                      if (link) {
                        valueText = link.href || link.textContent || '';
                      }
                    }
                    
                    // Strategy 4: Look within the row for values (cross-column search)
                    if (!valueText) {
                      const parentRow = column.closest('.row');
                      if (parentRow) {
                        const allRowParagraphs = parentRow.querySelectorAll('p');
                        for (const p of allRowParagraphs) {
                          let pText = '';
                          // Special handling for fields with addresses (preserve line breaks)
                          if (labelText.includes('Recalling Firm')) {
                            const innerHTML = p.innerHTML || '';
                            const textWithBreaks = innerHTML.replace(/<br\s*\/?>/gi, '  ');
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = textWithBreaks;
                            pText = tempDiv.textContent?.trim() || '';
                          } else {
                            // Use textContent instead of aria-label to avoid broken attributes
                            pText = p.textContent?.trim() || '';
                          }
                          // Skip if this is a label (contains colon) or is empty
                          if (pText && !pText.includes(':') && pText !== labelText) {
                            valueText = pText;
                            break;
                          }
                        }
                      }
                    }
                    
                    if (valueText) {
                      // Store fields using their exact label names from the modal
                      const cleanLabel = labelText.replace(':', '').trim();
                      if (cleanLabel) {
                        // Convert label to camelCase field name
                        const fieldName = cleanLabel
                          .toLowerCase()
                          .replace(/\s+/g, ' ')
                          .replace(/\b\w/g, l => l.toUpperCase())
                          .replace(/\s/g, '')
                          .replace(/^./, l => l.toLowerCase());
                        
                        data[fieldName] = valueText.trim();
                      }
                    }
                  }
                }
              });
            });
          }
        }
        
        return data;
      });

      // Filter out null/empty values and log what we extracted
      const cleanedData = {};
      let extractedCount = 0;
      
      Object.keys(modalData).forEach(key => {
        if (modalData[key] && modalData[key] !== 'N/A' && modalData[key].trim() !== '') {
          cleanedData[key] = modalData[key];
          extractedCount++;
        }
      });

      console.log(`Extracted ${extractedCount} additional data fields from modal`);
      return cleanedData;

    } catch (error) {
      console.log('Error extracting modal content:', error.message);
      return {};
    }
  }

  /**
   * Close the Product Details modal
   */
  async closeModal() {
    try {
      // First try the most reliable method - ESC key
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(200); // Small wait to let modal close
      
      // Quick check if modal is closed
      const modalExists = await this.page.locator('.ui-dialog-content, [role="dialog"], .modal, #productData')
        .first()
        .isVisible({ timeout: 100 })
        .catch(() => false);
      
      if (!modalExists) {
        console.log('Modal closed');
        return;
      }
      
      // If ESC didn't work, try clicking the close button
      try {
        const closeButton = this.page.locator('.ui-dialog-titlebar-close').first();
        if (await closeButton.isVisible({ timeout: 100 })) {
          await closeButton.click();
          console.log('Modal closed via button');
          return;
        }
      } catch (e) {
        // Button not found or clickable
      }
      
      // If still not closed, just continue (modal might auto-close on next action)
      console.log('Modal may still be open, continuing anyway');
    } catch (error) {
      console.log('Error closing modal:', error.message);
    }
  }

  /**
   * Filter recalls to only include food products
   * @param {Array} recalls - Array of recall objects
   * @returns {Array} Filtered array of food recalls only
   */
  filterFoodRecalls(recalls) {
    const foodKeywords = ['food', 'dietary', 'supplement', 'beverage', 'meat', 'poultry', 'seafood', 'produce'];
    
    const foodRecalls = recalls.filter(recall => {
      const productType = (recall.productType || recall.product_type || '').toLowerCase();
      const productDesc = (recall.productDescription || recall.product_description || '').toLowerCase();
      
      // Check if product type contains food-related keywords
      const isFoodType = foodKeywords.some(keyword => productType.includes(keyword));
      
      // Also check product description for food-related terms
      const isFoodDesc = foodKeywords.some(keyword => productDesc.includes(keyword));
      
      return isFoodType || isFoodDesc;
    });
    
    console.log(`Filtered ${foodRecalls.length} food recalls from ${recalls.length} total recalls`);
    
    if (foodRecalls.length > 0) {
      const foodTypes = {};
      foodRecalls.forEach(recall => {
        const type = recall.productType || recall.product_type || 'Unknown';
        foodTypes[type] = (foodTypes[type] || 0) + 1;
      });
      console.log('Food product types:', foodTypes);
    }
    
    return foodRecalls;
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

  /**
   * Main scraping method
   * @param {Object} options - Scraping options
   * @param {string} options.reportType - 'latest', 'new', or 'weeks'
   * @param {number} options.weeksToScan - Number of past weeks to scan (default: 1)
   * @param {number} options.maxRecalls - Maximum number of recalls to get details for per report
   * @param {boolean} options.includeNewRecalls - Whether to also process new recalls (when using 'weeks')
   */
  async scrape(options = {}) {
    const { 
      reportType = 'latest', // 'latest', 'new', or 'weeks'
      weeksToScan = 1,
      maxRecalls = 10,
      includeNewRecalls = true
    } = options;

    try {
      await this.init();
      await this.navigateToIRES();
      
      // Get the reports to process
      const reports = await this.selectEnforcementReports({ 
        type: reportType,
        weeksToScan: weeksToScan
      });
      
      // If scanning weeks and includeNewRecalls is true, also get new recalls
      if (reportType === 'weeks' && includeNewRecalls) {
        // Navigate back to IRES to reset the page state
        await this.navigateToIRES();
        
        // Now get the new recalls
        const newRecalls = await this.selectEnforcementReports({ type: 'new' });
        if (newRecalls.length > 0) {
          reports.unshift(newRecalls[0]); // Add new recalls at the beginning
        }
      }
      
      if (reports.length === 0) {
        console.log('No enforcement reports found to process');
        return [];
      }
      
      console.log(`\nProcessing ${reports.length} enforcement report(s)...`);
      
      const allDetailedRecalls = [];
      
      // Process each report
      for (let reportIndex = 0; reportIndex < reports.length; reportIndex++) {
        const report = reports[reportIndex];
        console.log(`\n═══ Report ${reportIndex + 1}/${reports.length}: ${report.text} ═══`);
        
        // Re-find the link by text before clicking (to avoid stale element issues)
        console.log(`Looking for link: ${report.text}`);
        
        // For reports other than the first, we might need to navigate back first
        if (reportIndex > 0) {
          // We're back at IRES, need to re-expand the month and find the link
          const reportMonth = report.text.match(/Week of (\w+)/)?.[1] || this.getCurrentMonthName();
          console.log(`Re-expanding ${reportMonth} to find the link...`);
          
          // Click on the month to expand it
          const monthSection = await this.page.locator(`text="${reportMonth}"`).first();
          if (await monthSection.count() > 0) {
            await monthSection.click();
            await this.page.waitForTimeout(1500);
          }
        }
        
        // Now find and click the specific report link
        let clicked = false;
        
        // Try to find the link by exact text match
        const exactLink = await this.page.locator(`a:has-text("${report.text}")`).first();
        if (await exactLink.count() > 0 && await exactLink.isVisible()) {
          await this.page.waitForTimeout(500); // Small delay before clicking
          await exactLink.click();
          clicked = true;
          console.log(`Clicked on report link using exact text match`);
        }
        
        // If exact match didn't work, try partial text match
        if (!clicked) {
          const partialText = report.text.replace('Enforcement Report for ', '');
          const partialLink = await this.page.locator(`a:has-text("${partialText}")`).first();
          if (await partialLink.count() > 0 && await partialLink.isVisible()) {
            await this.page.waitForTimeout(500); // Small delay before clicking
            await partialLink.click();
            clicked = true;
            console.log(`Clicked on report link using partial text match`);
          }
        }
        
        if (!clicked) {
          console.log(`ERROR: Could not click on report: ${report.text}`);
          continue;
        }
        
        // Wait for navigation to complete
        console.log(`Waiting for page to load...`);
        await this.page.waitForTimeout(2000); // Give time for navigation
        await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
        
        // Verify we're on the report page by checking for expected elements
        const onReportPage = await this.page.locator('select, #fda_table, table').first().isVisible({ timeout: 5000 }).catch(() => false);
        
        if (onReportPage) {
          console.log(`Successfully opened: ${report.text}`);
        } else {
          console.log(`WARNING: May not have navigated to report page properly`);
        }
        
        // Filter for food products
        await this.filterByFoodProducts();
        
        // Extract recalls
        const recalls = await this.extractRecallData();
        
        if (recalls.length === 0) {
          console.log('No food recalls found in this report');
          continue;
        }
        
        console.log(`Found ${recalls.length} food recalls`);
        
        // Limit processing for this report
        const processingCount = Math.min(recalls.length, maxRecalls);
        console.log(`Processing ${processingCount} recalls for detailed info...`);
        
        
        // Get detailed information for each recall sequentially
        for (let i = 0; i < processingCount; i++) {
          const detailedRecall = await this.extractDetailedInfo(recalls[i], i);
          
          // Add report metadata
          detailedRecall.reportType = report.text;
          detailedRecall.reportDate = new Date().toISOString();
          
          allDetailedRecalls.push(detailedRecall);
          
          // Small delay between requests to avoid overwhelming the server
          await this.page.waitForTimeout(500);
        }
        
        console.log(`Completed processing ${allDetailedRecalls.length} recalls from this report`);
        
        // Navigate back to the main page for next report (if not last)
        if (reportIndex < reports.length - 1) {
          await this.navigateToIRES();
        }
      }
      
      console.log(`\nTotal recalls extracted: ${allDetailedRecalls.length}`);
      return allDetailedRecalls;

    } catch (error) {
      console.error('Scraping failed:', error);
      
      if (this.debug) {
        await this.page.screenshot({ path: 'debug-error.png' });
        console.log('Error screenshot saved: debug-error.png');
      }
      
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     FDA IRES Enforcement Report Scraper  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const scraper = new FDAIRESScraper({
    headless: false,  // Set to true for production
    debug: true       // Set to false for production
  });

  try {
    // Example: Get last 4 weeks of reports plus new recalls
    const recalls = await scraper.scrape({
      reportType: 'weeks',  // 'latest', 'new', or 'weeks'
      weeksToScan: 4,       // Scan last 4 weeks
      maxRecalls: 10,       // Max recalls per report
      includeNewRecalls: true  // Also get new recalls since last report
    });

    // Save results
    const outputPath = path.join(__dirname, 'fda-ires-recalls.json');
    await fs.writeFile(outputPath, JSON.stringify(recalls, null, 2));
    
    console.log(`\nResults saved to ${outputPath}`);
    console.log(`Total recalls extracted: ${recalls.length}`);
    
    // Display summary
    if (recalls.length > 0) {
      console.log('\nSample recalls (modal data only):');
      recalls.slice(0, 3).forEach((recall, i) => {
        console.log(`\n${i + 1}. ${recall.productDescription || recall.product || 'Unknown Product'}`);
        console.log(`   Firm: ${recall.recallingFirm || recall.firm || 'Unknown'}`);
        console.log(`   Class: ${recall.classification || 'Unknown'}`);
        console.log(`   Reason: ${(recall.reasonForRecall || recall.reason || 'Unknown').substring(0, 100)}...`);
        console.log(`   Total fields: ${Object.keys(recall).length}`);
      });
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
  console.log('\n  cd backend/scripts');
  console.log('  npm install playwright');
  console.log('  npx playwright install chromium');
  console.log('\nThen run this script with:');
  console.log('  node fda-ires-scraper.js');
}

module.exports = FDAIRESScraper;