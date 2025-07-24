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

// Main analysis function
async function analyzeStateStatistics() {
  console.log('Starting state statistics analysis...');
  
  try {
    // Fetch all English recalls from Firestore
    console.log('Fetching recalls from database...');
    const recallsRef = db.collection('recalls');
    const snapshot = await recallsRef.where('langcode', '==', 'English').get();
    
    if (snapshot.empty) {
      console.log('No recalls found in database');
      return;
    }
    
    console.log(`Found ${snapshot.size} recalls`);
    
    const recalls = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      recalls.push({
        ...data,
        id: doc.id
      });
    });
    
    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Define time periods
    const timeframes = [
      {
        name: '2023_to_today',
        startYear: 2023,
        endYear: currentYear,
        description: '2023 to Today'
      },
      {
        name: 'last_10_years',
        startYear: currentYear - 9, // Last 10 years including current year
        endYear: currentYear,
        description: 'Last 10 Years'
      }
    ];
    
    console.log('Analyzing recalls by timeframe and state...');
    
    for (const timeframe of timeframes) {
      console.log(`\nAnalyzing: ${timeframe.description} (${timeframe.startYear}-${timeframe.endYear})`);
      
      // Filter recalls for this timeframe
      const timeframeRecalls = recalls.filter(recall => {
        if (!recall.field_recall_date) return false;
        const recallDate = new Date(recall.field_recall_date);
        const recallYear = recallDate.getFullYear();
        return recallYear >= timeframe.startYear && recallYear <= timeframe.endYear;
      });
      
      console.log(`Recalls in timeframe: ${timeframeRecalls.length}`);
      
      // Count recalls by state
      const stateStats = {};
      const yearsInRange = getYearsInRange(timeframe.startYear, timeframe.endYear);
      
      // First pass: collect nationwide recalls
      const nationwideStats = {
        totalRecalls: 0,
        yearlyRecalls: {}
      };
      
      // Initialize nationwide yearly counts
      yearsInRange.forEach(year => {
        nationwideStats.yearlyRecalls[year] = 0;
      });
      
      timeframeRecalls.forEach(recall => {
        const states = parseStates(recall.field_states);
        
        // Check if this recall includes "Nationwide"
        if (states.includes('Nationwide')) {
          nationwideStats.totalRecalls++;
          const recallYear = new Date(recall.field_recall_date).getFullYear();
          if (nationwideStats.yearlyRecalls[recallYear] !== undefined) {
            nationwideStats.yearlyRecalls[recallYear]++;
          }
        }
        
        states.forEach(state => {
          // Skip "Nationwide" - we'll add its counts to other states
          if (state === 'Nationwide') return;
          
          if (!stateStats[state]) {
            stateStats[state] = {
              totalRecalls: 0,
              yearlyRecalls: {}
            };
            
            // Initialize yearly counts
            yearsInRange.forEach(year => {
              stateStats[state].yearlyRecalls[year] = 0;
            });
          }
          
          stateStats[state].totalRecalls++;
          
          // Add to yearly count
          const recallYear = new Date(recall.field_recall_date).getFullYear();
          if (stateStats[state].yearlyRecalls[recallYear] !== undefined) {
            stateStats[state].yearlyRecalls[recallYear]++;
          }
        });
      });
      
      // Second pass: add nationwide counts to each state
      Object.keys(stateStats).forEach(state => {
        stateStats[state].totalRecalls += nationwideStats.totalRecalls;
        
        yearsInRange.forEach(year => {
          stateStats[state].yearlyRecalls[year] += nationwideStats.yearlyRecalls[year];
        });
      });
      
      console.log(`Found ${nationwideStats.totalRecalls} nationwide recalls that will be added to each state's count`);
      
      // Calculate averages and create final dataset
      const stateResults = [];
      
      Object.entries(stateStats).forEach(([state, stats]) => {
        const totalYears = yearsInRange.length;
        const averageRecalls = stats.totalRecalls / totalYears;
        
        stateResults.push({
          state: state,
          totalRecalls: stats.totalRecalls,
          averageRecalls: Math.round(averageRecalls * 100) / 100, // Round to 2 decimal places
          ...stats.yearlyRecalls
        });
      });
      
      // Sort by total recalls (descending)
      stateResults.sort((a, b) => b.totalRecalls - a.totalRecalls);
      
      console.log(`States found: ${stateResults.length}`);
      
      // Create CSV content
      const headers = ['State', 'Total Recalls', 'Average Recalls per Year', ...yearsInRange.map(year => `${year} Recalls`)];
      const csvRows = [headers.join(',')];
      
      stateResults.forEach(result => {
        const row = [
          `"${result.state}"`,
          result.totalRecalls,
          result.averageRecalls,
          ...yearsInRange.map(year => result[year] || 0)
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
        console.log(`   ${index + 1}. ${result.state}: ${result.totalRecalls} total (${result.averageRecalls} avg/year)`);
      });
      
      // Show some statistics
      console.log(`📈 Statistics for ${timeframe.description}:`);
      console.log(`   • Total unique states/regions: ${stateResults.length}`);
      console.log(`   • Total recall instances: ${stateResults.reduce((sum, r) => sum + r.totalRecalls, 0)}`);
      console.log(`   • Highest single state: ${stateResults[0]?.state} (${stateResults[0]?.totalRecalls} recalls)`);
      console.log(`   • Lowest single state: ${stateResults[stateResults.length - 1]?.state} (${stateResults[stateResults.length - 1]?.totalRecalls} recalls)`);
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