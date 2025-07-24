// Display data types for internal editing

export interface CardSplit {
  startIndex: number;  // Starting image index for this split
  endIndex: number;    // Ending image index for this split (exclusive)
  previewTitle?: string; // Optional override title for this split
  primaryImageIndex?: number; // Primary image index relative to this split's image range
}

export interface DisplayData {
  primaryImageIndex?: number; // Index of the primary image to show first on main card (relative to main card's image range)
  cardSplits?: CardSplit[];   // Array defining how to split cards
  previewTitle?: string;      // Override title for the main card
  uploadedImages?: UploadedImage[]; // User-uploaded images for this recall
  lastEditedBy?: string;      // Email/ID of last editor
  lastEditedAt?: string;      // ISO timestamp of last edit
}

// Extended Recall type with display data
export interface RecallWithDisplay {
  // All original recall fields
  id: string;
  field_title: string;
  field_recall_number: string;
  field_recall_date: string;
  field_states: string;
  field_risk_level: string;
  field_company_media_contact: string;
  field_establishment: string;
  field_product_items: string;
  field_recall_reason: string;
  field_summary: string;
  field_year: string;
  field_closed_date?: string;
  field_recall_url?: string;
  affectedStatesArray: string[];
  riskLevelCategory: 'high' | 'medium' | 'low' | 'unknown';
  isActive: boolean;
  langcode: string;
  
  // Image processing data
  processedImages?: ProcessedImage[];
  imagesProcessedAt?: string;
  totalImageCount?: number;
  
  // Display customization data
  display?: DisplayData;
}

export interface ProcessedImage {
  originalFilename: string;
  type: 'pdf-page' | 'image' | 'error';
  page?: number;
  sourceUrl: string;
  storageUrl?: string;
  error?: string;
  processedAt?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface UploadedImage {
  filename: string;        // Generated filename in storage
  originalName: string;    // Original filename from user's device
  type: 'uploaded-image';
  storageUrl: string;      // Firebase Storage URL
  uploadedAt: string;      // ISO timestamp of upload
  uploadedBy?: string;     // Email/ID of uploader
  size: number;           // File size in bytes
  dimensions?: {
    width: number;
    height: number;
  };
}

// Edit modal state
export interface EditModalState {
  isOpen: boolean;
  recall: RecallWithDisplay | null;
}

// Split preview for the modal
export interface SplitPreview {
  splitIndex: number;
  title: string;
  images: ProcessedImage[];
  startIndex: number;
  endIndex: number;
}