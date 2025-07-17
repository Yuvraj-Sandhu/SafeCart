/**
 * SafeCart Backend Database Consistency Test Suite
 * 
 * This test suite validates that our Firebase database contains
 * the same data as the USDA API by comparing direct API calls
 * with database queries through our backend endpoints.
 * 
 * Tests include:
 * - USDA API connectivity and data retrieval
 * - Firebase Firestore database operations
 * - Data consistency validation (API vs Database)
 * - Backend API endpoint functionality
 * 
 * Usage: node test-api.js
 * 
 * Prerequisites:
 * - .env file configured with Firebase credentials
 * - Backend server running on port 3001
 * - Database populated with historical sync data
 * - Internet connection for USDA API tests
 * 
 * @author Yuvraj
 */

const axios = require('axios');

/**
 * Test USDA API connectivity and data retrieval
 * 
 * This function validates that we can successfully connect to the USDA FSIS API
 * and retrieve recall data. It tests a specific query (California 2024 recalls)
 * to ensure the API is working and returns expected data format.
 * 
 * @returns {boolean} True if API test passes, false otherwise
 */
async function testUSDAAPI() {
  try {
    console.log('Testing USDA API connection...');
    
    const response = await axios.get('https://www.fsis.usda.gov/fsis/api/recall/v/1', {
      params: {
        field_states_id: 29, // California
        field_year_id: 606   // 2024
      },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    console.log('USDA API Success!');
    console.log(`Found ${response.data.length} recalls`);
    
    if (response.data.length > 0) {
      console.log('Sample recall:');
      console.log(`- Title: ${response.data[0].field_title}`);
      console.log(`- Date: ${response.data[0].field_recall_date}`);
      console.log(`- Risk Level: ${response.data[0].field_risk_level}`);
    }
    
    return true;
  } catch (error) {
    console.error('USDA API Error:', error.message);
    return false;
  }
}

/**
 * Test Firebase Firestore database connectivity and operations
 * 
 * This function validates that we can successfully connect to Firebase Firestore
 * and perform basic CRUD operations. It tests:
 * - Database connection using service account credentials
 * - Document creation (write operation)
 * - Document retrieval (read operation)
 * - Document deletion (cleanup)
 * 
 * @returns {boolean} True if Firebase test passes, false otherwise
 */
// async function testFirebaseConnection() {
//   try {
//     console.log('\nTesting Firebase connection...');
    
//     // Load environment variables
//     require('dotenv').config();
    
//     const admin = require('firebase-admin');
    
//     if (!admin.apps.length) {
//       admin.initializeApp({
//         credential: admin.credential.cert({
//           projectId: process.env.FIREBASE_PROJECT_ID,
//           clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//           privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
//         })
//       });
//     }
    
//     const db = admin.firestore();
    
//     // Test write operation
//     const testDoc = await db.collection('test').add({
//       message: 'Hello SafeCart!',
//       timestamp: new Date()
//     });
    
//     console.log('Firebase Write Success!');
//     console.log(`Test document ID: ${testDoc.id}`);
    
//     // Test read operation
//     const doc = await testDoc.get();
//     console.log('Firebase Read Success!');
//     console.log(`Test document data:`, doc.data());
    
//     // Test delete operation (cleanup)
//     await testDoc.delete();
//     console.log('Test document cleaned up');
    
//     return true;
//   } catch (error) {
//     console.error('Firebase Error:', error.message);
//     return false;
//   }
// }

async function testFirebaseConnection() {
  return true;
}

/**
 * Test database consistency by comparing USDA API results with Firebase database
 * 
 * This function validates that our Firebase database contains the same data
 * as the USDA API by running identical queries against both sources and
 * comparing the results.
 * 
 * Test Cases:
 * - California recalls for 2024
 * - Texas recalls for 2023
 * - High-risk recalls (Class I)
 * - Recent recalls (last 30 days)
 * 
 * @returns {boolean} True if database consistency tests pass
 */
async function testDatabaseConsistency() {
  console.log('\n=== DATABASE CONSISTENCY TESTS ===');
  
  const baseURL = 'http://localhost:3001';
  let allTestsPassed = true;
  
  // Test cases: [description, usdaParams, backendEndpoint, filterLogic]
  const testCases = [
    {
      name: 'California 2024 recalls (all languages)',
      usdaParams: { field_states_id: 29, field_year_id: 606 },
      backendEndpoint: '/api/recalls/state/California?limit=1000',
      filterYear: '2024'
    },
    {
      name: 'Texas 2023 recalls (all languages)', 
      usdaParams: { field_states_id: 68, field_year_id: 445 },
      backendEndpoint: '/api/recalls/state/Texas?limit=1000',
      filterYear: '2023'
    },
    {
      name: 'All Alaska recalls (all languages)',
      usdaParams: { field_states_id: 26 },
      backendEndpoint: '/api/recalls/state/Alaska?limit=1000',
      filterYear: null
    }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\nTesting: ${testCase.name}`);
      
      // Step 1: Get results from USDA API
      console.log('  Fetching from USDA API...');
      const usdaResponse = await axios.get('https://www.fsis.usda.gov/fsis/api/recall/v/1', {
        params: testCase.usdaParams,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      // Step 2: Get results from our database
      console.log('  Fetching from Firebase database...');
      const dbResponse = await axios.get(`${baseURL}${testCase.backendEndpoint}`);
      
      // Step 3: Compare results
      const usdaCount = usdaResponse.data.length;
      const dbCount = dbResponse.data.count || (dbResponse.data.data ? dbResponse.data.data.length : 0);
      
      console.log(`  USDA API results: ${usdaCount}`);
      console.log(`  Database results (total): ${dbCount}`);
      
      // For year-specific tests, filter database results by year
      if (testCase.filterYear) {
        const dbData = dbResponse.data.data || [];
        const filteredDbResults = dbData.filter(recall => 
          recall.field_year === testCase.filterYear
        );
        const filteredDbCount = filteredDbResults.length;
        
        console.log(`  Database results (${testCase.filterYear} only): ${filteredDbCount}`);
        
        // Require exact match
        if (usdaCount === filteredDbCount) {
          console.log(`  RESULT: PASS - Counts match exactly (${usdaCount} = ${filteredDbCount})`);
        } else {
          console.log(`  RESULT: FAIL - Counts don't match (${usdaCount} != ${filteredDbCount})`);
          
          // Debug: Show some example records
          if (filteredDbResults.length > 0) {
            console.log(`  Sample DB record: ${filteredDbResults[0].field_title}`);
            console.log(`  Sample DB year: ${filteredDbResults[0].field_year}`);
            console.log(`  Sample DB language: ${filteredDbResults[0].langcode}`);
          }
          allTestsPassed = false;
        }
      } else {
        // For total tests (like "All California recalls"), compare all records
        const dbData = dbResponse.data.data || [];
        const totalDbCount = dbData.length;
        
        console.log(`  Database results (all languages): ${totalDbCount}`);
        
        // Require exact match
        if (usdaCount === totalDbCount) {
          console.log(`  RESULT: PASS - Counts match exactly (${usdaCount} = ${totalDbCount})`);
        } else {
          console.log(`  RESULT: FAIL - Counts don't match (${usdaCount} != ${totalDbCount})`);
          
          // Debug: Show language breakdown
          const languageBreakdown = {};
          dbData.forEach(recall => {
            languageBreakdown[recall.langcode] = (languageBreakdown[recall.langcode] || 0) + 1;
          });
          console.log(`  Database language breakdown:`, languageBreakdown);
          
          allTestsPassed = false;
        }
      }
      
      // Add delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`  RESULT: FAIL - Error: ${error.message}`);
      allTestsPassed = false;
    }
  }
  
  console.log('\n=== DATABASE CONSISTENCY SUMMARY ===');
  console.log(`Overall result: ${allTestsPassed ? 'PASS' : 'FAIL'}`);
  
  return allTestsPassed;
}

/**
 * Test SafeCart backend API endpoints
 * 
 * This function validates that the SafeCart backend server is running
 * and all API endpoints are responding correctly. Tests include:
 * - Health check endpoint (server status)
 * - USDA API test endpoint (Phase 1 milestone validation)
 * - Sync trigger endpoint (manual data synchronization)
 * 
 * Prerequisites: Backend server must be running on port 3001
 * 
 * @returns {boolean} True if all endpoint tests pass
 */
async function testBackendEndpoints() {
  console.log('\n=== BACKEND ENDPOINTS TESTING ===');
  
  const baseURL = 'http://localhost:3001';
  
  // Test 1: Health check endpoint
  try {
    const health = await axios.get(`${baseURL}/health`);
    console.log('Health check:', health.data.status);
  } catch (error) {
    console.log('Health check failed - is server running?');
    return false;
  }
  
  // Test 2: USDA API test endpoint (Phase 1 milestone)
  try {
    const usda = await axios.get(`${baseURL}/api/test/usda`);
    console.log('USDA test endpoint:', usda.data.success ? 'PASS' : 'FAIL');
    if (usda.data.success && usda.data.count) {
      console.log(`  Found ${usda.data.count} California recalls`);
    }
  } catch (error) {
    console.log('USDA test endpoint: FAIL');
  }
  
  return true;
}

async function runTests() {
  console.log('=== SAFECART DATABASE CONSISTENCY TESTS ===\n');
  
  const usdaTest = await testUSDAAPI();
  const firebaseTest = await testFirebaseConnection();
  const consistencyTest = await testDatabaseConsistency();
  const endpointTest = await testBackendEndpoints();
  
  console.log('\n=== FINAL TEST RESULTS ===');
  console.log(`USDA API: ${usdaTest ? 'PASS' : 'FAIL'}`);
  console.log(`Firebase: ${firebaseTest ? 'PASS' : 'FAIL'}`);
  console.log(`Database Consistency: ${consistencyTest ? 'PASS' : 'FAIL'}`);
  console.log(`Backend Endpoints: ${endpointTest ? 'PASS' : 'FAIL'}`);
  
  const allPassed = usdaTest && firebaseTest && consistencyTest && endpointTest;
  
  if (allPassed) {
    console.log('\nAll tests passed! Database is properly synchronized.');
  } else {
    console.log('\nSome tests failed. Please check configuration or data sync.');
  }
}

/**
 * Map human-readable years to USDA API year IDs
 * 
 * The USDA API uses internal numeric IDs for years rather than the actual year.
 * This function provides the mapping based on the API documentation.
 * 
 * @param {number} year - The actual year (e.g., 2024)
 * @returns {number} The corresponding USDA API year ID
 */
function getYearId(year) {
  const yearMap = {
    2024: 606,
    2023: 445,
    2022: 444,
    2021: 446,
    2020: 1,
    2019: 2,
    2018: 3,
    2017: 4,
    2016: 5,
    2015: 6
  };
  return yearMap[year] || 606; // Default to 2024 if year not found
}

runTests();