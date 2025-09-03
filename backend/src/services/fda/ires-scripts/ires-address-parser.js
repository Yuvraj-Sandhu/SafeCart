/**
 * FDA IRES Address Parser
 * 
 * Parses the combined recallingFirm field from IRES data
 * to extract company name and address components
 * 
 * Example input:
 * "Kobayashi Noodle U.S.A. 315 E 157th St  Gardena, CA 90248-2512  United States"
 * 
 * Expected output:
 * {
 *   recalling_firm: "Kobayashi Noodle U.S.A.",
 *   address_1: "315 E 157th St",
 *   city: "Gardena",
 *   state: "CA",
 *   postal_code: "90248-2512",
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
    // Clean up multiple spaces
    const cleanStr = recallingFirmStr.replace(/\s+/g, ' ').trim();
    
    // Try to identify country at the end (common pattern: "United States", "Canada", etc.)
    let workingStr = cleanStr;
    let country = '';
    
    // Check for common country patterns at the end
    const countryPatterns = [
      'United States', 'USA', 'U.S.A.', 'US',
      'Canada', 'Mexico', 'United Kingdom', 'UK'
    ];
    
    for (const pattern of countryPatterns) {
      const regex = new RegExp(`\\s+${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      if (regex.test(workingStr)) {
        country = pattern;
        workingStr = workingStr.replace(regex, '').trim();
        break;
      }
    }
    
    result.country = country;
    
    // Look for postal code pattern (5 digits or 5-4 digits)
    const postalRegex = /\b(\d{5}(?:-\d{4})?)\b/;
    const postalMatch = workingStr.match(postalRegex);
    
    if (postalMatch) {
      result.postal_code = postalMatch[1];
      
      // Find state abbreviation before postal code
      const beforePostal = workingStr.substring(0, postalMatch.index).trim();
      const stateRegex = /\b([A-Z]{2})\s*$/;
      const stateMatch = beforePostal.match(stateRegex);
      
      if (stateMatch && STATE_ABBREV_TO_FULL[stateMatch[1]]) {
        result.state = stateMatch[1];
        
        // Extract city - it should be before the state, after a comma
        const beforeState = beforePostal.substring(0, stateMatch.index).trim();
        const lastCommaIndex = beforeState.lastIndexOf(',');
        
        if (lastCommaIndex !== -1) {
          result.city = beforeState.substring(lastCommaIndex + 1).trim();
          
          // Everything before the city is the address and firm name
          const beforeCity = beforeState.substring(0, lastCommaIndex).trim();
          
          // Try to split firm name from address
          // Strategy: Look for the first number (usually start of street address)
          const firstNumberMatch = beforeCity.match(/\d/);
          
          if (firstNumberMatch) {
            const numberIndex = beforeCity.indexOf(firstNumberMatch[0]);
            result.recalling_firm = beforeCity.substring(0, numberIndex).trim();
            result.address_1 = beforeCity.substring(numberIndex).trim();
          } else {
            // No clear address pattern, treat it all as firm name
            result.recalling_firm = beforeCity;
          }
        } else {
          // No clear city delimiter, try alternative parsing
          // Look for pattern: [Firm Name] [Address] [City], [State] [Zip]
          const parts = workingStr.split(/\s{2,}/); // Split by multiple spaces
          
          if (parts.length >= 2) {
            // First part is likely firm name
            result.recalling_firm = parts[0];
            
            // Try to find address in remaining parts
            for (let i = 1; i < parts.length; i++) {
              const part = parts[i];
              // Check if this part looks like an address (contains numbers)
              if (/\d/.test(part) && !result.address_1) {
                // Check if it's not the postal code we already found
                if (!part.includes(result.postal_code)) {
                  result.address_1 = part;
                }
              }
            }
          }
        }
      }
    }
    
    // Fallback: If we couldn't parse properly, at least extract firm name
    if (!result.recalling_firm) {
      // Take everything up to the first number as firm name
      const firstNumberMatch = workingStr.match(/\d/);
      if (firstNumberMatch) {
        const numberIndex = workingStr.indexOf(firstNumberMatch[0]);
        result.recalling_firm = workingStr.substring(0, numberIndex).trim();
        
        // Rest could be address
        const remaining = workingStr.substring(numberIndex).trim();
        if (remaining && !result.address_1) {
          // Take the part before any comma as address
          const commaIndex = remaining.indexOf(',');
          if (commaIndex !== -1) {
            result.address_1 = remaining.substring(0, commaIndex).trim();
          } else {
            result.address_1 = remaining;
          }
        }
      } else {
        // No numbers found, treat whole string as firm name
        result.recalling_firm = workingStr;
      }
    }
    
    // Clean up any remaining commas or extra spaces
    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = result[key].replace(/^,\s*/, '').replace(/\s*,$/, '').trim();
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