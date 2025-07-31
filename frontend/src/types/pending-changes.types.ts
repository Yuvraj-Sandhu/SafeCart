import { DisplayData, UserInfo } from './display';

export interface PendingChange {
  id: string;
  recallId: string;
  recallSource: 'USDA' | 'FDA';
  
  proposedBy: UserInfo;
  proposedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  
  reviewedBy?: UserInfo;
  reviewedAt?: string;
  rejectionReason?: string;
  
  // Full recall data for display without additional API calls
  originalRecall: any; // Contains complete USDA or FDA recall data
  
  // Proposed changes to the display field
  proposedDisplay: DisplayData;
}

export interface CreatePendingChangeRequest {
  recallId: string;
  recallSource: 'USDA' | 'FDA';
  originalRecall: any; // Full recall data to store
  proposedDisplay: DisplayData;
}