'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header } from '@/components/Header';
import { EditableRecallList } from '@/components/EditableRecallList';
import { EditModal } from '@/components/EditModal';
import { Button } from '@/components/ui/Button';
import { pendingChangesApi } from '@/services/pending-changes.api';
import { UnifiedRecall } from '@/types/recall.types';
import { PendingChange } from '@/types/pending-changes.types';
import styles from '../../../page.module.css';

export default function AdminPendingPage() {
  const { currentTheme } = useTheme();
  const router = useRouter();

  // Data states
  const [recalls, setRecalls] = useState<UnifiedRecall[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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

  // Fetch all pending changes for admin review
  useEffect(() => {
    const fetchPendingData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all pending changes
        const allPendingChanges = await pendingChangesApi.getAllPendingChanges();
        setPendingChanges(allPendingChanges);

        // Create UnifiedRecall objects from pending changes data for display
        if (allPendingChanges.length > 0) {
          const recallsFromPendingChanges = allPendingChanges.map((change): UnifiedRecall => {
            // Use the full recall data from originalRecall
            const originalRecall = change.originalRecall;
            
            // Extract title from proposed display or original recall
            const displayTitle = change.proposedDisplay?.previewTitle || 
                               originalRecall?.display?.previewTitle ||
                               originalRecall?.productTitle ||
                               originalRecall?.field_title ||
                               `Recall ${change.recallId}`;
            
            // Create a UnifiedRecall object using the original recall data
            const recall: UnifiedRecall = {
              id: change.recallId, // Use ORIGINAL recall ID for consistency
              recallNumber: originalRecall?.recallNumber || change.recallId,
              source: change.recallSource,
              isActive: originalRecall?.isActive ?? true,
              classification: originalRecall?.classification || originalRecall?.field_risk_level || 'Pending Review',
              recallingFirm: originalRecall?.recallingFirm || originalRecall?.recalling_firm || `Submitted by ${change.proposedBy.username}`,
              productTitle: displayTitle,
              productDescription: originalRecall?.productDescription || originalRecall?.field_summary || `Changes submitted on ${new Date(change.proposedAt).toLocaleDateString()}`,
              reasonForRecall: originalRecall?.reasonForRecall || originalRecall?.reason_for_recall || 'Awaiting Admin Review',
              recallDate: originalRecall?.recallDate || originalRecall?.report_date || change.proposedAt,
              affectedStates: originalRecall?.affectedStates || originalRecall?.affectedStatesArray || ['Admin Review Required'],
              images: originalRecall?.images || originalRecall?.processedImages || [],
              display: change.proposedDisplay, // The proposed changes for review
              originalData: change // Store pending change for approve/reject actions
            };

            return recall;
          });

          setRecalls(recallsFromPendingChanges);
        } else {
          setRecalls([]);
        }
      } catch (err) {
        console.error('Failed to fetch pending data:', err);
        setError('Failed to load pending changes');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingData();
  }, []);

  const handleEditRecall = (recall: UnifiedRecall) => {
    setEditModal({
      isOpen: true,
      recall,
      mode: 'view' // Admins start in view mode to review changes
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
    const reason = prompt('Please provide a reason for rejecting this change:');
    if (reason && reason.trim()) {
      try {
        setActionLoading(changeId);
        await pendingChangesApi.rejectPendingChange(changeId, reason.trim());
        
        // Refresh the data to show updated status
        window.location.reload();
      } catch (error) {
        console.error('Failed to reject change:', error);
        alert('Failed to reject change');
      } finally {
        setActionLoading(null);
      }
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
        <Header subtitle="Pending Changes Review" />

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
                hidePendingBadges={true}
              />
            </div>
          )}
        </div>

        {/* Admin Review Modal */}
        {editModal.isOpen && editModal.recall && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}>
            <div style={{
              backgroundColor: currentTheme.cardBackground,
              border: `1px solid ${currentTheme.cardBorder}`,
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: currentTheme.text, margin: '0 0 1rem 0' }}>
                  Review Pending Change
                </h3>
                <p style={{ color: currentTheme.textSecondary, margin: '0 0 1rem 0' }}>
                  Recall ID: {editModal.recall.id}
                </p>
                <p style={{ color: currentTheme.textSecondary, margin: 0 }}>
                  {editModal.recall.recallingFirm}
                </p>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
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
                      handleApprove(editModal.recall.originalData.id); // Use pending change ID from originalData
                      closeEditModal();
                    }
                  }}
                  disabled={actionLoading !== null}
                  style={{ backgroundColor: currentTheme.success }}
                >
                  {actionLoading ? 'Approving...' : 'Approve'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (editModal.recall?.originalData) {
                      handleReject(editModal.recall.originalData.id); // Use pending change ID from originalData
                      closeEditModal();
                    }
                  }}
                  disabled={actionLoading !== null}
                  style={{ backgroundColor: currentTheme.danger, color: 'white' }}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}