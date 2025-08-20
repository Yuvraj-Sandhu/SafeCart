'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/DateRangePicker';
import { EditableRecallList } from '@/components/EditableRecallList';
import { EditModal } from '@/components/EditModal';
import { UnifiedRecall } from '@/types/recall.types';
import { api } from '@/services/api';
import styles from './ManualDigestTab.module.css';

export function ManualDigestTab() {
  const { currentTheme } = useTheme();
  const [source, setSource] = useState<'USDA' | 'FDA' | 'both'>('both');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [recalls, setRecalls] = useState<UnifiedRecall[]>([]);
  const [selectedRecalls, setSelectedRecalls] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageStats, setImageStats] = useState({ total: 0, withImages: 0 });
  const [isSending, setIsSending] = useState(false);
  
  // Ref to prevent double API calls in development (React StrictMode)
  const hasFetched = useRef(false);
  
  // Edit modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    recall: UnifiedRecall | null;
  }>({
    isOpen: false,
    recall: null
  });

  // Check server health on mount
  useEffect(() => {
    // Prevent double API calls in React StrictMode (development)
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    api.getHealth().catch(() => {
      setError('Backend server is not running. Please start the server on port 3001.');
    });
  }, []);

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedRecalls(new Set()); // Clear selection on new search

    try {
      // Format dates for API (ISO string format: YYYY-MM-DD)
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Map source filter to API format
      const apiSource = source === 'both' ? 'BOTH' : source;
      
      // Get all recalls for the date range and source
      const response = await api.getAllUnifiedRecalls(apiSource, startDateStr, endDateStr, false);
      
      setRecalls(response.data);
      
      // Calculate image statistics
      const totalRecalls = response.data.length;
      const recallsWithImages = response.data.filter(recall => {
        const hasProcessedImages = recall.images && recall.images.length > 0;
        const hasUploadedImages = recall.display?.uploadedImages && recall.display.uploadedImages.length > 0;
        return hasProcessedImages || hasUploadedImages;
      }).length;
      
      setImageStats({ total: totalRecalls, withImages: recallsWithImages });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recalls');
      setRecalls([]);
      setImageStats({ total: 0, withImages: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecallSelect = (recallId: string) => {
    setSelectedRecalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recallId)) {
        newSet.delete(recallId);
      } else {
        newSet.add(recallId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedRecalls(new Set(recalls.map(r => r.id)));
  };

  const handleDeselectAll = () => {
    setSelectedRecalls(new Set());
  };

  const handleEdit = (recall: UnifiedRecall) => {
    setEditModal({
      isOpen: true,
      recall
    });
  };

  const handleSaveEdit = async (updatedRecall: UnifiedRecall) => {
    // Update the local recalls state with the edited recall
    setRecalls(prev => prev.map(r => 
      r.id === updatedRecall.id ? updatedRecall : r
    ));
    
    // Close modal
    setEditModal({ isOpen: false, recall: null });
    
    console.log('Recall updated successfully in email dashboard');
  };

  const handleSendTest = async () => {
    if (selectedRecalls.size === 0) return;
    
    setIsSending(true);
    try {
      // For test emails, we'll send a manual digest but only to a test recipient
      // This would be implemented differently based on your requirements
      console.log('Test email functionality would be implemented here');
      alert('Test email functionality would require a separate endpoint for sending to test recipients only.');
    } catch (error) {
      setError('Failed to send test email');
      console.error('Test email error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToAll = async () => {
    if (selectedRecalls.size === 0) return;
    
    if (!confirm(`Are you sure you want to send this digest with ${selectedRecalls.size} recalls to all subscribers?`)) {
      return;
    }

    setIsSending(true);
    setError(null);
    
    try {
      const recallIds = Array.from(selectedRecalls);
      const response = await api.sendManualDigest(recallIds);
      
      alert(`Digest sent successfully!\n- ${response.totalRecipients} recipients\n- ${response.recallCount} recalls`);
      
      // Clear selection after successful send
      setSelectedRecalls(new Set());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send digest');
      console.error('Manual digest send error:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Filter Section */}
      <div className={styles.filterSection}>
        <h2 className={styles.sectionTitle} style={{ color: currentTheme.text }}>
          Filter Recalls
        </h2>
        
        <div className={styles.filterControls}>
          {/* Source Selector */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} style={{ color: currentTheme.textSecondary }}>
              Source
            </label>
            <div className={styles.sourceButtons}>
              <button
                className={`${styles.sourceButton} ${source === 'USDA' ? styles.active : ''}`}
                onClick={() => setSource('USDA')}
                style={{
                  backgroundColor: source === 'USDA' ? currentTheme.buttonPrimary : 'transparent',
                  color: source === 'USDA' ? 'white' : currentTheme.text,
                  borderColor: currentTheme.primary
                }}
              >
                USDA
              </button>
              <button
                className={`${styles.sourceButton} ${source === 'FDA' ? styles.active : ''}`}
                onClick={() => setSource('FDA')}
                style={{
                  backgroundColor: source === 'FDA' ? currentTheme.buttonPrimary : 'transparent',
                  color: source === 'FDA' ? 'white' : currentTheme.text,
                  borderColor: currentTheme.primary
                }}
              >
                FDA
              </button>
              <button
                className={`${styles.sourceButton} ${source === 'both' ? styles.active : ''}`}
                onClick={() => setSource('both')}
                style={{
                  backgroundColor: source === 'both' ? currentTheme.buttonPrimary : 'transparent',
                  color: source === 'both' ? 'white' : currentTheme.text,
                  borderColor: currentTheme.primary
                }}
              >
                Both
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className={styles.filterGroup}>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            disabled={isLoading}
            className={styles.searchButton}
          >
            {isLoading ? 'Searching...' : 'Search Recalls'}
          </Button>
        </div>
      </div>

      {/* Results Section - Use EditableRecallList with selection */}
      {recalls.length > 0 && (
        <div style={{ marginTop: '-1rem', padding: '0 0.25rem' }}>
          <EditableRecallList
            recalls={recalls}
            loading={false}
            error={null}
            onEdit={handleEdit}
            enableSelection={true}
            selectedRecalls={selectedRecalls}
            onRecallSelect={handleRecallSelect}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            imageStats={imageStats}
          />
          
          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <Button
              onClick={handleSendTest}
              disabled={selectedRecalls.size === 0 || isSending}
              variant="secondary"
            >
              {isSending ? 'Sending...' : 'Send Test Email'}
            </Button>
            <Button
              onClick={handleSendToAll}
              disabled={selectedRecalls.size === 0 || isSending}
              variant="primary"
            >
              {isSending ? 'Sending...' : 'Send to All Subscribers'}
            </Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && editModal.recall && (
        <EditModal
          recall={editModal.recall}
          onClose={() => setEditModal({ isOpen: false, recall: null })}
          onSave={handleSaveEdit}
        />
      )}

      {/* Error State */}
      {error && (
        <div 
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: `${currentTheme.danger}20`,
            border: `1px solid ${currentTheme.danger}`,
            color: currentTheme.danger,
            marginBottom: '1rem',
            textAlign: 'center'
          }}
        >
          <p>{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && recalls.length === 0 && !error && (
        <div className={styles.emptyState}>
          <p style={{ color: currentTheme.textSecondary }}>
            Select filters and date range, then click "Search Recalls" to build a digest
          </p>
        </div>
      )}
    </div>
  );
}