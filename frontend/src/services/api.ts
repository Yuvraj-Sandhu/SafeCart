const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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
  affectedStatesArray: string[];
  riskLevelCategory: 'high' | 'medium' | 'low' | 'unknown';
  isActive: boolean;
  langcode: string;
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
    return response.json();
  },

  // Get all recalls
  async getAllRecalls(limit = 5000): Promise<RecallsResponse> {
    const response = await fetch(`${API_BASE_URL}/recalls/all?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch recalls');
    }
    return response.json();
  },

  // Get health status
  async getHealth(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    if (!response.ok) {
      throw new Error('Server is not responding');
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