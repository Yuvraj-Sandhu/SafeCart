require('dotenv').config();
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const { parseAffectedStates } = require('./state-mapping-utils');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const FDA_RECALLS_COLLECTION = 'fda_recalls';
const PROGRESS_FILE = path.join(__dirname, '.fda-import-progress.json');

// FDA API configuration
const FDA_API_BASE = 'https://api.fda.gov/food/enforcement.json';
const BATCH_SIZE = 500; // Firestore batch limit (max 500 operations per batch)

// Date range: 2023-01-01 to today
const START_DATE = '20230101';
const END_DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');

// Parse command line arguments
const args = process.argv.slice(2);
let limitRecords = null;
let resetProgress = false;

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const value = arg.substring(2);
    if (value === 'reset') {
      resetProgress = true;
    } else if (!isNaN(value)) {
      limitRecords = parseInt(value);
    }
  }
});

// Add delay function to handle rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sanitize document ID to ensure it's valid for Firestore
 * Firestore document IDs must be valid UTF-8 characters and cannot contain certain characters
 */
function sanitizeDocumentId(id) {
  if (!id || id.trim() === '') {
    return 'UNKNOWN';
  }
  
  return id
    .replace(/[\/\\\.\#\$\[\]]/g, '_') // Replace invalid characters with underscore
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .replace(/\s+/g, '_') // Replace spaces with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 1500) // Firestore document ID limit
    .trim() || 'UNKNOWN'; // Fallback if empty after sanitization
}

/**
 * Load progress from file
 */
async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
    return {
      lastSkip: 0,
      totalProcessed: 0,
      totalAvailable: null,
      lastRun: null
    };
  }
}

/**
 * Save progress to file
 */
async function saveProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Fetch FDA recalls with pagination
 */
async function fetchFDARecalls(skip = 0, limit = 1000) {
  const searchQuery = `report_date:[${START_DATE}+TO+${END_DATE}]`;
  const url = `${FDA_API_BASE}?search=${searchQuery}&limit=${limit}&skip=${skip}`;
  
  console.log(`Fetching FDA recalls: skip=${skip}, limit=${limit}`);
  console.log(`URL: ${url}`);
  
  try {
    const response = await fetch(url);
    
    // FDA API returns 404 when skip exceeds total available records
    if (response.status === 404) {
      console.log('Reached end of available FDA records (404 response)');
      return { results: [], meta: { results: { total: 0 } } };
    }
    
    if (!response.ok) {
      throw new Error(`FDA API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching FDA data:', error);
    throw error;
  }
}

/**
 * Transform FDA recall data to our schema
 */
function transformFDARecall(fdaRecall) {
  return {
    // Core FDA fields
    recall_number: fdaRecall.recall_number || '',
    event_id: fdaRecall.event_id || '',
    status: fdaRecall.status || '',
    classification: fdaRecall.classification || '',
    product_type: fdaRecall.product_type || '',
    
    // Company information
    recalling_firm: fdaRecall.recalling_firm || '',
    address_1: fdaRecall.address_1 || '',
    address_2: fdaRecall.address_2 || '',
    city: fdaRecall.city || '',
    state: fdaRecall.state || '',
    postal_code: fdaRecall.postal_code || '',
    country: fdaRecall.country || '',
    
    // Product information
    product_description: fdaRecall.product_description || '',
    product_quantity: fdaRecall.product_quantity || '',
    code_info: fdaRecall.code_info || '',
    more_code_info: fdaRecall.more_code_info || '',
    
    // Recall details
    reason_for_recall: fdaRecall.reason_for_recall || '',
    voluntary_mandated: fdaRecall.voluntary_mandated || '',
    initial_firm_notification: fdaRecall.initial_firm_notification || '',
    distribution_pattern: fdaRecall.distribution_pattern || '',
    
    // Dates (keeping as strings in YYYYMMDD format)
    recall_initiation_date: fdaRecall.recall_initiation_date || '',
    center_classification_date: fdaRecall.center_classification_date || '',
    termination_date: fdaRecall.termination_date || '',
    report_date: fdaRecall.report_date || '',
    
    // Metadata
    source: 'FDA',
    api_version: 'openFDA',
    imported_at: admin.firestore.FieldValue.serverTimestamp(),
    
    // Searchable arrays (now returns full state names like USDA format)
    affectedStatesArray: parseAffectedStates(fdaRecall.distribution_pattern || ''),
    
    // Store original OpenFDA data if needed
    openfda: fdaRecall.openfda || {},
  };
}


/**
 * Save recalls to Firestore in batches
 */
async function saveRecallsBatch(recalls, overwrite = false) {
  const batches = [];
  let currentBatch = db.batch();
  let operationCount = 0;
  
  console.log(`Preparing to save ${recalls.length} recalls to Firestore...`);
  
  for (const recall of recalls) {
    // Create a safe document ID by sanitizing recall_number and event_id
    const recallNumber = sanitizeDocumentId(recall.recall_number || 'UNKNOWN');
    const eventId = sanitizeDocumentId(recall.event_id || 'UNKNOWN');
    const docId = `${recallNumber}_${eventId}`;
    
    // Log first few doc IDs for debugging
    if (operationCount < 3) {
      console.log(`  Document ID: ${docId}`);
    }
    
    const docRef = db.collection(FDA_RECALLS_COLLECTION).doc(docId);
    // If overwrite is true (from reset), don't merge. Otherwise, merge.
    if (overwrite) {
      currentBatch.set(docRef, recall);
    } else {
      currentBatch.set(docRef, recall, { merge: true });
    }
    operationCount++;
    
    if (operationCount >= BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      operationCount = 0;
    }
  }
  
  if (operationCount > 0) {
    batches.push(currentBatch);
  }
  
  // Execute all batches
  console.log(`Saving ${recalls.length} recalls in ${batches.length} batch(es)...`);
  
  for (let i = 0; i < batches.length; i++) {
    try {
      await batches[i].commit();
      console.log(`✓ Committed batch ${i + 1}/${batches.length}`);
    } catch (error) {
      console.error(`✗ Failed to commit batch ${i + 1}/${batches.length}:`, error);
      
      // Log more details about the error
      if (error.code) {
        console.error(`  Error code: ${error.code}`);
      }
      if (error.details) {
        console.error(`  Error details: ${JSON.stringify(error.details)}`);
      }
      
      // Re-throw to trigger the retry logic in main()
      throw error;
    }
  }
}

/**
 * Main function to fetch and store FDA recalls
 */
async function main() {
  console.log('Starting FDA recall data import...');
  console.log(`Date range: ${START_DATE} to ${END_DATE}`);
  
  if (limitRecords) {
    console.log(`Limit: ${limitRecords} records per run`);
  }
  
  // Load or reset progress
  let progress = await loadProgress();
  
  if (resetProgress) {
    console.log('Resetting progress...');
    progress = {
      lastSkip: 0,
      totalProcessed: 0,
      totalAvailable: null,
      lastRun: null
    };
    await saveProgress(progress);
  }
  
  if (progress.totalProcessed > 0) {
    console.log(`Resuming from skip=${progress.lastSkip}, already processed: ${progress.totalProcessed}`);
  }
  
  let skip = progress.lastSkip;
  let totalProcessed = progress.totalProcessed;
  let totalSaved = 0;
  let recordsThisRun = 0;
  let hasMore = true;
  
  try {
    while (hasMore) {
      try {
        // Determine how many records to fetch
        let fetchLimit = 1000; // FDA max
        if (limitRecords && (recordsThisRun + fetchLimit > limitRecords)) {
          fetchLimit = limitRecords - recordsThisRun;
          if (fetchLimit <= 0) {
            console.log(`\nReached limit of ${limitRecords} records for this run`);
            break;
          }
        }
        
        // Fetch data from FDA API
        const response = await fetchFDARecalls(skip, fetchLimit);
        
        if (!response.results || response.results.length === 0) {
          console.log('No more results to fetch');
          hasMore = false;
          break;
        }
        
        const totalAvailable = response.meta?.results?.total || 0;
        
        // Update progress with total available if not set
        if (progress.totalAvailable === null) {
          progress.totalAvailable = totalAvailable;
        }
        
        console.log(`Total FDA recalls available: ${totalAvailable}`);
        console.log(`Processing ${response.results.length} recalls...`);
        
        // Transform and save recalls
        const transformedRecalls = response.results.map(transformFDARecall);
        
        // Validate transformed recalls
        const validRecalls = transformedRecalls.filter(recall => {
          if (!recall.recall_number || !recall.event_id) {
            console.warn('Skipping recall with missing recall_number or event_id:', recall);
            return false;
          }
          return true;
        });
        
        if (validRecalls.length !== transformedRecalls.length) {
          console.warn(`Filtered out ${transformedRecalls.length - validRecalls.length} invalid recalls`);
        }
        
        // If reset was used, overwrite documents completely (don't merge)
        if (validRecalls.length > 0) {
          await saveRecallsBatch(validRecalls, resetProgress);
        }
        
        recordsThisRun += response.results.length;
        totalProcessed += response.results.length;
        totalSaved += response.results.length;
        
        console.log(`Progress: ${totalProcessed}/${totalAvailable} recalls processed`);
        
        // Update and save progress
        progress.lastSkip = skip + response.results.length;
        progress.totalProcessed = totalProcessed;
        progress.lastRun = new Date().toISOString();
        await saveProgress(progress);
        
        // Check if we've reached the limit for this run
        if (limitRecords && recordsThisRun >= limitRecords) {
          console.log(`\nReached limit of ${limitRecords} records for this run`);
          hasMore = false;
          break;
        }
        
        // Check if there are more records to fetch
        if (totalProcessed >= totalAvailable || response.results.length < fetchLimit) {
          hasMore = false;
          console.log('\nAll available records have been processed');
        } else {
          skip += response.results.length;
          
          // Double-check if skip exceeds total available
          if (totalAvailable > 0 && skip >= totalAvailable) {
            console.log(`\nSkip value (${skip}) exceeds total available (${totalAvailable}). Stopping.`);
            hasMore = false;
          } else {
            // Add delay to avoid rate limiting
            await delay(1000);
          }
        }
        
      } catch (error) {
        console.error(`Error processing batch at skip=${skip}:`, error);
        // Save progress before retry
        progress.lastSkip = skip;
        progress.totalProcessed = totalProcessed;
        await saveProgress(progress);
        
        // Retry logic
        console.log('Retrying in 5 seconds...');
        await delay(5000);
      }
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Records processed this run: ${recordsThisRun}`);
    console.log(`Total records processed overall: ${totalProcessed}`);
    if (progress.totalAvailable) {
      console.log(`Total records available: ${progress.totalAvailable}`);
      console.log(`Remaining: ${progress.totalAvailable - totalProcessed}`);
    }
    console.log(`Collection: ${FDA_RECALLS_COLLECTION}`);
    
    if (limitRecords && progress.totalAvailable && totalProcessed < progress.totalAvailable) {
      console.log(`\nTo continue importing, run the command again:`);
      console.log(`node fetch-fda-recalls.js --${limitRecords}`);
    }
    
  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the import
main().catch(console.error);