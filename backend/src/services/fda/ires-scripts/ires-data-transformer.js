/**
 * FDA IRES Data Transformer
 * 
 * Transforms IRES scraper data to match FDA database schema
 * Handles field mapping, data validation, and format conversion
 */

const { parseRecallingFirm } = require('./ires-address-parser');
const { FDAApiService } = require('../api.service');
const admin = require('firebase-admin');

// Create instance of FDAApiService to use its parseAffectedStates method
const fdaApiService = new FDAApiService();

/**
 * Sanitize document ID to ensure it's valid for Firestore
 * Matches the existing fetch-fda-recalls.js implementation
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
 * Convert IRES date format to FDA database format (YYYYMMDD)
 * IRES may provide dates in various formats including MMDDYYYY
 */
function convertToFDADateFormat(dateStr) {
  if (!dateStr) return '';
  
  // Remove any non-alphanumeric characters
  const cleanDate = dateStr.replace(/[^0-9A-Za-z]/g, '');
  
  // Check if it's 8 digits
  if (/^\d{8}$/.test(cleanDate)) {
    // Check if it's already in YYYYMMDD format (year starts with 19 or 20)
    if (cleanDate.startsWith('19') || cleanDate.startsWith('20')) {
      return cleanDate;
    }
    
    // Otherwise assume it's MMDDYYYY and convert to YYYYMMDD
    const month = cleanDate.substring(0, 2);
    const day = cleanDate.substring(2, 4);
    const year = cleanDate.substring(4, 8);
    
    // Validate the date components
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    const yearNum = parseInt(year);
    
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900) {
      return `${year}${month}${day}`;
    }
  }
  
  // Try to parse common date formats
  try {
    // Handle "Month, DD YYYY HH:MM:SS" format (e.g., "July, 21 2025 00:00:00")
    const monthNameFormat = dateStr.match(/(\w+),?\s+(\d{1,2})\s+(\d{4})/);
    if (monthNameFormat) {
      const monthName = monthNameFormat[1];
      const day = monthNameFormat[2].padStart(2, '0');
      const year = monthNameFormat[3];
      
      // Convert month name to number
      const months = {
        'January': '01', 'February': '02', 'March': '03', 'April': '04',
        'May': '05', 'June': '06', 'July': '07', 'August': '08',
        'September': '09', 'October': '10', 'November': '11', 'December': '12',
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Sept': '09',
        'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      const month = months[monthName];
      if (month) {
        return `${year}${month}${day}`;
      }
    }
    
    // Handle MM/DD/YYYY or MM-DD-YYYY
    const slashFormat = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (slashFormat) {
      const month = slashFormat[1].padStart(2, '0');
      const day = slashFormat[2].padStart(2, '0');
      const year = slashFormat[3];
      return `${year}${month}${day}`;
    }
    
    // Handle YYYY-MM-DD
    const dashFormat = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (dashFormat) {
      const year = dashFormat[1];
      const month = dashFormat[2].padStart(2, '0');
      const day = dashFormat[3].padStart(2, '0');
      return `${year}${month}${day}`;
    }
    
    // If we can't parse it, return the original string
    return dateStr;
  } catch (error) {
    console.error('Error converting date:', dateStr, error);
    return dateStr;
  }
}

/**
 * Transform IRES recall data to FDA database schema
 * @param {Object} iresRecall - Raw recall data from IRES scraper
 * @returns {Object|null} Transformed recall or null if invalid
 */
function transformIRESToFDA(iresRecall) {
  try {
    // Skip recalls without valid recall_number or event_id
    if (!iresRecall.recallNumber || iresRecall.recallNumber === 'N/A' ||
        !iresRecall.eventId || iresRecall.eventId === 'N/A') {
      console.log(`Skipping recall with invalid ID: recall_number=${iresRecall.recallNumber}, event_id=${iresRecall.eventId}`);
      return null;
    }
    
    // Parse the recallingFirm field to extract address components
    const addressComponents = parseRecallingFirm(iresRecall.recallingFirm || '');
    
    // Build the transformed recall object
    const transformedRecall = {
      // Core FDA fields (from IRES)
      recall_number: iresRecall.recallNumber || '',
      event_id: iresRecall.eventId || '',
      status: iresRecall.status || 'Ongoing', // Default if not provided
      classification: iresRecall.classification || '',
      product_type: iresRecall.productType || 'Food', // Default to Food since IRES is filtered
      
      // Company information (parsed from recallingFirm)
      recalling_firm: addressComponents.recalling_firm || iresRecall.recallingFirm || '',
      address_1: addressComponents.address_1 || '',
      address_2: addressComponents.address_2 || '',
      city: addressComponents.city || '',
      state: addressComponents.state || '',
      postal_code: addressComponents.postal_code || '',
      country: addressComponents.country || '',
      
      // Product information
      product_description: iresRecall.productDescription || '',
      product_quantity: iresRecall.productQuantity || '',
      code_info: iresRecall.codeInformation || iresRecall.codeInfo || '',
      more_code_info: '', // Not available in IRES
      
      // Recall details
      reason_for_recall: iresRecall.reasonForRecall || '',
      voluntary_mandated: iresRecall.voluntaryMandated || iresRecall.voluntary_Mandated || '',
      initial_firm_notification: iresRecall.initialFirmNotification || '',
      distribution_pattern: iresRecall.distributionPattern || '',
      
      // Dates (convert to YYYYMMDD format)
      recall_initiation_date: convertToFDADateFormat(iresRecall.recallInitiationDate || ''),
      center_classification_date: convertToFDADateFormat(iresRecall.centerClassificationDate || ''),
      termination_date: convertToFDADateFormat(iresRecall.terminationDate || ''),
      report_date: convertToFDADateFormat(iresRecall.reportDate || ''),
      
      // Metadata
      source: 'FDA',
      api_version: 'IRES', // Mark as IRES import
      imported_at: admin.firestore.FieldValue.serverTimestamp(),
      ires_imported: true, // Flag to indicate IRES import
      ires_imported_at: admin.firestore.FieldValue.serverTimestamp(),
      
      // Searchable arrays (using FDAApiService's parseAffectedStates for consistency)
      affectedStatesArray: fdaApiService.parseAffectedStates(iresRecall.distributionPattern || ''),
      
      // OpenFDA data not available from IRES
      openfda: {}
    };
    
    // Add any additional IRES-specific fields that might be useful
    if (iresRecall.centerCity) {
      transformedRecall.center_city = iresRecall.centerCity;
    }
    
    // Add Press Release URL as recall_url (for FDA frontend display)
    // Note: scraper may add "(S)" suffix if there are multiple similar fields
    const pressReleaseUrl = iresRecall.pressReleaseUrl || 
                           iresRecall.pressReleaseURL || 
                           iresRecall['pressReleaseUrl(S)'] ||
                           iresRecall['pressReleaseURL(S)'];
    
    // Validate that it's actually a URL and not an address or other text
    if (pressReleaseUrl) {
      // Check if it's a valid URL (starts with http/https or contains www.)
      const isValidUrl = (
        pressReleaseUrl.startsWith('http://') || 
        pressReleaseUrl.startsWith('https://') ||
        pressReleaseUrl.includes('www.') ||
        pressReleaseUrl.includes('.gov/') ||
        pressReleaseUrl.includes('.com/') ||
        pressReleaseUrl.includes('.org/')
      );
      
      if (isValidUrl) {
        // Ensure it has proper protocol
        let finalUrl = pressReleaseUrl;
        if (!pressReleaseUrl.startsWith('http://') && !pressReleaseUrl.startsWith('https://')) {
          finalUrl = 'https://' + pressReleaseUrl;
        }
        
        transformedRecall.recall_url = finalUrl;
        // Also keep as press_release_url for compatibility
        transformedRecall.press_release_url = finalUrl;
      }
    }
    
    // Generate document ID
    const recallNumber = sanitizeDocumentId(transformedRecall.recall_number);
    const eventId = sanitizeDocumentId(transformedRecall.event_id);
    transformedRecall.id = `${recallNumber}_${eventId}`;
    
    return transformedRecall;
    
  } catch (error) {
    console.error('Error transforming IRES recall:', error, iresRecall);
    return null;
  }
}

/**
 * Batch transform IRES recalls
 * @param {Array} iresRecalls - Array of IRES recall objects
 * @returns {Array} Array of transformed recalls (excludes invalid ones)
 */
function batchTransformIRESRecalls(iresRecalls) {
  if (!Array.isArray(iresRecalls)) {
    console.error('Invalid input: expected array of recalls');
    return [];
  }
  
  const transformed = [];
  const skipped = [];
  
  for (const iresRecall of iresRecalls) {
    const transformedRecall = transformIRESToFDA(iresRecall);
    if (transformedRecall) {
      transformed.push(transformedRecall);
    } else {
      skipped.push(iresRecall);
    }
  }
  
  console.log(`Transformed ${transformed.length} recalls, skipped ${skipped.length} invalid recalls`);
  
  if (skipped.length > 0 && skipped.length <= 5) {
    // Log details of skipped recalls if there aren't too many
    console.log('Skipped recalls:', skipped.map(r => ({
      recallNumber: r.recallNumber,
      eventId: r.eventId,
      productDescription: r.productDescription?.substring(0, 50)
    })));
  }
  
  return transformed;
}

module.exports = {
  transformIRESToFDA,
  batchTransformIRESRecalls,
  sanitizeDocumentId,
  convertToFDADateFormat
};