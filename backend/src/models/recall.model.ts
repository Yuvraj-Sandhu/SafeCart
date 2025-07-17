import { z } from 'zod';

/**
 * Zod schema for validating USDA recall data
 * 
 * This schema ensures that all data received from the USDA API
 * matches the expected format and types. It serves as both
 * runtime validation and TypeScript type generation.
 * 
 * @see https://www.fsis.usda.gov/fsis/api/recall/v/1 - USDA API Documentation
 */
export const RecallSchema = z.object({
  field_title: z.string(),
  field_active_notice: z.string(),
  field_states: z.string(),
  field_archive_recall: z.string(),
  field_closed_date: z.string(),
  field_closed_year: z.string().optional(),
  field_company_media_contact: z.string().optional(),
  field_distro_list: z.string().optional(),
  field_en_press_release: z.string().optional(),
  field_establishment: z.string(),
  field_labels: z.string().optional(),
  field_media_contact: z.string().optional(),
  field_risk_level: z.string(),
  field_last_modified_date: z.string().optional(),
  field_press_release: z.string().optional(),
  field_processing: z.string(),
  field_product_items: z.string(),
  field_qty_recovered: z.string().optional(),
  field_recall_classification: z.string(),
  field_recall_date: z.string(),
  field_recall_number: z.string(),
  field_recall_reason: z.string(),
  field_recall_type: z.string(),
  field_related_to_outbreak: z.string(),
  field_summary: z.string(),
  field_year: z.string(),
  langcode: z.string(),
  field_has_spanish: z.string()
});

/**
 * TypeScript type generated from the RecallSchema
 * Represents the raw recall data as received from USDA API
 */
export type Recall = z.infer<typeof RecallSchema>;

/**
 * Processed image data structure for recall labels
 * 
 * @property originalFilename - Original filename from USDA
 * @property type - Type of processed content (pdf-page, image, or error)
 * @property page - Page number (for PDF conversions)
 * @property sourceUrl - Original USDA URL
 * @property storageUrl - Firebase Storage public URL
 * @property storagePath - Storage path in Firebase
 * @property mimeType - MIME type of the stored file
 * @property sizeBytes - File size in bytes
 * @property downloadedAt - ISO timestamp when processed
 * @property error - Error message if processing failed
 * @property attemptedUrl - URL that was attempted if error occurred
 */
export interface ProcessedImage {
  originalFilename: string;
  type: 'pdf-page' | 'image' | 'error';
  page?: number;
  sourceUrl: string;
  storageUrl?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  downloadedAt?: string;
  error?: string;
  attemptedUrl?: string;
}

/**
 * Enhanced recall data structure with additional processed fields
 * 
 * This interface extends the base Recall type with computed fields
 * and normalized data that makes it easier to work with in the application.
 * 
 * @extends Recall - Base recall data from USDA
 * 
 * @property id - Unique Firestore document ID
 * @property fetchedAt - Timestamp when the recall was fetched from USDA
 * @property imageUrls - Array of product image URLs (extracted from labels) - DEPRECATED
 * @property processedSummary - HTML-stripped and cleaned summary text
 * @property affectedStatesArray - Parsed array of affected state names
 * @property isActive - Boolean flag parsed from field_active_notice
 * @property isArchived - Boolean flag parsed from field_archive_recall
 * @property isOutbreakRelated - Boolean flag parsed from field_related_to_outbreak
 * @property hasSpanishVersion - Boolean flag parsed from field_has_spanish
 * @property riskLevelCategory - Normalized risk level for easier filtering
 * @property processedImages - Array of processed image/PDF data
 * @property imagesProcessedAt - Timestamp when images were processed
 * @property totalImageCount - Number of successfully processed images
 * @property hasErrors - Boolean indicating if any image processing failed
 * @property extractedUrls - Array of original label URLs found in summary
 */
export interface ProcessedRecall extends Recall {
  id: string;
  fetchedAt: Date;
  imageUrls?: string[]; // DEPRECATED - use processedImages instead
  processedSummary?: string;
  affectedStatesArray?: string[];
  isActive: boolean;
  isArchived: boolean;
  isOutbreakRelated: boolean;
  hasSpanishVersion: boolean;
  riskLevelCategory?: 'high' | 'medium' | 'low' | 'unknown';
  processedImages?: ProcessedImage[];
  imagesProcessedAt?: Date;
  totalImageCount?: number;
  hasErrors?: boolean;
  extractedUrls?: string[];
}