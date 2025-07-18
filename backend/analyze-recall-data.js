/**
 * Recall Data Analysis Script
 * 
 * This script analyzes Firebase recall data from 2023-2025 to identify:
 * 1. Recalls without processed images
 * 2. Recalls without URLs in field_summary
 * 3. Comprehensive statistics and breakdown
 * 
 * Usage: node analyze-recall-data.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();

/**
 * Extract label URLs from field_summary HTML
 */
function extractLabelUrls(fieldSummary) {
  if (!fieldSummary || fieldSummary.trim() === '') return [];
  
  const urls = [];
  
  // Pattern 1: Original href regex for labels (with optional 's')
  const hrefRegex = /href=["']([^"']*labels?[^"']*)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(fieldSummary)) !== null) {
    let url = match[1];
    
    // Skip anchor links to labels sections
    if (url === '#labels' || url === '#label') {
      continue;
    }
    
    if (url.startsWith('/')) {
      url = `https://www.fsis.usda.gov${url}`;
    }
    if (url.toLowerCase().includes('label')) {
      urls.push(url);
    }
  }
  
  // Pattern 2: Look for <a href="...">view label</a> or <a href="...">view labels</a> (both singular and plural)
  // Updated to handle href not being the first attribute
  const viewLabelRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*view\s+labels?\s*<\/a>/gi;
  
  while ((match = viewLabelRegex.exec(fieldSummary)) !== null) {
    let url = match[1];
    
    // Skip anchor links to labels sections
    if (url === '#labels' || url === '#label') {
      continue;
    }
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      url = `https://www.fsis.usda.gov${url}`;
    }
    
    // Handle HTML entities FIRST
    url = url.replace(/&amp;/g, '&');
    
    // Handle Outlook safe links
    if (url.includes('safelinks.protection.outlook.com')) {
      const urlMatch = url.match(/url=([^&]+)/);
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1]);
      }
    }
    
    // Only add if it's not already in the array
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  
  // Pattern 3: Also catch [<a href="...">view label</a>] or [<a href="...">view labels</a>] format (with brackets outside)
  const bracketViewLabelRegex = /\[<a[^>]*href=["']([^"']+)["'][^>]*>\s*view\s+labels?\s*<\/a>\]/gi;
  
  while ((match = bracketViewLabelRegex.exec(fieldSummary)) !== null) {
    let url = match[1];
    
    // Skip anchor links to labels sections
    if (url === '#labels' || url === '#label') {
      continue;
    }
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      url = `https://www.fsis.usda.gov${url}`;
    }
    
    // Handle HTML entities FIRST
    url = url.replace(/&amp;/g, '&');
    
    // Handle Outlook safe links
    if (url.includes('safelinks.protection.outlook.com')) {
      const urlMatch = url.match(/url=([^&]+)/);
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1]);
      }
    }
    
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  
  // Pattern 4: Also catch <a href="...">[view label]</a> or <a href="...">[view labels]</a> format (with brackets inside)
  const insideBracketViewLabelRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*\[\s*view\s+labels?\s*\]\s*<\/a>/gi;
  
  while ((match = insideBracketViewLabelRegex.exec(fieldSummary)) !== null) {
    let url = match[1];
    
    // Skip anchor links to labels sections
    if (url === '#labels' || url === '#label') {
      continue;
    }
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      url = `https://www.fsis.usda.gov${url}`;
    }
    
    // Handle HTML entities FIRST
    url = url.replace(/&amp;/g, '&');
    
    // Handle Outlook safe links
    if (url.includes('safelinks.protection.outlook.com')) {
      const urlMatch = url.match(/url=([^&]+)/);
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1]);
      }
    }
    
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  
  // Pattern 5: Links with "here" text pointing to PDF files
  const hereLinksRegex = /<a[^>]*href=["']([^"']*\.pdf[^"']*)["'][^>]*>\s*here\s*<\/a>/gi;
  
  while ((match = hereLinksRegex.exec(fieldSummary)) !== null) {
    let url = match[1];
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      url = `https://www.fsis.usda.gov${url}`;
    }
    
    // Handle HTML entities
    url = url.replace(/&amp;/g, '&');
    
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  
  // Pattern 6: Links with "product list" or similar text
  const productListRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*[^<]*product[^<]*list[^<]*<\/a>/gi;
  
  while ((match = productListRegex.exec(fieldSummary)) !== null) {
    let url = match[1];
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      url = `https://www.fsis.usda.gov${url}`;
    }
    
    // Handle HTML entities
    url = url.replace(/&amp;/g, '&');
    
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  
  // Pattern 7: PDF URLs containing relevant keywords (label, product, recall)
  const relevantPdfRegex = /<a[^>]*href=["']([^"']*(?:label|product|recall)[^"']*\.pdf[^"']*)["'][^>]*>/gi;
  
  while ((match = relevantPdfRegex.exec(fieldSummary)) !== null) {
    let url = match[1];
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      url = `https://www.fsis.usda.gov${url}`;
    }
    
    // Handle HTML entities
    url = url.replace(/&amp;/g, '&');
    
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  
  return [...new Set(urls)];
}

/**
 * Check if a recall has processed images
 */
function hasProcessedImages(recall) {
  return recall.processedImages && 
         Array.isArray(recall.processedImages) && 
         recall.processedImages.length > 0 &&
         recall.processedImages.some(img => img.type !== 'error');
}

/**
 * Check if a recall has URLs in field_summary
 */
function hasUrlsInSummary(recall) {
  const urls = extractLabelUrls(recall.field_summary || '');
  return urls.length > 0;
}

/**
 * Parse recall date and check if it's within specified range
 */
function isInDateRange(recall, startYear, endYear) {
  try {
    const recallDate = recall.field_recall_date;
    if (!recallDate) return false;
    
    // Try different date formats
    let year;
    
    // Format 2: YYYY-MM-DD
    if (recallDate.includes('-')) {
      const dateParts = recallDate.split('-');
      if (dateParts.length === 3) {
        year = parseInt(dateParts[0]);
      }
    }
    
    if (!year || isNaN(year)) return false;
    
    return year >= startYear && year <= endYear;
  } catch (error) {
    return false;
  }
}

/**
 * Main analysis function
 */
async function analyzeRecallData() {
  console.log('SAFECART RECALL DATA ANALYSIS');
  console.log('=' .repeat(50));
  console.log('Analyzing Firebase data from 2023-2025...\n');

  const startTime = Date.now();
  
  try {
    // Fetch all English recalls from Firebase
    console.log('Fetching all English recalls from Firebase...');
    const snapshot = await db.collection('recalls').where('langcode', '==', 'English').get();
    
    if (snapshot.empty) {
      console.log('No recalls found in Firebase');
      return;
    }

    console.log(`Found ${snapshot.docs.length} total English recalls in database\n`);

    // First, let's examine what years we have
    const allYears = new Set();
    
    console.log('Analyzing years in data...');
    for (const doc of snapshot.docs) {
      const recall = doc.data();
      if (recall.field_recall_date) {
        const date = recall.field_recall_date;
        
        // Parse YYYY-MM-DD format
        if (date.includes('-')) {
          const parts = date.split('-');
          if (parts.length === 3) {
            allYears.add(parseInt(parts[0]));
          }
        }
      }
    }
    
    console.log('Years range:', Math.min(...allYears), 'to', Math.max(...allYears));
    console.log('Total unique years:', allYears.size);
    console.log('');

    // Filter recalls for 2023-2025
    const recalls2023to2025 = [];
    const recallsByYear = {};
    
    for (const doc of snapshot.docs) {
      const recall = doc.data();
      
      if (isInDateRange(recall, 2023, 2025)) {
        recalls2023to2025.push({ id: doc.id, ...recall });
        
        // Group by year for detailed analysis
        let year;
        const date = recall.field_recall_date;
        if (date.includes('/')) {
          year = date.split('/')[2];
        } else if (date.includes('-')) {
          year = date.split('-')[0];
        } else if (date.length === 4) {
          year = date;
        }
        
        if (year && !recallsByYear[year]) {
          recallsByYear[year] = [];
        }
        if (year) {
          recallsByYear[year].push({ id: doc.id, ...recall });
        }
      }
    }

    console.log(`FILTERED DATA (2023-2025): ${recalls2023to2025.length} recalls\n`);
    
    // Year-wise breakdown
    console.log('YEAR-WISE BREAKDOWN:');
    Object.keys(recallsByYear).sort().forEach(year => {
      console.log(`   ${year}: ${recallsByYear[year].length} recalls`);
    });
    console.log('');

    // Analysis counters
    let recallsWithoutImages = 0;
    let recallsWithoutUrls = 0;
    let recallsWithoutBoth = 0;
    let recallsWithImages = 0;
    let recallsWithUrls = 0;
    let recallsWithBoth = 0;

    const detailedAnalysis = {
      withoutImages: [],
      withoutUrls: [],
      withoutBoth: [],
      withImages: [],
      withUrls: [],
      withBoth: []
    };

    // Analyze each recall
    for (const recall of recalls2023to2025) {
      const hasImages = hasProcessedImages(recall);
      const hasUrls = hasUrlsInSummary(recall);

      if (!hasImages) {
        recallsWithoutImages++;
        detailedAnalysis.withoutImages.push({
          id: recall.id,
          recallNumber: recall.field_recall_number,
          date: recall.field_recall_date,
          title: recall.field_title?.substring(0, 60) + '...'
        });
      } else {
        recallsWithImages++;
        detailedAnalysis.withImages.push({
          id: recall.id,
          recallNumber: recall.field_recall_number,
          imageCount: recall.totalImageCount || 0
        });
      }

      if (!hasUrls) {
        recallsWithoutUrls++;
        detailedAnalysis.withoutUrls.push({
          id: recall.id,
          recallNumber: recall.field_recall_number,
          date: recall.field_recall_date,
          title: recall.field_title?.substring(0, 60) + '...'
        });
      } else {
        recallsWithUrls++;
        const urls = extractLabelUrls(recall.field_summary);
        detailedAnalysis.withUrls.push({
          id: recall.id,
          recallNumber: recall.field_recall_number,
          urlCount: urls.length
        });
      }

      if (!hasImages && !hasUrls) {
        recallsWithoutBoth++;
        detailedAnalysis.withoutBoth.push({
          id: recall.id,
          recallNumber: recall.field_recall_number,
          date: recall.field_recall_date,
          title: recall.field_title?.substring(0, 60) + '...'
        });
      }

      if (hasImages && hasUrls) {
        recallsWithBoth++;
        detailedAnalysis.withBoth.push({
          id: recall.id,
          recallNumber: recall.field_recall_number,
          imageCount: recall.totalImageCount || 0,
          urlCount: extractLabelUrls(recall.field_summary).length
        });
      }
    }

    // Display results
    console.log('  ANALYSIS RESULTS:');
    console.log('=' .repeat(50));
    console.log(`Total recalls (2023-2025): ${recalls2023to2025.length}`);
    console.log('');

    console.log('   IMAGE ANALYSIS:');
    console.log(`     Recalls WITH images: ${recallsWithImages} (${((recallsWithImages/recalls2023to2025.length)*100).toFixed(1)}%)`);
    console.log(`     Recalls WITHOUT images: ${recallsWithoutImages} (${((recallsWithoutImages/recalls2023to2025.length)*100).toFixed(1)}%)`);
    console.log('');

    console.log('  URL ANALYSIS:');
    console.log(`     Recalls WITH URLs: ${recallsWithUrls} (${((recallsWithUrls/recalls2023to2025.length)*100).toFixed(1)}%)`);
    console.log(`     Recalls WITHOUT URLs: ${recallsWithoutUrls} (${((recallsWithoutUrls/recalls2023to2025.length)*100).toFixed(1)}%)`);
    console.log('');

    console.log('  COMBINED ANALYSIS:');
    console.log(`     Recalls with BOTH images AND URLs: ${recallsWithBoth} (${((recallsWithBoth/recalls2023to2025.length)*100).toFixed(1)}%)`);
    console.log(`     Recalls with NEITHER images NOR URLs: ${recallsWithoutBoth} (${((recallsWithoutBoth/recalls2023to2025.length)*100).toFixed(1)}%)`);
    console.log('');

    // Performance metrics
    const duration = Date.now() - startTime;
    console.log('   PERFORMANCE:');
    console.log(`    Analysis completed in: ${duration}ms`);
    console.log(`    Processed ${recalls2023to2025.length} recalls`);
    console.log(`    Average processing time: ${(duration/recalls2023to2025.length).toFixed(2)}ms per recall`);
    console.log('');

    // Recommendations
    console.log('  RECOMMENDATIONS:');
    if (recallsWithoutImages > 0) {
      console.log(`   - Run image processing for ${recallsWithoutImages} recalls without images`);
    }
    if (recallsWithoutUrls > 0) {
      console.log(`   - ${recallsWithoutUrls} recalls have no URLs in field_summary (may be text-only recalls)`);
    }
    if (recallsWithoutBoth > 0) {
      console.log(`   - ${recallsWithoutBoth} recalls have neither images nor URLs (investigate these)`);
    }
    console.log('');

    // Show recalls without URLs
    console.log('RECALLS WITHOUT URLs:');
    if (detailedAnalysis.withoutUrls.length > 0) {
      detailedAnalysis.withoutUrls.forEach((recall, index) => {
        console.log(`  ${index + 1}. ${recall.recallNumber}`);
      });
    } else {
      console.log('  None found');
    }
    console.log('');

    // Show recalls with URLs but no images for potential processing
    const recallsWithUrlsButNoImages = detailedAnalysis.withoutImages.filter(recall => {
      const fullRecall = recalls2023to2025.find(r => r.id === recall.id);
      return fullRecall && hasUrlsInSummary(fullRecall);
    });

    console.log('RECALLS WITH URLS BUT NO IMAGES:');
    if (recallsWithUrlsButNoImages.length > 0) {
      recallsWithUrlsButNoImages.forEach((recall, index) => {
        console.log(`  ${index + 1}. ${recall.recallNumber}`);
      });
      console.log('');
      console.log('To process these recalls, run the image processing script:');
      console.log('  node download-recall-images-robust.js --limit ' + recallsWithUrlsButNoImages.length);
    } else {
      console.log('  None found');
    }
    console.log('');

    console.log('Analysis completed successfully!');

  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

// Run the analysis
if (require.main === module) {
  analyzeRecallData().catch(console.error);
}

module.exports = { analyzeRecallData };