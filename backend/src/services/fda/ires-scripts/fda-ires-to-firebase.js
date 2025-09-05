/**
 * FDA IRES to Firebase Integration
 * 
 * Main script to import IRES scraper data into Firebase
 * Handles deduplication, merging with existing data, and LLM title generation
 */

require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const FDAIRESScraper = require('./fda-ires-scraper');
const { batchTransformIRESRecalls } = require('./ires-data-transformer');
const fetch = require('node-fetch');
// Import OpenAI service for LLM title generation
const { openAIService } = require('../../openai.service');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();
const FDA_RECALLS_COLLECTION = 'fda_recalls';
const BATCH_SIZE = 500; // Firestore batch limit

/**
 * Process and save IRES recalls to Firebase
 * Handles deduplication and preserves manual overrides
 */
async function saveIRESRecallsToFirebase(recalls) {
  if (!recalls || recalls.length === 0) {
    console.log('No recalls to save');
    return { newRecords: 0, updatedRecords: 0, skippedFDARecords: 0, errors: 0 };
  }

  const stats = {
    newRecords: 0,
    updatedRecords: 0,
    skippedFDARecords: 0, // Records skipped because they have FDA API data
    errors: 0
  };

  // Array to collect recalls that need LLM title processing
  const recallsForLLM = [];

  // Transform IRES data to FDA schema
  const transformedRecalls = batchTransformIRESRecalls(recalls);
  
  if (transformedRecalls.length === 0) {
    console.log('No valid recalls after transformation');
    return stats;
  }

  console.log(`\nProcessing ${transformedRecalls.length} transformed recalls...`);
  
  // Check for duplicate IDs
  const recallIds = transformedRecalls.map(r => r.id);
  const uniqueIds = new Set(recallIds);
  if (recallIds.length !== uniqueIds.size) {
    console.warn(`WARNING: Found duplicate recall IDs! ${recallIds.length} total, ${uniqueIds.size} unique`);
    const duplicates = recallIds.filter((id, index) => recallIds.indexOf(id) !== index);
    console.warn(`Duplicate IDs: ${duplicates.join(', ')}`);
  }

  // Process in batches
  const batches = [];
  let currentBatch = db.batch();
  let operationCount = 0;
  const processedIds = new Set();

  for (const recall of transformedRecalls) {
    try {
      // Skip if we've already processed this ID (shouldn't happen but let's check)
      if (processedIds.has(recall.id)) {
        console.warn(`  WARNING: Skipping duplicate recall ID: ${recall.id}`);
        continue;
      }
      
      const docRef = db.collection(FDA_RECALLS_COLLECTION).doc(recall.id);
      processedIds.add(recall.id);
      
      // Check if document exists
      const existingDoc = await docRef.get();
      
      if (existingDoc.exists) {
        // Document exists - check if it was updated by FDA API
        const existingData = existingDoc.data();
        
        // Skip if this recall was already updated by FDA API (more complete data)
        if (existingData.api_version === 'openFDA') {
          stats.skippedFDARecords++;
          console.log(`  Skipping ${recall.id} - already has FDA API data`);
          continue; // Don't update recalls that have FDA API data
        }
        
        // Only update if it's an IRES-imported recall
        // Start with the new IRES data
        const mergedData = { ...recall };
        
        // Preserve manual overrides and custom fields if they exist
        // Only add fields that have actual values (not undefined)
        if (existingData.display !== undefined) {
          mergedData.display = existingData.display;
          // Note: previewUrl inside display takes priority over recall_url in frontend
        }
        if (existingData.manualStatesOverride !== undefined) {
          mergedData.manualStatesOverride = existingData.manualStatesOverride;
        }
        if (existingData.useManualStates !== undefined) {
          mergedData.useManualStates = existingData.useManualStates;
        }
        if (existingData.manualStatesUpdatedBy !== undefined) {
          mergedData.manualStatesUpdatedBy = existingData.manualStatesUpdatedBy;
        }
        if (existingData.manualStatesUpdatedAt !== undefined) {
          mergedData.manualStatesUpdatedAt = existingData.manualStatesUpdatedAt;
        }
        if (existingData.llmTitle !== undefined) {
          mergedData.llmTitle = existingData.llmTitle;
        }
        
        // Remove any undefined fields from mergedData to avoid Firestore errors
        Object.keys(mergedData).forEach(key => {
          if (mergedData[key] === undefined) {
            delete mergedData[key];
          }
        });
        
        // Queue for LLM title generation if not present
        if (!mergedData.llmTitle && recall.product_description) {
          recallsForLLM.push({
            id: recall.id,
            title: recall.product_description
          });
        }
        
        currentBatch.update(docRef, mergedData);
        stats.updatedRecords++;
        
        // Log all updates for debugging
        console.log(`  Updating: ${recall.id} (operation ${operationCount + 1})`);
        
        // Log if this is one of the first few for detailed debugging
        if (operationCount < 3) {
          console.log(`    Fields being updated: ${Object.keys(mergedData).join(', ')}`);
        }
      } else {
        // New document - queue for LLM title generation
        if (recall.product_description) {
          recallsForLLM.push({
            id: recall.id,
            title: recall.product_description
          });
        }
        
        currentBatch.set(docRef, recall);
        stats.newRecords++;
        
        if (operationCount < 3) {
          console.log(`  Creating: ${recall.id}`);
        }
      }
      
      operationCount++;
      
      // Commit batch when it reaches the limit
      if (operationCount >= BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
      
    } catch (error) {
      console.error(`Error processing recall ${recall.id}:`, error.message);
      stats.errors++;
    }
  }
  
  // Add remaining batch if it has operations
  if (operationCount > 0) {
    console.log(`Adding final batch with ${operationCount} operations`);
    batches.push(currentBatch);
  }
  
  // Verify batch operations
  console.log(`\nBatch summary:`);
  console.log(`  Processed IDs: ${processedIds.size}`);
  console.log(`  Stats - New: ${stats.newRecords}, Updated: ${stats.updatedRecords}, Skipped: ${stats.skippedFDARecords}, Errors: ${stats.errors}`);
  console.log(`  Total operations in batches: ${stats.newRecords + stats.updatedRecords}`);
  
  if (processedIds.size !== transformedRecalls.length) {
    console.warn(`WARNING: Processed ${processedIds.size} unique IDs but had ${transformedRecalls.length} recalls`);
  }
  
  // Commit all batches
  console.log(`\nCommitting ${batches.length} batch(es) to Firebase...`);
  
  let totalCommitted = 0;
  for (let i = 0; i < batches.length; i++) {
    try {
      console.log(`  Committing batch ${i + 1}/${batches.length}...`);
      const commitResult = await batches[i].commit();
      console.log(`  Batch ${i + 1}/${batches.length} committed successfully`);
      totalCommitted++;
    } catch (error) {
      console.error(`Error committing batch ${i + 1}:`, error);
      console.error(`  Error details:`, error.message);
      console.error(`  Error code:`, error.code);
      if (error.details) {
        console.error(`  Error details:`, JSON.stringify(error.details));
      }
      stats.errors++;
    }
  }
  
  console.log(`Successfully committed ${totalCommitted}/${batches.length} batches`);
  
  // Process LLM titles asynchronously (non-blocking)
  if (recallsForLLM.length > 0) {
    console.log(`\nQueuing ${recallsForLLM.length} recalls for LLM title generation...`);
    processLLMTitlesForIRESRecalls(recallsForLLM).catch(error => {
      console.error('Error processing LLM titles:', error);
    });
  }
  
  return stats;
}

/**
 * Process LLM titles for IRES recalls asynchronously
 * Similar to processLLMTitlesForFDARecalls in sync.service.ts
 */
async function processLLMTitlesForIRESRecalls(recallsToProcess) {
  if (!openAIService || !openAIService.isAvailable || !openAIService.isAvailable()) {
    console.log('OpenAI service not available, skipping LLM title processing');
    return;
  }

  try {
    console.log(`Processing LLM titles for ${recallsToProcess.length} IRES recalls`);
    
    let processedCount = 0;
    let errorCount = 0;

    // Limit to 500 recalls per sync to avoid overloading OpenAI API
    const recallsToProcessLimited = recallsToProcess.slice(0, 500);

    for (const recall of recallsToProcessLimited) {
      try {
        if (!recall.title) {
          continue;
        }

        // Get enhanced title from OpenAI
        const enhancedTitle = await openAIService.enhanceRecallTitle(recall.title);
        
        if (enhancedTitle) {
          // Update the recall with the enhanced title
          await db.collection(FDA_RECALLS_COLLECTION).doc(recall.id).update({
            llmTitle: enhancedTitle
          });
          processedCount++;
          console.log(`LLM title processed for recall ${recall.id}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Failed to process LLM title for recall ${recall.id}:`, error.message);
      }
    }

    console.log(`LLM title processing complete: ${processedCount} processed, ${errorCount} errors`);
  } catch (error) {
    console.error('Error in processLLMTitlesForIRESRecalls:', error);
  }
}

/**
 * Scrape IRES website and import to Firebase
 * @param {Object} options - Scraping options
 */
async function scrapeAndImport(options = {}) {
  const {
    weeksToScan = 4,  // Scan last 4 weeks of enforcement reports
    includeNewRecalls = true, // Include new recalls since last report
    maxRecalls = null, // Process all found recalls by default
    headless = true,   // Run browser in headless mode
    debug = false      // Enable debug mode
  } = options;
  
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     FDA IRES to Firebase Import                  ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  
  const scraper = new FDAIRESScraper({
    headless,
    debug
  });
  
  try {
    // Use the new scrape method with multiple weeks support
    let scrapeOptions = {};
    
    if (weeksToScan === 0) {
      // When weeks=0, only scan new recalls
      scrapeOptions = {
        reportType: 'new',  // Only get new recalls
        weeksToScan: 0,
        maxRecalls: maxRecalls || 1000,
        includeNewRecalls: false  // Don't need this flag when reportType is 'new'
      };
      console.log('Scanning only New Recalls (weeks=0)');
    } else {
      // When weeks > 0, scan weekly reports and optionally new recalls
      scrapeOptions = {
        reportType: 'weeks',
        weeksToScan: weeksToScan,
        maxRecalls: maxRecalls || 1000,
        includeNewRecalls: includeNewRecalls
      };
    }
    
    const detailedRecalls = await scraper.scrape(scrapeOptions);
    
    if (detailedRecalls.length === 0) {
      console.log('No recalls found in IRES');
      return;
    }
    
    console.log(`\nExtracted ${detailedRecalls.length} recalls from IRES`);
    
    // Save to Firebase
    const stats = await saveIRESRecallsToFirebase(detailedRecalls);
    
    // Summary
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║                   Import Summary                 ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  New records:        ${stats.newRecords}`);
    console.log(`  Updated records:    ${stats.updatedRecords}`);
    console.log(`  Skipped (FDA data): ${stats.skippedFDARecords}`);
    console.log(`  Errors:             ${stats.errors}`);
    console.log(`  Total processed:    ${stats.newRecords + stats.updatedRecords}`);
    
    // Save scraped data to file for debugging
    if (debug) {
      const debugFile = path.join(__dirname, 'ires-import-debug.json');
      await fs.writeFile(debugFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        scraped: detailedRecalls,
        stats
      }, null, 2));
      console.log(`\nDebug data saved to ${debugFile}`);
    }
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await scraper.cleanup();
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    weeksToScan: 4,
    maxRecalls: null,
    headless: true,
    debug: false
  };
  
  args.forEach(arg => {
    if (arg === '--debug') {
      options.debug = true;
      options.headless = false; // Show browser in debug mode
    } else if (arg === '--headless=false') {
      options.headless = false;
    } else if (arg.startsWith('--weeks=')) {
      const weeks = parseInt(arg.split('=')[1]);
      // Don't use || because 0 is a valid value
      options.weeksToScan = isNaN(weeks) ? 4 : weeks;
    } else if (arg.startsWith('--limit=')) {
      options.maxRecalls = parseInt(arg.split('=')[1]) || null;
    }
  });
  
  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    
    console.log('Starting IRES import with options:');
    console.log(`  Weeks to scan: ${options.weeksToScan}`);
    console.log(`  Max recalls: ${options.maxRecalls || 'All'}`);
    console.log(`  Headless: ${options.headless}`);
    console.log(`  Debug: ${options.debug}\n`);
    
    await scrapeAndImport(options);
    
    console.log('\nImport completed successfully');
    
  } catch (error) {
    console.error('\nImport failed:', error);
    process.exit(1);
  }
}

// Export for use in sync service
module.exports = {
  scrapeAndImport,
  saveIRESRecallsToFirebase
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}