/**
 * Test script for FDA IRES Scraper
 * Tests fetching new recalls and past 1 week
 */

const FDAIRESScraper = require('./fda-ires-scraper');

async function testScraper() {
  console.log('Testing FDA IRES Scraper...\n');
  
  const scraper = new FDAIRESScraper({
    headless: false,  // Show browser for testing
    debug: false      // Minimal logging
  });
  
  try {
    // Test: Get past 1 week (August 27) + new recalls since last week
    const recalls = await scraper.scrape({
      reportType: 'weeks',
      weeksToScan: 1,           // Past 1 week (August 27)
      maxRecalls: 100,          // Get all recalls
      includeNewRecalls: true   // Also get new recalls
    });
    
    // Count recalls by report type
    let newRecallsCount = 0;
    let weekRecallsCount = 0;
    
    recalls.forEach(recall => {
      if (recall.reportType && recall.reportType.includes('New Recalls')) {
        newRecallsCount++;
      } else if (recall.reportType && recall.reportType.includes('Week of')) {
        weekRecallsCount++;
      }
    });
    
    console.log('\n========== TEST RESULTS ==========');
    console.log(`Total recalls fetched: ${recalls.length}`);
    console.log(`- New recalls since last week: ${newRecallsCount}`);
    console.log(`- Week of August 27 recalls: ${weekRecallsCount}`);
    console.log('==================================\n');
    
    // Save a sample to verify data structure
    if (recalls.length > 0) {
      console.log('Sample recall data:');
      console.log(`- Product: ${recalls[0].productDescription || 'N/A'}`);
      console.log(`- Recall Number: ${recalls[0].recallNumber || 'N/A'}`);
      console.log(`- Classification: ${recalls[0].classification || 'N/A'}`);
    }
    
    return recalls.length;
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return 0;
  } finally {
    await scraper.cleanup();
  }
}

// Run the test
testScraper().then(count => {
  console.log(`\nTest completed. Found ${count} recalls total.`);
  process.exit(count > 0 ? 0 : 1);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});