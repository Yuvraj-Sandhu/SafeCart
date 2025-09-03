/**
 * FDA Enforcement Reports Scraper
 * 
 * This script scrapes the FDA's weekly enforcement reports to get more timely recall data.
 * The FDA enforcement reports are typically published weekly and contain recalls that were
 * classified during that week, providing more up-to-date information than the OpenFDA API.
 * 
 * Target URL: https://www.accessdata.fda.gov/scripts/ires/index.cfm
 * 
 * Process:
 * 1. Navigate to enforcement reports page
 * 2. Select a specific week's enforcement report
 * 3. Filter by product type (Food)
 * 4. Extract recall details from the table
 * 5. Parse individual recall details from modal popups
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class FDAEnforcementScraper {
  constructor() {
    this.baseUrl = 'https://www.accessdata.fda.gov/scripts/ires/index.cfm';
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the browser and page
   */
  async init() {
    console.log('Initializing browser...');
    this.browser = await puppeteer.launch({
      headless: false, // Set to true in production
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Browser initialized');
  }

  /**
   * Navigate to the enforcement reports page
   */
  async navigateToEnforcementReports() {
    console.log(`Navigating to ${this.baseUrl}...`);
    
    try {
      await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      console.log('Successfully loaded enforcement reports page');
      
      // Wait for the page to fully load
      await this.page.waitForTimeout(2000);
      
    } catch (error) {
      console.error('Error navigating to enforcement reports:', error);
      throw error;
    }
  }

  /**
   * Select a specific week's enforcement report
   * @param {string} weekText - Text identifying the week (e.g., "August 27, 2024")
   */
  async selectWeeklyReport(weekText) {
    console.log(`Looking for enforcement report for week of ${weekText}...`);
    
    try {
      // Look for the enforcement report link
      // The page might use different selectors, so we'll try multiple approaches
      
      // First, check if there's a direct link with the date
      const linkSelectors = [
        `a:contains("${weekText}")`,
        `a[href*="enforcement"][href*="report"]`,
        `.enforcement-link`,
        `td a[href*="week"]`
      ];
      
      let clicked = false;
      for (const selector of linkSelectors) {
        try {
          // Try using page.evaluate to find and click the link
          clicked = await this.page.evaluate((text) => {
            const links = Array.from(document.querySelectorAll('a'));
            const targetLink = links.find(link => 
              link.textContent.includes(text) || 
              link.textContent.includes('Enforcement Report')
            );
            if (targetLink) {
              targetLink.click();
              return true;
            }
            return false;
          }, weekText);
          
          if (clicked) {
            console.log(`Clicked on enforcement report for week of ${weekText}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!clicked) {
        // If direct click didn't work, try to find and click using Puppeteer's click method
        const link = await this.page.$x(`//a[contains(text(), "${weekText}") or contains(text(), "Enforcement Report")]`);
        if (link.length > 0) {
          await link[0].click();
          console.log(`Clicked on enforcement report using XPath`);
        } else {
          console.log('Could not find enforcement report link, looking for alternative methods...');
          
          // Take a screenshot for debugging
          await this.page.screenshot({ path: 'enforcement-page.png' });
          console.log('Screenshot saved as enforcement-page.png');
          
          // Log the page content for analysis
          const pageContent = await this.page.content();
          require('fs').writeFileSync('enforcement-page.html', pageContent);
          console.log('Page HTML saved as enforcement-page.html');
        }
      }
      
      // Wait for navigation or new content to load
      await this.page.waitForTimeout(3000);
      
    } catch (error) {
      console.error('Error selecting weekly report:', error);
      throw error;
    }
  }

  /**
   * Filter results by product type (Food)
   */
  async filterByFood() {
    console.log('Filtering by product type: Food...');
    
    try {
      // Look for filter dropdown or checkbox for product type
      const filterSelectors = [
        'select[name*="product"]',
        'select[id*="product"]',
        'input[type="checkbox"][value="Food"]',
        'input[type="radio"][value="Food"]'
      ];
      
      let filtered = false;
      for (const selector of filterSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            // If it's a select dropdown
            if (selector.includes('select')) {
              await this.page.select(selector, 'Food');
              console.log('Selected Food from dropdown');
            } 
            // If it's a checkbox or radio
            else {
              await element.click();
              console.log('Clicked Food checkbox/radio');
            }
            filtered = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!filtered) {
        console.log('Could not find product type filter, proceeding without filtering');
      }
      
      // Wait for results to update
      await this.page.waitForTimeout(2000);
      
    } catch (error) {
      console.error('Error filtering by food:', error);
      // Continue even if filtering fails
    }
  }

  /**
   * Extract recall data from the table
   */
  async extractRecallData() {
    console.log('Extracting recall data from table...');
    
    try {
      // Wait for table to be present
      await this.page.waitForSelector('table', { timeout: 10000 }).catch(() => {
        console.log('No table found, looking for alternative data structure...');
      });
      
      // Extract data from the page
      const recalls = await this.page.evaluate(() => {
        const data = [];
        
        // Try to find recall data in tables
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const rows = table.querySelectorAll('tr');
          rows.forEach((row, index) => {
            if (index === 0) return; // Skip header row
            
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              const recall = {
                recallNumber: cells[0]?.textContent?.trim() || '',
                product: cells[1]?.textContent?.trim() || '',
                recallingFirm: cells[2]?.textContent?.trim() || '',
                reason: cells[3]?.textContent?.trim() || '',
                classification: cells[4]?.textContent?.trim() || '',
                detailsLink: row.querySelector('a[href*="detail"]')?.href || ''
              };
              
              // Only add if we have meaningful data
              if (recall.product || recall.recallingFirm) {
                data.push(recall);
              }
            }
          });
        });
        
        // If no table data, try to find recall information in other formats
        if (data.length === 0) {
          // Look for divs or lists with recall information
          const recallDivs = document.querySelectorAll('[class*="recall"], [id*="recall"]');
          recallDivs.forEach(div => {
            const text = div.textContent;
            if (text && text.length > 20) {
              data.push({
                rawText: text.trim(),
                html: div.innerHTML
              });
            }
          });
        }
        
        return data;
      });
      
      console.log(`Found ${recalls.length} recalls`);
      return recalls;
      
    } catch (error) {
      console.error('Error extracting recall data:', error);
      return [];
    }
  }

  /**
   * Get detailed information for a specific recall
   * @param {string} detailsUrl - URL to the recall details page
   */
  async getRecallDetails(detailsUrl) {
    console.log(`Getting details for recall: ${detailsUrl}`);
    
    try {
      // Open details in new page or modal
      const newPage = await this.browser.newPage();
      await newPage.goto(detailsUrl, { waitUntil: 'networkidle2' });
      
      const details = await newPage.evaluate(() => {
        const extractText = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent.trim() : '';
        };
        
        return {
          recallNumber: extractText('[class*="recall-number"], [id*="recall-number"]'),
          classification: extractText('[class*="classification"]'),
          productDescription: extractText('[class*="product-description"], [id*="product"]'),
          codeInfo: extractText('[class*="code-info"], [id*="code"]'),
          recallingFirm: extractText('[class*="recalling-firm"], [id*="firm"]'),
          reasonForRecall: extractText('[class*="reason"], [id*="reason"]'),
          voluntaryMandated: extractText('[class*="voluntary"]'),
          distributionPattern: extractText('[class*="distribution"]'),
          recallInitiationDate: extractText('[class*="initiation-date"], [id*="initiation"]'),
          reportDate: extractText('[class*="report-date"]')
        };
      });
      
      await newPage.close();
      return details;
      
    } catch (error) {
      console.error('Error getting recall details:', error);
      return null;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  /**
   * Main scraping function
   * @param {string} weekDate - Date string for the week to scrape
   */
  async scrape(weekDate = 'August 27, 2024') {
    try {
      await this.init();
      await this.navigateToEnforcementReports();
      await this.selectWeeklyReport(weekDate);
      await this.filterByFood();
      const recalls = await this.extractRecallData();
      
      // Get detailed information for each recall
      const detailedRecalls = [];
      for (const recall of recalls.slice(0, 5)) { // Limit to first 5 for testing
        if (recall.detailsLink) {
          const details = await this.getRecallDetails(recall.detailsLink);
          detailedRecalls.push({ ...recall, ...details });
        } else {
          detailedRecalls.push(recall);
        }
      }
      
      return detailedRecalls;
      
    } catch (error) {
      console.error('Scraping failed:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Alternative approach using direct API calls if available
class FDAEnforcementAPI {
  constructor() {
    this.baseUrl = 'https://www.accessdata.fda.gov/scripts/ires';
  }

  /**
   * Try to find and use any API endpoints
   */
  async checkForAPI() {
    console.log('Checking for API endpoints...');
    
    const possibleEndpoints = [
      '/api/enforcement/reports',
      '/data/enforcement.json',
      '/enforcement/weekly',
      '/index.cfm?action=getdata',
      '/index.cfm?method=reports'
    ];
    
    for (const endpoint of possibleEndpoints) {
      try {
        const url = this.baseUrl + endpoint;
        console.log(`Trying ${url}...`);
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*'
          },
          timeout: 5000
        });
        
        if (response.status === 200) {
          console.log(`Found working endpoint: ${url}`);
          return response.data;
        }
      } catch (error) {
        // Continue to next endpoint
      }
    }
    
    console.log('No API endpoints found');
    return null;
  }
}

// Run the scraper
async function main() {
  console.log('FDA Enforcement Reports Scraper');
  console.log('================================\n');
  
  // First try API approach
  const api = new FDAEnforcementAPI();
  const apiData = await api.checkForAPI();
  
  if (apiData) {
    console.log('Found API data:', JSON.stringify(apiData, null, 2));
  } else {
    console.log('No API found, using web scraping approach\n');
    
    // Use web scraping
    const scraper = new FDAEnforcementScraper();
    const recalls = await scraper.scrape('August 27, 2024');
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync(
      'fda-enforcement-recalls.json',
      JSON.stringify(recalls, null, 2)
    );
    
    console.log('\nResults saved to fda-enforcement-recalls.json');
    console.log(`Total recalls scraped: ${recalls.length}`);
  }
}

// Check if puppeteer is installed
try {
  require('puppeteer');
  main().catch(console.error);
} catch (error) {
  console.log('\n⚠️  Puppeteer is not installed.');
  console.log('Please install it first by running:');
  console.log('\n  cd backend');
  console.log('  npm install puppeteer');
  console.log('\nThen run this script again.');
}