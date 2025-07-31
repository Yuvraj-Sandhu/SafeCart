import { CreatePendingChangeRequest, PendingChange } from '../types/pending-changes.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://safecart-backend-984543935964.europe-west1.run.app/api';

export const pendingChangesApi = {
  // Create a new pending change
  async createPendingChange(data: CreatePendingChangeRequest): Promise<PendingChange> {
    const response = await fetch(`${API_BASE_URL}/pending-changes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create pending change');
    }

    const result = await response.json();
    return result.data;
  },

  // Get all pending changes (admin only)
  async getAllPendingChanges(): Promise<PendingChange[]> {
    const response = await fetch(`${API_BASE_URL}/pending-changes`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pending changes');
    }

    const result = await response.json();
    return result.data;
  },

  // Get user's pending changes
  async getMyPendingChanges(): Promise<PendingChange[]> {
    const response = await fetch(`${API_BASE_URL}/pending-changes/my`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch your pending changes');
    }

    const result = await response.json();
    return result.data;
  },

  // Get pending changes for a specific recall
  async getPendingChangesByRecall(recallId: string, source: 'USDA' | 'FDA'): Promise<PendingChange[]> {
    const response = await fetch(`${API_BASE_URL}/pending-changes/recall/${recallId}/${source}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recall pending changes');
    }

    const result = await response.json();
    return result.data;
  },

  // Approve a pending change (admin only)
  async approvePendingChange(changeId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pending-changes/${changeId}/approve`, {
      method: 'PUT',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to approve change');
    }
  },

  // Reject a pending change (admin only)
  async rejectPendingChange(changeId: string, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pending-changes/${changeId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to reject change');
    }
  },
};