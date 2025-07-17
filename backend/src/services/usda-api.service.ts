import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { Recall, RecallSchema } from '../models/recall.model';
import logger from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Query parameters supported by the USDA Recall API
 * 
 * These parameters allow filtering recalls by various criteria.
 * All parameters are optional and can be combined for complex queries.
 * 
 * @interface USDAQueryParams
 * @see CLAUDE.md for complete parameter documentation and valid values
 */
export interface USDAQueryParams {
  field_states_id?: string | number;
  field_year_id?: string | number;
  field_closed_year_id?: string | number;
  field_risk_level_id?: string | number;
  field_product_items_value?: string;
  field_recall_number?: string;
  field_summary_value?: string;
  field_archive_recall?: string | number;
  field_related_to_outbreak?: string | number;
  field_recall_type_id?: string | number;
  field_recall_classification_id?: string | number;
  field_translation_language?: string;
}

/**
 * Service class for interacting with the USDA Food Safety and Inspection Service (FSIS) Recall API
 * 
 * This service handles all communication with the USDA API, including:
 * - Configuring axios with proper headers to avoid blocking
 * - Validating response data using Zod schemas
 * - Providing typed methods for common query patterns
 * - Handling errors and logging
 * 
 * @example
 * ```typescript
 * const usdaService = new USDAApiService();
 * const californiaRecalls = await usdaService.fetchCaliforniaRecalls(2024, 6);
 * ```
 */
export class USDAApiService {
  private client: AxiosInstance;
  private baseURL: string;

  /**
   * Initializes the USDA API service with configured axios client
   * Sets up request interceptors for logging and error handling
   */
  constructor() {
    this.baseURL = process.env.USDA_API_BASE_URL || 'https://www.fsis.usda.gov/fsis/api/recall/v/1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: parseInt(process.env.API_REQUEST_TIMEOUT || '30000'),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    this.client.interceptors.response.use(
      response => {
        logger.info(`USDA API request successful: ${response.config.url}`);
        return response;
      },
      error => {
        logger.error('USDA API request failed:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetches recalls from USDA API with optional filtering parameters
   * 
   * @param params - Optional query parameters for filtering
   * @returns Promise resolving to array of validated Recall objects
   * @throws Error if API request fails or data validation fails
   */
  async fetchRecalls(params?: USDAQueryParams): Promise<Recall[]> {
    try {
      const response = await this.client.get('', { params });
      
      const RecallArraySchema = z.array(RecallSchema);
      const validatedData = RecallArraySchema.parse(response.data);
      
      logger.info(`Fetched ${validatedData.length} recalls from USDA API`);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Data validation error:', error.errors);
        throw new Error('Invalid data format from USDA API');
      }
      throw error;
    }
  }

  /**
   * Fetches recalls for a specific state with optional year filtering
   * 
   * @param stateId - Numeric state ID (e.g., 29 for California)
   * @param year - Optional year to filter results
   * @returns Promise resolving to array of recalls for the specified state
   */
  async fetchRecallsByState(stateId: number, year?: number): Promise<Recall[]> {
    const params: USDAQueryParams = {
      field_states_id: stateId
    };
    
    if (year) {
      params.field_year_id = this.getYearId(year);
    }
    
    return this.fetchRecalls(params);
  }

  /**
   * Convenience method for fetching California recalls
   * California is a key market for SafeCart's initial launch
   * 
   * @param year - Optional year filter
   * @param month - Optional month filter (1-12)
   * @returns Promise resolving to California recalls, optionally filtered by date
   */
  async fetchCaliforniaRecalls(year?: number, month?: number): Promise<Recall[]> {
    const params: USDAQueryParams = {
      field_states_id: 29 // California
    };
    
    if (year) {
      params.field_year_id = this.getYearId(year);
    }
    
    const recalls = await this.fetchRecalls(params);
    
    if (month && year) {
      return recalls.filter(recall => {
        const recallDate = new Date(recall.field_recall_date);
        return recallDate.getMonth() + 1 === month && 
               recallDate.getFullYear() === year;
      });
    }
    
    return recalls;
  }

  /**
   * Fetches only high-risk (Class I) recalls
   * These are recalls involving products that could cause serious health problems or death
   * 
   * @returns Promise resolving to array of high-risk recalls
   */
  async fetchHighRiskRecalls(): Promise<Recall[]> {
    return this.fetchRecalls({
      field_risk_level_id: 9 // High - Class I
    });
  }

  /**
   * Fetches recalls from the last N days
   * Note: This fetches all recalls then filters client-side
   * as the USDA API doesn't support date range queries directly
   * 
   * @param days - Number of days to look back (default: 30)
   * @returns Promise resolving to recent recalls within the specified timeframe
   */
  async fetchRecentRecalls(days: number = 30): Promise<Recall[]> {
    const recalls = await this.fetchRecalls();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return recalls.filter(recall => {
      const recallDate = new Date(recall.field_recall_date);
      return recallDate >= cutoffDate;
    });
  }

  /**
   * Maps human-readable years to USDA API year IDs
   * The USDA API uses internal numeric IDs for years rather than the actual year
   * 
   * @param year - The actual year (e.g., 2024)
   * @returns The corresponding USDA API year ID
   * @private
   */
  private getYearId(year: number): number {
    const yearMap: Record<number, number> = {
      2024: 606,
      2023: 445,
      2022: 444,
      2021: 446,
      2020: 1,
      2019: 2,
      2018: 3,
      2017: 4,
      2016: 5,
      2015: 6,
      2014: 117,
      2013: 215,
      2012: 216,
      2011: 217,
      2010: 218,
      2009: 219,
      2008: 220,
      2007: 221,
      2006: 222,
      2005: 223,
      2004: 224,
      2003: 225,
      2002: 226,
      2001: 227,
      2000: 228,
      1999: 229,
      1998: 230,
      1997: 231,
      1996: 463,
      1995: 462,
      1994: 464,
      1993: 465,
      1992: 466,
      1991: 467,
      1990: 468,
      1980: 469,
      1970: 470,
    };
    
    return yearMap[year] || 606; // Default to 2024
  }
}