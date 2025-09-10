/**
 * FDA Recall TypeScript Types
 */

import { DisplayData } from './display.types';

export interface FDARecall {
  // Document ID (sanitized recall_number_event_id)
  id?: string;
  
  // Core FDA fields
  recall_number: string;
  event_id: string;
  status: string;
  classification: string;
  product_type: string;
  
  // Company information
  recalling_firm: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  
  // Product information
  product_description: string;
  product_quantity: string;
  code_info: string;
  more_code_info?: string;
  
  // Recall details
  reason_for_recall: string;
  voluntary_mandated: string;
  initial_firm_notification: string;
  distribution_pattern: string;
  
  // Dates (YYYYMMDD format)
  recall_initiation_date: string;
  center_classification_date: string;
  termination_date?: string;
  report_date: string;
  
  // Metadata
  source: 'FDA';
  api_version: string;
  imported_at: any; // Firestore timestamp
  
  // Searchable arrays
  affectedStatesArray: string[];
  
  // Manual states override (admin only)
  manualStatesOverride?: string[];
  useManualStates?: boolean;
  manualStatesUpdatedBy?: string;
  manualStatesUpdatedAt?: string;
  
  // AI-enhanced title
  llmTitle?: string;
  
  // OpenFDA data (if available)
  openfda?: any;
  
  // Display customizations (similar to USDA)
  display?: DisplayData;
}

// Response format for API endpoints
export interface FDARecallResponse {
  success: boolean;
  data: FDARecall[];
  total?: number;
  source: 'FDA';
  error?: string;
}

// Query options
export interface FDAQueryOptions {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  stateCode?: string;
}

// Temporary FDA Recall for unclassified alerts
export interface TempFDARecall {
  // Document ID (YYYYMMDD_randomtext)
  id?: string;
  
  // Alert identification
  alert_url: string;  // The press release URL
  alert_date: string;  // Date of the alert (YYYY-MM-DD format)
  date: string;       // Date field for consistency with FDA recalls (YYYY-MM-DD format)
  
  // Status (always pending for unclassified)
  status: 'pending';
  classification: 'Unclassified';
  product_type: 'Food';
  
  // Company information
  recalling_firm: string;
  brand_name?: string;
  
  // Product information
  product_description: string;
  product_title: string;  // Enhanced title from press release
  
  // Recall details
  reason_for_recall: string;
  distribution_pattern: string;
  
  // AI-enhanced title
  llmTitle?: string;
  
  // Source metadata
  source: 'FDA';
  api_version: 'FDA_ALERTS';
  imported_at: any; // Firestore timestamp
  
  // Location data
  affectedStatesArray: string[];
}