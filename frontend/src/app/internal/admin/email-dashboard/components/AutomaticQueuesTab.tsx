'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { EditableRecallList } from '@/components/EditableRecallList';
import { EditModal } from '@/components/EditModal';
import { UnifiedRecall } from '@/types/recall.types';
import { api } from '@/services/api';
import styles from './AutomaticQueuesTab.module.css';

interface QueueData {
  id: string;
  type: 'USDA_DAILY' | 'FDA_WEEKLY';
  status: 'pending' | 'processing' | 'sent' | 'cancelled';
  recallIds: string[]; // Just store IDs
  scheduledFor: string | null; // ISO string
  createdAt: string; // ISO string  
  lastUpdated: string; // ISO string
}

interface QueuePreviewData {
  queue: QueueData;
  recalls: UnifiedRecall[];
  imageStats: {
    total: number;
    withImages: number;
  };
}

export function AutomaticQueuesTab() {
  const { currentTheme } = useTheme();
  const [usdaQueue, setUsdaQueue] = useState<QueueData | null>(null);
  const [fdaQueue, setFdaQueue] = useState<QueueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref to prevent double API calls in development (React StrictMode)
  const hasFetched = useRef(false);
  
  // Preview modal state
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    queueType: 'USDA_DAILY' | 'FDA_WEEKLY' | null;
    data: QueuePreviewData | null;
    selectedRecalls: Set<string>;
    loading: boolean;
  }>({
    isOpen: false,
    queueType: null,
    data: null,
    selectedRecalls: new Set(),
    loading: false
  });

  // Edit modal state for editing recalls within preview
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    recall: UnifiedRecall | null;
  }>({
    isOpen: false,
    recall: null
  });

  useEffect(() => {
    // Prevent double API calls in React StrictMode (development)
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    loadQueues();
  }, []);

  const loadQueues = async () => {
    setIsLoading(true);
    try {
      const response = await api.getQueues();
      
      // Backend now returns properly formatted ISO date strings
      
      setUsdaQueue(response.data.usda);
      setFdaQueue(response.data.fda);
    } catch (error) {
      console.error('Failed to load queues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async (queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    setPreviewModal(prev => ({ ...prev, loading: true, isOpen: true, queueType }));
    
    try {
      const response = await api.getQueuePreview(queueType);
      const previewData = response.data;
      
      // Transform RecallData to UnifiedRecall format for EditableRecallList
      const transformedRecalls = previewData.recalls.map((recall: any) => ({
        ...recall,
        // Map RecallData fields to UnifiedRecall fields
        productTitle: recall.title,
        recallingFirm: recall.company,
        productDescription: recall.description,
        reasonForRecall: recall.reason,
        affectedStates: recall.affectedStates || [],
        // Set required fields with defaults
        source: recall.source,
        isActive: true,
        classification: recall.classification,
        // Transform primaryImage string to images array structure
        images: recall.primaryImage ? [{
          storageUrl: recall.primaryImage,
          type: 'image',
          filename: `${recall.id}_primary`
        }] : [],
        // Set recallUrl if available
        recallUrl: recall.recallUrl,
        originalData: recall
      }));
      
      // All recalls are initially selected
      const allRecallIds = new Set<string>(transformedRecalls.map((r: UnifiedRecall) => r.id));
      
      setPreviewModal({
        isOpen: true,
        queueType,
        data: {
          ...previewData,
          recalls: transformedRecalls
        },
        selectedRecalls: allRecallIds,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load queue preview:', error);
      setPreviewModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSendNow = async (queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    if (confirm(`Are you sure you want to send the ${queueType === 'USDA_DAILY' ? 'USDA' : 'FDA'} queue now?`)) {
      console.log('Sending queue:', queueType);
      try {
        const result = await api.sendQueue(queueType);
        alert(`Queue sent successfully!\n- ${result.totalRecipients} recipients\n- ${result.recallCount} recalls`);
        await loadQueues();
      } catch (error) {
        console.error('Failed to send queue:', error);
        alert('Failed to send queue. Please try again.');
      }
    }
  };

  const handleCancel = async (queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    const queueName = queueType === 'USDA_DAILY' ? 'USDA daily' : 'FDA weekly';
    if (confirm(`Are you sure you want to cancel and delete the ${queueName} queue? This cannot be undone.`)) {
      console.log('Cancelling queue:', queueType);
      try {
        await api.cancelQueue(queueType);
        alert(`${queueName} queue cancelled successfully.`);
        await loadQueues();
      } catch (error) {
        console.error('Failed to cancel queue:', error);
        alert('Failed to cancel queue. Please try again.');
      }
    }
  };

  const handleRecallSelect = (recallId: string) => {
    setPreviewModal(prev => {
      const newSelected = new Set(prev.selectedRecalls);
      if (newSelected.has(recallId)) {
        newSelected.delete(recallId);
      } else {
        newSelected.add(recallId);
      }
      return { ...prev, selectedRecalls: newSelected };
    });
  };

  const handleSelectAll = () => {
    if (!previewModal.data) return;
    const allRecallIds = new Set(previewModal.data.recalls.map(r => r.id));
    setPreviewModal(prev => ({ ...prev, selectedRecalls: allRecallIds }));
  };

  const handleDeselectAll = () => {
    setPreviewModal(prev => ({ ...prev, selectedRecalls: new Set() }));
  };

  const handleEditInPreview = (recall: UnifiedRecall) => {
    setEditModal({
      isOpen: true,
      recall
    });
  };

  const handleSaveEdit = async (updatedRecall: UnifiedRecall) => {
    // Update the recall in the preview data
    if (previewModal.data) {
      const updatedRecalls = previewModal.data.recalls.map(r => 
        r.id === updatedRecall.id ? updatedRecall : r
      );
      
      setPreviewModal(prev => ({
        ...prev,
        data: {
          ...prev.data!,
          recalls: updatedRecalls
        }
      }));
    }
    
    // Close edit modal
    setEditModal({ isOpen: false, recall: null });
    console.log('Recall updated successfully in queue preview');
  };

  const handleSaveChanges = async () => {
    if (!previewModal.data || !previewModal.queueType) return;
    
    const originalRecallIds = previewModal.data.queue.recallIds;
    const selectedRecallIds = Array.from(previewModal.selectedRecalls);
    
    // Check if there are changes
    const hasChanges = originalRecallIds.length !== selectedRecallIds.length ||
                       !originalRecallIds.every(id => previewModal.selectedRecalls.has(id));
    
    if (hasChanges) {
      try {
        console.log('Saving queue changes:', {
          queueType: previewModal.queueType,
          originalCount: originalRecallIds.length,
          selectedCount: selectedRecallIds.length,
          removedRecalls: originalRecallIds.filter(id => !previewModal.selectedRecalls.has(id))
        });
        
        await api.updateQueue(previewModal.queueType, selectedRecallIds);
        
        // Update local state
        if (previewModal.queueType === 'USDA_DAILY') {
          setUsdaQueue(prev => prev ? { ...prev, recallIds: selectedRecallIds, lastUpdated: new Date().toISOString() } : null);
        } else {
          setFdaQueue(prev => prev ? { ...prev, recallIds: selectedRecallIds, lastUpdated: new Date().toISOString() } : null);
        }
        
        // Close modal
        setPreviewModal({ isOpen: false, queueType: null, data: null, selectedRecalls: new Set(), loading: false });
      } catch (error) {
        console.error('Failed to update queue:', error);
      }
    } else {
      // No changes, just close
      setPreviewModal({ isOpen: false, queueType: null, data: null, selectedRecalls: new Set(), loading: false });
    }
  };

  const handleClosePreview = () => {
    setPreviewModal({ isOpen: false, queueType: null, data: null, selectedRecalls: new Set(), loading: false });
  };

  const formatScheduleTime = (dateISOString: string | null, queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    if (queueType === 'FDA_WEEKLY') {
      return 'Manual send required';
    }
    if (!dateISOString) return 'Not scheduled';
    
    const date = new Date(dateISOString);
    
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Today ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        timeZoneName: 'short' 
      })}`;
    }
    
    return date.toLocaleString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const renderQueue = (queue: QueueData | null, title: string) => {
    if (!queue) {
      return (
        <div className={styles.queueCard} style={{ 
          backgroundColor: currentTheme.cardBackground,
          borderColor: currentTheme.cardBorder 
        }}>
          <h3 className={styles.queueTitle} style={{ color: currentTheme.text }}>
            {title}
          </h3>
          <div className={styles.emptyQueue} style={{ color: currentTheme.textSecondary }}>
            No recalls in queue
          </div>
        </div>
      );
    }

    const isUSDA = queue.type === 'USDA_DAILY';

    return (
      <div className={styles.queueCard} style={{ 
        backgroundColor: currentTheme.cardBackground,
        borderColor: currentTheme.cardBorder 
      }}>
        <div className={styles.queueHeader}>
          <h3 className={styles.queueTitle} style={{ color: currentTheme.text }}>
            {title}
          </h3>
          <span 
            className={styles.queueBadge}
            style={{ 
              backgroundColor: queue.status === 'pending' ? `${currentTheme.warning}20` : 
                             queue.status === 'processing' ? `${currentTheme.info}20` : 
                             queue.status === 'sent' ? `${currentTheme.success}20` : `${currentTheme.danger}20`,
              color: queue.status === 'pending' ? currentTheme.warning : 
                     queue.status === 'processing' ? currentTheme.info : 
                     queue.status === 'sent' ? currentTheme.success : currentTheme.danger
            }}
          >
            {queue.recallIds.length} recalls {queue.status}
          </span>
        </div>

        {/* Queue Status */}
        <div className={styles.queueStatus}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel} style={{ color: currentTheme.textSecondary }}>
              Next Run:
            </span>
            <span className={styles.statusValue} style={{ 
              color: isUSDA ? currentTheme.warning : currentTheme.text 
            }}>
              {formatScheduleTime(queue.scheduledFor, queue.type)}
            </span>
          </div>
          
          <div className={styles.statusItem}>
            <span className={styles.statusLabel} style={{ color: currentTheme.textSecondary }}>
              Recalls:
            </span>
            <span className={styles.statusValue} style={{ color: currentTheme.text }}>
              {queue.recallIds.length} queued
            </span>
          </div>
        </div>

        {/* Queue Summary */}
        <div className={styles.queueSummary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel} style={{ color: currentTheme.textSecondary }}>
              Created:
            </span>
            <span className={styles.summaryValue} style={{ color: currentTheme.text }}>
              {new Date(queue.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel} style={{ color: currentTheme.textSecondary }}>
              Last Updated:
            </span>
            <span className={styles.summaryValue} style={{ color: currentTheme.text }}>
              {new Date(queue.lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.queueActions}>
          <Button
            onClick={() => handlePreview(queue.type)}
            variant="secondary"
            size="small"
          >
            Preview
          </Button>
          <Button
            onClick={() => handleSendNow(queue.type)}
            variant="primary"
            size="small"
          >
            Send Now
          </Button>
          <Button
            onClick={() => handleCancel(queue.type)}
            variant="secondary"
            size="small"
          >
            {isUSDA ? 'Cancel Today' : 'Cancel Queue'}
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading} style={{ color: currentTheme.textSecondary }}>
          Loading queues...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.description} style={{ color: currentTheme.textSecondary }}>
        Manage automatic email queues created by sync services. USDA queue auto-sends at 5pm ET daily, 
        while FDA queue requires manual sending.
      </div>
      
      <div className={styles.queuesGrid}>
        {renderQueue(usdaQueue, 'USDA Daily Queue')}
        {renderQueue(fdaQueue, 'FDA Weekly Queue')}
      </div>
      
      {/* Preview Modal */}
      {previewModal.isOpen && (
        <div className={styles.modalOverlay}>
          <div 
            className={styles.modalContent}
            style={{
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.cardBorder
            }}
          >
            <div className={styles.modalHeader}>
              <h2 style={{ color: currentTheme.text }}>
                {previewModal.queueType === 'USDA_DAILY' ? 'USDA Daily' : 'FDA Weekly'} Queue Preview
              </h2>
              <button 
                className={styles.closeButton}
                onClick={handleClosePreview}
                style={{ color: currentTheme.textSecondary }}
              >
                ×
              </button>
            </div>
            
            {previewModal.loading ? (
              <div className={styles.modalLoading} style={{ color: currentTheme.textSecondary }}>
                Loading preview...
              </div>
            ) : previewModal.data ? (
              <>
                <div className={styles.modalInfo}>
                  <div style={{ color: currentTheme.textSecondary }}>
                    Deselected recalls will be removed from the queue.
                  </div>
                </div>
                
                <div className={`${styles.modalRecalls} modalContainer`}>
                  <EditableRecallList
                    recalls={previewModal.data.recalls}
                    loading={false}
                    error={null}
                    onEdit={handleEditInPreview} // Enable edit functionality in preview
                    enableSelection={true}
                    selectedRecalls={previewModal.selectedRecalls}
                    onRecallSelect={handleRecallSelect}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    imageStats={previewModal.data.imageStats}
                  />
                </div>
                
                <div className={styles.modalActions}>
                  <Button onClick={handleClosePreview} variant="secondary">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveChanges}
                    variant="primary"
                    disabled={previewModal.selectedRecalls.size === 0}
                  >
                    Save Changes ({previewModal.selectedRecalls.size} selected)
                  </Button>
                </div>
              </>
            ) : (
              <div className={styles.modalError} style={{ color: currentTheme.danger }}>
                Failed to load preview data
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Edit Modal for editing recalls within preview */}
      {editModal.isOpen && editModal.recall && (
        <EditModal
          recall={editModal.recall}
          onClose={() => setEditModal({ isOpen: false, recall: null })}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}