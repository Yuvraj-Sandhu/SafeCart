const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  // Check required environment variables
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is not set in environment variables');
  }
  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    throw new Error('FIREBASE_CLIENT_EMAIL is not set in environment variables');
  }
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('FIREBASE_PRIVATE_KEY is not set in environment variables');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();

// Helper function to parse states from field_states
function parseStates(statesString) {
  if (!statesString) return [];
  
  // Handle different formats
  const states = statesString
    .split(',')
    .map(state => state.trim())
    .filter(state => state.length > 0)
    .map(state => {
      // Handle "Nationwide" specifically
      if (state.toLowerCase().includes('nationwide')) {
        return 'Nationwide';
      }
      // Remove any extra text and get just the state name
      return state.replace(/\([^)]*\)/g, '').trim();
    });
  
  return [...new Set(states)]; // Remove duplicates
}

// Helper function to get years from date range
function getYearsInRange(startYear, endYear) {
  const years = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  return years;
}

// Helper function to format FDA date (YYYYMMDD) to YYYY-MM-DD
function formatFDADate(fdaDateString) {
  if (!fdaDateString || fdaDateString.length !== 8) return null;
  
  const year = fdaDateString.substring(0, 4);
  const month = fdaDateString.substring(4, 6);
  const day = fdaDateString.substring(6, 8);
  
  return `${year}-${month}-${day}`;
}

// Main analysis function
async function analyzeStateStatistics() {
  console.log('Starting state statistics analysis with USDA and FDA data...');
  
  try {
    // Fetch USDA recalls from Firestore
    console.log('Fetching USDA recalls from database...');
    const usdaRecallsRef = db.collection('recalls');
    const usdaSnapshot = await usdaRecallsRef.where('langcode', '==', 'English').get();
    
    console.log(`Found ${usdaSnapshot.size} USDA recalls`);
    
    const usdaRecalls = [];
    usdaSnapshot.forEach(doc => {
      const data = doc.data();
      usdaRecalls.push({
        ...data,
        id: doc.id,
        source: 'USDA'
      });
    });

    // Fetch FDA recalls from Firestore
    console.log('Fetching FDA recalls from database...');
    const fdaRecallsRef = db.collection('fda_recalls');
    const fdaSnapshot = await fdaRecallsRef.get();
    
    console.log(`Found ${fdaSnapshot.size} FDA recalls`);
    
    const fdaRecalls = [];
    fdaSnapshot.forEach(doc => {
      const data = doc.data();
      fdaRecalls.push({
        ...data,
        id: doc.id,
        source: 'FDA',
        // Map FDA fields to USDA structure for consistency
        field_recall_date: data.report_date ? formatFDADate(data.report_date) : null,
        field_states: data.affectedStatesArray ? data.affectedStatesArray.join(', ') : ''
      });
    });

    // Combine both datasets
    const allRecalls = [...usdaRecalls, ...fdaRecalls];
    console.log(`Total combined recalls: ${allRecalls.length} (${usdaRecalls.length} USDA + ${fdaRecalls.length} FDA)`);
    
    if (allRecalls.length === 0) {
      console.log('No recalls found in database');
      return;
    }
    
    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Define time periods - only 2023 to today as requested
    const timeframes = [
      {
        name: '2023_to_today_combined',
        startYear: 2023,
        endYear: currentYear,
        description: '2023 to Today (USDA + FDA Combined)'
      }
    ];
    
    console.log('Analyzing recalls by timeframe and state...');
    
    for (const timeframe of timeframes) {
      console.log(`\nAnalyzing: ${timeframe.description} (${timeframe.startYear}-${timeframe.endYear})`);
      
      // Filter recalls for this timeframe
      const timeframeRecalls = allRecalls.filter(recall => {
        if (!recall.field_recall_date) return false;
        const recallDate = new Date(recall.field_recall_date);
        const recallYear = recallDate.getFullYear();
        return recallYear >= timeframe.startYear && recallYear <= timeframe.endYear;
      });
      
      console.log(`Recalls in timeframe: ${timeframeRecalls.length}`);
      
      // Count recalls by state with source tracking
      const stateStats = {};
      const yearsInRange = getYearsInRange(timeframe.startYear, timeframe.endYear);
      
      // First pass: collect nationwide recalls
      const nationwideStats = {
        totalRecalls: 0,
        usdaRecalls: 0,
        fdaRecalls: 0,
        yearlyRecalls: {}
      };
      
      // Initialize nationwide yearly counts
      yearsInRange.forEach(year => {
        nationwideStats.yearlyRecalls[year] = {
          total: 0,
          usda: 0,
          fda: 0
        };
      });
      
      timeframeRecalls.forEach(recall => {
        const states = parseStates(recall.field_states);
        const isUSDA = recall.source === 'USDA';
        const isFDA = recall.source === 'FDA';
        
        // Check if this recall includes "Nationwide"
        if (states.includes('Nationwide')) {
          nationwideStats.totalRecalls++;
          if (isUSDA) nationwideStats.usdaRecalls++;
          if (isFDA) nationwideStats.fdaRecalls++;
          
          const recallYear = new Date(recall.field_recall_date).getFullYear();
          if (nationwideStats.yearlyRecalls[recallYear] !== undefined) {
            nationwideStats.yearlyRecalls[recallYear].total++;
            if (isUSDA) nationwideStats.yearlyRecalls[recallYear].usda++;
            if (isFDA) nationwideStats.yearlyRecalls[recallYear].fda++;
          }
        }
        
        states.forEach(state => {
          // Skip "Nationwide" - we'll add its counts to other states
          if (state === 'Nationwide') return;
          
          if (!stateStats[state]) {
            stateStats[state] = {
              totalRecalls: 0,
              usdaRecalls: 0,
              fdaRecalls: 0,
              yearlyRecalls: {}
            };
            
            // Initialize yearly counts
            yearsInRange.forEach(year => {
              stateStats[state].yearlyRecalls[year] = {
                total: 0,
                usda: 0,
                fda: 0
              };
            });
          }
          
          stateStats[state].totalRecalls++;
          if (isUSDA) stateStats[state].usdaRecalls++;
          if (isFDA) stateStats[state].fdaRecalls++;
          
          // Add to yearly count
          const recallYear = new Date(recall.field_recall_date).getFullYear();
          if (stateStats[state].yearlyRecalls[recallYear] !== undefined) {
            stateStats[state].yearlyRecalls[recallYear].total++;
            if (isUSDA) stateStats[state].yearlyRecalls[recallYear].usda++;
            if (isFDA) stateStats[state].yearlyRecalls[recallYear].fda++;
          }
        });
      });
      
      // Second pass: add nationwide counts to each state
      Object.keys(stateStats).forEach(state => {
        stateStats[state].totalRecalls += nationwideStats.totalRecalls;
        stateStats[state].usdaRecalls += nationwideStats.usdaRecalls;
        stateStats[state].fdaRecalls += nationwideStats.fdaRecalls;
        
        yearsInRange.forEach(year => {
          stateStats[state].yearlyRecalls[year].total += nationwideStats.yearlyRecalls[year].total;
          stateStats[state].yearlyRecalls[year].usda += nationwideStats.yearlyRecalls[year].usda;
          stateStats[state].yearlyRecalls[year].fda += nationwideStats.yearlyRecalls[year].fda;
        });
      });
      
      console.log(`Found ${nationwideStats.totalRecalls} nationwide recalls that will be added to each state's count`);
      
      // Calculate averages and create final dataset
      const stateResults = [];
      
      Object.entries(stateStats).forEach(([state, stats]) => {
        const totalYears = yearsInRange.length;
        const averageRecalls = stats.totalRecalls / totalYears;
        const averageUSDA = stats.usdaRecalls / totalYears;
        const averageFDA = stats.fdaRecalls / totalYears;
        
        const yearlyData = {};
        yearsInRange.forEach(year => {
          yearlyData[`${year}_Total`] = stats.yearlyRecalls[year].total;
          yearlyData[`${year}_USDA`] = stats.yearlyRecalls[year].usda;
          yearlyData[`${year}_FDA`] = stats.yearlyRecalls[year].fda;
        });
        
        stateResults.push({
          state: state,
          totalRecalls: stats.totalRecalls,
          usdaRecalls: stats.usdaRecalls,
          fdaRecalls: stats.fdaRecalls,
          averageRecalls: Math.round(averageRecalls * 100) / 100,
          averageUSDA: Math.round(averageUSDA * 100) / 100,
          averageFDA: Math.round(averageFDA * 100) / 100,
          ...yearlyData
        });
      });
      
      // Sort by total recalls (descending)
      stateResults.sort((a, b) => b.totalRecalls - a.totalRecalls);
      
      console.log(`States found: ${stateResults.length}`);
      console.log(`Nationwide recalls: ${nationwideStats.totalRecalls} (${nationwideStats.usdaRecalls} USDA + ${nationwideStats.fdaRecalls} FDA)`);
      
      // Create CSV content with enhanced headers
      const yearlyHeaders = yearsInRange.flatMap(year => [
        `${year} Total`,
        `${year} USDA`, 
        `${year} FDA`
      ]);
      
      const headers = [
        'State', 
        'Total Recalls', 
        'USDA Recalls', 
        'FDA Recalls',
        'Avg Total/Year',
        'Avg USDA/Year', 
        'Avg FDA/Year',
        ...yearlyHeaders
      ];
      const csvRows = [headers.join(',')];
      
      stateResults.forEach(result => {
        const yearlyValues = yearsInRange.flatMap(year => [
          result[`${year}_Total`] || 0,
          result[`${year}_USDA`] || 0,
          result[`${year}_FDA`] || 0
        ]);
        
        const row = [
          `"${result.state}"`,
          result.totalRecalls,
          result.usdaRecalls,
          result.fdaRecalls,
          result.averageRecalls,
          result.averageUSDA,
          result.averageFDA,
          ...yearlyValues
        ];
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      
      // Write CSV file
      const filename = `state-recall-statistics-${timeframe.name}.csv`;
      const filepath = path.join(__dirname, filename);
      fs.writeFileSync(filepath, csvContent);
      
      console.log(`✅ CSV file created: ${filename}`);
      console.log(`📊 Top 5 states for ${timeframe.description}:`);
      
      stateResults.slice(0, 5).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.state}: ${result.totalRecalls} total (${result.usdaRecalls} USDA + ${result.fdaRecalls} FDA) - ${result.averageRecalls} avg/year`);
      });
      
      // Show some statistics
      const totalUSDA = stateResults.reduce((sum, r) => sum + r.usdaRecalls, 0);
      const totalFDA = stateResults.reduce((sum, r) => sum + r.fdaRecalls, 0);
      const totalRecalls = stateResults.reduce((sum, r) => sum + r.totalRecalls, 0);
      
      console.log(`📈 Statistics for ${timeframe.description}:`);
      console.log(`   • Total unique states/regions: ${stateResults.length}`);
      console.log(`   • Total recall instances: ${totalRecalls} (${totalUSDA} USDA + ${totalFDA} FDA)`);
      console.log(`   • Highest single state: ${stateResults[0]?.state} (${stateResults[0]?.totalRecalls} recalls)`);
      console.log(`   • Lowest single state: ${stateResults[stateResults.length - 1]?.state} (${stateResults[stateResults.length - 1]?.totalRecalls} recalls)`);
      console.log(`   • USDA vs FDA ratio: ${Math.round((totalUSDA / totalFDA) * 100) / 100}:1`);
    }
    
    console.log('\n✅ State statistics analysis completed!');
    console.log('\nFiles created:');
    console.log('  - state-recall-statistics-2023_to_today.csv');
    console.log('  - state-recall-statistics-last_10_years.csv');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  }
}

// Helper function to display sample of data
function displaySample(data, title) {
  console.log(`\n${title}:`);
  console.log('Sample of first 3 records:');
  data.slice(0, 3).forEach((record, index) => {
    console.log(`${index + 1}. ${JSON.stringify(record, null, 2)}`);
  });
}

// Run the analysis
if (require.main === module) {
  analyzeStateStatistics()
    .then(() => {
      console.log('\nAnalysis complete. Exiting...');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { analyzeStateStatistics };