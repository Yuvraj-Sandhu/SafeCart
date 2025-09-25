'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header } from '@/components/Header';
import { EditableRecallList } from '@/components/EditableRecallList';
import { RecallList } from '@/components/RecallList';
import { EditModal } from '@/components/EditModal';
import { Button } from '@/components/ui/Button';
import { pendingChangesApi } from '@/services/pending-changes.api';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { UnifiedRecall } from '@/types/recall.types';
import { PendingChange } from '@/types/pending-changes.types';
import styles from '../../../page.module.css';

export default function AdminPendingPage() {
  const { currentTheme } = useTheme();
  const router = useRouter();

  // Use shared pending changes hook to avoid duplicate API calls
  const { pendingChanges, loading, error } = usePendingChanges();

  // Local state for recalls display
  const [recalls, setRecalls] = useState<UnifiedRecall[]>([]);
  
  // Edit modal state (for admin review and editing)
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    recall: UnifiedRecall | null;
    mode: 'view' | 'edit';
  }>({
    isOpen: false,
    recall: null,
    mode: 'view'
  });

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Process pending changes from the shared hook into recalls for display
  useEffect(() => {
    // Create UnifiedRecall objects from pending changes data for display
    if (pendingChanges.length > 0) {
      const recallsFromPendingChanges = pendingChanges.map((change): UnifiedRecall => {
        // Use the full recall data from originalRecall
        const originalRecall = change.originalRecall;
        
        // Extract title from proposed display or original recall
        const displayTitle = change.proposedDisplay?.previewTitle ||
                           originalRecall?.display?.previewTitle ||
                           originalRecall?.productTitle ||
                           originalRecall?.product_title ||
                           originalRecall?.field_title ||
                           `Recall ${change.recallId}`;
        
        // Create a UnifiedRecall object using the original recall data
        const recall: UnifiedRecall = {
          id: change.recallId, // Use ORIGINAL recall ID for consistency
          recallNumber: originalRecall?.recallNumber || originalRecall?.recall_number || originalRecall?.field_recall_number || change.recallId,
          source: change.recallSource === 'TEMP_FDA' ? 'FDA' : change.recallSource,
          isTemp: change.recallSource === 'TEMP_FDA',
          isActive: originalRecall?.isActive ?? true,
          classification: originalRecall?.classification || originalRecall?.field_risk_level || originalRecall?.field_recall_classification || 'Pending Review',
          recallingFirm: originalRecall?.recallingFirm || originalRecall?.recalling_firm || originalRecall?.field_establishment || `Submitted by ${change.proposedBy.username}`,
          productTitle: displayTitle,
          productDescription: originalRecall?.productDescription || originalRecall?.product_description || originalRecall?.field_summary || originalRecall?.field_product_items || `Changes submitted on ${new Date(change.proposedAt).toLocaleDateString()}`,
          reasonForRecall: originalRecall?.reasonForRecall || originalRecall?.reason_for_recall || originalRecall?.field_recall_reason || 'Awaiting Admin Review',
          recallDate: originalRecall?.recallDate || originalRecall?.report_date || originalRecall?.field_recall_date || originalRecall?.date || change.proposedAt,
          affectedStates: originalRecall?.affectedStates || originalRecall?.affectedStatesArray || (originalRecall?.field_states ? originalRecall.field_states.split(', ') : ['Admin Review Required']),
          images: originalRecall?.images || originalRecall?.processedImages || [],
          scrapped_images: originalRecall?.scrapped_images,
          llmTitle: originalRecall?.llmTitle,
          recallInitiationDate: originalRecall?.recallInitiationDate || originalRecall?.recall_initiation_date || originalRecall?.alert_date,
          recallUrl: originalRecall?.recallUrl || originalRecall?.recall_url || originalRecall?.alert_url,
          display: change.proposedDisplay, // The proposed changes for review
          originalData: change // Store pending change for approve/reject actions
        };

        return recall;
      });

      setRecalls(recallsFromPendingChanges);
    } else {
      setRecalls([]);
    }
  }, [pendingChanges]); // Depend on pendingChanges from the hook

  const handleEditRecall = (recall: UnifiedRecall) => {
    // Create a recall with proposed changes pre-applied for direct editing
    const recallWithProposedChanges: UnifiedRecall = {
      ...recall.originalData?.originalRecall || recall,
      display: recall.display // Apply the proposed display changes
    };
    
    setEditModal({
      isOpen: true,
      recall: recallWithProposedChanges,
      mode: 'edit' // Allow direct editing with proposed changes pre-applied
    });
  };

  const handleReviewRecall = (recall: UnifiedRecall) => {
    setEditModal({
      isOpen: true,
      recall,
      mode: 'view' // Show approve/reject interface
    });
  };

  const handleSaveEdit = async (updatedRecall: UnifiedRecall) => {
    // For admins, this handles the review actions
    try {
      // The EditModal handles the actual API calls, we just need to refresh
      window.location.reload();
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      recall: null,
      mode: 'view'
    });
  };

  const handleApprove = async (changeId: string) => {
    try {
      setActionLoading(changeId);
      await pendingChangesApi.approvePendingChange(changeId);
      
      // Refresh the data to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Failed to approve change:', error);
      alert('Failed to approve change');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (changeId: string) => {
    try {
      setActionLoading(changeId);
      await pendingChangesApi.rejectPendingChange(changeId);
      
      // Refresh the data to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Failed to reject change:', error);
      alert('Failed to reject change');
    } finally {
      setActionLoading(null);
    }
  };


  if (loading) {
    return (
      <ProtectedRoute requireAdmin={true}>
        <main className={styles.main}>
          <Header subtitle="Pending Changes Review" />
          <div className="container">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '200px',
              color: currentTheme.textSecondary 
            }}>
              Loading pending changes...
            </div>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute requireAdmin={true}>
        <main className={styles.main}>
          <Header subtitle="Pending Changes Review" />
          <div className="container">
            <Button 
              variant="secondary"
              onClick={() => router.push('/internal/edit')}
            >
              Back to Edit
            </Button>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '200px',
              gap: '1rem'
            }}>
              <p style={{ color: currentTheme.danger }}>{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      <main className={styles.main}>
        <Header subtitle="Admin - Pending Changes Review" />

        <div className="container">
          {recalls.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '300px',
              gap: '1rem',
              textAlign: 'center'
            }}>
              <h3 style={{ color: currentTheme.text, margin: 0 }}>
                No Pending Changes
              </h3>
              <p style={{ color: currentTheme.textSecondary, margin: 0 }}>
                All changes have been reviewed. Great job!
              </p>
              <Button 
                variant="primary"
                onClick={() => router.push('/internal/edit')}
              >
                Back to Editing
              </Button>
            </div>
          ) : (
            <div>
              <div style={{ 
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: currentTheme.cardBackground,
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: '0.75rem'
              }}>
                <Button 
                  variant="primary"
                  onClick={() => router.push('/internal/edit')}
                >
                  Back to Edit
                </Button>
                <div>
                  <h3 style={{ 
                    color: currentTheme.text, 
                    margin: '1rem 0 0.5rem 0',
                    fontSize: '1.2rem'
                  }}>
                    Review Pending Changes ({pendingChanges.length})
                  </h3>
                  <p style={{ 
                    color: currentTheme.textSecondary, 
                    margin: 0,
                    fontSize: '1rem'
                  }}>
                    Review, approve, or reject changes submitted by team members. Click on any recall to view details and take action.
                  </p>
                </div>
              </div>

              <EditableRecallList
                recalls={recalls}
                loading={false}
                error={null}
                onEdit={handleEditRecall}
                onReview={handleReviewRecall}
                hidePendingBadges={true}
              />
            </div>
          )}
        </div>

        {/* Edit/Review Modal */}
        {editModal.isOpen && editModal.recall && (
          <>
            {editModal.mode === 'edit' ? (
              // Show EditModal for direct editing with proposed changes pre-applied
              <EditModal
                recall={editModal.recall}
                onClose={closeEditModal}
                onSave={handleSaveEdit}
              />
            ) : (
              // Show before/after comparison for review
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '2rem'
              }}>
                <div 
                  className={styles.reviewModalContent}
                  style={{
                    backgroundColor: currentTheme.background,
                    border: `1px solid ${currentTheme.cardBorder}`
                  }}
                >
                  {/* Header */}
                  <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <h3 style={{ color: currentTheme.text, margin: '0 0 0.5rem 0' }}>
                      Review Pending Change
                    </h3>
                    <p style={{ color: currentTheme.textSecondary, margin: '0 0 0.5rem 0' }}>
                      Recall ID: {editModal.recall.id}
                    </p>
                    <p style={{ color: currentTheme.textSecondary, margin: 0, fontSize: '0.875rem' }}>
                      Submitted by: {editModal.recall.originalData?.proposedBy.username} on {new Date(editModal.recall.originalData?.proposedAt || '').toLocaleDateString()}
                    </p>
                  </div>
                  
                  {/* Before/After Comparison */}
                  <div style={{ marginBottom: '2rem' }}>
                    {/* BEFORE - Original Recall */}
                    <div style={{ 
                      marginBottom: '1rem',
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%'
                    }}>
                      <RecallList
                        recalls={editModal.recall.originalData?.originalRecall ? [editModal.recall.originalData.originalRecall] : []}
                        loading={false}
                        error={null}
                        hideSearch={true}
                        hideScrollTop={true}
                        hideEndIndicator={true}
                        hideBottomSpacer={true}
                      />
                    </div>
                    
                    {/* Downward Arrow */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center',
                      alignItems: 'center',
                      margin: '1.5rem 0'
                    }}>
                      <svg 
                        viewBox="0 0 46 40" 
                        style={{
                          width: '40px',
                          height: '35px',
                          fill: currentTheme.primary,
                          transform: 'rotate(90deg)'
                        }}
                      >
                        <path d="M46 20.038c0-.7-.3-1.5-.8-2.1l-16-17c-1.1-1-3.2-1.4-4.4-.3-1.2 1.1-1.2 3.3 0 4.4l11.3 11.9H3c-1.7 0-3 1.3-3 3s1.3 3 3 3h33.1l-11.3 11.9c-1 1-1.2 3.3 0 4.4 1.2 1.1 3.3.8 4.4-.3l16-17c.5-.5.8-1.1.8-1.9z" />
                      </svg>
                    </div>
                    
                    {/* AFTER - Proposed Changes */}
                    <div style={{ 
                      marginBottom: '1rem',
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%'
                    }}>
                      <RecallList
                        recalls={editModal.recall.originalData?.originalRecall ? [{
                          ...editModal.recall.originalData.originalRecall,
                          display: editModal.recall.originalData.proposedDisplay
                        }] : []}
                        loading={false}
                        error={null}
                        hideSearch={true}
                        hideScrollTop={true}
                        hideEndIndicator={true}
                        hideBottomSpacer={true}
                      />
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ 
                    borderTop: `1px solid ${currentTheme.cardBorder}`
                  }} className={styles.reviewModalFooter}>
                    {/* Red Reject button on the left */}
                    <div>
                      <Button
                        variant="primary"
                        onClick={() => {
                          if (editModal.recall?.originalData) {
                            handleReject(editModal.recall.originalData.id);
                            closeEditModal();
                          }
                        }}
                        disabled={actionLoading !== null}
                        style={{ 
                          backgroundColor: currentTheme.danger, 
                          color: 'white',
                          border: 'none'
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                    {/* Close and Approve buttons on the right */}
                    <div className={styles.reviewModalButtons}>
                      <Button
                        variant="secondary"
                        onClick={closeEditModal}
                      >
                        Close
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => {
                          if (editModal.recall?.originalData) {
                            handleApprove(editModal.recall.originalData.id);
                            closeEditModal();
                          }
                        }}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading ? 'Approving...' : 'Approve'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}