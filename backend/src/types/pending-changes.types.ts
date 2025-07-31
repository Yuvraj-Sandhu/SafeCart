import { DisplayData } from './display.types';
import { UserInfo } from './user.types';

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

export interface ApprovePendingChangeRequest {
  reason?: string;
}

export interface RejectPendingChangeRequest {
  reason: string;
}