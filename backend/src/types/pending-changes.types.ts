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
  
  // Current state snapshot (for comparison)
  currentDisplay?: DisplayData;
  
  // Proposed changes
  proposedDisplay: DisplayData;
}

export interface CreatePendingChangeRequest {
  recallId: string;
  recallSource: 'USDA' | 'FDA';
  currentDisplay?: DisplayData;
  proposedDisplay: DisplayData;
}

export interface ApprovePendingChangeRequest {
  reason?: string;
}

export interface RejectPendingChangeRequest {
  reason: string;
}