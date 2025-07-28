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
  async getRecallsByState(state: string, limit = 1000): Promise<RecallsResponse> {
    const response = await fetch(`${API_BASE_URL}/recalls/state/${state}?limit=${limit}`);
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
  async getAllRecalls(limit = 5000): Promise<RecallsResponse> {
    const response = await fetch(`${API_BASE_URL}/recalls/all?limit=${limit}`);
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
    
    // TODO: Add user ID when auth is implemented
    // formData.append('userId', userId);
    
    const response = await fetch(`${API_BASE_URL}/recalls/${recallId}/upload-images`, {
      method: 'POST',
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
    
    // TODO: Add user ID when auth is implemented
    // formData.append('userId', userId);
    
    const response = await fetch(`${API_BASE_URL}/fda/recalls/${recallId}/upload-images`, {
      method: 'POST',
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
  async getFDARecallsByState(state: string, limit = 5000): Promise<RecallResponse<UnifiedRecall>> {
    const response = await fetch(`${API_BASE_URL}/fda/recalls/state/${state}?limit=${limit}`);
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
  async getAllFDARecalls(limit = 500): Promise<RecallResponse<UnifiedRecall>> {
    const response = await fetch(`${API_BASE_URL}/fda/recalls/all?limit=${limit}`);
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
  async getUnifiedRecallsByState(state: string, source: 'USDA' | 'FDA' | 'BOTH' = 'BOTH'): Promise<RecallResponse<UnifiedRecall>> {
    const promises: Promise<RecallResponse<UnifiedRecall>>[] = [];
    
    if (source === 'USDA' || source === 'BOTH') {
      promises.push(
        api.getRecallsByState(state).then(data => ({
          success: data.success,
          data: data.data.map(usdaToUnified),
          total: data.count,
          source: 'USDA' as const
        }))
      );
    }
    
    if (source === 'FDA' || source === 'BOTH') {
      promises.push(api.getFDARecallsByState(state));
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
  async getAllUnifiedRecalls(source: 'USDA' | 'FDA' | 'BOTH' = 'BOTH'): Promise<RecallResponse<UnifiedRecall>> {
    const promises: Promise<RecallResponse<UnifiedRecall>>[] = [];
    
    if (source === 'USDA' || source === 'BOTH') {
      promises.push(
        api.getAllRecalls().then(data => ({
          success: data.success,
          data: data.data.map(usdaToUnified),
          total: data.count,
          source: 'USDA' as const
        }))
      );
    }
    
    if (source === 'FDA' || source === 'BOTH') {
      promises.push(api.getAllFDARecalls());
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