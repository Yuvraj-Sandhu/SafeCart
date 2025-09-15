/**
 * FDA IRES Address Parser
 * 
 * Parses the combined recallingFirm field from IRES data
 * to extract company name and address components
 * 
 * The aria-label contains data separated by double spaces which correspond to <br> tags:
 * Line 1: Company name
 * Line 2: Street address
 * Line 3: City, State ZIP
 * Line 4: Country
 * 
 * Example input:
 * "Beaver Street Fisheries, Inc.  1741 W Beaver St  Jacksonville, FL 32209-7526  United States"
 * 
 * Expected output:
 * {
 *   recalling_firm: "Beaver Street Fisheries, Inc.",
 *   address_1: "1741 W Beaver St",
 *   city: "Jacksonville",
 *   state: "FL",
 *   postal_code: "32209-7526",
 *   country: "United States"
 * }
 */

// State abbreviations to full names mapping
const STATE_ABBREV_TO_FULL = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

/**
 * Parse the recallingFirm field to extract address components
 * @param {string} recallingFirmStr - Combined string with firm name and address
 * @returns {Object} Parsed address components
 */
function parseRecallingFirm(recallingFirmStr) {
  // Default structure
  const result = {
    recalling_firm: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: ''
  };

  if (!recallingFirmStr || typeof recallingFirmStr !== 'string') {
    return result;
  }

  try {
    // Split by double spaces (or more) which represent line breaks in the aria-label
    // This corresponds to <br> tags in the HTML
    const lines = recallingFirmStr.split(/\s{2,}/).map(line => line.trim()).filter(line => line);
    
    // Parse based on the expected 4-line structure
    if (lines.length >= 3) {
      // Line 1: Recalling firm name
      result.recalling_firm = lines[0];
      
      // Line 2: Street address
      if (lines[1]) {
        result.address_1 = lines[1];
      }
      
      // Line 3: City, State ZIP (e.g., "Jacksonville, FL 32209-7526")
      if (lines[2]) {
        const cityStateZip = lines[2];
        
        // Extract postal code (5 digits or 5-4 digits)
        const postalMatch = cityStateZip.match(/\b(\d{5}(?:-\d{4})?)\b/);
        if (postalMatch) {
          result.postal_code = postalMatch[1];
          
          // Get everything before the postal code
          const beforePostal = cityStateZip.substring(0, postalMatch.index).trim();
          
          // Extract state (2 letter code, usually before postal)
          const stateMatch = beforePostal.match(/\b([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/); // Get the last state code
          if (stateMatch && STATE_ABBREV_TO_FULL[stateMatch[1]]) {
            result.state = stateMatch[1];
            
            // Get everything before the state code as the city
            const beforeState = beforePostal.substring(0, stateMatch.index).trim();
            
            // Remove trailing comma and any extra punctuation
            result.city = beforeState.replace(/[,\s]+$/, '').trim();
          } else {
            // If no state found, treat everything before postal as city
            result.city = beforePostal.replace(/[,\s]+$/, '').trim();
          }
        } else {
          // No postal code found, try to extract state and city
          const stateMatch = cityStateZip.match(/,\s*([A-Z]{2})\b/);
          if (stateMatch && STATE_ABBREV_TO_FULL[stateMatch[1]]) {
            result.state = stateMatch[1];
            result.city = cityStateZip.substring(0, stateMatch.index).trim();
          } else {
            // Just use the whole thing as city
            result.city = cityStateZip.replace(/[,\s]+$/, '').trim();
          }
        }
      }
      
      // Line 4: Country (if present)
      if (lines[3]) {
        result.country = lines[3];
      }
      
      // Sometimes line 3 might have an extra address line
      // Check if we didn't find a city yet and there's a 4th line
      if (!result.city && lines[3] && !lines[4]) {
        // Line 3 might be address_2, and line 4 is city/state/zip
        result.address_2 = lines[2];
        const cityStateZip = lines[3];
        
        // Re-parse for city/state/zip
        const postalMatch = cityStateZip.match(/\b(\d{5}(?:-\d{4})?)\b/);
        if (postalMatch) {
          result.postal_code = postalMatch[1];
          const beforePostal = cityStateZip.substring(0, postalMatch.index).trim();
          const stateMatch = beforePostal.match(/\b([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/);
          if (stateMatch && STATE_ABBREV_TO_FULL[stateMatch[1]]) {
            result.state = stateMatch[1];
            result.city = beforePostal.substring(0, stateMatch.index).replace(/[,\s]+$/, '').trim();
          }
        }
      }
    }
    
    // Clean up any fields
    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = result[key].trim();
      }
    });
    
  } catch (error) {
    console.error('Error parsing recallingFirm:', error);
    // On error, at least return the original string as firm name
    result.recalling_firm = recallingFirmStr;
  }
  
  return result;
}

module.exports = { parseRecallingFirm };