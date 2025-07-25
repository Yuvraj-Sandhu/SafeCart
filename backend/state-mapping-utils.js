/**
 * State name and abbreviation mappings
 */
const STATE_MAPPINGS = {
  // Abbreviations to full names
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'DC': 'District of Columbia',
  'PR': 'Puerto Rico',
  'VI': 'Virgin Islands',
  'GU': 'Guam'
};

// Create reverse mapping (full name to abbreviation)
const STATE_NAMES_TO_ABBR = {};
for (const [abbr, name] of Object.entries(STATE_MAPPINGS)) {
  STATE_NAMES_TO_ABBR[name.toUpperCase()] = abbr;
  STATE_NAMES_TO_ABBR[name.toLowerCase()] = abbr;
  STATE_NAMES_TO_ABBR[name] = abbr;
}

// Special region mappings
const REGION_MAPPINGS = {
  'NEW ENGLAND': ['Connecticut', 'Maine', 'Massachusetts', 'New Hampshire', 'Rhode Island', 'Vermont'],
  'NORTHEAST': ['Connecticut', 'Maine', 'Massachusetts', 'New Hampshire', 'New Jersey', 'New York', 'Pennsylvania', 'Rhode Island', 'Vermont'],
  'MIDWEST': ['Illinois', 'Indiana', 'Iowa', 'Kansas', 'Michigan', 'Minnesota', 'Missouri', 'Nebraska', 'North Dakota', 'Ohio', 'South Dakota', 'Wisconsin'],
  'SOUTH': ['Alabama', 'Arkansas', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Kentucky', 'Louisiana', 'Maryland', 'Mississippi', 'North Carolina', 'Oklahoma', 'South Carolina', 'Tennessee', 'Texas', 'Virginia', 'West Virginia'],
  'WEST': ['Alaska', 'Arizona', 'California', 'Colorado', 'Hawaii', 'Idaho', 'Montana', 'Nevada', 'New Mexico', 'Oregon', 'Utah', 'Washington', 'Wyoming'],
  'WEST COAST': ['California', 'Oregon', 'Washington'],
  'EAST COAST': ['Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland', 'Massachusetts', 'New Hampshire', 'New Jersey', 'New York', 'North Carolina', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Virginia']
};

/**
 * Parse affected states from FDA distribution pattern
 * Returns array of full state names like USDA format
 */
function parseAffectedStates(distributionPattern) {
  if (!distributionPattern) return [];
  
  const states = new Set(); // Use Set to avoid duplicates
  // Keep original pattern for case-sensitive matching of abbreviations
  const originalPattern = distributionPattern;
  // Uppercase version for full state name matching
  const upperPattern = distributionPattern.toUpperCase();
  
  // Check for nationwide indicators
  if (upperPattern.includes('NATIONWIDE') || 
      upperPattern.includes('NATION WIDE') || 
      upperPattern.includes('ALL STATES') ||
      upperPattern.includes('THROUGHOUT THE UNITED STATES') ||
      upperPattern.includes('ALL 50 STATES')) {
    return ['Nationwide'];
  }
  
  // Check for regions
  for (const [region, regionStates] of Object.entries(REGION_MAPPINGS)) {
    if (upperPattern.includes(region)) {
      regionStates.forEach(state => states.add(state));
    }
  }
  
  // First, try to match full state names (including multi-word states)
  // Sort by length descending to match longer names first (e.g., "NORTH CAROLINA" before "NORTH")
  const sortedStateNames = Object.keys(STATE_NAMES_TO_ABBR)
    .filter(name => name === name.toUpperCase()) // Only uppercase versions
    .sort((a, b) => b.length - a.length);
  
  for (const stateName of sortedStateNames) {
    // Use word boundary or punctuation to avoid partial matches
    const regex = new RegExp(`\\b${stateName}\\b`, 'g');
    if (regex.test(upperPattern)) {
      const fullName = STATE_MAPPINGS[STATE_NAMES_TO_ABBR[stateName]];
      if (fullName) {
        states.add(fullName);
      }
    }
  }
  
  // Then check for abbreviations (2-letter codes) - ONLY uppercase ones
  // Pattern to match ONLY uppercase state codes in common list contexts
  // This will match "IL, MI, IA" but NOT "in, or, by" etc.
  const abbrPattern = /(?:^|[\s,;]|and\s+)([A-Z]{2})(?=[\s,;.]|and\s|$)/g;
  let match;
  while ((match = abbrPattern.exec(originalPattern)) !== null) {
    const abbr = match[1];
    
    // Only match if it's a valid state code (already uppercase, so no false matches)
    if (STATE_MAPPINGS[abbr]) {
      states.add(STATE_MAPPINGS[abbr]);
    }
  }
  
  // If no specific states found, check for USA/United States indicators
  if (states.size === 0) {
    const usaPattern = upperPattern;
    if (usaPattern.includes('USA') || 
        usaPattern.includes('UNITED STATES') || 
        usaPattern.includes('UNITED STATES OF AMERICA') ||
        usaPattern.includes('THROUGHOUT THE USA') ||
        usaPattern.includes('THROUGHOUT USA') ||
        usaPattern.includes('THROUGHOUT THE UNITED STATES') ||
        usaPattern.includes('THROUGHOUT UNITED STATES') ||
        usaPattern.includes('ALL CUSTOMERS ARE LOCATED WITHIN THE UNITED STATES') ||
        usaPattern.includes('DISTRIBUTED THROUGHOUT THE USA') ||
        usaPattern.includes('US DISTRIBUTION') ||
        usaPattern.includes('DOMESTIC DISTRIBUTION') ||
        usaPattern.includes('U.S. DISTRIBUTION') ||
        usaPattern.includes('WITHIN THE UNITED STATES')) {
      return ['Nationwide'];
    }
  }
  
  // Convert Set to Array and sort
  return Array.from(states).sort();
}

// Export for use in other files
module.exports = {
  STATE_MAPPINGS,
  STATE_NAMES_TO_ABBR,
  REGION_MAPPINGS,
  parseAffectedStates
};