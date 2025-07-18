const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || 
      !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('Missing Firebase environment variables');
  }

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
const storage = admin.storage().bucket();

// Create temp directory
const tempDir = path.join(__dirname, 'temp-images');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Check for required dependencies
let PDF_CONVERSION_AVAILABLE = false;
let SHARP_AVAILABLE = false;
let PDF_LIB_AVAILABLE = false;

try {
  require('pdf2pic');
  PDF_CONVERSION_AVAILABLE = true;
} catch (error) {
  console.warn('pdf2pic not available - PDF conversion disabled');
}

try {
  require('sharp');
  SHARP_AVAILABLE = true;
} catch (error) {
  console.warn('sharp not available - image optimization disabled');
}

try {
  require('pdf-lib');
  PDF_LIB_AVAILABLE = true;
} catch (error) {
  console.warn('pdf-lib not available - PDF analysis disabled');
}

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
    if (url === '#labels' || url === '#label' || url === '#Labels' || url === '#Label') {
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
    if (url.toLowerCase() === '#labels' || url.toLowerCase() === '#label') {
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
    if (url.toLowerCase() === '#labels' || url.toLowerCase() === '#label') {
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
    if (url.toLowerCase() === '#labels' || url.toLowerCase() === '#label') {
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
 * Download file with retry logic
 */
async function downloadFile(url, filepath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      fs.writeFileSync(filepath, response.data);
      return { success: true, size: fs.statSync(filepath).size };
      
    } catch (error) {
      console.error(`Download attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Get PDF page count using pdf-lib
 */
async function getPdfPageCount(pdfPath) {
  if (!PDF_LIB_AVAILABLE) return 1;
  
  try {
    const { PDFDocument } = require('pdf-lib');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error getting PDF page count:', error.message);
    return 1;
  }
}

/**
 * Convert PDF to images using pdf2pic
 */
async function convertPdfToImages(pdfPath, recallId) {
  if (!PDF_CONVERSION_AVAILABLE) {
    console.warn('PDF conversion not available. Install: npm install pdf2pic');
    return null;
  }
  
  try {
    const { fromPath } = require('pdf2pic');
    
    // Check if GraphicsMagick/ImageMagick is available
    const { execSync } = require('child_process');
    try {
      execSync('gm version', { stdio: 'ignore' });
      console.log('✓ GraphicsMagick detected');
    } catch (error) {
      try {
        execSync('magick -version', { stdio: 'ignore' });
        console.log('✓ ImageMagick detected');
      } catch (error2) {
        try {
          execSync('convert -version', { stdio: 'ignore' });
          console.log('✓ ImageMagick detected (legacy command)');
        } catch (error3) {
          console.warn('GraphicsMagick/ImageMagick not found. PDF conversion may fail.');
          console.warn('Windows: Install from http://www.graphicsmagick.org/download.html');
          console.warn('Mac: brew install graphicsmagick');
          console.warn('Linux: sudo apt-get install graphicsmagick');
        }
      }
    }
    
    const pageCount = await getPdfPageCount(pdfPath);
    console.log(`PDF has ${pageCount} pages`);
    
    const options = {
      density: 150,           // Lower density for faster processing
      saveFilename: `${recallId}_page`,
      savePath: tempDir,
      format: "png",
      width: 1000,           // Reasonable size
      height: 1400,
      preserveAspectRatio: true,
      quality: 100
    };
    
    const convert = fromPath(pdfPath, options);
    const images = [];
    
    for (let page = 1; page <= pageCount; page++) {
      try {
        console.log(`Converting page ${page}/${pageCount}...`);
        
        // Use direct ImageMagick command first since it's more reliable
        const outputPath = path.join(tempDir, `${recallId}_page_${page}.png`);
        const { execSync } = require('child_process');
        
        try {
          execSync(`magick "${pdfPath}[${page-1}]" -density 150 -quality 100 "${outputPath}"`, { 
            stdio: 'pipe',
            timeout: 300000 
          });
          
          if (fs.existsSync(outputPath)) {
            images.push({
              path: outputPath,
              page: page,
              originalSize: fs.statSync(outputPath).size
              });
              console.log(`✓ Page ${page} converted (${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB)`);
            } else {
              console.warn(`⚠ Page ${page} conversion failed - no output file`);
            }
          } catch (directError) {
            console.error(`✗ ImageMagick failed for page ${page}:`, directError.message);
          }
        } catch (pageError) {
          console.error(`✗ Page ${page} error:`, pageError.message);
        }
    }
    
    return images.length > 0 ? images : null;
    
  } catch (error) {
    console.error('PDF conversion failed:', error.message);
    return null;
  }
}

/**
 * Optimize image using sharp
 */
async function optimizeImage(inputPath, outputPath, maxWidth = 1200) {
  if (!SHARP_AVAILABLE) {
    console.warn('Image optimization not available. Install: npm install sharp');
    // Just copy the file if sharp is not available
    fs.copyFileSync(inputPath, outputPath);
    return { success: true, size: fs.statSync(outputPath).size };
  }
  
  try {
    const sharp = require('sharp');
    
    const result = await sharp(inputPath)
      .resize(maxWidth, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .png({ quality: 85, compressionLevel: 6 })
      .toFile(outputPath);
    
    console.log(`✓ Image optimized: ${(result.size / 1024).toFixed(2)} KB`);
    return { success: true, size: result.size };
    
  } catch (error) {
    console.error('Image optimization failed:', error.message);
    // Fallback to copying original file
    fs.copyFileSync(inputPath, outputPath);
    return { success: true, size: fs.statSync(outputPath).size };
  }
}

/**
 * Upload file to Firebase Storage
 */
async function uploadToStorage(filePath, destination) {
  try {
    // Check if bucket exists
    const [bucketExists] = await storage.exists();
    if (!bucketExists) {
      console.log('Creating Firebase Storage bucket...');
      await storage.create();
    }
    
    const [file] = await storage.upload(filePath, {
      destination: destination,
      metadata: {
        contentType: getContentType(filePath)
      }
    });
    
    // Make file public
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${storage.name}/${destination}`;
    
    return publicUrl;
    
  } catch (error) {
    console.error('Storage upload failed:', error.message);
    throw error;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    default: return 'application/octet-stream';
  }
}

/**
 * Process a single recall
 */
async function processRecall(recallDoc) {
  const recall = recallDoc.data();
  const recallId = recallDoc.id;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing recall ${recall.field_recall_number} (${recallId})`);
  
  const labelUrls = extractLabelUrls(recall.field_summary);
  
  if (labelUrls.length === 0) {
    console.log('No label URLs found in field_summary');
    return { recallId, status: 'no_labels' };
  }
  
  console.log(`Found ${labelUrls.length} label URL(s):`);
  labelUrls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url}`);
  });
  
  const processedImages = [];
  
  for (let i = 0; i < labelUrls.length; i++) {
    const url = labelUrls[i];
    // Decode URL-encoded characters in filename to avoid file system issues
    const filename = decodeURIComponent(path.basename(url));
    
    try {
      console.log(`\n--- Processing ${filename} ---`);
      
      const tempFilePath = path.join(tempDir, `${recallId}_${filename}`);
      
      // Download file
      console.log('1. Downloading file...');
      const downloadResult = await downloadFile(url, tempFilePath);
      console.log(`✓ Downloaded: ${(downloadResult.size / 1024).toFixed(2)} KB`);
      
      const isPdf = filename.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        console.log('2. Processing PDF...');
        
        // Try to convert PDF to images
        const pdfImages = await convertPdfToImages(tempFilePath, recallId);
        
        if (pdfImages && pdfImages.length > 0) {
          console.log(`3. Optimizing and uploading ${pdfImages.length} PDF pages...`);
          
          // Process each page
          for (const imageInfo of pdfImages) {
            try {
              const optimizedPath = path.join(tempDir, `${recallId}_page_${imageInfo.page}_optimized.png`);
              
              // Optimize image
              await optimizeImage(imageInfo.path, optimizedPath);
              
              // Upload to storage
              const storagePath = `recall-images/${recallId}/${filename}_page_${imageInfo.page}.png`;
              const storageUrl = await uploadToStorage(optimizedPath, storagePath);
              
              processedImages.push({
                originalFilename: filename,
                type: 'pdf-page',
                page: imageInfo.page,
                sourceUrl: url,
                storageUrl: storageUrl,
                storagePath: storagePath,
                mimeType: 'image/png',
                sizeBytes: fs.statSync(optimizedPath).size,
                downloadedAt: new Date().toISOString()
              });
              
              console.log(`✓ Page ${imageInfo.page} uploaded: ${storageUrl}`);
              
              // Clean up temp files
              fs.unlinkSync(imageInfo.path);
              fs.unlinkSync(optimizedPath);
              
            } catch (pageError) {
              console.error(`✗ Failed to process page ${imageInfo.page}:`, pageError.message);
            }
          }
        } else {
          console.log('3. PDF conversion failed, storing original PDF...');
          
          // Store original PDF
          const storagePath = `recall-images/${recallId}/${filename}`;
          const storageUrl = await uploadToStorage(tempFilePath, storagePath);
          
          processedImages.push({
            originalFilename: filename,
            type: 'pdf',
            sourceUrl: url,
            storageUrl: storageUrl,
            storagePath: storagePath,
            mimeType: 'application/pdf',
            sizeBytes: downloadResult.size,
            downloadedAt: new Date().toISOString()
          });
          
          console.log(`✓ PDF uploaded: ${storageUrl}`);
        }
      } else {
        console.log('2. Processing image file...');
        
        // Optimize image
        const optimizedPath = path.join(tempDir, `${recallId}_${filename}_optimized.png`);
        await optimizeImage(tempFilePath, optimizedPath);
        
        // Upload to storage
        const storagePath = `recall-images/${recallId}/${filename}`;
        const storageUrl = await uploadToStorage(optimizedPath, storagePath);
        
        processedImages.push({
          originalFilename: filename,
          type: 'image',
          sourceUrl: url,
          storageUrl: storageUrl,
          storagePath: storagePath,
          mimeType: 'image/png',
          sizeBytes: fs.statSync(optimizedPath).size,
          downloadedAt: new Date().toISOString()
        });
        
        console.log(`✓ Image uploaded: ${storageUrl}`);
        
        // Clean up temp files
        fs.unlinkSync(optimizedPath);
      }
      
      // Clean up original temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
    } catch (error) {
      console.error(`✗ Failed to process ${filename}:`, error.message);
      processedImages.push({
        originalFilename: filename,
        type: 'error',
        error: error.message,
        attemptedUrl: url
      });
    }
  }
  
  // Update Firestore document
  if (processedImages.length > 0) {
    const updateData = {
      processedImages: processedImages,
      imagesProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalImageCount: processedImages.filter(img => img.type !== 'error').length,
      hasErrors: processedImages.some(img => img.type === 'error'),
      extractedUrls: labelUrls
    };
    
    await db.collection('recalls').doc(recallId).update(updateData);
    
    console.log(`\n✓ Updated recall ${recallId}:`);
    console.log(`  Files processed: ${processedImages.length}`);
    console.log(`  Successful: ${processedImages.filter(img => img.type !== 'error').length}`);
    console.log(`  Errors: ${processedImages.filter(img => img.type === 'error').length}`);
  }
  
  return { 
    recallId, 
    status: 'completed', 
    imageCount: processedImages.length,
    successCount: processedImages.filter(img => img.type !== 'error').length,
    urlsFound: labelUrls.length
  };
}

/**
 * Check if processedImages array contains actual converted images (not just PDFs or errors)
 */
function hasActualImages(processedImages) {
  if (!processedImages || !Array.isArray(processedImages) || processedImages.length === 0) {
    return false;
  }
  
  // Check if there are any successfully converted images (pdf-page or image types)
  const actualImages = processedImages.filter(img => 
    img.type === 'pdf-page' || img.type === 'image'
  );
  
  return actualImages.length > 0;
}

/**
 * Main processing function
 */
async function main() {
  try {
    console.log('SafeCart Robust Image Processor');
    console.log('===============================\n');
    
    // Show available features
    console.log('Available features:');
    console.log(`- PDF to Image conversion: ${PDF_CONVERSION_AVAILABLE ? '✓ Available' : '✗ Missing (npm install pdf2pic)'}`);
    console.log(`- Image optimization: ${SHARP_AVAILABLE ? '✓ Available' : '✗ Missing (npm install sharp)'}`);
    console.log(`- PDF analysis: ${PDF_LIB_AVAILABLE ? '✓ Available' : '✗ Missing (npm install pdf-lib)'}`);
    console.log('');
    
    if (!PDF_CONVERSION_AVAILABLE) {
      console.log('To enable PDF conversion:');
      console.log('1. npm install pdf2pic sharp pdf-lib');
      console.log('2. Install GraphicsMagick: http://www.graphicsmagick.org/download.html');
      console.log('3. Restart terminal and try again\n');
    }
    
    const args = process.argv.slice(2);
    const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 3;
    const skipProcessed = !args.includes('--reprocess');
    
    console.log(`Settings:`);
    console.log(`- Processing limit: ${limit} recalls`);
    console.log(`- Skip already processed: ${skipProcessed}\n`);
    
    // Get recalls from database
    let snapshot;
    if (skipProcessed) {
      // Look for recalls that either have no imagesProcessedAt OR have no processedImages
      snapshot = await db.collection('recalls')
        .limit(limit * 2)
        .get();
    } else {
      snapshot = await db.collection('recalls')
        .limit(limit * 2)
        .get();
    }
    
    // Filter for recalls with label URLs
    const recallsToProcess = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const labelUrls = extractLabelUrls(data.field_summary);
      
      if (labelUrls.length > 0) {
        let needsProcessing = true;
        
        if (skipProcessed) {
          // Check if images were actually processed successfully
          needsProcessing = !data.imagesProcessedAt || 
                          !data.processedImages || 
                          data.processedImages.length === 0 ||
                          data.totalImageCount === 0 ||
                          !hasActualImages(data.processedImages);
        }
        
        if (needsProcessing) {
          recallsToProcess.push(doc);
        }
      }
      
      if (recallsToProcess.length >= limit) break;
    }
    
    console.log(`Found ${recallsToProcess.length} recalls to process\n`);
    
    if (recallsToProcess.length === 0) {
      console.log('No recalls found to process.');
      return;
    }
    
    const results = [];
    
    for (let i = 0; i < recallsToProcess.length; i++) {
      const doc = recallsToProcess[i];
      
      try {
        const result = await processRecall(doc);
        results.push(result);
        
        console.log(`\nProgress: ${i + 1}/${recallsToProcess.length} completed`);
        
        // Rate limiting
        if (i < recallsToProcess.length - 1) {
          console.log('Waiting 3 seconds before next recall...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`Fatal error processing recall ${doc.id}:`, error);
        results.push({ 
          recallId: doc.id, 
          status: 'error', 
          error: error.message 
        });
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total processed: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.status === 'completed').length}`);
    console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);
    
    const totalImages = results.reduce((sum, r) => sum + (r.successCount || 0), 0);
    console.log(`Total images/files stored: ${totalImages}`);
    
    console.log('\n✓ Processing completed!');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    // Simple cleanup - just try once
    console.log('\nAttempting cleanup...');
    try {
      // Delete PNG files first (they're usually not locked)
      const files = fs.readdirSync(tempDir);
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          try {
            fs.unlinkSync(path.join(tempDir, file));
            deletedCount++;
          } catch (err) {
            // Ignore
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} PNG files`);
      }
      
      // Schedule full cleanup after process exits
      const { spawn } = require('child_process');
      const cleanupScript = `
        const fs = require('fs');
        const path = require('path');
        const tempDir = '${tempDir.replace(/\\/g, '\\\\')}';
        
        setTimeout(() => {
          try {
            if (fs.existsSync(tempDir)) {
              fs.rmSync(tempDir, { recursive: true, force: true });
              console.log('Temp directory cleaned up successfully');
            }
          } catch (err) {
            // Try Windows rmdir
            if (process.platform === 'win32') {
              try {
                require('child_process').execSync(\`rmdir /s /q "\${tempDir}"\`, { stdio: 'ignore' });
              } catch (e) {}
            }
          }
        }, 5000); // Wait 5 seconds after parent process exits
      `;
      
      // Write cleanup script
      const cleanupFile = path.join(__dirname, 'temp-cleanup.js');
      fs.writeFileSync(cleanupFile, cleanupScript);
      
      // Spawn detached cleanup process
      const cleanup = spawn('node', [cleanupFile], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      cleanup.unref();
      
      console.log('Cleanup scheduled for 5 seconds after process exit');
      
    } catch (error) {
      console.log('Cleanup will be attempted on next run');
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { extractLabelUrls, processRecall };