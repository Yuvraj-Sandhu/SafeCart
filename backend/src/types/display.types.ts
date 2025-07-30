import { UserInfo } from './user.types';

export interface CardSplit {
  startIndex: number;
  endIndex: number;
  previewTitle?: string;
  primaryImageIndex?: number;
}

export interface UploadedImage {
  filename: string;
  originalName: string;
  type: 'uploaded-image';
  storageUrl: string;
  uploadedAt: string;
  uploadedBy?: string;
  size: number;
}

export interface DisplayData {
  primaryImageIndex?: number;
  cardSplits?: CardSplit[];
  previewTitle?: string;
  previewUrl?: string;
  uploadedImages?: UploadedImage[];
  
  // Approval audit fields
  proposedBy?: UserInfo;
  proposedAt?: string;
  approvedBy?: UserInfo;
  approvedAt?: string;
}