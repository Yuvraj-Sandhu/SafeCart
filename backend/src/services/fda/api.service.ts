import axios from 'axios';
import { FDARecall } from '../../types/fda.types';
import logger from '../../utils/logger';
import * as admin from 'firebase-admin';

/**
 * Service for interacting with the FDA OpenFDA API
 * 
 * The FDA provides a RESTful API for accessing food recall data.
 * This service handles API communication, data transformation, and error handling.
 * 
 * API Documentation: https://open.fda.gov/apis/food/enforcement/
 */
export class FDAApiService {
  private readonly FDA_API_BASE = 'https://api.fda.gov/food/enforcement.json';
  private readonly MAX_LIMIT = 1000; // FDA API max records per request
  
  /**
   * Transform FDA API recall data to our schema
   */
  private transformFDARecall(fdaRecall: any): Omit<FDARecall, 'id'> {
    return {
      // Core FDA fields
      recall_number: fdaRecall.recall_number || '',
      event_id: fdaRecall.event_id || '',
      status: fdaRecall.status || '',
      classification: fdaRecall.classification || '',
      product_type: fdaRecall.product_type || '',
      
      // Company information
      recalling_firm: fdaRecall.recalling_firm || '',
      address_1: fdaRecall.address_1 || '',
      address_2: fdaRecall.address_2 || '',
      city: fdaRecall.city || '',
      state: fdaRecall.state || '',
      postal_code: fdaRecall.postal_code || '',
      country: fdaRecall.country || '',
      
      // Product information
      product_description: fdaRecall.product_description || '',
      product_quantity: fdaRecall.product_quantity || '',
      code_info: fdaRecall.code_info || '',
      more_code_info: fdaRecall.more_code_info || '',
      
      // Recall details
      reason_for_recall: fdaRecall.reason_for_recall || '',
      voluntary_mandated: fdaRecall.voluntary_mandated || '',
      initial_firm_notification: fdaRecall.initial_firm_notification || '',
      distribution_pattern: fdaRecall.distribution_pattern || '',
      
      // Dates (keeping as strings in YYYYMMDD format)
      recall_initiation_date: fdaRecall.recall_initiation_date || '',
      center_classification_date: fdaRecall.center_classification_date || '',
      termination_date: fdaRecall.termination_date || '',
      report_date: fdaRecall.report_date || '',
      
      // Metadata
      source: 'FDA' as const,
      api_version: 'openFDA',
      imported_at: admin.firestore.FieldValue.serverTimestamp(),
      
      // Searchable arrays
      affectedStatesArray: this.parseAffectedStates(fdaRecall.distribution_pattern || ''),
      
      // Store original OpenFDA data if needed
      openfda: fdaRecall.openfda || {},
    };
  }

  /**
   * Parse distribution pattern to extract affected states
   * Similar to the parseAffectedStates function in fetch-fda-recalls.js
   */
  public parseAffectedStates(distributionPattern: string): string[] {
    const stateMapping: { [key: string]: string } = {
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

    const affectedStates: string[] = [];
    const upperPattern = distributionPattern.toUpperCase();
    
    // Check for nationwide indicators
    if (upperPattern.includes('NATIONWIDE') || upperPattern.includes('NATION WIDE') ||
        upperPattern.includes('NATIONAL') || upperPattern.includes('ALL STATES') ||
        upperPattern.includes('THROUGHOUT THE US') || upperPattern.includes('THROUGHOUT THE UNITED STATES')) {
      affectedStates.push('Nationwide');
    }
    
    // Extract state codes and names
    for (const [code, name] of Object.entries(stateMapping)) {
      // Check for state code (with word boundaries)
      const codeRegex = new RegExp(`\\b${code}\\b`, 'g');
      if (codeRegex.test(upperPattern)) {
        if (!affectedStates.includes(name)) {
          affectedStates.push(name);
        }
      }
      
      // Check for full state name
      if (upperPattern.includes(name.toUpperCase())) {
        if (!affectedStates.includes(name)) {
          affectedStates.push(name);
        }
      }
    }
    
    // If no states found but has distribution info, default to empty array
    // This allows for better searching later
    return affectedStates;
  }

  /**
   * Fetch FDA recalls for the last N days
   * 
   * @param days - Number of days to look back (default: 60)
   * @returns Array of FDA recalls
   */
  async fetchRecentRecalls(days: number = 60): Promise<Omit<FDARecall, 'id'>[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startDateStr = this.formatDateToYYYYMMDD(startDate);
      const endDateStr = this.formatDateToYYYYMMDD(endDate);
      
      logger.info(`Fetching FDA recalls from ${startDateStr} to ${endDateStr}`);
      
      // Fetch all recalls in the date range
      const allRecalls = await this.fetchRecallsInDateRange(startDateStr, endDateStr);
      
      logger.info(`Fetched ${allRecalls.length} FDA recalls for the last ${days} days`);
      
      return allRecalls;
    } catch (error) {
      logger.error('Error fetching recent FDA recalls:', error);
      throw error;
    }
  }

  /**
   * Fetch all FDA recalls within a date range, handling pagination
   * 
   * @param startDate - Start date in YYYYMMDD format
   * @param endDate - End date in YYYYMMDD format
   * @returns Array of all recalls in the date range
   */
  private async fetchRecallsInDateRange(startDate: string, endDate: string): Promise<Omit<FDARecall, 'id'>[]> {
    const allRecalls: Omit<FDARecall, 'id'>[] = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const searchQuery = `report_date:[${startDate}+TO+${endDate}]`;
        const url = `${this.FDA_API_BASE}?search=${searchQuery}&limit=${this.MAX_LIMIT}&skip=${skip}`;
        
        logger.info(`Fetching FDA batch: skip=${skip}, limit=${this.MAX_LIMIT}`);
        
        const response = await axios.get(url, {
          timeout: 30000, // 30 second timeout
        });
        
        const data = response.data;
        
        if (!data.results || data.results.length === 0) {
          hasMore = false;
          break;
        }
        
        // Transform recalls
        const transformedRecalls = data.results.map((recall: any) => this.transformFDARecall(recall));
        allRecalls.push(...transformedRecalls);
        
        // Check if there are more records
        const totalAvailable = data.meta?.results?.total || 0;
        skip += data.results.length;
        
        if (skip >= totalAvailable || data.results.length < this.MAX_LIMIT) {
          hasMore = false;
        }
        
        // Add delay to avoid rate limiting
        if (hasMore) {
          await this.delay(1000);
        }
        
      } catch (error: any) {
        // FDA API returns 404 when skip exceeds total available records
        if (error.response?.status === 404) {
          logger.info('Reached end of available FDA records');
          hasMore = false;
        } else {
          logger.error(`Error fetching FDA batch at skip=${skip}:`, error);
          throw error;
        }
      }
    }
    
    return allRecalls;
  }

  /**
   * Format date to YYYYMMDD string for FDA API
   */
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Delay function for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}