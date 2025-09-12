import { DisplayData } from './display';

/**
 * Unified recall interface for frontend display
 * This interface is used to normalize both USDA and FDA recall data
 */
export interface UnifiedRecall {
  // Core identifiers
  id: string;
  recallNumber: string;
  source: 'USDA' | 'FDA';
  
  // Status and classification
  isActive: boolean;
  classification: string; // High, Low, Class I, Class II, etc.
  
  // Company information
  recallingFirm: string;
  establishment?: string;
  
  // Product information
  productTitle: string;
  productDescription: string;
  productQuantity?: string;
  llmTitle?: string; // AI-enhanced title from OpenAI
  
  // Recall details
  reasonForRecall: string;
  recallDate: string; // Standardized date format
  recallInitiationDate?: string; // FDA recall initiation date (for relative time display)
  recallUrl?: string; // URL to recall page (USDA has this, FDA doesn't)
  terminationDate?: string; // Date when recall was closed
  
  // Location information
  affectedStates: string[]; // Array of state names
  distributionPattern?: string;
  
  // Images (from USDA processing or user uploads)
  images?: Array<{
    storageUrl: string;
    type: string;
    filename?: string;
  }>;
  
  // Display customizations
  display?: DisplayData;
  
  // Original data reference (for pending changes, this contains the PendingChange object)
  originalData?: any; // Keep reference to original USDA/FDA data or PendingChange object
}

/**
 * Converts USDA recall to unified format
 */
export function usdaToUnified(usdaRecall: any): UnifiedRecall {
  return {
    id: usdaRecall.id,
    recallNumber: usdaRecall.field_recall_number,
    source: 'USDA',
    isActive: usdaRecall.isActive || usdaRecall.field_active_notice === 'True',
    classification: usdaRecall.field_risk_level || 'Unknown',
    recallingFirm: usdaRecall.field_company || usdaRecall.field_establishment || 'Unknown',
    establishment: usdaRecall.field_establishment,
    productTitle: usdaRecall.display?.previewTitle || usdaRecall.llmTitle || usdaRecall.field_title || 'Unknown Product',
    productDescription: usdaRecall.field_product_items || '',
    productQuantity: usdaRecall.field_product_quantity,
    llmTitle: usdaRecall.llmTitle,
    reasonForRecall: usdaRecall.field_recall_reason || 'Not specified',
    recallDate: usdaRecall.field_recall_date || '',
    recallInitiationDate: usdaRecall.field_recall_date, // For USDA, use field_recall_date for relative time
    recallUrl: usdaRecall.field_recall_url,
    terminationDate: usdaRecall.field_closed_date,
    affectedStates: usdaRecall.affectedStatesArray || [],
    distributionPattern: usdaRecall.field_states,
    images: usdaRecall.processedImages || [],
    display: usdaRecall.display,
    originalData: usdaRecall
  };
}

/**
 * Converts FDA recall to unified format
 */
export function fdaToUnified(fdaRecall: any): UnifiedRecall {
  // Convert FDA date format (YYYYMMDD) to standard format (YYYY-MM-DD)
  const formatFDADate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  };
  
  return {
    id: fdaRecall.id,
    recallNumber: fdaRecall.recall_number,
    source: 'FDA',
    isActive: fdaRecall.status !== 'Terminated',
    classification: fdaRecall.classification || 'Unknown',
    recallingFirm: fdaRecall.recalling_firm || 'Unknown',
    establishment: fdaRecall.recalling_firm,
    productTitle: fdaRecall.display?.previewTitle || fdaRecall.llmTitle || fdaRecall.product_description?.split(',')[0] || 'Unknown Product',
    productDescription: fdaRecall.product_description || '',
    productQuantity: fdaRecall.product_quantity,
    llmTitle: fdaRecall.llmTitle,
    reasonForRecall: fdaRecall.reason_for_recall || 'Not specified',
    recallDate: formatFDADate(fdaRecall.center_classification_date || fdaRecall.report_date), // Use center_classification_date if available, else report_date
    recallInitiationDate: fdaRecall.recall_initiation_date ? formatFDADate(fdaRecall.recall_initiation_date) : formatFDADate(fdaRecall.report_date), // Use recall_initiation_date if available, else report_date
    recallUrl: fdaRecall.display?.previewUrl || fdaRecall.recall_url || undefined, // Priority: manual preview > IRES URL > none
    terminationDate: fdaRecall.termination_date ? formatFDADate(fdaRecall.termination_date) : undefined,
    affectedStates: fdaRecall.affectedStatesArray || [],
    distributionPattern: fdaRecall.distribution_pattern,
    images: fdaRecall.processedImages || [],
    display: fdaRecall.display,
    originalData: fdaRecall
  };
}

/**
 * Converts temp FDA recall to unified format
 */
export function tempFdaToUnified(tempRecall: any): UnifiedRecall {
  return {
    id: tempRecall.id,
    recallNumber: tempRecall.id, // Use ID as recall number for temp recalls
    source: 'FDA',
    isActive: true, // All temp recalls are considered active
    classification: tempRecall.classification || 'Unclassified', // Use existing classification or default
    recallingFirm: tempRecall.recalling_firm || 'Unknown',
    establishment: tempRecall.recalling_firm,
    productTitle: tempRecall.display?.previewTitle || tempRecall.llmTitle || tempRecall.product_title || 'Unknown Product',
    productDescription: tempRecall.product_description || '',
    productQuantity: undefined,
    llmTitle: tempRecall.llmTitle,
    reasonForRecall: tempRecall.reason_for_recall || 'Not specified',
    recallDate: tempRecall.alert_date || tempRecall.date,
    recallInitiationDate: tempRecall.alert_date || tempRecall.date,
    recallUrl: tempRecall.alert_url,
    terminationDate: undefined, // Temp recalls don't have termination dates
    affectedStates: tempRecall.affectedStatesArray || [],
    distributionPattern: tempRecall.distribution_pattern,
    images: tempRecall.processedImages || [],
    display: tempRecall.display,
    originalData: tempRecall
  };
}

/**
 * Response format for API calls
 */
export interface RecallResponse<T = UnifiedRecall> {
  success: boolean;
  data: T[];
  total?: number;
  source?: 'USDA' | 'FDA' | 'BOTH';
  error?: string;
}