/**
 * Batch Historical Data Sync
 * 
 * This script fetches all USDA recall data and stores it in Firebase
 * in batches of 500 to avoid timeout issues.
 * 
 * Usage: node batch-historical-sync.js
 * 
 * Prerequisites:
 * - Backend server running on port 3001
 * - Firebase credentials configured
 * - Stable internet connection
 */

const axios = require('axios');

// Configuration
const BATCH_SIZE = 100; // Reduced batch size to avoid payload size issues
const BASE_URL = 'http://localhost:3001';
const USDA_API_URL = 'https://www.fsis.usda.gov/fsis/api/recall/v/1';

async function fetchAllRecalls() {
  console.log('Fetching all recalls from USDA API...');
  
  try {
    const response = await axios.get(USDA_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 60000 // 60 second timeout
    });
    
    console.log(`Successfully fetched ${response.data.length} recalls from USDA`);
    return response.data;
  } catch (error) {
    console.error('Error fetching recalls from USDA:', error.message);
    throw error;
  }
}

async function saveRecallBatch(recalls, batchNumber, totalBatches) {
  console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${recalls.length} recalls)...`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/recalls/batch`, {
      recalls: recalls
    }, {
      timeout: 600000 // 10 minute timeout for batch processing
    });
    
    if (response.data.success) {
      console.log(`Batch ${batchNumber} saved successfully`);
      return true;
    } else {
      console.error(`Batch ${batchNumber} failed:`, response.data.error);
      return false;
    }
  } catch (error) {
    console.error(`Batch ${batchNumber} error:`, error.message);
    return false;
  }
}

async function runBatchSync() {
  console.log('=== SAFECART BATCH HISTORICAL DATA SYNC ===\n');
  
  try {
    // Check if server is running
    console.log('Checking server status...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log(`Server status: ${health.data.status}\n`);
    
    // Fetch all recalls from USDA
    const allRecalls = await fetchAllRecalls();
    
    // Calculate batches
    const totalBatches = Math.ceil(allRecalls.length / BATCH_SIZE);
    console.log(`\nTotal recalls to process: ${allRecalls.length}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Total batches: ${totalBatches}`);
    console.log('Estimated time: ' + Math.ceil(totalBatches * 0.2) + ' minutes\n');
    
    // Process in batches
    let successfulBatches = 0;
    let failedBatches = 0;
    let processedRecalls = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, allRecalls.length);
      const batch = allRecalls.slice(start, end);
      
      const success = await saveRecallBatch(batch, i + 1, totalBatches);
      
      if (success) {
        successfulBatches++;
        processedRecalls += batch.length;
      } else {
        failedBatches++;
      }
      
      // Progress update
      const progress = ((i + 1) / totalBatches * 100).toFixed(1);
      console.log(`Progress: ${progress}% (${processedRecalls}/${allRecalls.length} recalls)`);
      
      // Add a small delay between batches to avoid overwhelming the server
      if (i < totalBatches - 1) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Final summary
    console.log('\n=== SYNC COMPLETE ===');
    console.log(`Total recalls processed: ${processedRecalls}/${allRecalls.length}`);
    console.log(`Successful batches: ${successfulBatches}/${totalBatches}`);
    console.log(`Failed batches: ${failedBatches}/${totalBatches}`);
    
    if (failedBatches > 0) {
      console.log('\nWARNING: Some batches failed. You may want to run the sync again.');
    } else {
      console.log('\nSUCCESS: All recalls have been stored in Firebase!');
    }
    
  } catch (error) {
    console.error('\nERROR: Batch sync failed');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('Server is not running. Please start the backend server first:');
      console.error('   cd backend && npm run dev');
    } else {
      console.error('Error details:', error.message);
    }
  }
}

// Run the batch sync
runBatchSync();