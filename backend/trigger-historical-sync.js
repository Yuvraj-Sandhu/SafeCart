/**
 * Trigger Historical Data Sync
 * 
 * This script triggers the historical sync endpoint to populate
 * the Firebase database with all existing USDA recall data.
 * 
 * Usage: node trigger-historical-sync.js
 * 
 * Prerequisites:
 * - Backend server running on port 3001
 * - Firebase credentials configured
 * - Stable internet connection
 */

const axios = require('axios');

async function triggerHistoricalSync() {
  console.log('=== SAFECART HISTORICAL DATA SYNC ===\n');
  
  const baseURL = 'http://localhost:3001';
  
  try {
    // Check if server is running
    console.log('Checking server status...');
    const health = await axios.get(`${baseURL}/health`);
    console.log(`Server status: ${health.data.status}`);
    
    // Trigger historical sync for ALL available data
    console.log('\nTriggering complete historical sync...');
    console.log('This will populate the database with ALL USDA recall data.');
    console.log('Expected: ~1,963 records from ALL states and ALL years');
    console.log('Estimated time: 10-15 minutes\n');
    
    const syncResponse = await axios.post(`${baseURL}/api/sync/historical`, {
      years: 60 // Sync all available years (USDA data goes back to 1970s)
    });
    
    if (syncResponse.data.success) {
      console.log('SUCCESS: Historical sync started successfully!');
      console.log('INFO: Check server logs for progress updates');
      console.log('INFO: Sync is running in background');
      
      // Monitor sync progress
      console.log('\nMonitoring sync progress...');
      console.log('(This is a background process - you can stop monitoring anytime)');
      
      let attempts = 0;
      const maxAttempts = 30; // Monitor for 5 minutes
      
      while (attempts < maxAttempts) {
        try {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          
          // Check if we can query some data (indicates sync progress)
          const recentCheck = await axios.get(`${baseURL}/api/recalls/recent?limit=5`);
          
          if (recentCheck.data.success && recentCheck.data.count > 0) {
            console.log(`Progress: ${recentCheck.data.count} recalls available in database`);
          }
          
          attempts++;
        } catch (error) {
          console.log('INFO: Sync still in progress...');
          attempts++;
        }
      }
      
      console.log('\nSUCCESS: Historical sync process initiated successfully!');
      console.log('INFO: The sync will continue running in the background');
      console.log('INFO: Check your Firebase console to see data being populated');
      
    } else {
      console.error('ERROR: Failed to start historical sync');
      console.error('Error:', syncResponse.data.error);
    }
    
  } catch (error) {
    console.error('ERROR: Error during historical sync:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('ERROR: Server is not running. Please start the backend server first:');
      console.error('   cd backend && npm run dev');
    } else {
      console.error('Error details:', error.message);
    }
  }
}

// Run the historical sync
triggerHistoricalSync();