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
        
        // Extract city - it should be before the state
        const beforeState = beforePostal.substring(0, stateMatch.index).trim();
        
        // Check if there's a comma separating city from state (format: "...Jacksonville, FL")
        const lastCommaIndex = beforeState.lastIndexOf(',');
        
        if (lastCommaIndex !== -1) {
          // City is likely just before the comma (format: "city, state")
          // But we need to separate it from the address that comes before it
          const beforeComma = beforeState.substring(0, lastCommaIndex).trim();
          
          // Look for where the city name starts (after the street address)
          // Strategy: Find the street suffix, city comes after it
          const streetPatterns = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl|Circle|Cir|Highway|Hwy|Parkway|Pkwy)\b/i;
          const streetMatch = beforeComma.match(streetPatterns);
          
          if (streetMatch) {
            const streetEndIndex = streetMatch.index + streetMatch[0].length;
            result.city = beforeComma.substring(streetEndIndex).trim();
            const beforeCity = beforeComma.substring(0, streetEndIndex).trim();
            
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
            // No street pattern found, use simpler heuristic
            // Assume last word before comma is city
            const words = beforeComma.split(/\s+/);
            if (words.length > 0) {
              result.city = words[words.length - 1];
              const withoutCity = words.slice(0, -1).join(' ');
              
              // Find firm name and address in remaining text
              const firstNumberMatch = withoutCity.match(/\d/);
              if (firstNumberMatch) {
                const numberIndex = withoutCity.indexOf(firstNumberMatch[0]);
                result.recalling_firm = withoutCity.substring(0, numberIndex).trim();
                result.address_1 = withoutCity.substring(numberIndex).trim();
              } else {
                result.recalling_firm = withoutCity;
              }
            }
          }
        } else {
          // No comma found - city and street address might be space-separated
          // Try to identify city by looking for common street suffixes
          const streetPatterns = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl|Circle|Cir|Highway|Hwy|Parkway|Pkwy)\b/i;
          const streetMatch = beforeState.match(streetPatterns);
          
          if (streetMatch) {
            // Find where the street suffix ends
            const streetEndIndex = streetMatch.index + streetMatch[0].length;
            const afterStreet = beforeState.substring(streetEndIndex).trim();
            
            // The next word(s) after the street suffix is likely the city
            // Extract everything up to the next comma or the end
            if (afterStreet) {
              result.city = afterStreet;
              // Everything before the city is address and firm
              const beforeCityStr = beforeState.substring(0, streetEndIndex).trim();
              
              // Find firm name and address
              const firstNumberMatch = beforeCityStr.match(/\d/);
              if (firstNumberMatch) {
                const numberIndex = beforeCityStr.indexOf(firstNumberMatch[0]);
                result.recalling_firm = beforeCityStr.substring(0, numberIndex).trim();
                result.address_1 = beforeCityStr.substring(numberIndex).trim();
              } else {
                result.recalling_firm = beforeCityStr;
              }
            }
          } else {
            // Fallback: try to identify by looking for capitalized words after numbers
            const parts = beforeState.split(/\s+/);
            let foundAddress = false;
            let addressParts = [];
            let cityParts = [];
            
            for (let i = 0; i < parts.length; i++) {
              if (!foundAddress && /\d/.test(parts[i])) {
                foundAddress = true;
              }
              
              if (foundAddress) {
                // Check if we've reached the city (usually after street suffix)
                if (i > 0 && streetPatterns.test(parts[i-1])) {
                  cityParts = parts.slice(i);
                  break;
                } else {
                  addressParts.push(parts[i]);
                }
              } else {
                // Part of firm name
                if (!result.recalling_firm) result.recalling_firm = '';
                result.recalling_firm += (result.recalling_firm ? ' ' : '') + parts[i];
              }
            }
            
            if (addressParts.length > 0) {
              // Last part might be city if no street suffix found
              if (cityParts.length === 0 && addressParts.length > 2) {
                cityParts = [addressParts.pop()];
              }
              result.address_1 = addressParts.join(' ');
              result.city = cityParts.join(' ');
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