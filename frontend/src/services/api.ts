import { UnifiedRecall, usdaToUnified, fdaToUnified, RecallResponse } from '@/types/recall.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://safecart-backend-984543935964.europe-west1.run.app/api';

export interface ProcessedImage {
  originalFilename: string;
  type: 'pdf-page' | 'image' | 'error';
  page?: number;
  sourceUrl: string;
  storageUrl?: string;
  error?: string;
  size?: number;
  optimizedSize?: number;
}

export interface Recall {
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
  processedImages?: ProcessedImage[];
  imagesProcessedAt?: string;
  totalImageCount?: number;
}

export interface RecallsResponse {
  success: boolean;
  count: number;
  data: Recall[];
}

export const api = {
  // Get recalls by state
  async getRecallsByState(state: string, limit = 1000, startDate?: string, endDate?: string, excludePending = false): Promise<RecallsResponse> {
    let url = `${API_BASE_URL}/recalls/state/${state}?limit=${limit}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (excludePending) url += `&excludePending=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch recalls');
    }
    const data: RecallsResponse = await response.json();
    
    // Filter for English records only
    data.data = data.data.filter(recall => 
      recall.langcode === 'English'
    );
    data.count = data.data.length;
    
    return data;
  },

  // Get all recalls
  async getAllRecalls(limit = 5000, startDate?: string, endDate?: string, excludePending = false): Promise<RecallsResponse> {
    let url = `${API_BASE_URL}/recalls/all?limit=${limit}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (excludePending) url += `&excludePending=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch recalls');
    }
    const data: RecallsResponse = await response.json();
    
    // Filter for English records only
    data.data = data.data.filter(recall => 
      recall.langcode === 'English'
    );
    data.count = data.data.length;
    
    return data;
  },

  // Get health status
  async getHealth(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    if (!response.ok) {
      throw new Error('Server is not responding');
    }
    return response.json();
  },

  // Update recall display data
  async updateRecallDisplay(recallId: string, displayData: any): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/recalls/${recallId}/display`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ display: displayData })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update recall display' }));
      throw new Error(error.message || 'Failed to update recall display');
    }
    
    return response.json();
  },

  // Update FDA recall display data
  async updateFDARecallDisplay(recallId: string, displayData: any): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/fda/recalls/${recallId}/display`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ display: displayData })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update FDA recall display' }));
      throw new Error(error.message || 'Failed to update FDA recall display');
    }
    
    return response.json();
  },

  async uploadImagesAndUpdateDisplay(
    recallId: string, 
    files: File[], 
    displayData: any
  ): Promise<{ success: boolean; message: string; data: any }> {
    const formData = new FormData();
    
    // Add files to form data
    files.forEach(file => {
      formData.append('images', file);
    });
    
    // Add display data as JSON string
    formData.append('displayData', JSON.stringify(displayData));
    
    const response = await fetch(`${API_BASE_URL}/recalls/${recallId}/upload-images`, {
      method: 'POST',
      credentials: 'include',
      body: formData
      // Note: Don't set Content-Type header for FormData - browser will set it with boundary
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to upload images' }));
      throw new Error(error.message || 'Failed to upload images');
    }
    
    return response.json();
  },

  // Upload images for FDA recalls and update display data
  async uploadFDAImagesAndUpdateDisplay(
    recallId: string, 
    files: File[], 
    displayData: any
  ): Promise<{ success: boolean; message: string; data: any }> {
    const formData = new FormData();
    
    // Add files to form data
    files.forEach(file => {
      formData.append('images', file);
    });
    
    // Add display data as JSON string
    formData.append('displayData', JSON.stringify(displayData));
    
    const response = await fetch(`${API_BASE_URL}/fda/recalls/${recallId}/upload-images`, {
      method: 'POST',
      credentials: 'include',
      body: formData
      // Note: Don't set Content-Type header for FormData - browser will set it with boundary
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to upload FDA images' }));
      throw new Error(error.message || 'Failed to upload FDA images');
    }
    
    return response.json();
  },

  // ========== FDA Recall Methods ==========
  
  // Get FDA recalls by state
  async getFDARecallsByState(state: string, limit = 5000, startDate?: string, endDate?: string, excludePending = false): Promise<RecallResponse<UnifiedRecall>> {
    let url = `${API_BASE_URL}/fda/recalls/state/${state}?limit=${limit}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (excludePending) url += `&excludePending=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch FDA recalls');
    }
    const data = await response.json();
    
    // Convert FDA format to unified format
    const unifiedRecalls = data.data.map(fdaToUnified);
    
    return {
      success: data.success,
      data: unifiedRecalls,
      total: unifiedRecalls.length,
      source: 'FDA'
    };
  },

  // Get all FDA recalls
  async getAllFDARecalls(limit = 5000, startDate?: string, endDate?: string, excludePending = false): Promise<RecallResponse<UnifiedRecall>> {
    let url = `${API_BASE_URL}/fda/recalls/all?limit=${limit}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (excludePending) url += `&excludePending=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch FDA recalls');
    }
    const data = await response.json();
    
    // Convert FDA format to unified format
    const unifiedRecalls = data.data.map(fdaToUnified);
    
    return {
      success: data.success,
      data: unifiedRecalls,
      total: unifiedRecalls.length,
      source: 'FDA'
    };
  },

  // ========== Unified Methods (USDA + FDA) ==========
  
  // Get recalls from both sources by state
  async getUnifiedRecallsByState(state: string, source: 'USDA' | 'FDA' | 'BOTH' = 'BOTH', startDate?: string, endDate?: string, excludePending = false): Promise<RecallResponse<UnifiedRecall>> {
    const promises: Promise<RecallResponse<UnifiedRecall>>[] = [];
    
    if (source === 'USDA' || source === 'BOTH') {
      promises.push(
        api.getRecallsByState(state, 1000, startDate, endDate, excludePending).then(data => ({
          success: data.success,
          data: data.data.map(usdaToUnified),
          total: data.count,
          source: 'USDA' as const
        }))
      );
    }
    
    if (source === 'FDA' || source === 'BOTH') {
      promises.push(api.getFDARecallsByState(state, 5000, startDate, endDate, excludePending));
    }
    
    const results = await Promise.all(promises);
    
    // Combine results
    const allRecalls = results.flatMap(r => r.data);
    
    // Sort by recall date (newest first)
    allRecalls.sort((a, b) => {
      const dateA = new Date(a.recallDate);
      const dateB = new Date(b.recallDate);
      return dateB.getTime() - dateA.getTime();
    });
    
    return {
      success: true,
      data: allRecalls,
      total: allRecalls.length,
      source: source
    };
  },

  // Get all recalls from both sources
  async getAllUnifiedRecalls(source: 'USDA' | 'FDA' | 'BOTH' = 'BOTH', startDate?: string, endDate?: string, excludePending = false): Promise<RecallResponse<UnifiedRecall>> {
    const promises: Promise<RecallResponse<UnifiedRecall>>[] = [];
    
    if (source === 'USDA' || source === 'BOTH') {
      promises.push(
        api.getAllRecalls(5000, startDate, endDate, excludePending).then(data => ({
          success: data.success,
          data: data.data.map(usdaToUnified),
          total: data.count,
          source: 'USDA' as const
        }))
      );
    }
    
    if (source === 'FDA' || source === 'BOTH') {
      promises.push(api.getAllFDARecalls(5000, startDate, endDate, excludePending));
    }
    
    const results = await Promise.all(promises);
    
    // Combine results
    const allRecalls = results.flatMap(r => r.data);
    
    // Sort by recall date (newest first)
    allRecalls.sort((a, b) => {
      const dateA = new Date(a.recallDate);
      const dateB = new Date(b.recallDate);
      return dateB.getTime() - dateA.getTime();
    });
    
    return {
      success: true,
      data: allRecalls,
      total: allRecalls.length,
      source: source
    };
  },

  // ========== Admin Email Queue Methods ==========
  
  // Get both queue statuses
  async getQueues(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/queues`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch queues');
    }
    return response.json();
  },

  // Get queue preview with full recall details
  async getQueuePreview(queueType: 'USDA_DAILY' | 'FDA_WEEKLY'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/queues/${queueType}/preview`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch queue preview');
    }
    return response.json();
  },

  // Get email preview for queue
  async getQueueEmailPreview(queueType: 'USDA_DAILY' | 'FDA_WEEKLY'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/queues/${queueType}/email-preview`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to generate email preview');
    }
    return response.json();
  },

  // Get email preview for manual digest
  async getManualDigestEmailPreview(recallIds: string[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/digest/email-preview`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recallIds })
    });
    if (!response.ok) {
      throw new Error('Failed to generate email preview');
    }
    return response.json();
  },

  // Update queue (remove recalls)
  async updateQueue(queueType: 'USDA_DAILY' | 'FDA_WEEKLY', recallIds: string[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/queues/${queueType}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recallIds })
    });
    if (!response.ok) {
      throw new Error('Failed to update queue');
    }
    return response.json();
  },

  // Send queue manually
  async sendQueue(queueType: 'USDA_DAILY' | 'FDA_WEEKLY', testMode: boolean = false): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/queues/${queueType}/send`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ testMode })
    });
    if (!response.ok) {
      throw new Error('Failed to send queue');
    }
    return response.json();
  },

  // Cancel/delete queue
  async cancelQueue(queueType: 'USDA_DAILY' | 'FDA_WEEKLY'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/queues/${queueType}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to cancel queue');
    }
    return response.json();
  },

  // Send test email
  async sendTestDigest(recallIds: string[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/digest/test`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recallIds })
    });
    if (!response.ok) {
      throw new Error('Failed to send test email');
    }
    return response.json();
  },

  // Send manual digest to all subscribers
  async sendManualDigest(recallIds: string[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/digest/send`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recallIds })
    });
    if (!response.ok) {
      throw new Error('Failed to send manual digest');
    }
    return response.json();
  },

  // Get email history
  async getEmailHistory(page: number = 1, limit: number = 10): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/email-history?page=${page}&limit=${limit}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch email history');
    }
    const result = await response.json();
    // Backend wraps response in { success: true, data: { digests, totalPages } }
    return result.data;
  },

  // Get all email history for CSV export (no pagination)
  async getAllEmailHistoryForExport(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/email-history/export`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch email history for export');
    }
    const result = await response.json();
    return result.data;
  },

  // Get public recall by ID (no authentication required)
  async getRecallById(id: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/public/recall/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Recall not found');
      }
      throw new Error('Failed to fetch recall details');
    }
    return response.json();
  }
};

// Utility function to filter recalls by date range
export function filterRecallsByDateRange(
  recalls: Recall[],
  startDate: Date | null,
  endDate: Date | null
): Recall[] {
  if (!startDate && !endDate) return recalls;
  
  return recalls.filter(recall => {
    const recallDate = new Date(recall.field_recall_date);
    if (startDate && recallDate < startDate) return false;
    if (endDate && recallDate > endDate) return false;
    return true;
  });
}

// Utility function to filter unified recalls by date range
export function filterUnifiedRecallsByDateRange(
  recalls: UnifiedRecall[],
  startDate: Date | null,
  endDate: Date | null
): UnifiedRecall[] {
  if (!startDate && !endDate) return recalls;
  
  return recalls.filter(recall => {
    const recallDate = new Date(recall.recallDate);
    if (startDate && recallDate < startDate) return false;
    if (endDate && recallDate > endDate) return false;
    return true;
  });
}

// Utility function to download data as JSON
export function downloadAsJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}