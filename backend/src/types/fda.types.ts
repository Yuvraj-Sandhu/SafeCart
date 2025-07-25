/**
 * FDA Recall TypeScript Types
 */

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
  
  // OpenFDA data (if available)
  openfda?: any;
  
  // Display customizations (similar to USDA)
  display?: {
    primaryImageIndex?: number;
    previewTitle?: string;
    uploadedImages?: any[];
    lastEditedAt?: string;
    lastEditedBy?: string;
  };
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